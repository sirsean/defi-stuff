/**
 * Flex Public Service - Read-only operations
 * Provides read-only access to Flex Perpetuals on Base mainnet
 */

import { ethers } from "ethers";
import {
  FLEX_ADDRESSES,
  MARKETS,
  TOKENS,
  FLEX_CONSTANTS,
  BASE_CHAIN_ID,
} from "./constants.js";
import { chainlinkOracle } from "../chainlink/chainlinkOracle.js";
import {
  getProvider,
  assertBaseNetwork,
  computeSubAccount,
  fromE30,
  fromToken,
  multicall,
  calculatePnL,
  calculateFundingFee,
  calculateBorrowingFee,
  calculateLeverage,
  calculateLiquidationPrice,
  type MulticallCall,
} from "./utils.js";
import type {
  MarketData,
  CollateralInfo,
  EquityData,
  LeverageInfo,
} from "../../types/flex.js";

/**
 * Lightweight position data returned by public service
 * (full Position type in types/flex.ts has more detailed fields)
 */
export interface PositionData {
  marketIndex: number;
  symbol: string;
  isLong: boolean;
  size: number; // USD
  sizeE30: bigint;
  avgEntryPrice: number;
  currentPrice: number;
  unrealizedPnl: number;
  fundingFee: number;
  borrowingFee: number;
  tradingFee: number;
  liquidationPrice: number;
  leverage: number;
}

// Import contract ABIs
import PerpStorageABI from "./contracts/PerpStorage.json" with { type: "json" };
import ConfigStorageABI from "./contracts/ConfigStorage.json" with { type: "json" };
import VaultStorageABI from "./contracts/VaultStorage.json" with { type: "json" };
import CalculatorABI from "./contracts/Calculator.json" with { type: "json" };
import OrderbookOracleABI from "./contracts/OrderbookOracle.json" with { type: "json" };
import OnchainPricelensABI from "./contracts/OnchainPricelens.json" with { type: "json" };
import LimitTradeHandlerABI from "./contracts/LimitTradeHandler.json" with { type: "json" };

/**
 * FlexPublicService - Read-only operations for Flex Perpetuals
 */
export class FlexPublicService {
  private provider: ethers.Provider;
  private perpStorage: ethers.Contract;
  private configStorage: ethers.Contract;
  private vaultStorage: ethers.Contract;
  private calculator: ethers.Contract;
  private orderbookOracle: ethers.Contract;
  private onchainPricelens: ethers.Contract;
  private limitTradeHandler: ethers.Contract;

  constructor(provider?: ethers.Provider) {
    this.provider = provider || getProvider();

    // Initialize contract instances
    this.perpStorage = new ethers.Contract(
      FLEX_ADDRESSES.PERP_STORAGE,
      PerpStorageABI,
      this.provider,
    );

    this.configStorage = new ethers.Contract(
      FLEX_ADDRESSES.CONFIG_STORAGE,
      ConfigStorageABI,
      this.provider,
    );

    this.vaultStorage = new ethers.Contract(
      FLEX_ADDRESSES.VAULT_STORAGE,
      VaultStorageABI,
      this.provider,
    );

    this.calculator = new ethers.Contract(
      FLEX_ADDRESSES.CALCULATOR,
      CalculatorABI,
      this.provider,
    );

    this.orderbookOracle = new ethers.Contract(
      FLEX_ADDRESSES.ORDERBOOK_ORACLE,
      OrderbookOracleABI,
      this.provider,
    );

    this.onchainPricelens = new ethers.Contract(
      FLEX_ADDRESSES.ONCHAIN_PRICELENS,
      OnchainPricelensABI,
      this.provider,
    );

    this.limitTradeHandler = new ethers.Contract(
      FLEX_ADDRESSES.LIMIT_TRADE_HANDLER,
      LimitTradeHandlerABI,
      this.provider,
    );
  }

  /**
   * Validate that we're connected to Base network
   */
  async validateNetwork(): Promise<void> {
    await assertBaseNetwork(this.provider);
  }

  // ============================================================================
  // MARKET DATA QUERIES
  // ============================================================================

  /**
   * Get current market price from oracle
   * Uses Chainlink price feeds on Base for BTC and ETH
   * @param marketIndex Market index (e.g., 1 for BTC)
   * @returns Market data with current price
   */
  async getMarketPrice(marketIndex: number): Promise<MarketData> {
    await this.validateNetwork();

    const market = Object.values(MARKETS).find((m) => m.index === marketIndex);

    if (!market) {
      throw new Error(`Market index ${marketIndex} not found`);
    }

    let price: number;

    // Use Chainlink oracle for BTC and ETH
    if (market.symbol === "BTC") {
      price = await chainlinkOracle.getBtcUsd();
    } else if (market.symbol === "ETH") {
      price = await chainlinkOracle.getEthUsd();
    } else {
      // For other markets, we don't have Chainlink feeds yet
      throw new Error(
        `Chainlink price feed not available for ${market.symbol}. Only BTC and ETH are supported.`,
      );
    }

    // Convert price to e30 format (used by Flex)
    const priceE30 = BigInt(Math.floor(price * 1e30));

    return {
      marketIndex,
      symbol: market.symbol,
      assetId: market.assetId,
      price,
      priceE30,
      timestamp: Math.floor(Date.now() / 1000),
      oracleType: "chainlink", // Using Chainlink oracle
    };
  }

  /**
   * Get market configuration and limits
   */
  async getMarketInfo(marketIndex: number) {
    await this.validateNetwork();

    const market = Object.values(MARKETS).find((m) => m.index === marketIndex);

    if (!market) {
      throw new Error(`Market index ${marketIndex} not found`);
    }

    // Get market config from ConfigStorage
    try {
      const marketConfig =
        await this.configStorage.getMarketConfigByIndex(marketIndex);

      if (!marketConfig) {
        throw new Error(`No market config found for market ${marketIndex}`);
      }

      // Market config struct:
      // - initialMarginFractionBPS: BPS for initial margin (e.g., 200 = 2% = 50x leverage)
      // - fundingRate.maxSkewScaleUSD: Max skew scale
      // - fundingRate.maxFundingRate: Max funding rate (e30)

      const initialMarginBPS = Number(marketConfig.initialMarginFractionBPS);
      const maxLeverage =
        initialMarginBPS > 0 ? Math.floor(10000 / initialMarginBPS) : 0;

      // Note: maxFundingRate is in e18, not e30
      // maxSkewScaleUSD is in e30
      const maxFundingRate = marketConfig.fundingRate
        ? Number(marketConfig.fundingRate.maxFundingRate) / 1e18
        : 0;

      return {
        marketIndex,
        symbol: market.symbol,
        assetId: market.assetId,
        maxLeverage,
        maxSkewScale: marketConfig.fundingRate
          ? fromE30(marketConfig.fundingRate.maxSkewScaleUSD).toString()
          : "0",
        maxFundingRate,
        fundingRateFactor: 0, // Not directly available, would need calculation
      };
    } catch (error: any) {
      throw new Error(
        `Failed to get market config for ${market.symbol} (index ${marketIndex}): ${error.message}`,
      );
    }
  }

  /**
   * Get current funding rate for a market
   */
  async getFundingRate(marketIndex: number) {
    await this.validateNetwork();

    const market = Object.values(MARKETS).find((m) => m.index === marketIndex);

    if (!market) {
      throw new Error(`Market index ${marketIndex} not found`);
    }

    // Get global state which includes funding info
    const globalState = await this.perpStorage.getGlobalState();
    const marketState = await this.perpStorage.getMarketByIndex(marketIndex);

    // Note: currentFundingRate and fundingAccrued are in e18, not e30
    // Position sizes are in e30
    const currentFundingRate = Number(marketState.currentFundingRate) / 1e18;
    const fundingAccrued = Number(marketState.fundingAccrued) / 1e18;

    return {
      marketIndex,
      symbol: market.symbol,
      currentFundingRate,
      fundingAccrued,
      lastFundingTime: Number(marketState.lastFundingTime),
      longPositionSize: fromE30(marketState.longPositionSize),
      shortPositionSize: fromE30(marketState.shortPositionSize),
    };
  }

  // ============================================================================
  // POSITION QUERIES
  // ============================================================================

  /**
   * Get position for a specific market and wallet address
   */
  async getPosition(
    account: string,
    marketIndex: number,
  ): Promise<PositionData | null> {
    await this.validateNetwork();

    const market = Object.values(MARKETS).find((m) => m.index === marketIndex);

    if (!market) {
      throw new Error(`Market index ${marketIndex} not found`);
    }

    // Get all positions for this account
    const allPositions = await this.perpStorage.getPositionBySubAccount(account);

    // Find the position for the requested market
    const positionData = allPositions.find(
      (p: any) => Number(p.marketIndex) === marketIndex,
    );

    // Check if position exists (non-zero size)
    if (!positionData || positionData.positionSizeE30 === 0n) {
      return null;
    }

    // Get current market price for PnL calculation
    const marketData = await this.getMarketPrice(marketIndex);

    // Get market state for funding
    const marketState = await this.perpStorage.getMarketByIndex(marketIndex);

    const size = fromE30(positionData.positionSizeE30);
    const avgEntryPrice = fromE30(positionData.avgEntryPriceE30);
    const isLong = size > 0;
    const absSize = Math.abs(size);

    // Calculate unrealized PnL
    const unrealizedPnl = fromE30(
      calculatePnL(
        isLong,
        positionData.positionSizeE30,
        positionData.avgEntryPriceE30,
        marketData.priceE30,
      ),
    );

    // Calculate funding fee
    const fundingFee = fromE30(
      calculateFundingFee(
        positionData.positionSizeE30,
        marketState.fundingAccrued,
        positionData.lastFundingAccrued,
      ),
    );

    // Calculate borrowing fee
    const borrowingFee = fromE30(
      calculateBorrowingFee(
        positionData.reserveValueE30,
        marketState.borrowingRate,
        positionData.entryBorrowingRate,
      ),
    );

    return {
      marketIndex,
      symbol: market.symbol,
      isLong,
      size: absSize,
      sizeE30: positionData.positionSizeE30,
      avgEntryPrice,
      currentPrice: marketData.price,
      unrealizedPnl,
      fundingFee,
      borrowingFee,
      tradingFee: 0, // Trading fee not stored in position data
      liquidationPrice: 0, // Will calculate below if we have equity
      leverage: 0, // Will calculate below if we have equity
    };
  }

  /**
   * Get all open positions for an account across all markets
   */
  async getAllPositions(account: string): Promise<PositionData[]> {
    await this.validateNetwork();

    // Get all positions from PerpStorage
    const allPositions = await this.perpStorage.getPositionBySubAccount(account);

    const positions: PositionData[] = [];

    // Process each position
    for (const positionData of allPositions) {
      // Skip positions with zero size
      if (positionData.positionSizeE30 === 0n) {
        continue;
      }

      const marketIndex = Number(positionData.marketIndex);
      const market = Object.values(MARKETS).find((m) => m.index === marketIndex);

      if (!market) {
        console.warn(`Unknown market index ${marketIndex}, skipping`);
        continue;
      }

      // Get current market price for PnL calculation
      const marketData = await this.getMarketPrice(marketIndex);

      // Get market state for funding
      const marketState = await this.perpStorage.getMarketByIndex(marketIndex);

      const size = fromE30(positionData.positionSizeE30);
      const avgEntryPrice = fromE30(positionData.avgEntryPriceE30);
      const isLong = size > 0;
      const absSize = Math.abs(size);

      // Calculate unrealized PnL
      const unrealizedPnl = fromE30(
        calculatePnL(
          isLong,
          positionData.positionSizeE30,
          positionData.avgEntryPriceE30,
          marketData.priceE30,
        ),
      );

      // Calculate funding fee
      const fundingFee = fromE30(
        calculateFundingFee(
          positionData.positionSizeE30,
          marketState.fundingAccrued,
          positionData.lastFundingAccrued,
        ),
      );

      // Calculate borrowing fee
      const borrowingFee = fromE30(
        calculateBorrowingFee(
          positionData.reserveValueE30,
          marketState.borrowingRate,
          positionData.entryBorrowingRate,
        ),
      );

      positions.push({
        marketIndex,
        symbol: market.symbol,
        isLong,
        size: absSize,
        sizeE30: positionData.positionSizeE30,
        avgEntryPrice,
        currentPrice: marketData.price,
        unrealizedPnl,
        fundingFee,
        borrowingFee,
        tradingFee: 0, // Trading fee not stored in position data
        liquidationPrice: 0, // Will calculate if needed
        leverage: 0, // Will calculate if needed
      });
    }

    return positions;
  }

  // ============================================================================
  // COLLATERAL & EQUITY QUERIES
  // ============================================================================

  /**
   * Get collateral balance for a wallet address
   * Queries USDC collateral directly from VaultStorage
   */
  async getCollateral(account: string): Promise<CollateralInfo> {
    try {
      await this.validateNetwork();

      // Get USDC collateral from VaultStorage
      const usdcToken = TOKENS.USDC;

      // Query traderBalances with wallet address and USDC token address
      // Returns balance in USDC's native decimals (6 decimals)
      const balanceRaw = await this.vaultStorage.traderBalances(
        account,
        usdcToken.address,
      );

      // Convert from USDC's 6 decimals to human-readable number
      const balance = fromToken(balanceRaw, usdcToken.decimals);

      return {
        token: "USDC",
        tokenAddress: usdcToken.address,
        balance,
        balanceRaw,
      };
    } catch (error: any) {
      throw new Error(
        `Failed to get collateral for account ${account}: ${error.message}`,
      );
    }
  }

  /**
   * Get equity (collateral + unrealized PnL) for a wallet address
   */
  async getEquity(account: string): Promise<EquityData> {
    await this.validateNetwork();

    // Get collateral (stored at wallet level)
    const collateral = await this.getCollateral(account);

    // Get all positions for this account
    const positions = await this.getAllPositions(account);

    // Calculate total unrealized PnL and fees from all positions
    let totalUnrealizedPnl = 0;
    let totalFees = 0;

    for (const position of positions) {
      totalUnrealizedPnl += position.unrealizedPnl;
      totalFees += position.fundingFee + position.borrowingFee;
    }

    // Equity = collateral + unrealized PnL - fees
    const equity = collateral.balance + totalUnrealizedPnl - totalFees;

    return {
      subAccountId: 0, // Deprecated field
      subAccount: account,
      collateral: collateral.balance,
      unrealizedPnl: totalUnrealizedPnl,
      fees: totalFees,
      equity,
      positions,
    };
  }

  /**
   * Get leverage information for a wallet address
   */
  async getLeverage(account: string): Promise<LeverageInfo> {
    await this.validateNetwork();

    const equity = await this.getEquity(account);

    // Calculate total position size
    // Note: position.size is already in USD terms
    let totalPositionSize = 0;
    for (const position of equity.positions) {
      totalPositionSize += position.size;
    }

    const leverage = calculateLeverage(totalPositionSize, equity.equity);

    return {
      subAccountId: 0, // Deprecated field
      equity: equity.equity,
      totalPositionSize,
      leverage,
      availableMargin: equity.equity,
    };
  }

  /**
   * Get available margin for new positions
   */
  async getAvailableMargin(
    account: string,
    targetLeverage: number = 1,
  ): Promise<number> {
    await this.validateNetwork();

    const leverageInfo = await this.getLeverage(account);

    // Available margin considering target leverage
    const availableForNewPositions =
      leverageInfo.equity * targetLeverage - leverageInfo.totalPositionSize;

    return Math.max(0, availableForNewPositions);
  }

  // ============================================================================
  // PENDING ORDERS
  // ============================================================================

  /**
   * Get pending limit/trigger orders for a wallet address
   */
  async getPendingOrders(account: string): Promise<any[]> {
    await this.validateNetwork();

    // Query limit orders from LimitTradeHandler
    // Note: This depends on the contract's interface for querying orders
    // Will need to check the actual ABI for the correct method
    try {
      const orders = await this.limitTradeHandler.getLimitOrders(account);
      return orders;
    } catch (error) {
      // If method doesn't exist or fails, return empty array
      console.warn("Unable to fetch pending orders:", error);
      return [];
    }
  }
}

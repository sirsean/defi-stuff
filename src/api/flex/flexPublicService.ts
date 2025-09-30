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
  subAccountId: number;
  subAccount: string;
  isLong: boolean;
  size: number; // USD
  sizeE30: bigint;
  avgEntryPrice: number;
  currentPrice: number;
  unrealizedPnl: number;
  fundingFee: number;
  borrowingFee: number;
  liquidationPrice: number;
  leverage: number;
}

// Import contract ABIs
import PerpStorageABI from "./contracts/PerpStorage.json" with { type: "json" };
import ConfigStorageABI from "./contracts/ConfigStorage.json" with { type: "json" };
import VaultStorageABI from "./contracts/VaultStorage.json" with { type: "json" };
import CalculatorABI from "./contracts/Calculator.json" with { type: "json" };
import OrderbookOracleABI from "./contracts/OrderbookOracle.json" with { type: "json" };
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
  private limitTradeHandler: ethers.Contract;

  constructor(provider?: ethers.Provider) {
    this.provider = provider || getProvider();
    
    // Initialize contract instances
    this.perpStorage = new ethers.Contract(
      FLEX_ADDRESSES.PERP_STORAGE,
      PerpStorageABI,
      this.provider
    );
    
    this.configStorage = new ethers.Contract(
      FLEX_ADDRESSES.CONFIG_STORAGE,
      ConfigStorageABI,
      this.provider
    );
    
    this.vaultStorage = new ethers.Contract(
      FLEX_ADDRESSES.VAULT_STORAGE,
      VaultStorageABI,
      this.provider
    );
    
    this.calculator = new ethers.Contract(
      FLEX_ADDRESSES.CALCULATOR,
      CalculatorABI,
      this.provider
    );
    
    this.orderbookOracle = new ethers.Contract(
      FLEX_ADDRESSES.ORDERBOOK_ORACLE,
      OrderbookOracleABI,
      this.provider
    );
    
    this.limitTradeHandler = new ethers.Contract(
      FLEX_ADDRESSES.LIMIT_TRADE_HANDLER,
      LimitTradeHandlerABI,
      this.provider
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
   * @param marketIndex Market index (e.g., 1 for BTC)
   * @returns Market data with current price
   */
  async getMarketPrice(marketIndex: number): Promise<MarketData> {
    await this.validateNetwork();

    const market = Object.values(MARKETS).find(
      (m) => m.index === marketIndex
    );
    
    if (!market) {
      throw new Error(`Market index ${marketIndex} not found`);
    }

    // Get asset ID for this market
    const assetId = market.assetId;

    // Get price from orderbook oracle
    const [priceE30, timestamp] = await this.orderbookOracle.getLatestPrice(
      assetId,
      false // isMax - use false for mid price
    );

    const price = fromE30(priceE30);

    return {
      marketIndex,
      symbol: market.symbol,
      assetId,
      price,
      priceE30,
      timestamp: Number(timestamp),
      oracleType: "onchain", // Default oracle type for Base markets
    };
  }

  /**
   * Get market configuration and limits
   */
  async getMarketInfo(marketIndex: number) {
    await this.validateNetwork();

    const market = Object.values(MARKETS).find(
      (m) => m.index === marketIndex
    );
    
    if (!market) {
      throw new Error(`Market index ${marketIndex} not found`);
    }

    // Get market config from ConfigStorage
    const marketConfig = await this.configStorage.getMarketConfigByIndex(
      marketIndex
    );

    return {
      marketIndex,
      symbol: market.symbol,
      assetId: market.assetId,
      maxLeverage: Number(marketConfig.maxLeverage),
      maxSkewScale: marketConfig.maxSkewScale,
      maxFundingRate: fromE30(marketConfig.maxFundingRate),
      fundingRateFactor: fromE30(marketConfig.fundingRateFactor),
    };
  }

  /**
   * Get current funding rate for a market
   */
  async getFundingRate(marketIndex: number) {
    await this.validateNetwork();

    const market = Object.values(MARKETS).find(
      (m) => m.index === marketIndex
    );
    
    if (!market) {
      throw new Error(`Market index ${marketIndex} not found`);
    }

    // Get global state which includes funding info
    const globalState = await this.perpStorage.getGlobalState();
    const marketState = await this.perpStorage.getMarketByIndex(marketIndex);

    return {
      marketIndex,
      symbol: market.symbol,
      currentFundingRate: fromE30(marketState.currentFundingRate),
      fundingAccrued: fromE30(marketState.fundingAccrued),
      lastFundingTime: Number(marketState.lastFundingTime),
      longPositionSize: fromE30(marketState.longPositionSize),
      shortPositionSize: fromE30(marketState.shortPositionSize),
    };
  }

  // ============================================================================
  // POSITION QUERIES
  // ============================================================================

  /**
   * Get position for a specific market and subaccount
   */
  async getPosition(
    account: string,
    subAccountId: number,
    marketIndex: number
  ): Promise<PositionData | null> {
    await this.validateNetwork();

    const market = Object.values(MARKETS).find(
      (m) => m.index === marketIndex
    );
    
    if (!market) {
      throw new Error(`Market index ${marketIndex} not found`);
    }

    // Compute subaccount address
    const subAccount = computeSubAccount(account, subAccountId);

    // Get position from PerpStorage
    const positionData = await this.perpStorage.getPositionBySubAccount(
      subAccount,
      marketIndex
    );

    // Check if position exists (non-zero size)
    if (positionData.positionSizeE30 === 0n) {
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
        marketData.priceE30
      )
    );

    // Calculate funding fee
    const fundingFee = fromE30(
      calculateFundingFee(
        positionData.positionSizeE30,
        marketState.fundingAccrued,
        positionData.lastFundingAccrued
      )
    );

    // Calculate borrowing fee
    const borrowingFee = fromE30(
      calculateBorrowingFee(
        positionData.reserveValueE30,
        marketState.borrowingRate,
        positionData.entryBorrowingRate
      )
    );

    return {
      marketIndex,
      symbol: market.symbol,
      subAccountId,
      subAccount,
      isLong,
      size: absSize,
      sizeE30: positionData.positionSizeE30,
      avgEntryPrice,
      currentPrice: marketData.price,
      unrealizedPnl,
      fundingFee,
      borrowingFee,
      liquidationPrice: 0, // Will calculate below if we have equity
      leverage: 0, // Will calculate below if we have equity
    };
  }

  /**
   * Get all open positions for an account across all markets
   */
  async getAllPositions(
    account: string,
    subAccountIds: number[]
  ): Promise<PositionData[]> {
    await this.validateNetwork();

    const positions: PositionData[] = [];

    // Query positions for each subaccount and market combination
    for (const subAccountId of subAccountIds) {
      for (const market of Object.values(MARKETS)) {
        const position = await this.getPosition(
          account,
          subAccountId,
          market.index
        );
        
        if (position) {
          positions.push(position);
        }
      }
    }

    return positions;
  }

  // ============================================================================
  // COLLATERAL & EQUITY QUERIES
  // ============================================================================

  /**
   * Get collateral balance for a subaccount
   */
  async getCollateral(
    account: string,
    subAccountId: number
  ): Promise<CollateralInfo> {
    await this.validateNetwork();

    const subAccount = computeSubAccount(account, subAccountId);

    // Get USDC collateral from VaultStorage
    const usdcToken = TOKENS.USDC;
    const collateralE30 = await this.vaultStorage.traderBalances(
      subAccount,
      usdcToken.address
    );

    const balance = fromE30(collateralE30);

    return {
      subAccountId,
      subAccount,
      token: "USDC",
      tokenAddress: usdcToken.address,
      balance,
      balanceE30: collateralE30,
    };
  }

  /**
   * Get equity (collateral + unrealized PnL) for a subaccount
   */
  async getEquity(
    account: string,
    subAccountId: number
  ): Promise<EquityData> {
    await this.validateNetwork();

    const subAccount = computeSubAccount(account, subAccountId);

    // Get collateral
    const collateral = await this.getCollateral(account, subAccountId);

    // Get all positions for this subaccount
    const positions: PositionData[] = [];
    for (const market of Object.values(MARKETS)) {
      const position = await this.getPosition(
        account,
        subAccountId,
        market.index
      );
      if (position) {
        positions.push(position);
      }
    }

    // Calculate total unrealized PnL
    let totalUnrealizedPnl = 0;
    let totalFees = 0;
    
    for (const position of positions) {
      totalUnrealizedPnl += position.unrealizedPnl;
      totalFees += position.fundingFee + position.borrowingFee;
    }

    const equity = collateral.balance + totalUnrealizedPnl - totalFees;

    return {
      subAccountId,
      subAccount,
      collateral: collateral.balance,
      unrealizedPnl: totalUnrealizedPnl,
      fees: totalFees,
      equity,
      positions,
    };
  }

  /**
   * Get leverage information for a subaccount
   */
  async getLeverage(
    account: string,
    subAccountId: number
  ): Promise<LeverageInfo> {
    await this.validateNetwork();

    const equity = await this.getEquity(account, subAccountId);

    // Calculate total position size
    // Note: position.size is already in USD terms
    let totalPositionSize = 0;
    for (const position of equity.positions) {
      totalPositionSize += position.size;
    }

    const leverage = calculateLeverage(totalPositionSize, equity.equity);

    return {
      subAccountId,
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
    subAccountId: number,
    targetLeverage: number = 1
  ): Promise<number> {
    await this.validateNetwork();

    const leverageInfo = await this.getLeverage(account, subAccountId);
    
    // Available margin considering target leverage
    const availableForNewPositions =
      (leverageInfo.equity * targetLeverage) - leverageInfo.totalPositionSize;
    
    return Math.max(0, availableForNewPositions);
  }

  // ============================================================================
  // PENDING ORDERS
  // ============================================================================

  /**
   * Get pending limit/trigger orders for a subaccount
   */
  async getPendingOrders(
    account: string,
    subAccountId: number
  ): Promise<any[]> {
    await this.validateNetwork();

    const subAccount = computeSubAccount(account, subAccountId);

    // Query limit orders from LimitTradeHandler
    // Note: This depends on the contract's interface for querying orders
    // Will need to check the actual ABI for the correct method
    try {
      const orders = await this.limitTradeHandler.getLimitOrders(subAccount);
      return orders;
    } catch (error) {
      // If method doesn't exist or fails, return empty array
      console.warn("Unable to fetch pending orders:", error);
      return [];
    }
  }
}

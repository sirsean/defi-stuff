/**
 * Flex Private Service - Transaction operations
 * Provides write operations for Flex Perpetuals on Base mainnet
 */

import { ethers } from "ethers";
import { FLEX_ADDRESSES, TOKENS, FLEX_CONSTANTS } from "./constants.js";
import {
  getProvider,
  getSigner,
  assertBaseNetwork,
  computeSubAccount,
  toE30,
  toToken,
  validateSubAccountId,
  parseRevertError,
  isUserRejection,
} from "./utils.js";
import { FlexPublicService } from "./flexPublicService.js";
import type { TransactionReceipt } from "../../types/flex.js";

// Import contract ABIs
import ERC20ABI from "./contracts/ERC20.json" with { type: "json" };
import CrossMarginHandlerABI from "./contracts/CrossMarginHandler.json" with { type: "json" };
import LimitTradeHandlerABI from "./contracts/LimitTradeHandler.json" with { type: "json" };
import VaultStorageABI from "./contracts/VaultStorage.json" with { type: "json" };

/**
 * Order parameters for market orders
 */
export interface MarketOrderParams {
  marketIndex: number;
  subAccountId: number;
  sizeDelta: number; // USD amount, positive for long, negative for short
  acceptablePrice?: number; // Optional slippage protection
}

/**
 * Order parameters for limit/trigger orders
 */
export interface LimitOrderParams {
  marketIndex: number;
  subAccountId: number;
  sizeDelta: number; // USD amount
  triggerPrice: number;
  triggerAboveThreshold: boolean; // true = trigger when price goes above, false = below
  reduceOnly?: boolean;
  acceptablePrice?: number;
}

/**
 * FlexPrivateService - Write operations for Flex Perpetuals
 */
export class FlexPrivateService {
  private provider: ethers.Provider;
  private signer: ethers.Signer;
  private publicService: FlexPublicService;

  // Contract instances with signer
  private usdcToken: ethers.Contract;
  private crossMarginHandler: ethers.Contract;
  private limitTradeHandler: ethers.Contract;
  private vaultStorage: ethers.Contract;

  constructor(signer?: ethers.Signer, provider?: ethers.Provider) {
    this.provider = provider || getProvider();
    this.signer = signer || getSigner(this.provider);
    this.publicService = new FlexPublicService(this.provider);

    // Initialize contract instances with signer
    this.usdcToken = new ethers.Contract(
      TOKENS.USDC.address,
      ERC20ABI,
      this.signer,
    );

    this.crossMarginHandler = new ethers.Contract(
      FLEX_ADDRESSES.CROSS_MARGIN_HANDLER,
      CrossMarginHandlerABI,
      this.signer,
    );

    this.limitTradeHandler = new ethers.Contract(
      FLEX_ADDRESSES.LIMIT_TRADE_HANDLER,
      LimitTradeHandlerABI,
      this.signer,
    );

    this.vaultStorage = new ethers.Contract(
      FLEX_ADDRESSES.VAULT_STORAGE,
      VaultStorageABI,
      this.signer,
    );
  }

  /**
   * Validate that we're connected to Base network
   */
  async validateNetwork(): Promise<void> {
    await assertBaseNetwork(this.provider);
  }

  /**
   * Get the signer's address
   */
  async getAddress(): Promise<string> {
    return await this.signer.getAddress();
  }

  // ============================================================================
  // COLLATERAL MANAGEMENT
  // ============================================================================

  /**
   * Check and approve USDC spending if needed
   */
  private async ensureUSDCApproval(
    spender: string,
    amount: bigint,
  ): Promise<ethers.ContractTransactionResponse | null> {
    const signerAddress = await this.getAddress();
    const currentAllowance = await this.usdcToken.allowance(
      signerAddress,
      spender,
    );

    if (currentAllowance >= amount) {
      return null; // Already approved
    }

    // Approve the spender
    console.log(`Approving ${spender} to spend USDC...`);
    const tx = await this.usdcToken.approve(spender, amount);
    await tx.wait();
    console.log(`USDC approval confirmed: ${tx.hash}`);

    return tx;
  }

  /**
   * Deposit USDC collateral into a subaccount
   */
  async depositCollateral(
    subAccountId: number,
    amount: number,
  ): Promise<TransactionReceipt> {
    await this.validateNetwork();
    validateSubAccountId(subAccountId);

    if (amount <= 0) {
      throw new Error("Deposit amount must be positive");
    }

    const signerAddress = await this.getAddress();
    const subAccount = computeSubAccount(signerAddress, subAccountId);
    const amountTokens = toToken(amount, TOKENS.USDC.decimals);

    try {
      // Ensure approval first
      await this.ensureUSDCApproval(
        FLEX_ADDRESSES.CROSS_MARGIN_HANDLER,
        amountTokens,
      );

      console.log(`Depositing ${amount} USDC to subaccount ${subAccountId}...`);

      // Execute deposit
      const tx = await this.crossMarginHandler.depositCollateral(
        subAccount,
        TOKENS.USDC.address,
        amountTokens,
      );

      const receipt = await tx.wait();

      return {
        success: receipt.status === 1,
        transactionHash: receipt.hash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed,
        effectiveGasPrice: receipt.effectiveGasPrice || 0n,
        totalCost:
          BigInt(receipt.gasUsed) * BigInt(receipt.effectiveGasPrice || 0n),
        totalCostEth:
          Number(receipt.gasUsed * (receipt.effectiveGasPrice || 0n)) / 1e18,
      };
    } catch (error: any) {
      if (isUserRejection(error)) {
        throw new Error("Transaction rejected by user");
      }
      throw new Error(`Deposit failed: ${parseRevertError(error)}`);
    }
  }

  /**
   * Withdraw USDC collateral from a subaccount
   */
  async withdrawCollateral(
    subAccountId: number,
    amount: number,
  ): Promise<TransactionReceipt> {
    await this.validateNetwork();
    validateSubAccountId(subAccountId);

    if (amount <= 0) {
      throw new Error("Withdrawal amount must be positive");
    }

    const signerAddress = await this.getAddress();
    const subAccount = computeSubAccount(signerAddress, subAccountId);
    const amountTokens = toToken(amount, TOKENS.USDC.decimals);

    try {
      console.log(
        `Withdrawing ${amount} USDC from subaccount ${subAccountId}...`,
      );

      const tx = await this.crossMarginHandler.withdrawCollateral(
        subAccount,
        TOKENS.USDC.address,
        amountTokens,
      );

      const receipt = await tx.wait();

      return {
        success: receipt.status === 1,
        transactionHash: receipt.hash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed,
        effectiveGasPrice: receipt.effectiveGasPrice || 0n,
        totalCost:
          BigInt(receipt.gasUsed) * BigInt(receipt.effectiveGasPrice || 0n),
        totalCostEth:
          Number(receipt.gasUsed * (receipt.effectiveGasPrice || 0n)) / 1e18,
      };
    } catch (error: any) {
      if (isUserRejection(error)) {
        throw new Error("Transaction rejected by user");
      }
      throw new Error(`Withdrawal failed: ${parseRevertError(error)}`);
    }
  }

  // ============================================================================
  // MARKET ORDERS
  // ============================================================================

  /**
   * Execute a market order
   */
  async executeMarketOrder(
    params: MarketOrderParams,
  ): Promise<TransactionReceipt> {
    await this.validateNetwork();
    validateSubAccountId(params.subAccountId);

    if (params.sizeDelta === 0) {
      throw new Error("Order size cannot be zero");
    }

    const signerAddress = await this.getAddress();
    const subAccount = computeSubAccount(signerAddress, params.subAccountId);
    const sizeDeltaE30 = toE30(Math.abs(params.sizeDelta));

    // Determine if increasing or decreasing position
    const isLong = params.sizeDelta > 0;

    try {
      console.log(
        `Executing market order: ${isLong ? "LONG" : "SHORT"} ` +
          `$${Math.abs(params.sizeDelta)} on market ${params.marketIndex}...`,
      );

      // Get current price for slippage protection
      let acceptablePriceE30: bigint;
      if (params.acceptablePrice) {
        acceptablePriceE30 = toE30(params.acceptablePrice);
      } else {
        // Use current price with 1% slippage tolerance
        const currentPrice = await this.publicService.getMarketPrice(
          params.marketIndex,
        );
        const slippage = isLong ? 1.01 : 0.99;
        acceptablePriceE30 = toE30(currentPrice.price * slippage);
      }

      // Execute order through CrossMarginHandler
      const tx = await this.crossMarginHandler.createOrder(
        subAccount,
        params.marketIndex,
        sizeDeltaE30,
        acceptablePriceE30,
        { value: FLEX_CONSTANTS.EXECUTION_FEE },
      );

      const receipt = await tx.wait();

      return {
        success: receipt.status === 1,
        transactionHash: receipt.hash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed,
        effectiveGasPrice: receipt.effectiveGasPrice || 0n,
        totalCost:
          BigInt(receipt.gasUsed) * BigInt(receipt.effectiveGasPrice || 0n),
        totalCostEth:
          Number(receipt.gasUsed * (receipt.effectiveGasPrice || 0n)) / 1e18,
      };
    } catch (error: any) {
      if (isUserRejection(error)) {
        throw new Error("Transaction rejected by user");
      }
      throw new Error(`Market order failed: ${parseRevertError(error)}`);
    }
  }

  // ============================================================================
  // LIMIT/TRIGGER ORDERS
  // ============================================================================

  /**
   * Create a limit or trigger order
   */
  async createLimitOrder(
    params: LimitOrderParams,
  ): Promise<TransactionReceipt> {
    await this.validateNetwork();
    validateSubAccountId(params.subAccountId);

    if (params.sizeDelta === 0) {
      throw new Error("Order size cannot be zero");
    }

    const signerAddress = await this.getAddress();
    const subAccount = computeSubAccount(signerAddress, params.subAccountId);
    const sizeDeltaE30 = toE30(Math.abs(params.sizeDelta));
    const triggerPriceE30 = toE30(params.triggerPrice);

    // Calculate acceptable price with slippage if not provided
    let acceptablePriceE30: bigint;
    if (params.acceptablePrice) {
      acceptablePriceE30 = toE30(params.acceptablePrice);
    } else {
      // 1% slippage from trigger price
      const slippage = params.sizeDelta > 0 ? 1.01 : 0.99;
      acceptablePriceE30 = toE30(params.triggerPrice * slippage);
    }

    try {
      console.log(
        `Creating limit order: ${params.sizeDelta > 0 ? "LONG" : "SHORT"} ` +
          `$${Math.abs(params.sizeDelta)} @ $${params.triggerPrice}...`,
      );

      const tx = await this.limitTradeHandler.createOrder(
        subAccount,
        params.marketIndex,
        sizeDeltaE30,
        triggerPriceE30,
        acceptablePriceE30,
        params.triggerAboveThreshold,
        params.reduceOnly || false,
        { value: FLEX_CONSTANTS.EXECUTION_FEE },
      );

      const receipt = await tx.wait();

      return {
        success: receipt.status === 1,
        transactionHash: receipt.hash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed,
        effectiveGasPrice: receipt.effectiveGasPrice || 0n,
        totalCost:
          BigInt(receipt.gasUsed) * BigInt(receipt.effectiveGasPrice || 0n),
        totalCostEth:
          Number(receipt.gasUsed * (receipt.effectiveGasPrice || 0n)) / 1e18,
      };
    } catch (error: any) {
      if (isUserRejection(error)) {
        throw new Error("Transaction rejected by user");
      }
      throw new Error(
        `Limit order creation failed: ${parseRevertError(error)}`,
      );
    }
  }

  // ============================================================================
  // ORDER MANAGEMENT
  // ============================================================================

  /**
   * Cancel a pending limit/trigger order
   */
  async cancelOrder(
    subAccountId: number,
    orderIndex: number,
  ): Promise<TransactionReceipt> {
    await this.validateNetwork();
    validateSubAccountId(subAccountId);

    const signerAddress = await this.getAddress();
    const subAccount = computeSubAccount(signerAddress, subAccountId);

    try {
      console.log(`Cancelling order ${orderIndex}...`);

      const tx = await this.limitTradeHandler.cancelOrder(
        subAccount,
        orderIndex,
      );

      const receipt = await tx.wait();

      return {
        success: receipt.status === 1,
        transactionHash: receipt.hash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed,
        effectiveGasPrice: receipt.effectiveGasPrice || 0n,
        totalCost:
          BigInt(receipt.gasUsed) * BigInt(receipt.effectiveGasPrice || 0n),
        totalCostEth:
          Number(receipt.gasUsed * (receipt.effectiveGasPrice || 0n)) / 1e18,
      };
    } catch (error: any) {
      if (isUserRejection(error)) {
        throw new Error("Transaction rejected by user");
      }
      throw new Error(`Order cancellation failed: ${parseRevertError(error)}`);
    }
  }

  // ============================================================================
  // POSITION MANAGEMENT
  // ============================================================================

  /**
   * Close a position (full or partial)
   */
  async closePosition(
    marketIndex: number,
    subAccountId: number,
    percentToClose: number = 100,
  ): Promise<TransactionReceipt> {
    await this.validateNetwork();
    validateSubAccountId(subAccountId);

    if (percentToClose <= 0 || percentToClose > 100) {
      throw new Error("Percent to close must be between 0 and 100");
    }

    const signerAddress = await this.getAddress();

    // Get current position
    const position = await this.publicService.getPosition(
      signerAddress,
      subAccountId,
      marketIndex,
    );

    if (!position) {
      throw new Error("No position found to close");
    }

    // Calculate close size (opposite direction of current position)
    const closeSize = position.size * (percentToClose / 100);
    const closeSizeDelta = position.isLong ? -closeSize : closeSize;

    console.log(
      `Closing ${percentToClose}% of ${position.isLong ? "LONG" : "SHORT"} ` +
        `position ($${closeSize})...`,
    );

    // Execute market order in opposite direction
    return await this.executeMarketOrder({
      marketIndex,
      subAccountId,
      sizeDelta: closeSizeDelta,
    });
  }

  // ============================================================================
  // TRANSACTION UTILITIES
  // ============================================================================

  /**
   * Estimate gas for a transaction
   */
  async estimateGas(
    contract: ethers.Contract,
    method: string,
    args: any[],
  ): Promise<bigint> {
    try {
      const gasEstimate = await contract[method].estimateGas(...args);
      // Add 20% buffer
      return (gasEstimate * 120n) / 100n;
    } catch (error: any) {
      throw new Error(`Gas estimation failed: ${parseRevertError(error)}`);
    }
  }

  /**
   * Get current gas price
   */
  async getGasPrice(): Promise<bigint> {
    const feeData = await this.provider.getFeeData();
    return feeData.gasPrice || 0n;
  }

  /**
   * Wait for transaction confirmation with timeout
   */
  async waitForTransaction(
    txHash: string,
    confirmations: number = 1,
    timeout: number = 120000, // 2 minutes
  ): Promise<ethers.TransactionReceipt | null> {
    try {
      const receipt = await this.provider.waitForTransaction(
        txHash,
        confirmations,
        timeout,
      );
      return receipt;
    } catch (error: any) {
      throw new Error(`Transaction wait failed: ${parseRevertError(error)}`);
    }
  }
}

/**
 * Utility functions for Flex Perpetuals integration
 */

import { ethers } from "ethers";
import {
  BASE_CHAIN_ID,
  DEFAULT_RPC_URL,
  FLEX_ADDRESSES,
  FLEX_CONSTANTS,
} from "./constants.js";

// ============================================================================
// PROVIDER & SIGNER
// ============================================================================

/**
 * Get an ethers provider for Base network
 * Uses FLEX_RPC_URL from env if available, otherwise uses default RPC
 */
export function getProvider(): ethers.JsonRpcProvider {
  const rpcUrl = process.env.FLEX_RPC_URL || DEFAULT_RPC_URL;
  return new ethers.JsonRpcProvider(rpcUrl);
}

/**
 * Get a signer from MAIN_PRIVATE_KEY
 * Throws if private key is not set
 */
export function getSigner(
  provider?: ethers.Provider
): ethers.Wallet {
  const privateKey = process.env.MAIN_PRIVATE_KEY;
  
  if (!privateKey) {
    throw new Error(
      "MAIN_PRIVATE_KEY environment variable is required for transaction operations"
    );
  }
  
  const wallet = new ethers.Wallet(privateKey);
  
  if (provider) {
    return wallet.connect(provider);
  }
  
  return wallet;
}

/**
 * Assert that the provider is connected to Base network (chain ID 8453)
 * Throws if on wrong network
 */
export async function assertBaseNetwork(
  provider: ethers.Provider
): Promise<void> {
  const network = await provider.getNetwork();
  const chainId = Number(network.chainId);
  
  if (chainId !== BASE_CHAIN_ID) {
    throw new Error(
      `Wrong network: expected Base (${BASE_CHAIN_ID}), got ${chainId}. ` +
        `Please connect to Base mainnet.`
    );
  }
}

// ============================================================================
// UNIT CONVERSIONS
// ============================================================================

/**
 * Convert a number to e30 precision (for USD amounts in contracts)
 * Uses string manipulation to avoid floating point precision issues
 * @param n Number or string to convert
 * @returns BigInt in e30 format
 */
export function toE30(n: number | string): bigint {
  const str = typeof n === "string" ? n : n.toString();
  
  // Match number format: optional sign, integer part, optional decimal part
  const match = str.match(/^(-?)(\d+)(\.\d+)?$/);
  if (!match) {
    throw new Error(`Invalid number for e30 conversion: ${n}`);
  }
  
  const [, sign, intPart, decPart = ""] = match;
  const decimals = decPart.slice(1); // Remove the dot
  
  // Pad to exactly 30 decimals or truncate if longer
  const paddedDecimals = decimals.padEnd(30, "0").slice(0, 30);
  const fullNumber = sign + intPart + paddedDecimals;
  
  return BigInt(fullNumber);
}

/**
 * Convert from e30 precision to a regular number
 * @param b BigInt in e30 format
 * @returns Number
 */
export function fromE30(b: bigint): number {
  // Convert to string and insert decimal point
  const str = b.toString().padStart(31, "0");
  const intPart = str.slice(0, -30) || "0";
  const decPart = str.slice(-30);
  
  // Remove trailing zeros from decimal part
  const trimmedDec = decPart.replace(/0+$/, "");
  
  if (trimmedDec.length === 0) {
    return parseFloat(intPart);
  }
  
  return parseFloat(`${intPart}.${trimmedDec}`);
}

/**
 * Convert a number to token units based on decimals
 * Uses string manipulation to avoid floating point precision issues
 * @param amount Human-readable amount
 * @param decimals Token decimals (e.g., 6 for USDC, 18 for ETH)
 * @returns BigInt in token's smallest unit
 */
export function toToken(amount: number, decimals: number): bigint {
  if (decimals < 0 || decimals > 77) {
    throw new Error(`Invalid decimals: ${decimals}`);
  }
  
  const str = amount.toString();
  
  // Match number format: optional sign, integer part, optional decimal part
  const match = str.match(/^(-?)(\d+)(\.\d+)?$/);
  if (!match) {
    throw new Error(`Invalid amount for token conversion: ${amount}`);
  }
  
  const [, sign, intPart, decPart = ""] = match;
  const decimalDigits = decPart.slice(1); // Remove the dot
  
  // Pad to exactly decimals or truncate if longer
  const paddedDecimals = decimalDigits.padEnd(decimals, "0").slice(0, decimals);
  const fullNumber = sign + intPart + paddedDecimals;
  
  return BigInt(fullNumber);
}

/**
 * Convert from token units to human-readable number
 * @param b BigInt in token's smallest unit
 * @param decimals Token decimals
 * @returns Number
 */
export function fromToken(b: bigint, decimals: number): number {
  if (decimals < 0 || decimals > 77) {
    throw new Error(`Invalid decimals: ${decimals}`);
  }
  
  const str = b.toString().padStart(decimals + 1, "0");
  const intPart = str.slice(0, -decimals) || "0";
  const decPart = str.slice(-decimals);
  
  // Remove trailing zeros
  const trimmedDec = decPart.replace(/0+$/, "");
  
  if (trimmedDec.length === 0) {
    return parseFloat(intPart);
  }
  
  return parseFloat(`${intPart}.${trimmedDec}`);
}

// ============================================================================
// SUBACCOUNT CALCULATION
// ============================================================================

/**
 * Compute the subaccount address from primary account and subaccount ID
 * Uses keccak256(abi.encodePacked(account, subAccountId))
 * @param account Primary account address
 * @param subAccountId Subaccount ID (0-255)
 * @returns Subaccount address (32 bytes as hex string)
 */
export function computeSubAccount(
  account: string,
  subAccountId: number
): string {
  // Validate subAccountId first (before address validation)
  if (
    !Number.isInteger(subAccountId) ||
    subAccountId < FLEX_CONSTANTS.MIN_SUBACCOUNT_ID ||
    subAccountId > FLEX_CONSTANTS.MAX_SUBACCOUNT_ID
  ) {
    throw new Error(
      `Invalid subAccountId: ${subAccountId}. Must be between ${FLEX_CONSTANTS.MIN_SUBACCOUNT_ID} and ${FLEX_CONSTANTS.MAX_SUBACCOUNT_ID}`
    );
  }
  
  // Validate and normalize address using getAddress
  try {
    account = ethers.getAddress(account);
  } catch (error) {
    throw new Error(`Invalid account address: ${account}`);
  }
  
  // Pack account (20 bytes) and subAccountId (1 byte) then hash
  // Similar to Solidity's keccak256(abi.encodePacked(account, uint8(subAccountId)))
  const packed = ethers.solidityPacked(
    ["address", "uint8"],
    [account, subAccountId]
  );
  
  return ethers.keccak256(packed);
}

/**
 * Validate subaccount ID is within valid range
 */
export function validateSubAccountId(subAccountId: number): void {
  if (
    !Number.isInteger(subAccountId) ||
    subAccountId < FLEX_CONSTANTS.MIN_SUBACCOUNT_ID ||
    subAccountId > FLEX_CONSTANTS.MAX_SUBACCOUNT_ID
  ) {
    throw new Error(
      `Invalid subAccountId: ${subAccountId}. Must be between ${FLEX_CONSTANTS.MIN_SUBACCOUNT_ID} and ${FLEX_CONSTANTS.MAX_SUBACCOUNT_ID}`
    );
  }
}

// ============================================================================
// MULTICALL3 UTILITIES
// ============================================================================

/**
 * Call structure for multicall
 */
export interface MulticallCall {
  target: string;
  callData: string;
}

/**
 * Result structure from multicall
 */
export interface MulticallResult {
  success: boolean;
  returnData: string;
}

/**
 * Execute a batch of contract calls using Multicall3
 * @param provider Ethers provider
 * @param calls Array of calls to execute
 * @param allowFailure Whether to allow individual calls to fail
 * @returns Array of results
 */
export async function multicall(
  provider: ethers.Provider,
  calls: MulticallCall[],
  allowFailure: boolean = false
): Promise<MulticallResult[]> {
  const multicallAddress = FLEX_ADDRESSES.MULTICALL;
  
  // Multicall3 ABI for aggregate3 function
  const multicallAbi = [
    "function aggregate3(tuple(address target, bool allowFailure, bytes callData)[] calls) returns (tuple(bool success, bytes returnData)[] returnData)",
  ];
  
  const multicallContract = new ethers.Contract(
    multicallAddress,
    multicallAbi,
    provider
  );
  
  // Convert calls to Multicall3 format
  const multicallCalls = calls.map((call) => ({
    target: call.target,
    allowFailure,
    callData: call.callData,
  }));
  
  // Execute multicall
  const results = await multicallContract.aggregate3(multicallCalls);
  
  return results.map(
    (result: { success: boolean; returnData: string }) => ({
      success: result.success,
      returnData: result.returnData,
    })
  );
}

/**
 * Chunk an array into smaller arrays of specified size
 */
export function chunk<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

// ============================================================================
// ERROR HANDLING
// ============================================================================

/**
 * Parse a revert error from a transaction
 * Attempts to decode custom errors if possible
 */
export function parseRevertError(error: any): string {
  // Check for revert reason in various error formats
  if (error?.reason) {
    return error.reason;
  }
  
  if (error?.data?.message) {
    return error.data.message;
  }
  
  if (error?.error?.message) {
    return error.error.message;
  }
  
  if (error?.message) {
    // Try to extract revert reason from message
    const match = error.message.match(/reverted with reason string '(.+)'/);
    if (match) {
      return match[1];
    }
    
    // Check for common error patterns
    if (error.message.includes("insufficient funds")) {
      return "Insufficient funds for transaction";
    }
    
    if (error.message.includes("nonce too low")) {
      return "Transaction nonce too low";
    }
    
    if (error.message.includes("gas required exceeds allowance")) {
      return "Gas required exceeds allowance";
    }
    
    return error.message;
  }
  
  return "Unknown error occurred";
}

/**
 * Check if an error is a user rejection (e.g., from wallet)
 */
export function isUserRejection(error: any): boolean {
  const message = error?.message?.toLowerCase() || "";
  return (
    message.includes("user rejected") ||
    message.includes("user denied") ||
    message.includes("cancelled")
  );
}

// ============================================================================
// MATH HELPERS FOR PNL CALCULATIONS
// ============================================================================

/**
 * Calculate unrealized PnL for a position
 * @param isLong Whether position is long
 * @param sizeE30 Position size in e30
 * @param entryPriceE30 Entry price in e30
 * @param currentPriceE30 Current price in e30
 * @returns PnL in e30 format
 */
export function calculatePnL(
  isLong: boolean,
  sizeE30: bigint,
  entryPriceE30: bigint,
  currentPriceE30: bigint
): bigint {
  if (sizeE30 === 0n) return 0n;
  
  const priceDiff = currentPriceE30 - entryPriceE30;
  
  // PnL = size * (currentPrice - entryPrice) for long
  // PnL = size * (entryPrice - currentPrice) for short
  const multiplier = isLong ? 1n : -1n;
  
  // size is in USD (e30), priceDiff is in USD/unit (e30)
  // Result needs to be divided by e30 to get USD
  return (sizeE30 * priceDiff * multiplier) / FLEX_CONSTANTS.E30;
}

/**
 * Calculate funding fee
 * @param sizeE30 Position size in e30
 * @param currentFundingAccrued Current accumulated funding
 * @param lastFundingAccrued Last accumulated funding at position entry
 * @returns Funding fee in e30 format (positive = trader pays, negative = trader receives)
 */
export function calculateFundingFee(
  sizeE30: bigint,
  currentFundingAccrued: bigint,
  lastFundingAccrued: bigint
): bigint {
  if (sizeE30 === 0n) return 0n;
  
  const fundingDelta = currentFundingAccrued - lastFundingAccrued;
  
  // Funding fee = size * fundingDelta / e30
  return (sizeE30 * fundingDelta) / FLEX_CONSTANTS.E30;
}

/**
 * Calculate borrowing fee
 * @param reserveValueE30 Position's reserve value in e30
 * @param currentBorrowingRate Current accumulated borrowing rate
 * @param entryBorrowingRate Entry borrowing rate
 * @returns Borrowing fee in e30 format
 */
export function calculateBorrowingFee(
  reserveValueE30: bigint,
  currentBorrowingRate: bigint,
  entryBorrowingRate: bigint
): bigint {
  if (reserveValueE30 === 0n) return 0n;
  
  const borrowingDelta = currentBorrowingRate - entryBorrowingRate;
  
  // Borrowing fee = reserveValue * borrowingDelta / e30
  return (reserveValueE30 * borrowingDelta) / FLEX_CONSTANTS.E30;
}

/**
 * Calculate price impact for a given size
 * @param longPositionSize Current long position size
 * @param shortPositionSize Current short position size
 * @param maxSkewScale Maximum skew scale parameter
 * @param sizeDelta Size delta (positive for long, negative for short)
 * @returns Price impact multiplier in e30 format
 */
export function calculatePriceImpact(
  longPositionSize: bigint,
  shortPositionSize: bigint,
  maxSkewScale: bigint,
  sizeDelta: bigint
): bigint {
  if (maxSkewScale === 0n) return 0n;
  
  const currentSkew = longPositionSize - shortPositionSize;
  const newSkew = currentSkew + sizeDelta;
  
  // Impact = newSkew / maxSkewScale
  // This is a simplified version - actual implementation may vary
  return (newSkew * FLEX_CONSTANTS.E30) / maxSkewScale;
}

/**
 * Calculate leverage from position size and equity
 */
export function calculateLeverage(
  positionSizeUsd: number,
  equityUsd: number
): number {
  if (equityUsd === 0) return 0;
  return positionSizeUsd / equityUsd;
}

/**
 * Calculate liquidation price for a position
 * This is a simplified calculation - actual implementation depends on protocol specifics
 */
export function calculateLiquidationPrice(
  isLong: boolean,
  entryPrice: number,
  leverage: number,
  maintenanceMarginFraction: number
): number {
  // Liquidation occurs when equity falls below maintenance margin
  // For long: liquidationPrice = entryPrice * (1 - (1 - maintenanceMargin) / leverage)
  // For short: liquidationPrice = entryPrice * (1 + (1 - maintenanceMargin) / leverage)
  
  const factor = (1 - maintenanceMarginFraction) / leverage;
  
  if (isLong) {
    return entryPrice * (1 - factor);
  } else {
    return entryPrice * (1 + factor);
  }
}

// ============================================================================
// FORMATTING HELPERS
// ============================================================================

/**
 * Format a USD amount for display
 */
export function formatUsd(amount: number, decimals: number = 2): string {
  const formatted = Math.abs(amount).toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  
  // Handle negative sign placement (before the $)
  return amount < 0 ? `-$${formatted}` : `$${formatted}`;
}

/**
 * Format a percentage for display
 */
export function formatPercent(value: number, decimals: number = 2): string {
  return `${value.toFixed(decimals)}%`;
}

/**
 * Format basis points to percentage
 */
export function bpsToPercent(bps: number): number {
  return bps / 100;
}

/**
 * Shorten an address for display (0x1234...5678)
 */
export function shortenAddress(address: string, chars: number = 4): string {
  if (!address) return "";
  // For default 4 chars, show first 4 (after 0x) and last 3 chars to match common convention
  const endChars = chars === 4 ? 3 : chars;
  return `${address.slice(0, chars + 2)}...${address.slice(-endChars)}`;
}

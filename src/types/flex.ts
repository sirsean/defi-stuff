/**
 * TypeScript types for Flex Perpetuals integration
 */

// ============================================================================
// MARKET & PRICING TYPES
// ============================================================================

/**
 * Market price information
 */
export interface Price {
  marketIndex: number;
  symbol: string;
  mid: number; // Human-readable price (e.g., 45000.50)
  midE30: bigint; // On-chain price in e30 format
  timestamp?: number;
}

/**
 * Detailed market information including rates and configuration
 */
export interface MarketInfo {
  marketIndex: number;
  symbol: string;
  name: string;
  
  // Current price
  price: number;
  priceE30: bigint;
  
  // Leverage & margin
  maxLeverage: number;
  initialMarginFractionBps: number;
  maintenanceMarginFractionBps: number;
  
  // Position sizes
  longPositionSize: number; // USD
  shortPositionSize: number; // USD
  
  // Rates (annualized percentages)
  fundingRate: {
    hourly: number;
    daily: number;
    yearly: number;
  };
  borrowingRate: {
    hourly: number;
    daily: number;
    yearly: number;
  };
  
  // Fee rates (in basis points)
  feeRates: {
    increaseBps: number;
    decreaseBps: number;
    makerBps?: number;
    takerBps?: number;
  };
  
  // Price impact parameters
  maxSkewScaleUsd: number;
  maxFundingRate: number;
  
  // Status
  active: boolean;
  allowIncreasePosition: boolean;
}

/**
 * Adaptive price with impact calculation
 */
export interface AdaptivePrice extends Price {
  basePrice: number;
  adaptivePrice: number;
  priceImpact: number; // Percentage
  size: number; // USD size used for calculation
  side: "buy" | "sell";
}

// ============================================================================
// POSITION TYPES
// ============================================================================

/**
 * Trading position information
 */
export interface Position {
  // Identity
  primaryAccount: string;
  subAccountId: number;
  marketIndex: number;
  symbol: string;
  
  // Position details
  isLong: boolean;
  sizeUsd: number; // Human-readable USD size
  sizeE30: bigint; // On-chain size in e30
  
  // Entry & current pricing
  avgEntryPrice: number;
  avgEntryPriceE30: bigint;
  currentPrice: number;
  currentPriceE30: bigint;
  
  // PnL breakdown
  unrealizedPnlUsd: number;
  realizedPnlUsd: number;
  totalPnlUsd: number;
  
  // Fees
  fundingFeeUsd: number;
  borrowingFeeUsd: number;
  totalFeesUsd: number;
  
  // Risk metrics
  liquidationPrice: number;
  liquidationPriceE30: bigint;
  leverage: number;
  marginUsed: number; // USD
  
  // Timestamps
  lastIncreaseTimestamp: number;
  
  // Raw on-chain data
  raw: {
    reserveValueE30: bigint;
    entryBorrowingRate: bigint;
    lastFundingAccrued: bigint;
  };
}

/**
 * Simplified position summary
 */
export interface PositionSummary {
  marketIndex: number;
  symbol: string;
  side: "long" | "short";
  sizeUsd: number;
  pnlUsd: number;
  leverage: number;
}

// ============================================================================
// ORDER TYPES
// ============================================================================

/**
 * Order status
 */
export type OrderStatus =
  | "pending"
  | "active"
  | "executed"
  | "cancelled"
  | "expired";

/**
 * Order type
 */
export type OrderType = "market" | "limit" | "stop" | "stop_limit";

/**
 * Trading order information
 */
export interface Order {
  // Identity
  orderIndex: number;
  account: string;
  subAccountId: number;
  
  // Market
  marketIndex: number;
  symbol: string;
  
  // Order details
  orderType: OrderType;
  isLong: boolean;
  sizeUsd: number;
  sizeDeltaE30: bigint;
  
  // Pricing
  triggerPrice: number;
  triggerPriceE30: bigint;
  acceptablePrice: number;
  acceptablePriceE30: bigint;
  triggerAboveThreshold: boolean;
  
  // Flags
  reduceOnly: boolean;
  
  // Status
  status: OrderStatus;
  
  // Timestamps
  createdTimestamp: number;
  executedTimestamp?: number;
  
  // Fees
  executionFee: bigint;
  
  // Take profit token (optional)
  tpToken: string;
}

/**
 * Parameters for creating an order
 */
export interface OrderParams {
  subAccountId: number;
  marketIndex: number;
  buy: boolean; // true = long, false = short
  sizeUsd: number;
  reduceOnly: boolean;
  
  // Optional for limit/stop orders
  triggerPrice?: number;
  triggerAboveThreshold?: boolean;
  acceptablePrice?: number;
  
  // Optional
  tpToken?: string;
}

/**
 * Order creation result
 */
export interface OrderResult {
  success: boolean;
  orderIndex?: number;
  transactionHash: string;
  gasUsed: bigint;
  effectiveGasPrice: bigint;
  error?: string;
}

// ============================================================================
// COLLATERAL & ACCOUNT TYPES
// ============================================================================

/**
 * Collateral token balance
 */
export interface Collateral {
  token: string; // Address
  symbol: string; // e.g., "USDC"
  decimals: number;
  
  // Balances
  balance: bigint; // Raw on-chain balance
  balanceFloat: number; // Human-readable
  
  // USD valuation
  usdValue: number;
  
  // Collateral factor
  collateralFactorBps: number;
  valueWithFactor: number; // USD value after applying factor
  
  // Status
  accepted: boolean;
}

/**
 * Account equity information
 */
export interface Equity {
  // Total values
  equityUsd: number;
  collateralUsd: number;
  
  // Position impact
  unrealizedPnlUsd: number;
  
  // Fee debts
  tradingFeeDebt: number;
  borrowingFeeDebt: number;
  fundingFeeDebt: number;
  lossDebt: number;
  totalDebt: number;
  
  // Available
  freeCollateralUsd: number;
  marginUsed: number;
}

/**
 * Leverage information
 */
export interface FlexLeverage {
  actual: number; // Current leverage ratio
  maxAllowed: number; // Maximum allowed by protocol
  
  // Margin fractions
  initial: number; // Initial margin requirement (e.g., 0.1 = 10x max)
  maintenance: number; // Maintenance margin requirement
  
  // Buffer to liquidation
  liquidationBuffer: number; // Percentage above maintenance
}

/**
 * Complete account summary
 */
export interface AccountSummary {
  account: string;
  subAccountId: number;
  
  equity: Equity;
  leverage: FlexLeverage;
  collaterals: Collateral[];
  positions: Position[];
  activeOrders: Order[];
  
  // Aggregates
  totalPositionSizeUsd: number;
  totalPnlUsd: number;
  portfolioValue: number;
}

// ============================================================================
// RISK MANAGEMENT TYPES
// ============================================================================

/**
 * Position sizing parameters
 */
export interface PositionSizingParams {
  equity: number;
  riskPercentage: number; // e.g., 0.02 = 2% risk per trade
  entryPrice: number;
  stopLossPrice: number;
  leverage?: number;
}

/**
 * Position sizing result
 */
export interface PositionSizingResult {
  positionSizeUsd: number;
  quantity: number; // In base asset units
  riskUsd: number;
  requiredMargin: number;
  leverage: number;
  stopLossDistance: number;
  stopLossPercentage: number;
}

/**
 * Liquidation risk assessment
 */
export interface LiquidationRisk {
  marketIndex: number;
  symbol: string;
  
  currentPrice: number;
  liquidationPrice: number;
  liquidationDistance: number; // Percentage
  
  maintenanceMarginRequired: number;
  currentMargin: number;
  marginBuffer: number; // Percentage above maintenance
  
  riskLevel: "safe" | "warning" | "danger" | "critical";
}

/**
 * Order validation result
 */
export interface OrderValidation {
  valid: boolean;
  errors: string[];
  warnings: string[];
  
  // Pre-trade state
  currentEquity: number;
  currentLeverage: number;
  
  // Post-trade projections
  projectedEquity: number;
  projectedLeverage: number;
  projectedMarginUsage: number;
  
  // Limits
  maxLeverage: number;
  maxPositionSize: number;
  availableMargin: number;
}

// ============================================================================
// TRANSACTION TYPES
// ============================================================================

/**
 * Transaction receipt summary
 */
export interface TransactionReceipt {
  success: boolean;
  transactionHash: string;
  blockNumber: number;
  gasUsed: bigint;
  effectiveGasPrice: bigint;
  totalCost: bigint; // In wei
  totalCostEth: number;
  timestamp?: number;
}

/**
 * Deposit/Withdrawal result
 */
export interface CollateralResult extends TransactionReceipt {
  token: string;
  symbol: string;
  amount: number;
  amountRaw: bigint;
  operation: "deposit" | "withdraw";
}

// ============================================================================
// HELPER TYPES
// ============================================================================

/**
 * Fee breakdown
 */
export interface FeeBreakdown {
  tradingFee: number;
  fundingFee: number;
  borrowingFee: number;
  executionFee: number;
  total: number;
}

/**
 * Market statistics
 */
export interface MarketStats {
  marketIndex: number;
  symbol: string;
  
  volume24h: number;
  openInterest: number;
  longShortRatio: number;
  
  fundingRate24h: number;
  borrowingRate24h: number;
  
  priceChange24h: number;
  priceChange24hPercent: number;
}

/**
 * Subaccount information
 */
export interface SubAccountInfo {
  primaryAccount: string;
  subAccountId: number;
  subAccountAddress: string; // Computed address
  
  // Balances
  collaterals: Collateral[];
  totalCollateralUsd: number;
  
  // Positions
  positions: Position[];
  totalPositionSizeUsd: number;
  
  // Orders
  activeOrders: Order[];
  
  // Metrics
  equity: number;
  leverage: number;
  pnl: number;
}

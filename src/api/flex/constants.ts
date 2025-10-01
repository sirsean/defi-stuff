/**
 * Constants for Flex Perpetuals integration on Base mainnet
 * Chain ID: 8453
 */

// ============================================================================
// CHAIN CONFIGURATION
// ============================================================================

export const BASE_CHAIN_ID = 8453;

export const DEFAULT_RPC_URL = "https://mainnet.base.org";

// ============================================================================
// CONTRACT ADDRESSES (Base Mainnet)
// ============================================================================

export const FLEX_ADDRESSES = {
  // Core Protocol Contracts
  CROSS_MARGIN_HANDLER: "0x8eBcF0b886188467B6ad9199535F2666E4e9d48F",
  LIMIT_TRADE_HANDLER: "0x0d8294F7fa786dF50A15c94C93C28d85fb2A2116",
  VAULT_STORAGE: "0x1375653D8a328154327e48A203F46Aa70B6C0b92",
  PERP_STORAGE: "0x734a1FB1fd54233f7Cad4345C8fc0135340c4b53",
  CONFIG_STORAGE: "0x1b92F5C0787bde0d2Aa21110f8f2a77595523598",
  CALCULATOR: "0x651e03A1A9D1657C870Ee22165C331bebAeAEd97",
  TRADE_HELPER: "0x92E4a331F76042f3e449002cF6960111C2f04815",

  // Oracle & Pricing
  ONCHAIN_PRICELENS: "0x061B43dbB9B4D189Cd0Ed142e2E808a2459DB947",
  CALC_PRICELENS: "0x48b4cCD3f7ecAffFFb111b75483543E640D9F2C9",
  ORDERBOOK_ORACLE: "0x7c714c52B162Fb678B9930CD2Bc67e4B04CbcB96",
  ADAPTIVE_FEE_CALCULATOR: "0xc1875dcDf4b1fcCD82553315625836c4e8000CAf",

  // Utilities
  MULTICALL: "0xcA11bde05977b3631167028862bE2a173976CA11",

  // Intent Handler (for future intent-based orders)
  INTENT_HANDLER: "0x48b4cCD3f7ecAffFFb111b75483543E640D9F2C9",
} as const;

// ============================================================================
// COLLATERAL TOKENS (Base Mainnet)
// ============================================================================

export const TOKENS = {
  // Source: Circle's official USDC on Base
  // https://developers.circle.com/stablecoins/docs/usdc-on-base
  USDC: {
    address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    symbol: "USDC",
    decimals: 6,
    isCollateral: true,
  },
  // Note: Add WETH, WBTC etc. when needed for future collateral support
} as const;

// ============================================================================
// MARKETS
// ============================================================================

/**
 * Market configuration for Flex Perpetuals on Base
 */
export interface MarketConfig {
  index: number;
  symbol: string;
  name: string;
  assetId: string; // Oracle asset identifier
  displayDecimals: number;
}

export const MARKETS: Record<string, MarketConfig> = {
  ETH: {
    index: 0,
    symbol: "ETH",
    name: "ETH-USD",
    assetId: "ETH",
    displayDecimals: 2,
  },
  BTC: {
    index: 1,
    symbol: "BTC",
    name: "BTC-USD",
    assetId: "BTC",
    displayDecimals: 2,
  },
  SOL: {
    index: 2,
    symbol: "SOL",
    name: "SOL-USD",
    assetId: "SOL",
    displayDecimals: 2,
  },
  XRP: {
    index: 3,
    symbol: "XRP",
    name: "XRP-USD",
    assetId: "XRP",
    displayDecimals: 4,
  },
  BNB: {
    index: 4,
    symbol: "BNB",
    name: "BNB-USD",
    assetId: "BNB",
    displayDecimals: 2,
  },
  DOGE: {
    index: 5,
    symbol: "DOGE",
    name: "DOGE-USD",
    assetId: "DOGE",
    displayDecimals: 5,
  },
  TRX: {
    index: 6,
    symbol: "TRX",
    name: "TRX-USD",
    assetId: "TRX",
    displayDecimals: 5,
  },
  ADA: {
    index: 7,
    symbol: "ADA",
    name: "ADA-USD",
    assetId: "ADA",
    displayDecimals: 4,
  },
  TON: {
    index: 8,
    symbol: "TON",
    name: "TON-USD",
    assetId: "TON",
    displayDecimals: 3,
  },
  LINK: {
    index: 9,
    symbol: "LINK",
    name: "LINK-USD",
    assetId: "LINK",
    displayDecimals: 3,
  },
  VIRTUAL: {
    index: 10,
    symbol: "VIRTUAL",
    name: "VIRTUAL-USD",
    assetId: "VIRTUAL",
    displayDecimals: 4,
  },
  AVAX: {
    index: 11,
    symbol: "AVAX",
    name: "AVAX-USD",
    assetId: "AVAX",
    displayDecimals: 2,
  },
  HBAR: {
    index: 12,
    symbol: "HBAR",
    name: "HBAR-USD",
    assetId: "HBAR",
    displayDecimals: 4,
  },
  SUI: {
    index: 13,
    symbol: "SUI",
    name: "SUI-USD",
    assetId: "SUI",
    displayDecimals: 3,
  },
  SHIB: {
    index: 14,
    symbol: "SHIB",
    name: "SHIB-USD",
    assetId: "SHIB",
    displayDecimals: 8,
  },
  AAVE: {
    index: 15,
    symbol: "AAVE",
    name: "AAVE-USD",
    assetId: "AAVE",
    displayDecimals: 2,
  },
  PENDLE: {
    index: 16,
    symbol: "PENDLE",
    name: "PENDLE-USD",
    assetId: "PENDLE",
    displayDecimals: 3,
  },
  UNI: {
    index: 17,
    symbol: "UNI",
    name: "UNI-USD",
    assetId: "UNI",
    displayDecimals: 3,
  },
  PEPE: {
    index: 18,
    symbol: "PEPE",
    name: "PEPE-USD",
    assetId: "PEPE",
    displayDecimals: 8,
  },
  HYPE: {
    index: 19,
    symbol: "HYPE",
    name: "HYPE-USD",
    assetId: "HYPE",
    displayDecimals: 3,
  },
  AERO: {
    index: 20,
    symbol: "AERO",
    name: "AERO-USD",
    assetId: "AERO",
    displayDecimals: 3,
  },
  BRETT: {
    index: 21,
    symbol: "BRETT",
    name: "BRETT-USD",
    assetId: "BRETT",
    displayDecimals: 4,
  },
} as const;

/**
 * Reverse lookup: market index to symbol
 */
export const MARKET_INDEX_TO_SYMBOL: Record<number, string> = Object.entries(
  MARKETS,
).reduce(
  (acc, [symbol, config]) => {
    acc[config.index] = symbol;
    return acc;
  },
  {} as Record<number, string>,
);

// ============================================================================
// PROTOCOL CONSTANTS
// ============================================================================

export const FLEX_CONSTANTS = {
  // Precision
  E30: 10n ** 30n, // Main precision for USD amounts
  E18: 10n ** 18n, // ETH/token precision
  E8: 10n ** 8n, // Some fee calculations
  E6: 10n ** 6n, // USDC precision

  // Limits
  MAX_UINT256: 2n ** 256n - 1n,
  MAX_UINT: 0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffn,
  ZERO: 0n,
  ONE: 1n,

  // Fees (in wei, ~0.0001 ETH typical)
  // TODO: Verify actual execution fee from protocol docs
  EXECUTION_FEE: 100000000000000n, // 0.0001 ETH in wei

  // Basis Points
  BPS: 10000n, // 100% = 10000 bps

  // Time Constants (seconds)
  SECONDS_PER_HOUR: 3600,
  SECONDS_PER_DAY: 86400,
  SECONDS_PER_YEAR: 31536000,

  // Subaccount Limits
  MAX_SUBACCOUNTS: 256,
  MIN_SUBACCOUNT_ID: 0,
  MAX_SUBACCOUNT_ID: 255,

  // Address Constants
  ADDRESS_ZERO: "0x0000000000000000000000000000000000000000",
  BYTE_ZERO:
    "0x0000000000000000000000000000000000000000000000000000000000000000",
} as const;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get market config by symbol
 */
export function getMarketBySymbol(symbol: string): MarketConfig {
  const market = MARKETS[symbol.toUpperCase()];
  if (!market) {
    throw new Error(`Unknown market symbol: ${symbol}`);
  }
  return market;
}

/**
 * Get market config by index
 */
export function getMarketByIndex(index: number): MarketConfig {
  const symbol = MARKET_INDEX_TO_SYMBOL[index];
  if (!symbol) {
    throw new Error(`Unknown market index: ${index}`);
  }
  return MARKETS[symbol];
}

/**
 * Get all active market indices
 */
export function getAllMarketIndices(): number[] {
  return Object.values(MARKETS).map((m) => m.index);
}

/**
 * Get all active market symbols
 */
export function getAllMarketSymbols(): string[] {
  return Object.keys(MARKETS);
}

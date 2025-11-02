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
// CHAINLINK ORACLE ADDRESSES (Base Mainnet)
// ============================================================================

/**
 * Chainlink price feed addresses on Base mainnet
 * Source: https://docs.chain.link/data-feeds/price-feeds/addresses?network=base
 */
export const CHAINLINK_ORACLE_ADDRESSES = {
  BTC_USD: "0x64c911996D3c6aC71f9b455B1E8E7266BcbD848F",
  ETH_USD: "0x71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70",
} as const;

// ============================================================================
// PYTH NETWORK ORACLE CONFIGURATION (Base Mainnet)
// ============================================================================

/**
 * Pyth Network Hermes API endpoint
 * Source: https://hermes.pyth.network
 */
export const PYTH_HERMES_ENDPOINT = "https://hermes.pyth.network";

/**
 * Pyth price feed IDs for Base mainnet (chain ID 8453)
 * Maps asset IDs to their corresponding Pyth price feed identifiers
 * Source: Flex Community SDK - https://github.com/Flex-Community/fp-sdk-python
 */
export const PYTH_PRICE_FEED_IDS: Record<string, string> = {
  BTC: "0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43",
  USDC: "0xeaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a",
  ETH: "0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace",
  BNB: "0x2f95862b045670cd22bee3114c39763a4a08beeb663b145d283c31d7d1101c4f",
  SHIB: "0xf0d57deca57b3da2fe63a493f4c25925fdfd8edf834b20f93e1f84dbd1504d4a",
  PEPE: "0xd69731a2e74ac1ce884fc3890f7ee324b6deb66147055249568869ed700882e4",
  SUI: "0x23d7315113f5b1d3ba7a83604c44b94d79f4fd69af77f804fc7f920a6dc65744",
  DOGE: "0xdcef50dd0a4cd2dcc17e45df1676dcb336a11a61c69df7a0299b0150c672d25c",
  AAVE: "0x2b9ab1e972a281585084148ba1389800799bd4be63b957507db1349314e47445",
  HBAR: "0x3728e591097635310e6341af53db8b7ee42da9b3a8d918f9463ce9cca886dfbd",
  VIRTUAL: "0x8132e3eb1dac3e56939a16ff83848d194345f6688bff97eb1c8bd462d558802b",
  ADA: "0x2a01deaec9e51a579277b34b122399984d0bbf57e2458a7e42fecd2829867a0d",
  PENDLE: "0x9a4df90b25497f66b1afb012467e316e801ca3d839456db028892fe8c70c8016",
  TRX: "0x67aed5a24fdad045475e7195c98a98aea119c763f272d4523f5bac93a4f33c2b",
  AVAX: "0x93da3352f9f1d105fdfe4971cfa80e9dd777bfc5d0f683ebb6e1294b92137bb7",
  UNI: "0x78d185a741d07edb3412b09008b7c5cfb9bbbd7d568bf00ba737b456ba171501",
  SOL: "0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d",
  LINK: "0x8ac0c70fff57e9aefdf5edf44b51d62c2d433653cbb2cf5cc06bb115af04d221",
  XRP: "0xec5d399846a9209f3fe5881d70aae9268c94339ff9817e8d18ff19fa05eea1c8",
  TON: "0x8963217838ab4cf5cadc172203c1f0b763fbaa45f346d8ee50ba994bbcac3026",
} as const;

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

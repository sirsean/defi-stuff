/**
 * Types for Polymarket API responses and BTC price predictions
 */

/**
 * Raw market data from Polymarket API
 */
export interface PolymarketMarket {
  id: string;
  question: string;
  slug: string;
  endDate: string;
  lastTradePrice: number; // 0-1 probability
  bestBid: number;
  bestAsk: number;
  volume24hr?: number;
  volume24hrClob?: number;
  liquidity?: number;
  liquidityClob?: number;
  closed: boolean;
  active?: boolean;
}

/**
 * Event grouping multiple related markets
 */
export interface PolymarketEvent {
  id: string;
  title: string;
  slug: string;
  endDate: string;
  closed: boolean;
  active?: boolean;
  markets: PolymarketMarket[];
  volume24hr?: number;
  liquidity?: number;
}

/**
 * Parsed BTC price threshold from market question
 */
export interface BTCPriceThreshold {
  price: number;
  probability: number; // 0-1
  direction: "above" | "below"; // "reach" (ceiling) vs "dip to" (floor)
  marketId: string;
  question: string;
  endDate: string;
  spread: number; // bid-ask spread
  liquidity: number;
}

/**
 * Price range segment in probability distribution
 */
export interface BTCPriceRange {
  min: number;
  max: number | null; // null = unbounded (e.g., >= $250k)
  probability: number; // 0-1
  midpoint: number; // for expected value calculation
}

/**
 * Complete BTC price prediction analysis
 */
export interface BTCPricePrediction {
  targetDate: string;
  priceThresholds: BTCPriceThreshold[];
  priceRanges: BTCPriceRange[];
  analysis: {
    expectedPrice: number;
    likelyRange: {
      min: number;
      max: number;
    };
    confidence: number; // 0-1
    sentiment:
      | "very bearish"
      | "bearish"
      | "neutral"
      | "bullish"
      | "very bullish";
  };
  metadata: {
    marketCount: number;
    totalVolume24hr: number;
    avgLiquidity: number;
    methodology: string;
  };
}

/**
 * Economic indicator category
 */
export enum EconomicIndicatorCategory {
  FED_POLICY = "FED_POLICY",
  RECESSION = "RECESSION",
  INFLATION = "INFLATION",
  SAFE_HAVEN = "SAFE_HAVEN",
  OTHER = "OTHER",
}

/**
 * Individual economic indicator from Polymarket
 */
export interface EconomicIndicator {
  id: string; // Polymarket market ID
  question: string; // Market question/title
  probability: number; // 0-1 prob. of "Yes" outcome
  volume24hr: number; // Recent trading activity (USD)
  category: EconomicIndicatorCategory;
}

/**
 * Economic sentiment for risk assets
 */
export type EconomicSentiment = "bearish" | "neutral" | "bullish";

/**
 * Summary of economic indicators and their impact on risk assets
 */
export interface EconomicIndicatorsSummary {
  indicators: EconomicIndicator[];
  analysis: string; // Human-readable synthesis of sentiment and drivers
  sentiment: EconomicSentiment;
  confidence: number; // 0-1 confidence based on signal alignment and liquidity
}

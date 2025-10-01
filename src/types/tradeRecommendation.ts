/**
 * Types for AI-powered trade recommendation system
 */

import type { FearGreedAnalysis } from "./feargreed.js";
import type { BTCPricePrediction } from "./polymarket.js";

/**
 * Possible trading actions
 */
export type TradeAction = "long" | "short" | "close" | "hold";

/**
 * Time horizon for position
 */
export type Timeframe = "short" | "medium" | "long";

/**
 * Individual trade recommendation for a specific market
 */
export interface TradeRecommendation {
  /** Market symbol (e.g., "BTC", "ETH") */
  market: string;
  /** Recommended action */
  action: TradeAction;
  /** Suggested position size in USD (optional, null for close/hold) */
  size_usd: number | null;
  /** Confidence score 0-1 (0.7+ = high confidence) */
  confidence: number;
  /** Detailed reasoning for the recommendation */
  reasoning: string;
  /** Risk factors that could invalidate the thesis */
  risk_factors: string[];
  /** Expected holding period */
  timeframe: Timeframe;
}

/**
 * Market-specific data point
 */
export interface MarketData {
  /** Market symbol */
  symbol: string;
  /** Current price in USD */
  price: number;
  /** Funding rate (as decimal, e.g. 0.0001 = 0.01%) */
  funding_rate: number;
  /** Long open interest in USD */
  long_oi: number;
  /** Short open interest in USD */
  short_oi: number;
}

/**
 * Open position summary
 */
export interface PositionSummary {
  /** Market symbol */
  market: string;
  /** Position direction */
  direction: "long" | "short";
  /** Position size in USD */
  size_usd: number;
  /** Average entry price */
  entry_price: number;
  /** Current price */
  current_price: number;
  /** Unrealized PnL in USD */
  pnl_usd: number;
  /** Unrealized PnL as percentage */
  pnl_percent: number;
  /** Current leverage */
  leverage: number;
}

/**
 * Complete market context for AI analysis
 */
export interface MarketContext {
  /** Fear & Greed Index analysis */
  fear_greed: FearGreedAnalysis;
  /** Polymarket BTC price prediction (optional if unavailable) */
  polymarket_prediction: BTCPricePrediction | null;
  /** Market-specific data for requested markets */
  markets: MarketData[];
  /** Currently open positions */
  open_positions: PositionSummary[];
  /** Total portfolio value in USD */
  portfolio_value_usd: number;
}

/**
 * Complete AI agent analysis response
 */
export interface AgentAnalysis {
  /** Array of recommendations (one per market) */
  recommendations: TradeRecommendation[];
  /** Overall market assessment */
  market_summary: string;
  /** Timestamp of analysis */
  timestamp: string;
}

/**
 * Types for AI-powered trade recommendation system
 */

import type { FearGreedAnalysis } from "./feargreed.js";
import type {
  BTCPricePrediction,
  EconomicIndicatorsSummary,
} from "./polymarket.js";

/**
 * Possible trading actions
 *
 * - **long**: Enter or maintain a long position. If currently short, flip from short to long. If flat, enter long.
 * - **short**: Enter or maintain a short position. If currently long, flip from long to short. If flat, enter short.
 * - **hold**: Maintain the current state. If flat, stay flat. If long, stay long. If short, stay short.
 * - **close**: Exit the current position and go flat. Only valid when already in a long or short position (invalid when flat).
 */
export type TradeAction = "long" | "short" | "close" | "hold";

/**
 * Current position state for a market
 *
 * - **long**: Currently holding a long position
 * - **short**: Currently holding a short position
 * - **flat**: No open position
 */
export type PositionState = "long" | "short" | "flat";

/**
 * Time horizon for position
 */
export type Timeframe = "intraday" | "short" | "medium" | "long";

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
  /**
   * The original, uncalibrated confidence score from the LLM (0-1).
   * This is the raw output before any statistical calibration is applied.
   * Value range: 0.0 to 1.0, where 1.0 represents maximum confidence.
   */
  raw_confidence: number;
  /**
   * The calibrated confidence score (0-1) based on historical performance.
   * This represents the actual probability of success after isotonic regression calibration.
   * Falls back to raw_confidence if no calibration model is available.
   * Value range: 0.0 to 1.0, where 1.0 represents maximum confidence.
   * Note: 0.7+ is generally considered "high confidence" after calibration.
   */
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
  /** Economic indicators from Polymarket (optional for backward compatibility) */
  economic_indicators: EconomicIndicatorsSummary | null;
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
  /** Market context used for analysis */
  context: MarketContext;
  /** Timestamp of analysis */
  timestamp: string;
}

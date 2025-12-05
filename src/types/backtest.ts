/**
 * Types for trade recommendation backtest analysis
 */

/**
 * Trade result details
 */
export interface TradeResult {
  market: string;
  entry_time: Date;
  exit_time: Date;
  action: "long" | "short";
  entry_price: number;
  exit_price: number;
  size_usd: number;
  confidence: number;
  raw_confidence?: number;
  pnl_usd: number;
  pnl_percent: number;
}

/**
 * Strategy performance metrics
 */
export interface StrategyPerformance {
  total_pnl_usd: number;
  total_return_percent: number;
  win_rate: number;
  avg_trade_return_usd: number;
  avg_trade_return_percent: number;
  num_trades: number;
  trades: TradeResult[];
}

/**
 * Statistics for a specific action type
 */
export interface ActionStats {
  count: number;
  win_rate: number;
  avg_pnl: number;
}

/**
 * Confidence analysis metrics
 */
export interface ConfidenceAnalysis {
  high_confidence_win_rate: number;
  low_confidence_win_rate: number;
  correlation: number;
}

/**
 * Hold mode for backtesting
 */
export type HoldMode = "maintain" | "close" | "both";

/**
 * Complete backtest analysis result for a single market
 */
export interface BacktestResult {
  // Summary
  /** Market symbol */
  market: string;
  /** Date range of analyzed recommendations */
  date_range: { start: Date; end: Date };
  /** Total number of recommendations analyzed */
  total_recommendations: number;
  /** Capital base used for return calculations */
  capital_base: number;

  // Performance comparison
  /** Performance if recommendations were followed */
  recommended_strategy: StrategyPerformance;
  /** Performance of buy and hold strategy */
  buy_and_hold_strategy: StrategyPerformance;

  // Detailed breakdowns
  /** Statistics by action type */
  by_action: {
    long: ActionStats;
    short: ActionStats;
    hold: ActionStats;
    close: ActionStats;
  };

  // Analysis
  /** Confidence vs performance relationship (using calibrated confidence) */
  confidence_analysis: ConfidenceAnalysis;
  /** Raw confidence vs performance relationship (before calibration) */
  raw_confidence_analysis?: ConfidenceAnalysis;

  // Insights
  /** Actionable suggestions for improving recommendations */
  improvement_suggestions: string[];
}

/**
 * Options for running a backtest
 */
export interface BacktestOptions {
  /** Market to analyze (e.g., "BTC") */
  market?: string;
  /** Number of days to look back */
  days?: number;
  /** Default position size in USD if not specified in recommendation */
  defaultSizeUsd?: number;
  /** Capital base to use for return calculations (e.g. current available margin) */
  capitalBase?: number;
}

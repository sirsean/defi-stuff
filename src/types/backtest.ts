/**
 * Types for trade recommendation backtest analysis
 */

/**
 * Hold mode interpretation
 */
export type HoldMode = "maintain" | "close";

/**
 * Trade action type
 */
export type Action = "long" | "short" | "hold" | "close";

/**
 * Result of a single closed trade
 */
export interface TradeResult {
  /** Market symbol (e.g., "BTC") */
  market: string;
  /** Entry timestamp */
  entry_time: Date;
  /** Exit timestamp */
  exit_time: Date;
  /** Trade direction */
  action: "long" | "short";
  /** Entry price */
  entry_price: number;
  /** Exit price */
  exit_price: number;
  /** Position size in USD */
  size_usd: number;
  /** Confidence at entry (0-1) */
  confidence: number;
  /** Profit/loss in USD */
  pnl_usd: number;
  /** Profit/loss as percentage */
  pnl_percent: number;
}

/**
 * Performance metrics for a trading strategy
 */
export interface StrategyPerformance {
  /** Total profit/loss in USD */
  total_pnl_usd: number;
  /** Total return as percentage of capital deployed */
  total_return_percent: number;
  /** Percentage of profitable trades */
  win_rate: number;
  /** Average profit/loss per trade in USD */
  avg_trade_return_usd: number;
  /** Average return per trade as percentage */
  avg_trade_return_percent: number;
  /** Number of closed trades */
  num_trades: number;
  /** List of all closed trades */
  trades: TradeResult[];
}

/**
 * Statistics for a specific action type
 */
export interface ActionStats {
  /** Number of times this action was recommended */
  count: number;
  /** Win rate for trades initiated by this action (0-100) */
  win_rate: number;
  /** Average PnL for trades initiated by this action */
  avg_pnl: number;
}

/**
 * Confidence-based performance analysis
 */
export interface ConfidenceAnalysis {
  /** Win rate for high confidence trades (>=0.7) */
  high_confidence_win_rate: number;
  /** Win rate for low confidence trades (<0.7) */
  low_confidence_win_rate: number;
  /** Pearson correlation between confidence and PnL% */
  correlation: number;
}

/**
 * Complete backtest analysis result for a single market and hold mode
 */
export interface BacktestResult {
  // Summary
  /** Market symbol */
  market: string;
  /** Date range of analyzed recommendations */
  date_range: { start: Date; end: Date };
  /** Total number of recommendations analyzed */
  total_recommendations: number;

  // Hold mode configuration
  /** How "hold" signals were interpreted */
  hold_mode: HoldMode;

  // Performance comparison
  /** Performance if recommendations were followed */
  recommended_strategy: StrategyPerformance;
  /** Performance with perfect hindsight */
  perfect_strategy: StrategyPerformance;

  // Detailed breakdowns
  /** Statistics by action type */
  by_action: {
    long: ActionStats;
    short: ActionStats;
    hold: ActionStats;
    close: ActionStats;
  };

  // Analysis
  /** Confidence vs performance relationship */
  confidence_analysis: ConfidenceAnalysis;

  // Insights
  /** Actionable suggestions for improving recommendations */
  improvement_suggestions: string[];
}

/**
 * Multi-mode backtest result container
 */
export interface MultiModeBacktestResult {
  mode: "both";
  results: BacktestResult[];
}

/**
 * Options for running a backtest
 */
export interface BacktestOptions {
  /** Market to analyze (e.g., "BTC") */
  market?: string;
  /** Number of days to look back */
  days?: number;
  /** Hold mode interpretation */
  holdMode: HoldMode | "both";
  /** Default position size in USD if not specified in recommendation */
  defaultSizeUsd?: number;
}

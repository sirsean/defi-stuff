/**
 * Types for trade recommendation backtest analysis
 */

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

/**
 * Types for confidence calibration system
 *
 * The calibration system adjusts LLM-generated confidence scores based on
 * historical performance using isotonic regression to ensure higher confidence
 * correlates with better trade outcomes.
 */

/**
 * A single point in the calibration mapping curve
 * Maps raw LLM confidence to calibrated confidence
 */
export interface CalibrationPoint {
  /** Raw confidence score from LLM (0.0 to 1.0) */
  rawConfidence: number;
  /** Calibrated confidence score based on historical performance (0.0 to 1.0) */
  calibratedConfidence: number;
}

/**
 * Complete calibration data for a market
 * Contains the mapping curve and associated metrics
 */
export interface CalibrationData {
  /** Market symbol (e.g., "BTC", "ETH") */
  market: string;
  /** Rolling window size in days used to compute calibration */
  windowDays: number;
  /** Piecewise linear calibration curve (sorted by rawConfidence ascending) */
  points: CalibrationPoint[];
  /** Number of trade recommendations used to compute this calibration */
  sampleSize: number;
  /** Pearson correlation coefficient between confidence and PnL% */
  correlation: number;
  /** Win rate for high confidence trades (confidence >= 0.7) */
  highConfWinRate: number;
  /** Win rate for low confidence trades (confidence < 0.7) */
  lowConfWinRate: number;
}

/**
 * Database record for confidence_calibrations table
 * Matches the schema created in migration
 */
export interface CalibrationRecord {
  /** Primary key */
  id?: number;
  /** When calibration was computed (timestamp in milliseconds) */
  timestamp: number;
  /** Market symbol */
  market: string;
  /** Rolling window size in days */
  window_days: number;
  /** JSON-serialized calibration points */
  calibration_data: string;
  /** Number of samples used */
  sample_size: number;
  /** Pearson correlation coefficient */
  correlation: number;
  /** Win rate for confidence >= 0.7 */
  high_conf_win_rate: number | null;
  /** Win rate for confidence < 0.7 */
  low_conf_win_rate: number | null;
}

/**
 * Trade outcome for calibration computation
 * Simplified view of a recommendation with its outcome
 */
export interface TradeOutcome {
  /** Confidence score at entry */
  confidence: number;
  /** Whether the trade was profitable (true) or not (false) */
  isWinner: boolean;
  /** Profit/loss percentage */
  pnlPercent: number;
}

/**
 * Confidence bucket for grouping trades
 * Used in isotonic regression algorithm
 */
export interface ConfidenceBucket {
  /** Lower bound of confidence range (inclusive) */
  minConfidence: number;
  /** Upper bound of confidence range (exclusive, except for last bucket) */
  maxConfidence: number;
  /** Trades in this bucket */
  outcomes: TradeOutcome[];
  /** Win rate for this bucket (0.0 to 1.0) */
  winRate: number;
  /** Sample size */
  count: number;
}

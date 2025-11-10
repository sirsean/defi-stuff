import { Knex } from "knex";
import { KnexConnector } from "./knexConnector.js";
import type {
  CalibrationData,
  CalibrationPoint,
  CalibrationRecord,
  TradeOutcome,
  ConfidenceBucket,
} from "../types/confidence.js";

/**
 * Service for computing and managing confidence calibrations
 *
 * Uses isotonic regression (pool adjacent violators algorithm) to create
 * monotonic mappings from raw LLM confidence to calibrated confidence based
 * on historical trade outcomes.
 */
export class ConfidenceCalibrationService {
  private db!: Knex;

  // HOLD evaluation configuration parameters
  private readonly OPPORTUNITY_THRESHOLD = 0.5; // 0.5% price movement required to flag missed opportunity
  private readonly MIN_CONFIDENCE_FOR_EVALUATION = 0.5; // Only evaluate HOLDs/CLOSEs above this confidence
  private readonly HOLD_PENALTY_WEIGHT = 1.0; // Weight for synthetic outcomes (1.0 = equal to real trades)

  // CLOSE evaluation configuration parameters
  private readonly CLOSE_TOO_EARLY_THRESHOLD = 0.5; // 0.5% continued movement = closed too early
  private readonly CLOSE_PENALTY_WEIGHT = 1.0; // Weight for early close penalties

  constructor() {
    this.initDatabase();
  }

  /**
   * Initialize database connection
   */
  private async initDatabase(): Promise<void> {
    this.db = await KnexConnector.getConnection("development");
  }

  /**
   * Close database connection
   */
  async close(): Promise<void> {
    await KnexConnector.destroy();
  }

  /**
   * Compute calibration mapping for a market using historical recommendations
   *
   * @param market Market symbol (e.g., "BTC", "ETH")
   * @param windowDays Rolling window size in days
   * @returns Calibration data with monotonic mapping curve
   */
  async computeCalibration(
    market: string,
    windowDays: number,
  ): Promise<CalibrationData> {
    // Ensure DB is initialized
    if (!this.db) {
      await this.initDatabase();
    }

    // Fetch recommendations for the specified window
    const cutoffTimestamp = Date.now() - windowDays * 24 * 60 * 60 * 1000;

    const recommendations = await this.db("trade_recommendations")
      .where("market", market)
      .where("timestamp", ">=", cutoffTimestamp)
      .where("action", "in", ["long", "short", "hold", "close"]) // Include HOLD and CLOSE for evaluation
      .orderBy("timestamp", "asc")
      .select("*");

    if (recommendations.length < 10) {
      throw new Error(
        `Insufficient data: need at least 10 trades, found ${recommendations.length}`,
      );
    }

    // Compute outcomes for each recommendation with position tracking
    const outcomes: TradeOutcome[] = [];

    // Track current position state to evaluate CLOSE decisions
    let currentPosition: {
      action: "long" | "short";
      entryPrice: number;
      entryIndex: number;
    } | null = null;

    for (let i = 0; i < recommendations.length - 1; i++) {
      const current = recommendations[i];
      const next = recommendations[i + 1];

      const currentPrice = Number(current.price);
      const nextPrice = Number(next.price);
      const confidence = Number(current.confidence);

      if (current.action === "hold") {
        // Evaluate HOLD for missed opportunities
        // Compute hypothetical LONG outcome
        const pnlLong = ((nextPrice - currentPrice) / currentPrice) * 100;

        // Compute hypothetical SHORT outcome
        const pnlShort = ((currentPrice - nextPrice) / currentPrice) * 100;

        // Determine if this was a missed opportunity
        const missedLong =
          pnlLong > this.OPPORTUNITY_THRESHOLD &&
          confidence >= this.MIN_CONFIDENCE_FOR_EVALUATION;
        const missedShort =
          pnlShort > this.OPPORTUNITY_THRESHOLD &&
          confidence >= this.MIN_CONFIDENCE_FOR_EVALUATION;

        if (missedLong || missedShort) {
          // Add synthetic outcome for missed opportunity
          const bestPnl = Math.max(pnlLong, pnlShort);
          outcomes.push({
            confidence,
            isWinner: false, // Penalize for missing opportunity
            pnlPercent: -Math.abs(bestPnl) * this.HOLD_PENALTY_WEIGHT,
          });
        }
        // If not a missed opportunity, no outcome is added (correct HOLD)
      } else if (current.action === "long") {
        // Opening or maintaining LONG position
        if (!currentPosition || currentPosition.action !== "long") {
          // Opening new LONG position or flipping from SHORT
          if (currentPosition && currentPosition.action === "short") {
            // Closing SHORT, opening LONG - evaluate the SHORT close
            const pnlPercent =
              ((currentPosition.entryPrice - currentPrice) /
                currentPosition.entryPrice) *
              100;
            const entryRec = recommendations[currentPosition.entryIndex];
            outcomes.push({
              confidence: Number(entryRec.confidence),
              isWinner: pnlPercent > 0,
              pnlPercent,
            });
          }
          currentPosition = {
            action: "long",
            entryPrice: currentPrice,
            entryIndex: i,
          };
        }
        // If already LONG, maintain (no additional outcome)
      } else if (current.action === "short") {
        // Opening or maintaining SHORT position
        if (!currentPosition || currentPosition.action !== "short") {
          // Opening new SHORT position or flipping from LONG
          if (currentPosition && currentPosition.action === "long") {
            // Closing LONG, opening SHORT - evaluate the LONG close
            const pnlPercent =
              ((currentPrice - currentPosition.entryPrice) /
                currentPosition.entryPrice) *
              100;
            const entryRec = recommendations[currentPosition.entryIndex];
            outcomes.push({
              confidence: Number(entryRec.confidence),
              isWinner: pnlPercent > 0,
              pnlPercent,
            });
          }
          currentPosition = {
            action: "short",
            entryPrice: currentPrice,
            entryIndex: i,
          };
        }
        // If already SHORT, maintain (no additional outcome)
      } else if (current.action === "close") {
        // Evaluate CLOSE decision
        if (
          currentPosition &&
          confidence >= this.MIN_CONFIDENCE_FOR_EVALUATION
        ) {
          // Calculate P/L at close
          let pnlAtClose: number;
          if (currentPosition.action === "long") {
            pnlAtClose =
              ((currentPrice - currentPosition.entryPrice) /
                currentPosition.entryPrice) *
              100;
          } else {
            pnlAtClose =
              ((currentPosition.entryPrice - currentPrice) /
                currentPosition.entryPrice) *
              100;
          }

          // Calculate what would have happened if we held until next price
          let pnlIfHeld: number;
          if (currentPosition.action === "long") {
            pnlIfHeld =
              ((nextPrice - currentPosition.entryPrice) /
                currentPosition.entryPrice) *
              100;
          } else {
            pnlIfHeld =
              ((currentPosition.entryPrice - nextPrice) /
                currentPosition.entryPrice) *
              100;
          }

          // Check if we closed too early (price continued favorably)
          const missedGain = pnlIfHeld - pnlAtClose;
          const closedTooEarly = missedGain > this.CLOSE_TOO_EARLY_THRESHOLD;

          if (closedTooEarly) {
            // Penalize for closing too early
            outcomes.push({
              confidence,
              isWinner: false,
              pnlPercent: -Math.abs(missedGain) * this.CLOSE_PENALTY_WEIGHT,
            });
          } else {
            // Good close (price reversed or didn't move much)
            // Reward based on how much drawdown we avoided
            const drawdownAvoided = Math.abs(Math.min(0, missedGain));
            outcomes.push({
              confidence,
              isWinner: true,
              pnlPercent: drawdownAvoided,
            });
          }

          // Record the original P/L from the position entry
          const entryRec = recommendations[currentPosition.entryIndex];
          outcomes.push({
            confidence: Number(entryRec.confidence),
            isWinner: pnlAtClose > 0,
            pnlPercent: pnlAtClose,
          });
        }

        // Position is now closed
        currentPosition = null;
      }
    }

    // Close any remaining position at last price
    if (currentPosition) {
      const lastRec = recommendations[recommendations.length - 1];
      const lastPrice = Number(lastRec.price);
      let pnlPercent: number;

      if (currentPosition.action === "long") {
        pnlPercent =
          ((lastPrice - currentPosition.entryPrice) /
            currentPosition.entryPrice) *
          100;
      } else {
        pnlPercent =
          ((currentPosition.entryPrice - lastPrice) /
            currentPosition.entryPrice) *
          100;
      }

      const entryRec = recommendations[currentPosition.entryIndex];
      outcomes.push({
        confidence: Number(entryRec.confidence),
        isWinner: pnlPercent > 0,
        pnlPercent,
      });
    }

    // Group outcomes into confidence buckets
    const buckets = this.createConfidenceBuckets(outcomes);

    // Apply isotonic regression (pool adjacent violators)
    const calibratedBuckets = this.isotonicRegression(buckets);

    // Convert buckets to calibration points
    const points = this.bucketsToPoints(calibratedBuckets);

    // Compute correlation and win rates
    const correlation = this.computeCorrelation(outcomes);
    const { highWinRate, lowWinRate } = this.computeWinRates(outcomes);

    return {
      market,
      windowDays,
      points,
      sampleSize: outcomes.length,
      correlation,
      highConfWinRate: highWinRate,
      lowConfWinRate: lowWinRate,
    };
  }

  /**
   * Group trade outcomes into confidence buckets
   * Uses 0.1 increments (0.0-0.1, 0.1-0.2, ..., 0.9-1.0)
   */
  private createConfidenceBuckets(
    outcomes: TradeOutcome[],
  ): ConfidenceBucket[] {
    const buckets: ConfidenceBucket[] = [];

    // Create 10 buckets: [0.0, 0.1), [0.1, 0.2), ..., [0.9, 1.0]
    for (let i = 0; i < 10; i++) {
      const minConfidence = i / 10;
      const maxConfidence = (i + 1) / 10;

      const bucketOutcomes = outcomes.filter(
        (o) =>
          o.confidence >= minConfidence &&
          (i === 9
            ? o.confidence <= maxConfidence
            : o.confidence < maxConfidence),
      );

      const winners = bucketOutcomes.filter((o) => o.isWinner).length;
      const winRate =
        bucketOutcomes.length > 0 ? winners / bucketOutcomes.length : 0;

      buckets.push({
        minConfidence,
        maxConfidence,
        outcomes: bucketOutcomes,
        winRate,
        count: bucketOutcomes.length,
      });
    }

    return buckets;
  }

  /**
   * Apply isotonic regression using pool adjacent violators algorithm
   * Ensures win rate is monotonically increasing with confidence
   *
   * @param buckets Original confidence buckets
   * @returns Calibrated buckets with monotonic win rates
   */
  private isotonicRegression(buckets: ConfidenceBucket[]): ConfidenceBucket[] {
    // Skip empty buckets
    const nonEmptyBuckets = buckets.filter((b) => b.count > 0);

    if (nonEmptyBuckets.length === 0) {
      return buckets;
    }

    // Pool adjacent violators algorithm
    const calibrated = [...nonEmptyBuckets];
    let changed = true;

    while (changed) {
      changed = false;

      for (let i = 0; i < calibrated.length - 1; i++) {
        // If win rate violates monotonicity (current >= next)
        if (calibrated[i].winRate > calibrated[i + 1].winRate) {
          // Pool these two buckets
          const pooledWinRate =
            (calibrated[i].winRate * calibrated[i].count +
              calibrated[i + 1].winRate * calibrated[i + 1].count) /
            (calibrated[i].count + calibrated[i + 1].count);

          const pooledCount = calibrated[i].count + calibrated[i + 1].count;

          const pooledOutcomes = [
            ...calibrated[i].outcomes,
            ...calibrated[i + 1].outcomes,
          ];

          // Replace both buckets with the pooled bucket
          calibrated[i] = {
            minConfidence: calibrated[i].minConfidence,
            maxConfidence: calibrated[i + 1].maxConfidence,
            outcomes: pooledOutcomes,
            winRate: pooledWinRate,
            count: pooledCount,
          };

          // Remove the next bucket
          calibrated.splice(i + 1, 1);
          changed = true;
          break; // Restart from beginning
        }
      }
    }

    return calibrated;
  }

  /**
   * Convert calibrated buckets to calibration points
   * Creates piecewise linear mapping curve
   */
  private bucketsToPoints(buckets: ConfidenceBucket[]): CalibrationPoint[] {
    const points: CalibrationPoint[] = [];

    // Always start at (0.0, 0.0)
    points.push({ rawConfidence: 0.0, calibratedConfidence: 0.0 });

    // Add midpoint of each bucket
    for (const bucket of buckets) {
      const rawConfidence = (bucket.minConfidence + bucket.maxConfidence) / 2;
      // Clamp calibrated confidence to [0, 1]
      const calibratedConfidence = Math.max(0, Math.min(1, bucket.winRate));

      points.push({
        rawConfidence,
        calibratedConfidence,
      });
    }

    // Always end at (1.0, max_win_rate) or (1.0, 1.0) if we have data at high confidence
    const lastPoint = points[points.length - 1];
    if (lastPoint.rawConfidence < 1.0) {
      points.push({
        rawConfidence: 1.0,
        calibratedConfidence: Math.max(
          0,
          Math.min(1, lastPoint.calibratedConfidence),
        ),
      });
    }

    return points;
  }

  /**
   * Compute Pearson correlation between confidence and PnL%
   */
  private computeCorrelation(outcomes: TradeOutcome[]): number {
    if (outcomes.length < 2) return 0;

    const confidences = outcomes.map((o) => o.confidence);
    const pnls = outcomes.map((o) => o.pnlPercent);

    const meanConf =
      confidences.reduce((a, b) => a + b, 0) / confidences.length;
    const meanPnl = pnls.reduce((a, b) => a + b, 0) / pnls.length;

    let numerator = 0;
    let sumSqConf = 0;
    let sumSqPnl = 0;

    for (let i = 0; i < outcomes.length; i++) {
      const dConf = confidences[i] - meanConf;
      const dPnl = pnls[i] - meanPnl;

      numerator += dConf * dPnl;
      sumSqConf += dConf * dConf;
      sumSqPnl += dPnl * dPnl;
    }

    const denominator = Math.sqrt(sumSqConf * sumSqPnl);
    return denominator === 0 ? 0 : numerator / denominator;
  }

  /**
   * Compute win rates for high and low confidence trades
   */
  private computeWinRates(outcomes: TradeOutcome[]): {
    highWinRate: number;
    lowWinRate: number;
  } {
    const highConfOutcomes = outcomes.filter((o) => o.confidence >= 0.7);
    const lowConfOutcomes = outcomes.filter((o) => o.confidence < 0.7);

    const highWinRate =
      highConfOutcomes.length > 0
        ? highConfOutcomes.filter((o) => o.isWinner).length /
          highConfOutcomes.length
        : 0;

    const lowWinRate =
      lowConfOutcomes.length > 0
        ? lowConfOutcomes.filter((o) => o.isWinner).length /
          lowConfOutcomes.length
        : 0;

    return { highWinRate, lowWinRate };
  }

  /**
   * Save calibration data to database
   */
  async saveCalibration(calibration: CalibrationData): Promise<number> {
    // Ensure DB is initialized
    if (!this.db) {
      await this.initDatabase();
    }

    const record: Omit<CalibrationRecord, "id"> = {
      timestamp: Date.now(),
      market: calibration.market,
      window_days: calibration.windowDays,
      calibration_data: JSON.stringify(calibration.points),
      sample_size: calibration.sampleSize,
      correlation: calibration.correlation,
      high_conf_win_rate: calibration.highConfWinRate,
      low_conf_win_rate: calibration.lowConfWinRate,
    };

    const [id] = await this.db("confidence_calibrations").insert(record);
    return id;
  }

  /**
   * Get the most recent calibration for a market
   *
   * @param market Market symbol
   * @returns Calibration data or null if none exists
   */
  async getLatestCalibration(market: string): Promise<CalibrationData | null> {
    // Ensure DB is initialized
    if (!this.db) {
      await this.initDatabase();
    }

    const record = await this.db("confidence_calibrations")
      .where("market", market)
      .orderBy("timestamp", "desc")
      .first();

    if (!record) {
      return null;
    }

    return this.recordToCalibrationData(record);
  }

  /**
   * Get the timestamp of the most recent calibration for a market
   *
   * @param market Market symbol
   * @returns Timestamp in milliseconds or null if none exists
   */
  async getLatestCalibrationTimestamp(market: string): Promise<number | null> {
    // Ensure DB is initialized
    if (!this.db) {
      await this.initDatabase();
    }

    const record = await this.db("confidence_calibrations")
      .where("market", market)
      .orderBy("timestamp", "desc")
      .first();

    return record ? Number(record.timestamp) : null;
  }

  /**
   * Check if a market's calibration is stale
   *
   * @param market Market symbol
   * @param maxAgeDays Maximum age in days before considering stale
   * @returns true if stale or missing, false if fresh
   */
  async isCalibrationStale(
    market: string,
    maxAgeDays: number = 7,
  ): Promise<boolean> {
    const latest = await this.getLatestCalibration(market);

    if (!latest) {
      return true; // No calibration exists
    }

    // Check if exists in database and get timestamp
    const record = await this.db("confidence_calibrations")
      .where("market", market)
      .orderBy("timestamp", "desc")
      .first();

    if (!record) {
      return true;
    }

    const ageMs = Date.now() - Number(record.timestamp);
    const ageDays = ageMs / (24 * 60 * 60 * 1000);

    return ageDays > maxAgeDays;
  }

  /**
   * Apply calibration to a raw confidence score
   * Uses linear interpolation between calibration points
   *
   * @param rawScore Raw LLM confidence (0.0 to 1.0)
   * @param calibration Calibration data
   * @returns Calibrated confidence score (0.0 to 1.0)
   */
  applyCalibration(rawScore: number, calibration: CalibrationData): number {
    // Clamp to [0, 1]
    const score = Math.max(0, Math.min(1, rawScore));

    const points = calibration.points;

    // Handle edge cases
    if (points.length === 0) {
      return score; // No calibration available
    }

    if (points.length === 1) {
      return points[0].calibratedConfidence;
    }

    // Find the two points to interpolate between
    let lowerPoint = points[0];
    let upperPoint = points[points.length - 1];

    for (let i = 0; i < points.length - 1; i++) {
      if (
        score >= points[i].rawConfidence &&
        score <= points[i + 1].rawConfidence
      ) {
        lowerPoint = points[i];
        upperPoint = points[i + 1];
        break;
      }
    }

    // Handle exact matches
    if (score === lowerPoint.rawConfidence) {
      return lowerPoint.calibratedConfidence;
    }
    if (score === upperPoint.rawConfidence) {
      return upperPoint.calibratedConfidence;
    }

    // Linear interpolation
    const range = upperPoint.rawConfidence - lowerPoint.rawConfidence;
    if (range === 0) {
      return lowerPoint.calibratedConfidence;
    }

    const ratio = (score - lowerPoint.rawConfidence) / range;
    const calibrated =
      lowerPoint.calibratedConfidence +
      ratio *
        (upperPoint.calibratedConfidence - lowerPoint.calibratedConfidence);

    return Math.max(0, Math.min(1, calibrated));
  }

  /**
   * Convert database record to CalibrationData
   */
  private recordToCalibrationData(record: CalibrationRecord): CalibrationData {
    const points = JSON.parse(record.calibration_data) as CalibrationPoint[];

    return {
      market: record.market,
      windowDays: record.window_days,
      points,
      sampleSize: record.sample_size,
      correlation: record.correlation,
      highConfWinRate: record.high_conf_win_rate || 0,
      lowConfWinRate: record.low_conf_win_rate || 0,
    };
  }
}

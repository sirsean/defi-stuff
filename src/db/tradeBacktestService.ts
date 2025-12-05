import { Knex } from "knex";
import { KnexConnector } from "./knexConnector.js";
import {
  TradeRecommendationService,
  type TradeRecommendationRecord,
} from "./tradeRecommendationService.js";
import type {
  BacktestResult,
  BacktestOptions,
  HoldMode,
  TradeResult,
  StrategyPerformance,
  ActionStats,
  ConfidenceAnalysis,
} from "../types/backtest.js";

/**
 * Service for backtesting trade recommendations against historical prices
 */
export class TradeBacktestService {
  private db!: Knex;
  private tradeRecommendationService: TradeRecommendationService;
  private defaultSizeUsd: number;

  constructor(
    tradeRecommendationService?: TradeRecommendationService,
    defaultSizeUsd: number = 1000,
  ) {
    this.tradeRecommendationService =
      tradeRecommendationService || new TradeRecommendationService();
    this.defaultSizeUsd = defaultSizeUsd;
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
   * Run backtest analysis
   */
  async run(options: BacktestOptions): Promise<BacktestResult> {
    const { market, days, capitalBase = 0 } = options;

    // Fetch and preprocess recommendations
    const recs = await this.fetchRecommendations({ market, days });

    if (recs.length === 0) {
      throw new Error("No recommendations found for the specified criteria");
    }

    // Get market from recommendations
    const recMarket = recs[0].market;

    // Simulate recommended strategy
    const recommendedTrades = this.simulateRecommendedStrategy(recs);

    // Simulate buy and hold strategy
    const buyAndHoldTrades = this.simulateBuyAndHold(recs, capitalBase);

    // Compute performance metrics
    const recommendedPerf = this.computePerformance(
      recommendedTrades,
      capitalBase,
    );
    const buyAndHoldPerf = this.computePerformance(
      buyAndHoldTrades,
      capitalBase,
    );

    // Compute action breakdown
    const byAction = this.computeActionBreakdown(recs, recommendedTrades);

    // Compute confidence analysis (calibrated)
    const confidenceAnalysis =
      this.computeConfidenceAnalysis(recommendedTrades);

    // Compute raw confidence analysis (before calibration)
    const rawConfidenceAnalysis =
      this.computeRawConfidenceAnalysis(recommendedTrades);

    // Generate improvement suggestions
    const improvementSuggestions = this.generateSuggestions(
      recommendedPerf,
      buyAndHoldPerf,
      byAction,
      confidenceAnalysis,
      rawConfidenceAnalysis,
    );

    // Build result
    return {
      market: recMarket,
      date_range: {
        start: new Date(recs[0].timestamp),
        end: new Date(recs[recs.length - 1].timestamp),
      },
      total_recommendations: recs.length,
      capital_base: capitalBase,
      recommended_strategy: recommendedPerf,
      buy_and_hold_strategy: buyAndHoldPerf,
      by_action: byAction,
      confidence_analysis: confidenceAnalysis,
      raw_confidence_analysis: rawConfidenceAnalysis,
      improvement_suggestions: improvementSuggestions,
    };
  }

  /**
   * Fetch recommendations from database
   */
  private async fetchRecommendations(options: {
    market?: string;
    days?: number;
  }): Promise<TradeRecommendationRecord[]> {
    const { market, days } = options;

    // Ensure DB is initialized
    if (!this.db) {
      await this.initDatabase();
    }

    let query = this.db("trade_recommendations").orderBy("timestamp", "asc");

    // Filter by market if specified
    if (market) {
      query = query.where({ market: market.toUpperCase() });
    }

    // Filter by days if specified
    if (days && days > 0) {
      const cutoffDate = Date.now() - days * 24 * 60 * 60 * 1000;
      query = query.where("timestamp", ">=", cutoffDate);
    }

    const results = await query;

    // Parse risk_factors if needed
    return results.map((rec) => {
      if (rec.risk_factors && typeof rec.risk_factors === "string") {
        try {
          rec.risk_factors = JSON.parse(rec.risk_factors);
        } catch (e) {
          rec.risk_factors = null;
        }
      }
      return rec;
    });
  }

  /**
   * Simulate recommended strategy with position tracking
   */
  private simulateRecommendedStrategy(
    recs: TradeRecommendationRecord[],
  ): TradeResult[] {
    const trades: TradeResult[] = [];
    let currentPosition: {
      action: "long" | "short";
      entry_price: number;
      entry_time: Date;
      size_usd: number;
      confidence: number;
      raw_confidence?: number;
    } | null = null;

    for (const rec of recs) {
      const action = rec.action;
      const price = Number(rec.price);
      const timestamp = new Date(rec.timestamp);
      const sizeUsd = rec.size_usd ? Number(rec.size_usd) : this.defaultSizeUsd;
      const confidence = Number(rec.confidence);
      const rawConfidence = rec.raw_confidence
        ? Number(rec.raw_confidence)
        : undefined;

      if (action === "long" || action === "short") {
        // If we have an opposite position, close it first (flip)
        if (currentPosition && currentPosition.action !== action) {
          const trade = this.closeTrade(
            currentPosition,
            price,
            timestamp,
            recs[0].market,
          );
          trades.push(trade);
          currentPosition = null;
        }

        // If flat or flipped, open new position
        if (!currentPosition) {
          currentPosition = {
            action,
            entry_price: price,
            entry_time: timestamp,
            size_usd: sizeUsd,
            confidence,
            raw_confidence: rawConfidence,
          };
        }
        // If same direction, maintain (no re-entry)
      } else if (action === "close") {
        // Close position if open (no-op if flat)
        if (currentPosition) {
          const trade = this.closeTrade(
            currentPosition,
            price,
            timestamp,
            recs[0].market,
          );
          trades.push(trade);
          currentPosition = null;
        }
        // If flat, this is a no-op
      } else if (action === "hold") {
        // Hold maintains current state (flat stays flat, long stays long, short stays short)
        // No action needed - state stays as is
      }
    }

    // Close any remaining position at last price
    if (currentPosition) {
      const lastRec = recs[recs.length - 1];
      const trade = this.closeTrade(
        currentPosition,
        Number(lastRec.price),
        new Date(lastRec.timestamp),
        recs[0].market,
      );
      trades.push(trade);
    }

    return trades;
  }

  /**
   * Close a trade and compute PnL
   */
  private closeTrade(
    position: {
      action: "long" | "short";
      entry_price: number;
      entry_time: Date;
      size_usd: number;
      confidence: number;
      raw_confidence?: number;
    },
    exitPrice: number,
    exitTime: Date,
    market: string,
  ): TradeResult {
    let pnlUsd: number;
    let pnlPercent: number;

    if (position.action === "long") {
      pnlPercent = (exitPrice / position.entry_price - 1) * 100;
      pnlUsd = position.size_usd * (exitPrice / position.entry_price - 1);
    } else {
      // short
      pnlPercent = (1 - exitPrice / position.entry_price) * 100;
      pnlUsd = position.size_usd * (1 - exitPrice / position.entry_price);
    }

    return {
      market,
      entry_time: position.entry_time,
      exit_time: exitTime,
      action: position.action,
      entry_price: position.entry_price,
      exit_price: exitPrice,
      size_usd: position.size_usd,
      confidence: position.confidence,
      raw_confidence: position.raw_confidence,
      pnl_usd: pnlUsd,
      pnl_percent: pnlPercent,
    };
  }

  /**
   * Simulate Buy and Hold strategy
   * Enters long at start, exits at end.
   */
  private simulateBuyAndHold(
    recs: TradeRecommendationRecord[],
    capitalBase: number,
  ): TradeResult[] {
    if (recs.length < 2) return [];

    const startRec = recs[0];
    const endRec = recs[recs.length - 1];

    const startPrice = Number(startRec.price);
    const endPrice = Number(endRec.price);

    // Use capitalBase if available, otherwise defaultSizeUsd
    const sizeUsd = capitalBase > 0 ? capitalBase : this.defaultSizeUsd;

    // Calculate PnL
    const pnlPercent = (endPrice / startPrice - 1) * 100;
    const pnlUsd = sizeUsd * (endPrice / startPrice - 1);

    return [
      {
        market: startRec.market,
        entry_time: new Date(startRec.timestamp),
        exit_time: new Date(endRec.timestamp),
        action: "long",
        entry_price: startPrice,
        exit_price: endPrice,
        size_usd: sizeUsd,
        confidence: 1.0, // N/A
        pnl_usd: pnlUsd,
        pnl_percent: pnlPercent,
      },
    ];
  }

  /**
   * Compute performance metrics from trades
   */
  private computePerformance(
    trades: TradeResult[],
    capitalBase: number,
  ): StrategyPerformance {
    if (trades.length === 0) {
      return {
        total_pnl_usd: 0,
        total_return_percent: 0,
        win_rate: 0,
        avg_trade_return_usd: 0,
        avg_trade_return_percent: 0,
        num_trades: 0,
        trades: [],
      };
    }

    const totalPnl = this.sum(trades.map((t) => t.pnl_usd));
    const totalSizeUsd = this.sum(trades.map((t) => t.size_usd));

    // Determine denominator for return calculation
    // If capitalBase is provided (>0), use it.
    // Otherwise, fall back to the maximum position size used in any single trade.
    // This assumes a sequential trading strategy where capital is reused.
    const denominator =
      capitalBase > 0
        ? capitalBase
        : Math.max(...trades.map((t) => t.size_usd), 1); // Avoid div by zero

    const totalReturnPercent = (totalPnl / denominator) * 100;

    const winningTrades = trades.filter((t) => t.pnl_usd > 0);
    const winRate = (winningTrades.length / trades.length) * 100;

    const avgPnlUsd = this.mean(trades.map((t) => t.pnl_usd));
    const avgPnlPercent = this.mean(trades.map((t) => t.pnl_percent));

    return {
      total_pnl_usd: totalPnl,
      total_return_percent: totalReturnPercent,
      win_rate: winRate,
      avg_trade_return_usd: avgPnlUsd,
      avg_trade_return_percent: avgPnlPercent,
      num_trades: trades.length,
      trades,
    };
  }

  /**
   * Compute action breakdown stats
   */
  private computeActionBreakdown(
    recs: TradeRecommendationRecord[],
    trades: TradeResult[],
  ): {
    long: ActionStats;
    short: ActionStats;
    hold: ActionStats;
    close: ActionStats;
  } {
    // Count occurrences of each action in recommendations
    const longCount = recs.filter((r) => r.action === "long").length;
    const shortCount = recs.filter((r) => r.action === "short").length;
    const holdCount = recs.filter((r) => r.action === "hold").length;
    const closeCount = recs.filter((r) => r.action === "close").length;

    // Compute stats for trades by entry action
    const longTrades = trades.filter((t) => t.action === "long");
    const shortTrades = trades.filter((t) => t.action === "short");

    const longStats = this.computeActionStats(longTrades, longCount);
    const shortStats = this.computeActionStats(shortTrades, shortCount);

    return {
      long: longStats,
      short: shortStats,
      hold: { count: holdCount, win_rate: 0, avg_pnl: 0 },
      close: { count: closeCount, win_rate: 0, avg_pnl: 0 },
    };
  }

  /**
   * Compute stats for a specific action's trades
   */
  private computeActionStats(
    trades: TradeResult[],
    count: number,
  ): ActionStats {
    if (trades.length === 0) {
      return { count, win_rate: 0, avg_pnl: 0 };
    }

    const winningTrades = trades.filter((t) => t.pnl_usd > 0);
    const winRate = (winningTrades.length / trades.length) * 100;
    const avgPnl = this.mean(trades.map((t) => t.pnl_usd));

    return { count, win_rate: winRate, avg_pnl: avgPnl };
  }

  /**
   * Compute confidence analysis
   */
  private computeConfidenceAnalysis(trades: TradeResult[]): ConfidenceAnalysis {
    if (trades.length === 0) {
      return {
        high_confidence_win_rate: 0,
        low_confidence_win_rate: 0,
        correlation: 0,
      };
    }

    const highConfTrades = trades.filter((t) => t.confidence >= 0.7);
    const lowConfTrades = trades.filter((t) => t.confidence < 0.7);

    const highWinRate =
      highConfTrades.length > 0
        ? (highConfTrades.filter((t) => t.pnl_usd > 0).length /
            highConfTrades.length) *
          100
        : 0;

    const lowWinRate =
      lowConfTrades.length > 0
        ? (lowConfTrades.filter((t) => t.pnl_usd > 0).length /
            lowConfTrades.length) *
          100
        : 0;

    // Compute Pearson correlation
    const correlation = this.pearsonCorrelation(
      trades.map((t) => t.confidence),
      trades.map((t) => t.pnl_percent),
    );

    return {
      high_confidence_win_rate: highWinRate,
      low_confidence_win_rate: lowWinRate,
      correlation,
    };
  }

  /**
   * Compute confidence analysis using raw confidence scores (before calibration)
   */
  private computeRawConfidenceAnalysis(
    trades: TradeResult[],
  ): ConfidenceAnalysis | undefined {
    // Check if trades have raw_confidence data
    const hasRawConfidence = trades.some((t) => t.raw_confidence !== undefined);
    if (!hasRawConfidence || trades.length === 0) {
      return undefined;
    }

    // Filter out trades without raw confidence (shouldn't happen, but be safe)
    const tradesWithRaw = trades.filter((t) => t.raw_confidence !== undefined);

    const highConfTrades = tradesWithRaw.filter(
      (t) => t.raw_confidence! >= 0.7,
    );
    const lowConfTrades = tradesWithRaw.filter((t) => t.raw_confidence! < 0.7);

    const highWinRate =
      highConfTrades.length > 0
        ? (highConfTrades.filter((t) => t.pnl_usd > 0).length /
            highConfTrades.length) *
          100
        : 0;

    const lowWinRate =
      lowConfTrades.length > 0
        ? (lowConfTrades.filter((t) => t.pnl_usd > 0).length /
            lowConfTrades.length) *
          100
        : 0;

    // Compute Pearson correlation using raw confidence
    const correlation = this.pearsonCorrelation(
      tradesWithRaw.map((t) => t.raw_confidence!),
      tradesWithRaw.map((t) => t.pnl_percent),
    );

    return {
      high_confidence_win_rate: highWinRate,
      low_confidence_win_rate: lowWinRate,
      correlation,
    };
  }

  /**
   * Generate improvement suggestions based on analysis
   */
  private generateSuggestions(
    recommended: StrategyPerformance,
    buyAndHold: StrategyPerformance,
    byAction: {
      long: ActionStats;
      short: ActionStats;
      hold: ActionStats;
      close: ActionStats;
    },
    confidence: ConfidenceAnalysis,
    rawConfidence: ConfidenceAnalysis | undefined,
  ): string[] {
    const suggestions: string[] = [];

    // 1. Confidence calibration analysis
    if (rawConfidence) {
      const correlationImprovement =
        confidence.correlation - rawConfidence.correlation;

      if (correlationImprovement > 0.1) {
        // Calibration is working well
        suggestions.push(
          `Calibration improved correlation by ${correlationImprovement.toFixed(2)} (${rawConfidence.correlation.toFixed(2)} → ${confidence.correlation.toFixed(2)}). Good job!`,
        );
      } else if (correlationImprovement < -0.1) {
        // Calibration made things worse
        suggestions.push(
          `Calibration degraded correlation by ${Math.abs(correlationImprovement).toFixed(2)}. Consider recomputing calibration with more recent data.`,
        );
      }

      // Suggest calibration if raw confidence is poor and not yet calibrated
      if (
        rawConfidence.correlation < 0.3 &&
        Math.abs(correlationImprovement) < 0.05
      ) {
        suggestions.push(
          `Raw confidence correlation is low (r=${rawConfidence.correlation.toFixed(2)}). Run 'confidence:calibrate -m ${recommended.trades[0]?.market || "MARKET"}' to improve.`,
        );
      }
    } else {
      // No raw confidence data - legacy recommendations
      if (
        confidence.high_confidence_win_rate < confidence.low_confidence_win_rate
      ) {
        suggestions.push(
          "High-confidence signals underperform low-confidence. Consider running confidence calibration.",
        );
      }
    }

    // 2. Confidence scaling
    if (confidence.correlation > 0.3) {
      suggestions.push(
        `Scale position size with confidence (r=${confidence.correlation.toFixed(2)} shows predictive value).`,
      );
    } else if (confidence.correlation < -0.3) {
      suggestions.push(
        `Negative confidence correlation (r=${confidence.correlation.toFixed(2)}); consider inverting confidence weighting.`,
      );
    }

    // 2. Action bias detection
    const longWinRate = byAction.long.win_rate;
    const shortWinRate = byAction.short.win_rate;

    if (longWinRate - shortWinRate > 10) {
      suggestions.push(
        `Long bias detected: long win rate ${longWinRate.toFixed(1)}% vs short ${shortWinRate.toFixed(1)}%. Filter weak short signals.`,
      );
    } else if (shortWinRate - longWinRate > 10) {
      suggestions.push(
        `Short bias detected: short win rate ${shortWinRate.toFixed(1)}% vs long ${longWinRate.toFixed(1)}%. Filter weak long signals.`,
      );
    }

    // 3. Performance vs Buy and Hold
    if (buyAndHold.total_pnl_usd > 0) {
      const gap =
        ((buyAndHold.total_pnl_usd - recommended.total_pnl_usd) /
          buyAndHold.total_pnl_usd) *
        100;
      if (gap > 20) {
        suggestions.push(
          `Strategy underperforming Buy & Hold by ${gap.toFixed(1)}%. Consider holding winners longer.`,
        );
      }
    }

    // 4. Low win rate suggestion
    if (recommended.win_rate < 50) {
      suggestions.push(
        `Win rate below 50% (${recommended.win_rate.toFixed(1)}%); consider raising confidence threshold or filtering signals.`,
      );
    }

    // 5. Position sizing if high variance in sizes
    const sizesVary =
      recommended.trades.length > 0 &&
      this.stdev(recommended.trades.map((t) => t.size_usd)) >
        this.mean(recommended.trades.map((t) => t.size_usd)) * 0.5;

    if (sizesVary) {
      suggestions.push(
        "High variance in position sizes; consider normalizing or using volatility-based sizing.",
      );
    }

    // Cap at 6 suggestions
    return suggestions.slice(0, 6);
  }

  // ============================================================================
  // Utility functions
  // ============================================================================

  private sum(arr: number[]): number {
    return arr.reduce((a, b) => a + b, 0);
  }

  private mean(arr: number[]): number {
    if (arr.length === 0) return 0;
    return this.sum(arr) / arr.length;
  }

  private stdev(arr: number[]): number {
    if (arr.length === 0) return 0;
    const avg = this.mean(arr);
    const squareDiffs = arr.map((val) => Math.pow(val - avg, 2));
    const avgSquareDiff = this.mean(squareDiffs);
    return Math.sqrt(avgSquareDiff);
  }

  /**
   * Compute Pearson correlation coefficient
   */
  private pearsonCorrelation(x: number[], y: number[]): number {
    if (x.length !== y.length || x.length < 2) return 0;

    const n = x.length;
    const meanX = this.mean(x);
    const meanY = this.mean(y);

    let numerator = 0;
    let sumSqX = 0;
    let sumSqY = 0;

    for (let i = 0; i < n; i++) {
      const dx = x[i] - meanX;
      const dy = y[i] - meanY;
      numerator += dx * dy;
      sumSqX += dx * dx;
      sumSqY += dy * dy;
    }

    const denominator = Math.sqrt(sumSqX * sumSqY);
    if (denominator === 0) return 0;

    return numerator / denominator;
  }
}

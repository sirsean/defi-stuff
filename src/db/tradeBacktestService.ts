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
  async run(options: BacktestOptions): Promise<BacktestResult | BacktestResult[]> {
    const { holdMode, market, days } = options;

    // Fetch and preprocess recommendations
    const recs = await this.fetchRecommendations({ market, days });

    if (recs.length === 0) {
      throw new Error("No recommendations found for the specified criteria");
    }

    // If hold mode is "both", run twice
    if (holdMode === "both") {
      const maintainResult = await this.runSingle(recs, "maintain");
      const closeResult = await this.runSingle(recs, "close");
      return [maintainResult, closeResult];
    }

    return this.runSingle(recs, holdMode);
  }

  /**
   * Run backtest for a single hold mode
   */
  private async runSingle(
    recs: TradeRecommendationRecord[],
    holdMode: HoldMode,
  ): Promise<BacktestResult> {
    // Get market from recommendations
    const market = recs[0].market;

    // Simulate recommended strategy
    const recommendedTrades = this.simulateRecommendedStrategy(recs, holdMode);

    // Simulate perfect strategy
    const perfectTrades = this.simulatePerfectStrategy(recs);

    // Compute performance metrics
    const recommendedPerf = this.computePerformance(recommendedTrades);
    const perfectPerf = this.computePerformance(perfectTrades);

    // Compute action breakdown
    const byAction = this.computeActionBreakdown(recs, recommendedTrades);

    // Compute confidence analysis
    const confidenceAnalysis = this.computeConfidenceAnalysis(recommendedTrades);

    // Generate improvement suggestions
    const improvementSuggestions = this.generateSuggestions(
      recommendedPerf,
      perfectPerf,
      byAction,
      confidenceAnalysis,
      holdMode,
    );

    // Build result
    return {
      market,
      date_range: {
        start: new Date(recs[0].timestamp),
        end: new Date(recs[recs.length - 1].timestamp),
      },
      total_recommendations: recs.length,
      hold_mode: holdMode,
      recommended_strategy: recommendedPerf,
      perfect_strategy: perfectPerf,
      by_action: byAction,
      confidence_analysis: confidenceAnalysis,
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
   * 
   * Position-aware semantics (holdMode parameter is deprecated and ignored):
   * - LONG: Enter or maintain long position; flip to long if currently short
   * - SHORT: Enter or maintain short position; flip to short if currently long
   * - HOLD: Maintain current state (flat stays flat, long stays long, short stays short)
   * - CLOSE: Exit to flat; no-op if already flat (invalid action when flat)
   * 
   * @deprecated holdMode parameter is deprecated and has no effect
   */
  private simulateRecommendedStrategy(
    recs: TradeRecommendationRecord[],
    holdMode: HoldMode,
  ): TradeResult[] {
    const trades: TradeResult[] = [];
    let currentPosition: {
      action: "long" | "short";
      entry_price: number;
      entry_time: Date;
      size_usd: number;
      confidence: number;
    } | null = null;

    for (const rec of recs) {
      const action = rec.action;
      const price = Number(rec.price);
      const timestamp = new Date(rec.timestamp);
      const sizeUsd = rec.size_usd ? Number(rec.size_usd) : this.defaultSizeUsd;
      const confidence = Number(rec.confidence);

      if (action === "long" || action === "short") {
        // If we have an opposite position, close it first (flip)
        if (
          currentPosition &&
          currentPosition.action !== action
        ) {
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
      pnl_usd: pnlUsd,
      pnl_percent: pnlPercent,
    };
  }

  /**
   * Simulate perfect strategy using one-step lookahead
   */
  private simulatePerfectStrategy(
    recs: TradeRecommendationRecord[],
  ): TradeResult[] {
    const trades: TradeResult[] = [];

    for (let i = 0; i < recs.length - 1; i++) {
      const current = recs[i];
      const next = recs[i + 1];

      const p0 = Number(current.price);
      const p1 = Number(next.price);

      // Skip if prices are equal
      if (p0 === p1) continue;

      const action: "long" | "short" = p1 > p0 ? "long" : "short";
      const sizeUsd = current.size_usd
        ? Number(current.size_usd)
        : this.defaultSizeUsd;

      let pnlUsd: number;
      let pnlPercent: number;

      if (action === "long") {
        pnlPercent = (p1 / p0 - 1) * 100;
        pnlUsd = sizeUsd * (p1 / p0 - 1);
      } else {
        pnlPercent = (1 - p1 / p0) * 100;
        pnlUsd = sizeUsd * (1 - p1 / p0);
      }

      trades.push({
        market: current.market,
        entry_time: new Date(current.timestamp),
        exit_time: new Date(next.timestamp),
        action,
        entry_price: p0,
        exit_price: p1,
        size_usd: sizeUsd,
        confidence: 1.0, // Perfect has 100% confidence
        pnl_usd: pnlUsd,
        pnl_percent: pnlPercent,
      });
    }

    return trades;
  }

  /**
   * Compute performance metrics from trades
   */
  private computePerformance(trades: TradeResult[]): StrategyPerformance {
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
    const totalReturnPercent =
      totalSizeUsd > 0 ? (totalPnl / totalSizeUsd) * 100 : 0;

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
   * Generate improvement suggestions based on analysis
   */
  private generateSuggestions(
    recommended: StrategyPerformance,
    perfect: StrategyPerformance,
    byAction: {
      long: ActionStats;
      short: ActionStats;
      hold: ActionStats;
      close: ActionStats;
    },
    confidence: ConfidenceAnalysis,
    holdMode: HoldMode,
  ): string[] {
    const suggestions: string[] = [];

    // 1. Confidence calibration
    if (
      confidence.high_confidence_win_rate < confidence.low_confidence_win_rate
    ) {
      suggestions.push(
        "Recalibrate model confidence; high-confidence signals underperform low-confidence.",
      );
    }

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

    // 3. Performance gap to perfect
    if (perfect.total_pnl_usd > 0) {
      const gap =
        ((perfect.total_pnl_usd - recommended.total_pnl_usd) /
          perfect.total_pnl_usd) *
        100;
      if (gap > 70) {
        suggestions.push(
          `Large gap to perfect (${gap.toFixed(1)}%); react faster to direction changes.`,
        );
      }
    }

    // 4. Hold mode recommendation (can only suggest if we have comparison data)
    if (holdMode === "maintain") {
      suggestions.push(
        "Run with --hold-mode both to compare maintain vs close-on-hold policies.",
      );
    }

    // 5. Low win rate suggestion
    if (recommended.win_rate < 50) {
      suggestions.push(
        `Win rate below 50% (${recommended.win_rate.toFixed(1)}%); consider raising confidence threshold or filtering signals.`,
      );
    }

    // 6. Position sizing if high variance in sizes
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

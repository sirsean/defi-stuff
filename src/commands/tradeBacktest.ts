import { TradeBacktestService } from "../db/tradeBacktestService.js";
import type { BacktestResult, HoldMode } from "../types/backtest.js";

interface TradeBacktestCLIOptions {
  market?: string;
  days?: number;
  holdMode?: string;
  json?: boolean;
  verbose?: boolean;
}

/**
 * Format number as USD currency
 */
function toUsd(value: number): string {
  const sign = value >= 0 ? "+" : "";
  return `${sign}$${value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * Format number as percentage
 */
function toPct(value: number): string {
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

/**
 * Format date for display
 */
function formatDate(date: Date): string {
  return date.toLocaleString("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Print human-readable backtest result
 */
function printResult(result: BacktestResult, verbose: boolean = false): void {
  const { market, date_range, total_recommendations, hold_mode } = result;
  const { recommended_strategy, perfect_strategy, by_action, confidence_analysis, raw_confidence_analysis } = result;

  console.log("");
  console.log("═".repeat(80));
  console.log("  📊 TRADE RECOMMENDATION BACKTEST ANALYSIS");
  console.log("═".repeat(80));
  console.log("");

  // Summary
  console.log(`Market: ${market}`);
  console.log(`Period: ${formatDate(date_range.start)} - ${formatDate(date_range.end)}`);
  console.log(`Total Recommendations: ${total_recommendations}`);
  console.log("");

  // Recommended strategy
  console.log("─".repeat(80));
  console.log(`📈 RECOMMENDED STRATEGY (hold=${hold_mode})`);
  console.log("─".repeat(80));
  console.log("");

  if (recommended_strategy.num_trades === 0) {
    console.log("  No trades executed");
  } else {
    console.log(`  Total PnL:              ${toUsd(recommended_strategy.total_pnl_usd)}`);
    console.log(`  Total Return:           ${toPct(recommended_strategy.total_return_percent)}`);
    console.log(`  Win Rate:               ${recommended_strategy.win_rate.toFixed(2)}%`);
    console.log(`  Avg Trade Return:       ${toUsd(recommended_strategy.avg_trade_return_usd)} (${toPct(recommended_strategy.avg_trade_return_percent)})`);
    console.log(`  Number of Trades:       ${recommended_strategy.num_trades}`);
  }
  console.log("");

  // Perfect strategy
  console.log("─".repeat(80));
  console.log("🎯 PERFECT STRATEGY (with hindsight)");
  console.log("─".repeat(80));
  console.log("");

  if (perfect_strategy.num_trades === 0) {
    console.log("  No trades possible (insufficient price movements)");
  } else {
    console.log(`  Total PnL:              ${toUsd(perfect_strategy.total_pnl_usd)}`);
    console.log(`  Total Return:           ${toPct(perfect_strategy.total_return_percent)}`);
    console.log(`  Win Rate:               ${perfect_strategy.win_rate.toFixed(2)}%`);
    console.log(`  Avg Trade Return:       ${toUsd(perfect_strategy.avg_trade_return_usd)} (${toPct(perfect_strategy.avg_trade_return_percent)})`);
    console.log(`  Number of Trades:       ${perfect_strategy.num_trades}`);
    console.log("");

    // Performance gap
    if (recommended_strategy.num_trades > 0 && perfect_strategy.total_pnl_usd > 0) {
      const gapPercent =
        ((perfect_strategy.total_pnl_usd - recommended_strategy.total_pnl_usd) /
          perfect_strategy.total_pnl_usd) *
        100;
      console.log(`  Performance Gap:        ${gapPercent.toFixed(2)}% below perfect`);
    }
  }
  console.log("");

  // Breakdown by action
  console.log("─".repeat(80));
  console.log("📊 BREAKDOWN BY ACTION");
  console.log("─".repeat(80));
  console.log("");

  const formatActionLine = (name: string, stats: { count: number; win_rate: number; avg_pnl: number }): string => {
    if (stats.count === 0) return `  ${name}:     0 recommendations`;
    if (name === "Hold" || name === "Close") {
      return `  ${name}:     ${stats.count} recommendations | (no PnL attribution)`;
    }
    return `  ${name}:     ${stats.count} recommendations | Win Rate: ${stats.win_rate.toFixed(1)}% | Avg: ${toUsd(stats.avg_pnl)}`;
  };

  console.log(formatActionLine("Long ", by_action.long));
  console.log(formatActionLine("Short", by_action.short));
  console.log(formatActionLine("Hold ", by_action.hold));
  console.log(formatActionLine("Close", by_action.close));
  console.log("");

  // Raw Confidence Analysis (if available)
  if (raw_confidence_analysis && recommended_strategy.num_trades > 0) {
    console.log("─".repeat(80));
    console.log("🎓 RAW CONFIDENCE ANALYSIS (Before Calibration)");
    console.log("─".repeat(80));
    console.log("");
    console.log(`  High Confidence (≥0.7):    Win Rate: ${raw_confidence_analysis.high_confidence_win_rate.toFixed(1)}%`);
    console.log(`  Low Confidence (<0.7):     Win Rate: ${raw_confidence_analysis.low_confidence_win_rate.toFixed(1)}%`);
    console.log(`  Correlation (r):           ${raw_confidence_analysis.correlation >= 0 ? "+" : ""}${raw_confidence_analysis.correlation.toFixed(3)}`);
    console.log("");
  }

  // Calibrated Confidence Analysis
  console.log("─".repeat(80));
  if (raw_confidence_analysis) {
    console.log("🎓 CALIBRATED CONFIDENCE ANALYSIS (After Calibration)");
  } else {
    console.log("🎓 CONFIDENCE ANALYSIS");
  }
  console.log("─".repeat(80));
  console.log("");

  if (recommended_strategy.num_trades === 0) {
    console.log("  No trades to analyze");
  } else {
    console.log(`  High Confidence (≥0.7):    Win Rate: ${confidence_analysis.high_confidence_win_rate.toFixed(1)}%`);
    console.log(`  Low Confidence (<0.7):     Win Rate: ${confidence_analysis.low_confidence_win_rate.toFixed(1)}%`);
    console.log(`  Correlation (r):           ${confidence_analysis.correlation >= 0 ? "+" : ""}${confidence_analysis.correlation.toFixed(3)}`);
    console.log("");

    // Interpretation
    if (confidence_analysis.correlation > 0.3) {
      console.log("  Interpretation: Strong positive correlation. Higher confidence");
      console.log("                  trades perform better. Consider scaling position");
      console.log("                  sizes with confidence levels.");
    } else if (confidence_analysis.correlation < -0.3) {
      console.log("  Interpretation: Strong negative correlation. Higher confidence");
      console.log("                  trades perform worse. Model may be anti-calibrated.");
    } else {
      console.log("  Interpretation: Weak correlation. Confidence may not be");
      console.log("                  predictive of trade outcomes.");
    }
  }
  console.log("");

  // Calibration Improvement Analysis (if both raw and calibrated are available)
  if (raw_confidence_analysis && recommended_strategy.num_trades > 0) {
    console.log("─".repeat(80));
    console.log("📊 CALIBRATION IMPROVEMENT");
    console.log("─".repeat(80));
    console.log("");

    const correlationChange = confidence_analysis.correlation - raw_confidence_analysis.correlation;
    const rawGap = raw_confidence_analysis.high_confidence_win_rate - raw_confidence_analysis.low_confidence_win_rate;
    const calibratedGap = confidence_analysis.high_confidence_win_rate - confidence_analysis.low_confidence_win_rate;
    const gapChange = calibratedGap - rawGap;

    // Correlation improvement
    const correlationSymbol = correlationChange > 0.05 ? "✓" : correlationChange < -0.05 ? "✗" : "~";
    const corrChangeStr = correlationChange >= 0 ? `+${correlationChange.toFixed(3)}` : correlationChange.toFixed(3);
    console.log(`  Correlation Change:        ${raw_confidence_analysis.correlation.toFixed(3)} → ${confidence_analysis.correlation.toFixed(3)} (${corrChangeStr}) ${correlationSymbol}`);

    // Win rate gap improvement
    const gapSymbol = gapChange > 5 ? "✓" : gapChange < -5 ? "✗" : "~";
    const gapChangeStr = gapChange >= 0 ? `+${gapChange.toFixed(1)}` : gapChange.toFixed(1);
    console.log(`  High/Low Win Rate Gap:     ${rawGap.toFixed(1)}% → ${calibratedGap.toFixed(1)}% (${gapChangeStr}%) ${gapSymbol}`);
    console.log("");

    // Interpretation
    if (correlationChange > 0.1 && gapChange > 10) {
      console.log("  Interpretation: ✓ Calibration significantly improved confidence");
      console.log("                  predictiveness. High-confidence trades now perform");
      console.log("                  better than low-confidence trades.");
    } else if (correlationChange > 0.05 || gapChange > 5) {
      console.log("  Interpretation: ✓ Calibration moderately improved confidence");
      console.log("                  scores. Results are trending in the right direction.");
    } else if (correlationChange < -0.05 || gapChange < -5) {
      console.log("  Interpretation: ✗ Calibration degraded confidence predictiveness.");
      console.log("                  Consider recomputing calibration with more recent data.");
    } else {
      console.log("  Interpretation: ~ Calibration had minimal effect on confidence");
      console.log("                  predictiveness. May need more data or refinement.");
    }
    console.log("");
  }

  // Improvement suggestions
  if (result.improvement_suggestions.length > 0) {
    console.log("─".repeat(80));
    console.log("💡 IMPROVEMENT SUGGESTIONS");
    console.log("─".repeat(80));
    console.log("");

    result.improvement_suggestions.forEach((suggestion, i) => {
      console.log(`  ${i + 1}. ${suggestion}`);
    });
    console.log("");
  }

  // Verbose: print per-trade log
  if (verbose && recommended_strategy.trades.length > 0) {
    console.log("─".repeat(80));
    console.log("📋 TRADE LOG");
    console.log("─".repeat(80));
    console.log("");

    recommended_strategy.trades.forEach((trade, i) => {
      const action = trade.action.toUpperCase().padEnd(5);
      const entryTime = formatDate(trade.entry_time).split(",")[0]; // Just date
      const entryPrice = `$${trade.entry_price.toLocaleString()}`;
      const exitPrice = `$${trade.exit_price.toLocaleString()}`;
      const pnlUsd = toUsd(trade.pnl_usd);
      const pnlPct = `(${toPct(trade.pnl_percent)})`;

      console.log(`  Trade #${(i + 1).toString().padStart(3)}:  ${entryTime}  ${action}  @ ${entryPrice}  →  ${exitPrice}  |  ${pnlUsd} ${pnlPct}`);
    });
    console.log("");
  }

  console.log("═".repeat(80));
  console.log("");
}

/**
 * Trade backtest command
 */
export async function tradeBacktest(
  options: TradeBacktestCLIOptions = {},
): Promise<void> {
  try {
    // Parse options
    const market = options.market?.toUpperCase();
    const days = options.days;
    const holdModeInput = (options.holdMode || "maintain").toLowerCase();
    const jsonOutput = options.json || false;
    const verbose = options.verbose || false;

    // Validate hold mode
    if (!["maintain", "close", "both"].includes(holdModeInput)) {
      console.error("❌ Invalid hold mode. Must be 'maintain', 'close', or 'both'.");
      process.exit(1);
    }

    const holdMode = holdModeInput as HoldMode | "both";

    // Create backtest service
    const service = new TradeBacktestService();

    try {
      // Run backtest
      const result = await service.run({
        market,
        days,
        holdMode,
      });

      // JSON output
      if (jsonOutput) {
        if (Array.isArray(result)) {
          console.log(JSON.stringify({ mode: "both", results: result }, null, 2));
        } else {
          console.log(JSON.stringify(result, null, 2));
        }
        return;
      }

      // Human-readable output
      if (Array.isArray(result)) {
        // Both modes
        result.forEach((r, i) => {
          if (i > 0) console.log("\n\n");
          printResult(r, verbose);
        });

        // Comparison summary if both modes
        if (result.length === 2) {
          const [maintain, close] = result;
          const maintainReturn = maintain.recommended_strategy.total_return_percent;
          const closeReturn = close.recommended_strategy.total_return_percent;
          const diff = maintainReturn - closeReturn;

          console.log("");
          console.log("═".repeat(80));
          console.log("  📊 HOLD MODE COMPARISON");
          console.log("═".repeat(80));
          console.log("");
          console.log(`  Maintain-on-Hold:  ${toPct(maintainReturn)} return`);
          console.log(`  Close-on-Hold:     ${toPct(closeReturn)} return`);
          console.log(`  Difference:        ${toPct(Math.abs(diff))} ${diff >= 0 ? "(maintain wins)" : "(close wins)"}`);
          console.log("");

          if (Math.abs(diff) > 5) {
            const winner = diff >= 0 ? "maintain-on-hold" : "close-on-hold";
            console.log(`  💡 Recommendation: Use ${winner} policy (${toPct(Math.abs(diff))} better return)`);
            console.log("");
          } else {
            console.log("  💡 Recommendation: Performance is similar; choose based on risk preference");
            console.log("");
          }
          console.log("═".repeat(80));
          console.log("");
        }
      } else {
        // Single mode
        printResult(result, verbose);
      }
    } finally {
      await service.close();
    }
  } catch (error: any) {
    console.error("\n❌ Backtest failed:", error.message);

    if (error.message.includes("No recommendations")) {
      console.error(
        "\n💡 Hint: Make sure you have trade recommendations in the database.",
      );
      console.error("    Run: npm run dev -- trade:recommend --db");
    }

    console.error("");
    process.exit(1);
  }
}

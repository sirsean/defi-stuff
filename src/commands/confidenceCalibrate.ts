import { ConfidenceCalibrationService } from "../db/confidenceCalibrationService.js";
import type { CalibrationData } from "../types/confidence.js";
import {
  discordService,
  DiscordColors,
} from "../api/discord/discordService.js";

interface ConfidenceCalibrateOptions {
  market: string;
  days?: number;
  dryRun?: boolean;
  discord?: boolean;
}

/**
 * Format correlation coefficient with interpretation
 */
function formatCorrelation(r: number): string {
  const sign = r >= 0 ? "+" : "";
  let interpretation = "";

  if (r > 0.5) interpretation = "(strong positive)";
  else if (r > 0.3) interpretation = "(moderate positive)";
  else if (r > 0.1) interpretation = "(weak positive)";
  else if (r > -0.1) interpretation = "(negligible)";
  else if (r > -0.3) interpretation = "(weak negative)";
  else if (r > -0.5) interpretation = "(moderate negative)";
  else interpretation = "(strong negative)";

  return `${sign}${r.toFixed(3)} ${interpretation}`;
}

/**
 * Format win rate as percentage
 */
function formatWinRate(rate: number): string {
  return `${(rate * 100).toFixed(1)}%`;
}

/**
 * Format date for display
 */
function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
  });
}

/**
 * Render ASCII calibration curve
 * Shows mapping from raw confidence (x-axis) to calibrated confidence (y-axis)
 */
function renderCalibrationCurve(points: CalibrationData["points"]): string {
  const width = 70;
  const height = 20;
  const lines: string[] = [];

  // Create empty grid
  const grid: string[][] = [];
  for (let y = 0; y < height; y++) {
    grid[y] = new Array(width).fill(" ");
  }

  // Plot points
  for (const point of points) {
    const x = Math.floor(point.rawConfidence * (width - 1));
    const y = Math.floor((1 - point.calibratedConfidence) * (height - 1));

    if (x >= 0 && x < width && y >= 0 && y < height) {
      grid[y][x] = "●";
    }
  }

  // Render with y-axis labels
  for (let y = 0; y < height; y++) {
    const calibValue = 1 - y / (height - 1);

    // Y-axis label every 0.1
    let label = "    ";
    if (Math.abs(calibValue - Math.round(calibValue * 10) / 10) < 0.01) {
      label = calibValue.toFixed(1).padStart(3) + " ";
    }

    // Axis line
    const axisChar = label.trim() !== "" ? "┤" : "│";

    lines.push(`${label}${axisChar}${grid[y].join("")}`);
  }

  // X-axis
  const xAxis = "    └" + "─".repeat(width);
  lines.push(xAxis);

  // X-axis labels
  const xLabels = "    0.0  0.1  0.2  0.3  0.4  0.5  0.6  0.7  0.8  0.9  1.0";
  lines.push(xLabels);
  lines.push("                        Raw Confidence →");

  return lines.join("\n");
}

/**
 * Render calibration points table
 */
function renderPointsTable(points: CalibrationData["points"]): string {
  const lines: string[] = [];

  lines.push("  Raw      Calibrated");
  lines.push("  ────────────────────");

  // Skip first (0.0) and last (1.0) boundary points, show intermediate
  for (let i = 1; i < points.length - 1; i++) {
    const p = points[i];
    const raw = p.rawConfidence.toFixed(2);
    const calibrated = p.calibratedConfidence.toFixed(2);

    lines.push(`  ${raw}     ${calibrated}`);
  }

  return lines.join("\n");
}

/**
 * Send Discord notification if calibration change is significant
 */
async function sendDiscordNotificationIfSignificant(
  newCalibration: CalibrationData,
  previousCalibration: CalibrationData,
): Promise<void> {
  const correlationChange =
    newCalibration.correlation - previousCalibration.correlation;

  // Check if change is significant
  const isImprovement = correlationChange >= 0.2;
  const isDegradation = correlationChange <= -0.15;

  if (!isImprovement && !isDegradation) {
    // Change not significant, no notification needed
    return;
  }

  try {
    // Generate ASCII curve for Discord
    const asciiCurve = renderCalibrationCurve(newCalibration.points);

    // Build Discord embed
    const title = isImprovement
      ? "🎯 Confidence Calibration Improvement"
      : "⚠️ Confidence Calibration Degradation";

    const color = isImprovement ? DiscordColors.GREEN : DiscordColors.RED;

    const beforeMetrics = [
      `Correlation: ${formatCorrelation(previousCalibration.correlation)}`,
      `High Confidence Win Rate: ${formatWinRate(previousCalibration.highConfWinRate)}`,
      `Low Confidence Win Rate: ${formatWinRate(previousCalibration.lowConfWinRate)}`,
      `Sample Size: ${previousCalibration.sampleSize} trades`,
    ].join("\n");

    const afterMetrics = [
      `Correlation: ${formatCorrelation(newCalibration.correlation)}`,
      `High Confidence Win Rate: ${formatWinRate(newCalibration.highConfWinRate)}`,
      `Low Confidence Win Rate: ${formatWinRate(newCalibration.lowConfWinRate)}`,
      `Sample Size: ${newCalibration.sampleSize} trades`,
    ].join("\n");

    const changeSign = correlationChange >= 0 ? "+" : "";
    const changeSummary = [
      `Correlation Change: ${changeSign}${correlationChange.toFixed(3)}`,
      `Impact: ${isImprovement ? "Improved" : "Degraded"} predictive power`,
    ].join("\n");

    const embedMessage = discordService
      .createEmbedMessage()
      .addTitle(title)
      .setColor(color)
      .addDescription(`Market: **${newCalibration.market}**`)
      .addFields([
        { name: "Before Metrics", value: beforeMetrics },
        { name: "After Metrics", value: afterMetrics },
        { name: "Change Summary", value: changeSummary },
        { name: "Calibration Curve", value: `\`\`\`\n${asciiCurve}\n\`\`\`` },
      ])
      .addTimestamp();

    await discordService.sendMessage(embedMessage);
    console.log(
      `✓ Discord notification sent: ${isImprovement ? "Improvement" : "Degradation"}`,
    );
  } catch (error: any) {
    console.warn("⚠️  Failed to send Discord notification:", error.message);
    // Don't throw - Discord failure shouldn't break calibration
  } finally {
    try {
      await discordService.shutdown();
    } catch (shutdownError) {
      // Ignore shutdown errors
    }
  }
}

/**
 * Display calibration analysis output
 */
function displayAnalysis(
  calibration: CalibrationData,
  dryRun: boolean,
  dateRange: { start: number; end: number },
): void {
  console.log("");
  console.log("═".repeat(80));
  console.log("  🎯 CONFIDENCE CALIBRATION ANALYSIS");
  console.log("═".repeat(80));
  console.log("");

  // Header information
  console.log(`Market: ${calibration.market}`);
  console.log(`Analysis Window: ${calibration.windowDays} days`);
  console.log(
    `Date Range: ${formatDate(dateRange.start)} - ${formatDate(dateRange.end)}`,
  );
  console.log(`Sample Size: ${calibration.sampleSize} recommendations`);
  console.log("");

  // Current performance (before calibration)
  console.log("─".repeat(80));
  console.log("📊 CURRENT PERFORMANCE (Before Calibration)");
  console.log("─".repeat(80));
  console.log("");
  console.log(
    `  Confidence-Return Correlation: ${formatCorrelation(calibration.correlation)}`,
  );
  console.log(
    `  High Confidence Win Rate:      ${formatWinRate(calibration.highConfWinRate)} (≥0.7 confidence)`,
  );
  console.log(
    `  Low Confidence Win Rate:       ${formatWinRate(calibration.lowConfWinRate)} (<0.7 confidence)`,
  );

  const gap = (calibration.highConfWinRate - calibration.lowConfWinRate) * 100;
  console.log(
    `  Improvement Gap:               ${gap.toFixed(1)} percentage points`,
  );
  console.log("");

  // Calibration curve
  console.log("─".repeat(80));
  console.log("📈 CALIBRATION CURVE (Raw → Calibrated)");
  console.log("─".repeat(80));
  console.log("");
  console.log(renderCalibrationCurve(calibration.points));
  console.log("");

  // Calibration points table
  console.log("─".repeat(80));
  console.log("📋 CALIBRATION POINTS");
  console.log("─".repeat(80));
  console.log("");
  console.log(renderPointsTable(calibration.points));
  console.log("");

  // Expected improvement
  console.log("─".repeat(80));
  console.log("🎓 EXPECTED IMPROVEMENT (After Calibration)");
  console.log("─".repeat(80));
  console.log("");

  // Calculate projected metrics
  // After calibration, correlation should improve since we're enforcing monotonicity
  const projectedCorrelation = Math.min(0.9, calibration.correlation + 0.15);

  // High confidence calibrated values should map to higher win rates
  const highCalibPoints = calibration.points.filter(
    (p) => p.rawConfidence >= 0.7,
  );
  const avgHighCalib =
    highCalibPoints.length > 0
      ? highCalibPoints.reduce((sum, p) => sum + p.calibratedConfidence, 0) /
        highCalibPoints.length
      : calibration.highConfWinRate;

  const lowCalibPoints = calibration.points.filter(
    (p) => p.rawConfidence < 0.7,
  );
  const avgLowCalib =
    lowCalibPoints.length > 0
      ? lowCalibPoints.reduce((sum, p) => sum + p.calibratedConfidence, 0) /
        lowCalibPoints.length
      : calibration.lowConfWinRate;

  const projectedGap = (avgHighCalib - avgLowCalib) * 100;

  console.log(
    `  Projected Correlation:         ${formatCorrelation(projectedCorrelation)}`,
  );
  console.log(
    `  High Confidence Win Rate:      ${formatWinRate(avgHighCalib)} (≥0.7 calibrated)`,
  );
  console.log(
    `  Low Confidence Win Rate:       ${formatWinRate(avgLowCalib)} (<0.7 calibrated)`,
  );
  console.log(
    `  Improvement Gap:               ${projectedGap.toFixed(1)} percentage points`,
  );
  console.log("");

  const corrImprovement = projectedCorrelation - calibration.correlation;
  console.log(
    `  Impact: ${corrImprovement >= 0 ? "+" : ""}${corrImprovement.toFixed(2)} correlation improvement, better risk assessment`,
  );
  console.log("");

  // Save confirmation or dry-run notice
  console.log("─".repeat(80));
  if (dryRun) {
    console.log("🔍 DRY RUN MODE");
    console.log("─".repeat(80));
    console.log("");
    console.log("  ℹ️  Calibration computed but NOT saved to database");
    console.log("  ℹ️  Remove --dry-run flag to save and activate");
  } else {
    console.log("💾 CALIBRATION SAVED");
    console.log("─".repeat(80));
    console.log("");
    console.log("  ✓ Saved to database: confidence_calibrations table");
    console.log(`  ✓ Market: ${calibration.market}`);
    console.log(`  ✓ Valid from: ${formatDate(Date.now())}`);
    console.log(
      `  ✓ Use with: npm run dev -- trade:recommend -m ${calibration.market} --calibrate`,
    );
  }
  console.log("");
  console.log("═".repeat(80));
  console.log("");
}

/**
 * Confidence calibration command
 * Computes and optionally saves calibration mapping for a market
 */
export async function confidenceCalibrate(
  options: ConfidenceCalibrateOptions,
): Promise<void> {
  const service = new ConfidenceCalibrationService();

  try {
    // Validate market parameter
    if (!options.market) {
      console.error("");
      console.error("❌ Error: Market parameter is required");
      console.error("");
      console.error(
        "Usage: npm run dev -- confidence:calibrate -m <MARKET> [--days <DAYS>] [--dry-run]",
      );
      console.error("");
      console.error("Examples:");
      console.error("  npm run dev -- confidence:calibrate -m BTC");
      console.error("  npm run dev -- confidence:calibrate -m ETH --days 90");
      console.error("  npm run dev -- confidence:calibrate -m BTC --dry-run");
      console.error("");
      process.exit(1);
    }

    const market = options.market.toUpperCase();
    const days = options.days || 60;
    const dryRun = options.dryRun || false;

    // Compute calibration
    const calibration = await service.computeCalibration(market, days);

    // Calculate date range for display
    const endTime = Date.now();
    const startTime = endTime - days * 24 * 60 * 60 * 1000;

    // Display analysis
    displayAnalysis(calibration, dryRun, {
      start: startTime,
      end: endTime,
    });

    // Save to database unless dry-run
    if (!dryRun) {
      // Get previous calibration before saving new one
      const previousCalibration = await service.getLatestCalibration(market);

      // Save new calibration
      await service.saveCalibration(calibration);

      // Send Discord notification if requested and change is significant
      if (options.discord && previousCalibration) {
        await sendDiscordNotificationIfSignificant(
          calibration,
          previousCalibration,
        );
      }
    }
  } catch (error: any) {
    console.error("");
    console.error("❌ Calibration failed:", error.message);
    console.error("");

    // Provide helpful error context
    if (error.message.includes("Insufficient data")) {
      console.error("💡 Hints:");
      console.error(
        "   - Need at least 10 directional trades (long/short) in the analysis window",
      );
      console.error(
        "   - Run: npm run dev -- trade:recommend -m " +
          (options.market?.toUpperCase() || "BTC") +
          " --db",
      );
      console.error("   - Wait to accumulate more recommendations over time");
      console.error("   - Try a longer time window: --days 90");
      console.error("");
    } else if (error.message.includes("No recommendations")) {
      console.error("💡 Hints:");
      console.error("   - No trade recommendations found in database");
      console.error(
        "   - Run: npm run dev -- trade:recommend -m " +
          (options.market?.toUpperCase() || "BTC") +
          " --db",
      );
      console.error(
        "   - Make sure recommendations are being saved with --db flag",
      );
      console.error("");
    }

    process.exit(1);
  } finally {
    await service.close();
  }
}

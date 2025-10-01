import { tradeRecommendationAgent } from "../api/trading/tradeRecommendationAgent.js";
import type { TradeRecommendation } from "../types/tradeRecommendation.js";

interface TradeRecommendationOptions {
  markets?: string;
  address?: string;
  subs?: string;
  json?: boolean;
}

/**
 * Get action emoji
 */
function getActionEmoji(action: string): string {
  const map: Record<string, string> = {
    long: "📈",
    short: "📉",
    close: "❌",
    hold: "⏸️",
  };
  return map[action] || "•";
}

/**
 * Get market emoji
 */
function getMarketEmoji(market: string): string {
  const map: Record<string, string> = {
    BTC: "₿",
    ETH: "Ξ",
    SOL: "◎",
    XRP: "✕",
  };
  return map[market] || "•";
}

/**
 * Create a confidence meter visualization
 */
function createConfidenceMeter(confidence: number): string {
  const filled = Math.round(confidence * 10);
  const bar = "█".repeat(filled) + "░".repeat(10 - filled);
  const percent = Math.round(confidence * 100);
  return `${bar} ${percent}%`;
}

/**
 * Get confidence level text
 */
function getConfidenceLevel(confidence: number): string {
  if (confidence >= 0.8) return "Very High";
  if (confidence >= 0.7) return "High";
  if (confidence >= 0.5) return "Moderate";
  if (confidence >= 0.3) return "Low";
  return "Very Low";
}

/**
 * Wrap text to specified width
 */
function wrapText(text: string, width: number = 80): string {
  const words = text.split(" ");
  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    if (currentLine.length + word.length + 1 <= width) {
      currentLine += (currentLine ? " " : "") + word;
    } else {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
    }
  }
  if (currentLine) lines.push(currentLine);

  return lines.join("\n  ");
}

/**
 * Format a single recommendation
 */
function formatRecommendation(rec: TradeRecommendation): string[] {
  const lines: string[] = [];
  const emoji = getMarketEmoji(rec.market);
  const actionEmoji = getActionEmoji(rec.action);

  // Header
  lines.push(
    `${emoji} ${rec.market} ${actionEmoji} ${rec.action.toUpperCase()}`,
  );
  lines.push("");

  // Confidence
  const confidenceLevel = getConfidenceLevel(rec.confidence);
  lines.push(`  Confidence: ${confidenceLevel}`);
  lines.push(`  ${createConfidenceMeter(rec.confidence)}`);
  lines.push("");

  // Size (if specified)
  if (rec.size_usd !== null) {
    lines.push(`  Suggested Size: $${rec.size_usd.toLocaleString()}`);
    lines.push("");
  }

  // Timeframe
  const timeframeMap: Record<string, string> = {
    short: "Short-term (1-3 days)",
    medium: "Medium-term (3-7 days)",
    long: "Long-term (7-14 days)",
  };
  lines.push(`  Timeframe: ${timeframeMap[rec.timeframe] || rec.timeframe}`);
  lines.push("");

  // Reasoning
  lines.push(`  Reasoning:`);
  const wrappedReasoning = wrapText(rec.reasoning, 76);
  lines.push(`  ${wrappedReasoning}`);
  lines.push("");

  // Risk Factors
  if (rec.risk_factors && rec.risk_factors.length > 0) {
    lines.push(`  Risk Factors:`);
    for (const risk of rec.risk_factors) {
      const wrappedRisk = wrapText(risk, 74);
      lines.push(`  • ${wrappedRisk}`);
    }
    lines.push("");
  }

  return lines;
}

/**
 * Command to generate AI-powered trade recommendations
 */
export async function tradeRecommendation(
  opts: TradeRecommendationOptions = {},
): Promise<void> {
  try {
    // Parse markets (default: BTC,ETH)
    const marketsStr = opts.markets || "BTC,ETH";
    const markets = marketsStr.split(",").map((m) => m.trim().toUpperCase());

    // Get wallet address (from option or env)
    const walletAddress = opts.address || process.env.WALLET_ADDRESS;

    // Parse subaccount IDs (default: 0)
    const subsStr = opts.subs || "0";
    const subAccountIds = subsStr.split(",").map((s) => parseInt(s.trim(), 10));

    // Validate subaccount IDs
    for (const subId of subAccountIds) {
      if (isNaN(subId) || subId < 0 || subId > 255) {
        console.error(`Invalid subaccount ID: ${subId}. Must be 0-255.`);
        process.exit(1);
      }
    }

    // Generate recommendations
    console.log("\n🤖 Generating trade recommendations...\n");

    const analysis = await tradeRecommendationAgent.generateRecommendation(
      markets,
      walletAddress,
      subAccountIds,
    );

    // JSON output mode
    if (opts.json) {
      console.log(JSON.stringify(analysis, null, 2));
      return;
    }

    // Human-readable output
    console.log("═".repeat(80));
    console.log("  🎯 AI TRADE RECOMMENDATIONS");
    console.log("═".repeat(80));
    console.log("");

    // Timestamp
    const date = new Date(analysis.timestamp);
    const dateStr = date.toLocaleString("en-US", {
      dateStyle: "medium",
      timeStyle: "short",
    });
    console.log(`Generated: ${dateStr}`);
    console.log("");

    // Market Summary
    console.log("📊 MARKET SUMMARY");
    console.log("─".repeat(80));
    console.log("");
    const wrappedSummary = wrapText(analysis.market_summary, 78);
    console.log(`  ${wrappedSummary}`);
    console.log("");
    console.log("");

    // Recommendations
    console.log("💡 RECOMMENDATIONS");
    console.log("─".repeat(80));
    console.log("");

    for (const rec of analysis.recommendations) {
      const recLines = formatRecommendation(rec);
      console.log(recLines.join("\n"));
      console.log("─".repeat(80));
      console.log("");
    }

    // Footer disclaimer
    console.log("");
    console.log("⚠️  DISCLAIMER");
    console.log("─".repeat(80));
    console.log("");
    console.log(
      "  This is AI-generated analysis based on current market data and should",
    );
    console.log(
      "  NOT be considered financial advice. Always do your own research and",
    );
    console.log(
      "  never risk more than you can afford to lose. Past performance does",
    );
    console.log("  not guarantee future results.");
    console.log("");
  } catch (error: any) {
    console.error(
      `\n❌ Failed to generate trade recommendations: ${error?.message ?? "Unknown error"}`,
    );

    // Provide helpful hints for common errors
    if (error?.message?.includes("CLOUDFLARE")) {
      console.error(
        "\n💡 Hint: Make sure CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_AUTH_TOKEN are set in your .env file",
      );
    }
    if (error?.message?.includes("Unknown market")) {
      console.error(
        "\n💡 Hint: Use valid market symbols (BTC, ETH, SOL, etc.)",
      );
    }
    if (error?.message?.includes("Failed to fetch")) {
      console.error(
        "\n💡 Hint: Check your network connection and Base RPC endpoint",
      );
    }

    console.error("");
    process.exit(1);
  }
}

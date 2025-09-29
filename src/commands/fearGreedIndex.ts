import { fearGreedService } from "../api/feargreed/fearGreedService.js";
import type { FearGreedAnalysis, FearGreedTrend } from "../types/feargreed.js";

/**
 * Map classification names to emojis
 */
function classificationEmoji(classification: string): string {
  const map: Record<string, string> = {
    "Extreme Fear": "😱",
    Fear: "😨",
    Neutral: "😐",
    Greed: "🙂",
    "Extreme Greed": "🤑",
  };
  return map[classification] ?? "";
}

/**
 * Map trend to emoji
 */
function trendEmoji(trend: FearGreedTrend): string {
  if (trend === "improving") return "📈";
  if (trend === "declining") return "📉";
  return "🔁";
}

/**
 * Capitalize first letter of a string
 */
function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Format numeric value as rounded integer
 */
function formatValue(n: number): string {
  return `${Math.round(n)}`;
}

interface FearGreedIndexOptions {
  limit?: number | string;
}

/**
 * Command to fetch and display the Fear and Greed Index
 * @param opts Command options with optional limit
 */
export async function fearGreedIndex(
  opts: FearGreedIndexOptions = {},
): Promise<void> {
  try {
    const limit =
      typeof opts.limit === "string"
        ? parseInt(opts.limit, 10)
        : typeof opts.limit === "number"
          ? opts.limit
          : 10;

    const analysis: FearGreedAnalysis =
      await fearGreedService.analyzeFearGreedIndex(limit);

    const lines: string[] = [];
    lines.push("Fear & Greed Index", "");
    lines.push(
      `Current: ${formatValue(analysis.current.value)} (${analysis.current.classification}) ${classificationEmoji(
        analysis.current.classification,
      )}`,
    );
    lines.push(
      `Min: ${formatValue(analysis.min.value)} (${analysis.min.classification})`,
    );
    lines.push(
      `Max: ${formatValue(analysis.max.value)} (${analysis.max.classification})`,
    );
    lines.push(
      `Trend: ${capitalize(analysis.trend)} ${trendEmoji(analysis.trend)}`,
      "",
    );
    lines.push(`Based on last ${limit} days`);

    console.log(lines.join("\n"));
  } catch (err: any) {
    console.error(
      `Failed to fetch Fear & Greed Index: ${err?.message ?? "Unknown error"}`,
    );
    process.exit(1);
  }
}

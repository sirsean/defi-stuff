import { polymarketService } from "../api/polymarket/polymarketService.js";
import type { BTCPricePrediction } from "../types/polymarket.js";

interface BTCPredictionOptions {
  date?: string;
  json?: boolean;
}

/**
 * Format price for display
 */
function formatPrice(price: number): string {
  if (price >= 1000000) {
    return `$${(price / 1000000).toFixed(2)}M`;
  } else if (price >= 1000) {
    return `$${(price / 1000).toFixed(0)}k`;
  }
  return `$${price.toFixed(0)}`;
}

/**
 * Get sentiment emoji
 */
function getSentimentEmoji(
  sentiment: BTCPricePrediction["analysis"]["sentiment"],
): string {
  const map = {
    "very bearish": "🐻💔",
    bearish: "🐻",
    neutral: "😐",
    bullish: "🐂",
    "very bullish": "🐂🚀",
  };
  return map[sentiment] || "";
}

/**
 * Create a simple bar chart for probability distribution
 */
function createBarChart(probability: number, maxWidth: number = 15): string {
  const filledWidth = Math.round(probability * maxWidth);
  return "▓".repeat(filledWidth) + "░".repeat(maxWidth - filledWidth);
}

/**
 * Command to predict BTC price based on Polymarket data
 */
export async function btcPrediction(
  opts: BTCPredictionOptions = {},
): Promise<void> {
  try {
    // Parse date option (undefined = use nearest future date)
    const targetDate = opts.date;

    // Fetch and analyze
    const prediction: BTCPricePrediction =
      await polymarketService.analyzeBTCPrice(targetDate);

    // JSON output mode
    if (opts.json) {
      console.log(JSON.stringify(prediction, null, 2));
      return;
    }

    // Human-readable output
    console.log("\n🔮 BTC Price Prediction from Polymarket\n");

    // Format actual date used (not requested date)
    const date = new Date(prediction.targetDate + "T00:00:00Z");
    const dateStr = date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      timeZone: "UTC",
    });
    console.log(`Target Date: ${dateStr}`);
    console.log();

    // Main prediction
    console.log(
      "Median Price:",
      formatPrice(prediction.analysis.expectedPrice),
    );
    console.log(
      "Likely Range:",
      `${formatPrice(prediction.analysis.likelyRange.min)} - ${formatPrice(prediction.analysis.likelyRange.max)}`,
      `(68% confidence)`,
    );
    console.log(
      "Confidence Score:",
      `${Math.round(prediction.analysis.confidence * 100)}%`,
    );
    console.log();

    // Probability distribution
    console.log("Probability Distribution:");
    console.log();

    const sortedRanges = [...prediction.priceRanges].sort(
      (a, b) => a.min - b.min,
    );

    for (const range of sortedRanges) {
      const probPct = Math.round(range.probability * 100);
      if (probPct < 1) continue; // Skip very small probabilities

      let rangeStr: string;
      if (range.max === null) {
        rangeStr = `>= ${formatPrice(range.min)}`;
      } else if (range.min === 0) {
        rangeStr = `< ${formatPrice(range.max)}`;
      } else {
        rangeStr = `${formatPrice(range.min)} - ${formatPrice(range.max)}`;
      }

      const bar = createBarChart(range.probability);
      console.log(`  ${rangeStr.padEnd(20)} ${probPct}% ${bar}`);
    }

    console.log();

    // Sentiment
    const sentimentEmoji = getSentimentEmoji(prediction.analysis.sentiment);
    const capitalizedSentiment =
      prediction.analysis.sentiment.charAt(0).toUpperCase() +
      prediction.analysis.sentiment.slice(1);
    console.log(`Market Sentiment: ${capitalizedSentiment} ${sentimentEmoji}`);
    console.log();

    // Metadata footer
    console.log(
      `Based on ${prediction.metadata.marketCount} active Polymarket prediction markets`,
    );
    if (prediction.metadata.totalVolume24hr > 0) {
      const volumeStr =
        prediction.metadata.totalVolume24hr >= 1000000
          ? `$${(prediction.metadata.totalVolume24hr / 1000000).toFixed(2)}M`
          : `$${(prediction.metadata.totalVolume24hr / 1000).toFixed(1)}k`;
      console.log(`Total 24h Volume: ${volumeStr}`);
    }
    console.log();
  } catch (error: any) {
    console.error(
      `Failed to generate BTC prediction: ${error?.message ?? "Unknown error"}`,
    );
    process.exit(1);
  }
}

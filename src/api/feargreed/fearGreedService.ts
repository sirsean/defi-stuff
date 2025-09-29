import type { FearGreedAnalysis } from "../../types/feargreed.js";
import { fearGreedClient, FearGreedClient } from "./fearGreedClient.js";

type Trend = FearGreedAnalysis["trend"];

/**
 * Compute the trend using recent momentum for forward-looking signal
 * This focuses on the last few days to capture current market direction
 * @param values Array of index values (newest first)
 * @returns Trend classification: improving, declining, or stable
 */
function computeTrend(values: number[]): Trend {
  if (!values || values.length < 2) return "stable";

  const n = values.length;

  // Use the most recent 40% of data (min 3, max 5) for momentum calculation
  // This captures recent direction without being too noisy
  const windowSize = Math.max(3, Math.min(5, Math.floor(n * 0.4)));
  const recentValues = values.slice(0, windowSize);

  // Calculate simple linear regression on recent window (oldest to newest)
  const reversed = [...recentValues].reverse();
  const m = reversed.length;

  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumX2 = 0;

  for (let i = 0; i < m; i++) {
    sumX += i;
    sumY += reversed[i];
    sumXY += i * reversed[i];
    sumX2 += i * i;
  }

  // Slope formula: m = (n*sumXY - sumX*sumY) / (n*sumX2 - sumX*sumX)
  const slope = (m * sumXY - sumX * sumY) / (m * sumX2 - sumX * sumX);

  // For a forward-looking trading signal:
  // Slope > 1.5: gaining more than 1.5 pts/day = strong momentum = improving
  // Slope < -1.5: losing more than 1.5 pts/day = weak momentum = declining
  // Otherwise: stable/sideways
  if (slope > 1.5) return "improving";
  if (slope < -1.5) return "declining";
  return "stable";
}

/**
 * Service for analyzing Fear and Greed Index data
 */
export class FearGreedService {
  constructor(private client: FearGreedClient = fearGreedClient) {}

  /**
   * Analyze the Fear and Greed Index over a specified period
   * @param limit Number of days to analyze (default: 10)
   * @returns Analysis including current value, min, max, and trend
   */
  async analyzeFearGreedIndex(limit = 10): Promise<FearGreedAnalysis> {
    const resp = await this.client.getFearGreedIndex(limit);

    if (resp.metadata?.error) {
      throw new Error(`Fear & Greed API error: ${resp.metadata.error}`);
    }

    const data = resp.data ?? [];
    if (data.length === 0) {
      throw new Error("Fear & Greed API returned no data");
    }

    const toNum = (s: string) => Number.parseFloat(s);
    const values = data.map((d) => toNum(d.value));

    // Current is the first item (API returns newest first)
    const currentPoint = data[0];
    const current = {
      value: toNum(currentPoint.value),
      classification: currentPoint.value_classification,
    };

    // Min/Max across the period
    let minIdx = 0;
    let maxIdx = 0;
    for (let i = 1; i < values.length; i++) {
      if (values[i] < values[minIdx]) minIdx = i;
      if (values[i] > values[maxIdx]) maxIdx = i;
    }
    const min = {
      value: values[minIdx],
      classification: data[minIdx].value_classification,
    };
    const max = {
      value: values[maxIdx],
      classification: data[maxIdx].value_classification,
    };

    const trend = computeTrend(values);

    return { current, min, max, trend };
  }
}

/**
 * Singleton instance of FearGreedService
 */
export const fearGreedService = new FearGreedService();

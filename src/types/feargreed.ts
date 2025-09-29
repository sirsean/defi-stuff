/**
 * Types for Fear and Greed Index API responses from alternative.me
 */

export interface FearGreedDataPoint {
  value: string; // numeric string, e.g. "52"
  value_classification: string; // e.g. "Neutral", "Fear", "Greed"
  timestamp: string; // unix seconds as string
  time_until_update?: string; // seconds until next update, as string (optional, only on current)
}

export interface FearGreedMetadata {
  error: string | null;
}

export interface FearGreedIndexResponse {
  name: string; // e.g., "Fear and Greed Index"
  data: FearGreedDataPoint[];
  metadata: FearGreedMetadata;
}

export type FearGreedTrend = "improving" | "declining" | "stable";

export interface FearGreedAnalysis {
  current: { value: number; classification: string };
  min: { value: number; classification: string };
  max: { value: number; classification: string };
  trend: FearGreedTrend;
}

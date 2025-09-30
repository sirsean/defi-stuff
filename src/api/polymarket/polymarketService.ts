import { polymarketClient, PolymarketClient } from "./polymarketClient.js";
import type {
  PolymarketMarket,
  BTCPriceThreshold,
  BTCPricePrediction,
  BTCPriceRange,
} from "../../types/polymarket.js";

/**
 * Extract date from market question
 * Examples: "by December 31, 2025" -> "2025-12-31"
 */
function extractDateFromQuestion(question: string): string | null {
  // Match "by [Month] [Day], [Year]"
  const monthMatch = question.match(
    /by\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),?\s+(\d{4})/i,
  );

  if (monthMatch) {
    const monthNames: Record<string, string> = {
      january: "01",
      february: "02",
      march: "03",
      april: "04",
      may: "05",
      june: "06",
      july: "07",
      august: "08",
      september: "09",
      october: "10",
      november: "11",
      december: "12",
    };

    const month = monthNames[monthMatch[1].toLowerCase()];
    const day = monthMatch[2].padStart(2, "0");
    const year = monthMatch[3];

    return `${year}-${month}-${day}`;
  }

  return null;
}

/**
 * Extract price from market question using regex
 * Examples: "Will Bitcoin reach $150,000" -> 150000
 */
function extractPriceFromQuestion(question: string): number | null {
  // Match $X,XXX,XXX or $XXX,XXX or $XXXK format
  const match = question.match(/\$(\d+(?:,\d{3})*(?:,\d{3})?(?:K|k)?)/);
  if (!match) return null;

  let priceStr = match[1].replace(/,/g, "");

  // Handle K suffix
  if (priceStr.endsWith("K") || priceStr.endsWith("k")) {
    priceStr = priceStr.slice(0, -1);
    return parseFloat(priceStr) * 1000;
  }

  return parseFloat(priceStr);
}

/**
 * Categorize market as ceiling (reach/above), floor (dip to/below), range (between), or event
 */
function categorizeMarket(
  question: string,
): "ceiling" | "floor" | "event" | null {
  const lowerQuestion = question.toLowerCase();

  // Skip "between" markets - these are range markets, not threshold markets
  if (lowerQuestion.includes("between")) {
    return "event";
  }

  // "less than" or "below" = floor markets
  if (lowerQuestion.includes("less than") || lowerQuestion.includes("below")) {
    return "floor";
  }

  // "above" or "reach" = ceiling markets
  if (lowerQuestion.includes("above") || lowerQuestion.includes("reach")) {
    return "ceiling";
  }

  // "dip to" or "drop to" = floor markets
  if (
    lowerQuestion.includes("dip to") ||
    lowerQuestion.includes("dip below") ||
    lowerQuestion.includes("drop to")
  ) {
    return "floor";
  }

  // Check if it has a price but isn't clearly ceiling/floor
  const hasPrice = extractPriceFromQuestion(question) !== null;
  if (!hasPrice) {
    return "event";
  }

  // Default: if it has a price, assume ceiling
  return "ceiling";
}

/**
 * Service for analyzing Bitcoin price predictions from Polymarket
 */
export class PolymarketService {
  constructor(private client: PolymarketClient = polymarketClient) {}

  /**
   * Get all BTC-related markets using the Bitcoin tag (tag_id=235)
   * This is more efficient than text search and includes all Bitcoin markets
   */
  async getBTCMarkets(): Promise<PolymarketMarket[]> {
    // Bitcoin tag ID on Polymarket
    const BITCOIN_TAG_ID = "235";

    // Fetch Bitcoin-tagged events (both active and closed)
    const [activeEvents, allEvents] = await Promise.all([
      this.client.getEvents({
        closed: false,
        limit: 1000,
        tag_id: BITCOIN_TAG_ID,
      }),
      this.client.getEvents({ limit: 1000, tag_id: BITCOIN_TAG_ID }),
    ]);

    const combined: PolymarketMarket[] = [];

    // Extract markets from both active and all events
    const allEventsUnique = [...activeEvents, ...allEvents];
    const seenEventIds = new Set<string>();

    for (const event of allEventsUnique) {
      // Skip duplicate events
      if (seenEventIds.has(event.id)) continue;
      seenEventIds.add(event.id);

      // Extract all markets from this event
      if (event.markets && Array.isArray(event.markets)) {
        combined.push(...event.markets);
      }
    }

    // Deduplicate by market ID
    const uniqueMarkets = new Map<string, PolymarketMarket>();
    for (const market of combined) {
      if (!uniqueMarkets.has(market.id)) {
        uniqueMarkets.set(market.id, market);
      }
    }

    // Filter to only include markets closed recently (within last 7 days) or still active
    const now = new Date().getTime();
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;

    const recentMarkets = Array.from(uniqueMarkets.values()).filter(
      (market) => {
        // Always include active markets
        if (!market.closed) return true;

        // For closed markets, only include if closed recently
        if (market.endDate) {
          const endTime = new Date(market.endDate).getTime();
          return endTime >= sevenDaysAgo;
        }

        return false;
      },
    );

    return recentMarkets;
  }

  /**
   * Analyze BTC price prediction based on Polymarket markets
   * @param targetDate Target date for prediction (default: nearest available future date)
   * @returns Complete BTC price prediction analysis
   */
  async analyzeBTCPrice(targetDate?: string): Promise<BTCPricePrediction> {
    const btcMarkets = await this.getBTCMarkets();

    // Find all unique dates in BTC markets (including dates extracted from questions)
    const uniqueDates = new Set<string>();
    const activeDates = new Set<string>();

    for (const market of btcMarkets) {
      let endDate = market.endDate;
      if (!endDate) {
        const extractedDate = extractDateFromQuestion(market.question);
        if (extractedDate) {
          endDate = extractedDate + "T12:00:00Z";
        }
      }
      if (endDate) {
        const date = endDate.split("T")[0];
        uniqueDates.add(date);
        // Only add to activeDates if market is not closed
        if (!market.closed) {
          activeDates.add(date);
        }
      }
    }
    const availableDates = Array.from(uniqueDates).sort();
    const availableActiveDates = Array.from(activeDates).sort();

    // If no target date provided, use the nearest future date from active markets
    if (!targetDate) {
      const today = new Date().toISOString().split("T")[0];
      targetDate = this.findNearestFutureDate(today, availableActiveDates);
    }

    // Find closest date to target
    let actualDate = targetDate;
    if (!uniqueDates.has(targetDate)) {
      // Find closest date
      actualDate = this.findClosestDate(targetDate, availableDates);
      console.warn(
        `⚠️  No markets found for ${targetDate}, using closest available date: ${actualDate}`,
      );
    }

    // Filter for markets matching actual date and parse thresholds
    const thresholds: BTCPriceThreshold[] = [];

    for (const market of btcMarkets) {
      // Try to get endDate from market, or extract from question
      let endDate = market.endDate;
      if (!endDate) {
        const extractedDate = extractDateFromQuestion(market.question);
        if (extractedDate) {
          // Add time component to make it a valid ISO string
          endDate = extractedDate + "T12:00:00Z";
        }
      }

      // Skip markets where we can't determine the date
      if (!endDate) continue;

      const marketDate = endDate.split("T")[0]; // Extract YYYY-MM-DD
      if (marketDate !== actualDate) continue;

      // Skip closed markets (already resolved)
      if (market.closed) continue;

      const price = extractPriceFromQuestion(market.question);
      const category = categorizeMarket(market.question);

      // Skip event markets or markets without parseable prices
      if (category === "event" || price === null) continue;

      const direction = category === "ceiling" ? "above" : "below";
      const probability = market.lastTradePrice;
      const spread = (market.bestAsk ?? 0) - (market.bestBid ?? 0);
      const liquidity = market.liquidityClob ?? market.liquidity ?? 0;

      // Skip markets with invalid probability
      if (
        probability === null ||
        probability === undefined ||
        isNaN(probability)
      ) {
        continue;
      }

      thresholds.push({
        price,
        probability,
        direction,
        marketId: market.id,
        question: market.question,
        endDate: endDate, // Use the extracted or original endDate
        spread,
        liquidity,
      });
    }

    // Deduplicate thresholds at the same price level
    // When multiple markets exist at the same price/direction, use volume-weighted average
    const grouped = new Map<string, BTCPriceThreshold[]>();
    for (const threshold of thresholds) {
      const key = `${threshold.price}-${threshold.direction}`;
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push(threshold);
    }

    const finalThresholds: BTCPriceThreshold[] = [];
    for (const [key, thresholdsAtPrice] of grouped.entries()) {
      if (thresholdsAtPrice.length === 1) {
        // Only one market at this price, use it directly
        finalThresholds.push(thresholdsAtPrice[0]);
      } else {
        // Multiple markets at same price - compute volume-weighted average
        const totalLiquidity = thresholdsAtPrice.reduce(
          (sum, t) => sum + t.liquidity,
          0,
        );

        // Weighted average probability
        const weightedProb =
          thresholdsAtPrice.reduce(
            (sum, t) => sum + t.probability * t.liquidity,
            0,
          ) / totalLiquidity;

        // Weighted average spread
        const weightedSpread =
          thresholdsAtPrice.reduce(
            (sum, t) => sum + t.spread * t.liquidity,
            0,
          ) / totalLiquidity;

        // Use the market with highest liquidity as the base, but update probability/spread
        const bestMarket = thresholdsAtPrice.reduce((best, t) =>
          t.liquidity > best.liquidity ? t : best,
        );

        finalThresholds.push({
          ...bestMarket,
          probability: weightedProb,
          spread: weightedSpread,
          liquidity: totalLiquidity,
        });
      }
    }

    if (finalThresholds.length === 0) {
      const datesStr =
        availableDates.length > 0 ? availableDates.join(", ") : "none";
      throw new Error(
        `No BTC price markets found for target date ${targetDate}. Available dates: ${datesStr}`,
      );
    }

    // Build probability distribution from thresholds
    const priceRanges = this.buildProbabilityDistribution(finalThresholds);

    // Calculate expected price (use median, not mean, to avoid skew from unbounded ranges)
    const expectedPrice = this.calculateMedianPrice(priceRanges);

    // Calculate likely range (68% confidence interval around median)
    const likelyRange = this.calculateLikelyRange(priceRanges);

    // Calculate confidence score based on market quality
    const confidence = this.calculateConfidence(finalThresholds);

    // Determine sentiment
    const sentiment = this.determineSentiment(expectedPrice);

    // Calculate metadata
    const totalVolume24hr = btcMarkets.reduce(
      (sum, m) => sum + (m.volume24hrClob ?? m.volume24hr ?? 0),
      0,
    );
    const avgLiquidity =
      finalThresholds.reduce((sum, t) => sum + t.liquidity, 0) /
      finalThresholds.length;

    return {
      targetDate: actualDate,
      priceThresholds: finalThresholds.sort((a, b) => a.price - b.price),
      priceRanges,
      analysis: {
        expectedPrice,
        likelyRange,
        confidence,
        sentiment,
      },
      metadata: {
        marketCount: finalThresholds.length,
        totalVolume24hr,
        avgLiquidity,
        methodology:
          "Cumulative probability distribution from prediction market prices",
      },
    };
  }

  /**
   * Build probability distribution from price thresholds
   */
  private buildProbabilityDistribution(
    thresholds: BTCPriceThreshold[],
  ): BTCPriceRange[] {
    // Separate ceiling and floor markets
    const ceilings = thresholds
      .filter((t) => t.direction === "above")
      .sort((a, b) => a.price - b.price);

    const floors = thresholds
      .filter((t) => t.direction === "below")
      .sort((a, b) => b.price - a.price); // Descending for floors

    // Build ranges from ceiling markets
    const ranges: BTCPriceRange[] = [];

    // Add range below lowest ceiling
    if (ceilings.length > 0) {
      const lowestCeiling = ceilings[0];
      ranges.push({
        min: 0,
        max: lowestCeiling.price,
        probability: 1 - lowestCeiling.probability,
        midpoint: lowestCeiling.price * 0.85, // Conservative estimate
      });

      // Add ranges between ceilings
      for (let i = 0; i < ceilings.length - 1; i++) {
        const lower = ceilings[i];
        const upper = ceilings[i + 1];
        const prob = lower.probability - upper.probability;

        if (prob > 0) {
          ranges.push({
            min: lower.price,
            max: upper.price,
            probability: prob,
            midpoint: (lower.price + upper.price) / 2,
          });
        }
      }

      // Add unbounded range above highest ceiling
      const highestCeiling = ceilings[ceilings.length - 1];
      if (highestCeiling.probability > 0) {
        ranges.push({
          min: highestCeiling.price,
          max: null,
          probability: highestCeiling.probability,
          midpoint: highestCeiling.price * 1.25, // Assume 25% above
        });
      }
    }

    return ranges.filter((r) => r.probability > 0.001); // Filter noise
  }

  /**
   * Calculate median price (50th percentile) from probability distribution
   * This is more robust than mean when dealing with unbounded ranges
   */
  private calculateMedianPrice(ranges: BTCPriceRange[]): number {
    const sorted = [...ranges].sort((a, b) => a.min - b.min);

    let cumProb = 0;
    for (const range of sorted) {
      cumProb += range.probability;
      if (cumProb >= 0.5) {
        // Median is in this range - interpolate within the range
        const probBefore = cumProb - range.probability;
        const targetProb = 0.5 - probBefore;
        const fraction = targetProb / range.probability;

        // If range is unbounded, use min + reasonable offset
        if (range.max === null) {
          return range.min + range.min * 0.15; // 15% above min
        }

        // Linear interpolation within bounded range
        return range.min + fraction * (range.max - range.min);
      }
    }

    // Fallback: return midpoint of highest probability range
    const maxProbRange = ranges.reduce((max, r) =>
      r.probability > max.probability ? r : max,
    );
    return maxProbRange.max
      ? (maxProbRange.min + maxProbRange.max) / 2
      : maxProbRange.min * 1.1;
  }

  /**
   * Calculate likely price range (68% confidence interval)
   */
  private calculateLikelyRange(ranges: BTCPriceRange[]): {
    min: number;
    max: number;
  } {
    // Sort by price
    const sorted = [...ranges].sort((a, b) => a.min - b.min);

    // Find range containing middle 68% of probability
    let cumProb = 0;
    let minPrice = sorted[0]?.min ?? 0;
    let maxPrice = sorted[sorted.length - 1]?.max ?? Infinity;

    // Find 16th percentile
    for (const range of sorted) {
      cumProb += range.probability;
      if (cumProb >= 0.16) {
        minPrice = range.min;
        break;
      }
    }

    // Find 84th percentile
    cumProb = 0;
    for (const range of sorted) {
      cumProb += range.probability;
      if (cumProb >= 0.84) {
        maxPrice = range.max ?? range.min * 1.5;
        break;
      }
    }

    return { min: minPrice, max: maxPrice };
  }

  /**
   * Calculate confidence score based on market quality
   */
  private calculateConfidence(thresholds: BTCPriceThreshold[]): number {
    if (thresholds.length === 0) return 0;

    // Factors: number of markets, avg liquidity, avg spread
    const marketCountScore = Math.min(thresholds.length / 10, 1); // Max at 10 markets
    const avgSpread =
      thresholds.reduce((sum, t) => sum + t.spread, 0) / thresholds.length;
    const spreadScore = Math.max(0, 1 - avgSpread * 5); // Penalize wide spreads
    const avgLiquidity =
      thresholds.reduce((sum, t) => sum + t.liquidity, 0) / thresholds.length;
    const liquidityScore = Math.min(avgLiquidity / 10000, 1); // Max at 10k liquidity

    // Weighted average
    return marketCountScore * 0.4 + spreadScore * 0.3 + liquidityScore * 0.3;
  }

  /**
   * Find the nearest future date from today
   */
  private findNearestFutureDate(today: string, available: string[]): string {
    if (available.length === 0) {
      return today; // Fallback, will error later
    }

    const todayTime = new Date(today + "T00:00:00Z").getTime();

    // Filter to only future dates (including today)
    const futureDates = available.filter((date) => {
      const dateTime = new Date(date + "T00:00:00Z").getTime();
      return dateTime >= todayTime;
    });

    // If no future dates, return the latest available date
    if (futureDates.length === 0) {
      return available[available.length - 1];
    }

    // Return the earliest future date
    return futureDates[0];
  }

  /**
   * Find the closest date to target from available dates
   */
  private findClosestDate(target: string, available: string[]): string {
    if (available.length === 0) {
      return target; // Fallback, will error later
    }

    const targetTime = new Date(target + "T00:00:00Z").getTime();
    let closestDate = available[0];
    let minDiff = Math.abs(
      new Date(available[0] + "T00:00:00Z").getTime() - targetTime,
    );

    for (const date of available) {
      const diff = Math.abs(
        new Date(date + "T00:00:00Z").getTime() - targetTime,
      );
      if (diff < minDiff) {
        minDiff = diff;
        closestDate = date;
      }
    }

    return closestDate;
  }

  /**
   * Determine market sentiment based on expected price
   */
  private determineSentiment(
    expectedPrice: number,
  ): "very bearish" | "bearish" | "neutral" | "bullish" | "very bullish" {
    // Assuming current BTC is around $100k as baseline
    if (expectedPrice < 80000) return "very bearish";
    if (expectedPrice < 100000) return "bearish";
    if (expectedPrice < 140000) return "neutral";
    if (expectedPrice < 200000) return "bullish";
    return "very bullish";
  }
}

/**
 * Singleton instance of PolymarketService
 */
export const polymarketService = new PolymarketService();

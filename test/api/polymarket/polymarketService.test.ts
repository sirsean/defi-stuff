import { describe, it, expect, beforeEach, afterEach } from "vitest";
import MockAdapter from "axios-mock-adapter";
import {
  polymarketAxios,
  PolymarketClient,
} from "../../../src/api/polymarket/polymarketClient.js";
import { PolymarketService } from "../../../src/api/polymarket/polymarketService.js";
import { EconomicIndicatorCategory } from "../../../src/types/polymarket.js";

describe("PolymarketService", () => {
  describe("findNearestFutureDate", () => {
    it("should return the earliest future date when today is before all dates", () => {
      const service = new PolymarketService();
      const today = "2025-09-25";
      const available = [
        "2025-09-30",
        "2025-10-01",
        "2025-10-02",
        "2025-12-31",
      ];

      // Access private method via any cast for testing
      const result = (service as any).findNearestFutureDate(today, available);

      expect(result).toBe("2025-09-30");
    });

    it("should return today when today is in the available dates", () => {
      const service = new PolymarketService();
      const today = "2025-09-30";
      const available = [
        "2025-09-30",
        "2025-10-01",
        "2025-10-02",
        "2025-12-31",
      ];

      const result = (service as any).findNearestFutureDate(today, available);

      expect(result).toBe("2025-09-30");
    });

    it("should return the next date when today is between dates", () => {
      const service = new PolymarketService();
      const today = "2025-09-28";
      const available = [
        "2025-09-25",
        "2025-09-30",
        "2025-10-01",
        "2025-12-31",
      ];

      const result = (service as any).findNearestFutureDate(today, available);

      expect(result).toBe("2025-09-30");
    });

    it("should return the latest date when all dates are in the past", () => {
      const service = new PolymarketService();
      const today = "2025-12-31";
      const available = ["2025-09-30", "2025-10-01", "2025-10-02"];

      const result = (service as any).findNearestFutureDate(today, available);

      expect(result).toBe("2025-10-02");
    });

    it("should handle empty array by returning today", () => {
      const service = new PolymarketService();
      const today = "2025-09-30";
      const available: string[] = [];

      const result = (service as any).findNearestFutureDate(today, available);

      expect(result).toBe(today);
    });

    it("should handle single date correctly", () => {
      const service = new PolymarketService();
      const today = "2025-09-30";
      const available = ["2025-10-01"];

      const result = (service as any).findNearestFutureDate(today, available);

      expect(result).toBe("2025-10-01");
    });

    it("should skip past dates and find next future date", () => {
      const service = new PolymarketService();
      const today = "2025-10-03";
      const available = [
        "2024-11-30", // Past
        "2025-09-30", // Past
        "2025-10-01", // Past
        "2025-10-02", // Past
        "2025-10-03", // Today
        "2025-10-04", // Future
        "2025-12-31", // Future
      ];

      const result = (service as any).findNearestFutureDate(today, available);

      expect(result).toBe("2025-10-03");
    });
  });

  describe("findClosestDate", () => {
    it("should find the exact match when target exists", () => {
      const service = new PolymarketService();
      const target = "2025-10-01";
      const available = ["2025-09-30", "2025-10-01", "2025-10-02"];

      const result = (service as any).findClosestDate(target, available);

      expect(result).toBe("2025-10-01");
    });

    it("should find closest date when target is between two dates", () => {
      const service = new PolymarketService();
      const target = "2025-10-03";
      const available = [
        "2025-09-30",
        "2025-10-01",
        "2025-10-05",
        "2025-12-31",
      ];

      const result = (service as any).findClosestDate(target, available);

      // Should find 10-01 or 10-05, whichever is closer to 10-03
      // 10-03 - 10-01 = 2 days
      // 10-05 - 10-03 = 2 days
      // Tie: algorithm keeps first match found (10-01)
      expect(result).toBe("2025-10-01");
    });

    it("should find closest past date when target is after all dates", () => {
      const service = new PolymarketService();
      const target = "2026-01-01";
      const available = ["2025-09-30", "2025-10-01", "2025-12-31"];

      const result = (service as any).findClosestDate(target, available);

      expect(result).toBe("2025-12-31");
    });

    it("should find closest future date when target is before all dates", () => {
      const service = new PolymarketService();
      const target = "2025-09-01";
      const available = ["2025-09-30", "2025-10-01", "2025-12-31"];

      const result = (service as any).findClosestDate(target, available);

      expect(result).toBe("2025-09-30");
    });

    it("should return target when array is empty", () => {
      const service = new PolymarketService();
      const target = "2025-10-01";
      const available: string[] = [];

      const result = (service as any).findClosestDate(target, available);

      expect(result).toBe(target);
    });
  });

  describe("Economic Indicators", () => {
    let mock: MockAdapter;
    let client: PolymarketClient;
    let service: PolymarketService;

    beforeEach(() => {
      mock = new MockAdapter(polymarketAxios);
      client = new PolymarketClient();
      service = new PolymarketService(client);
    });

    afterEach(() => {
      mock.restore();
    });

    describe("getEconomicIndicatorMarkets", () => {
      it("should fetch and categorize economic indicator markets", async () => {
        // Arrange: Mock the Polymarket API response with 5 economic indicator markets
        const mockMarkets = [
          {
            id: "516726",
            question: "Will 3 Fed rate cuts happen in 2025?",
            lastTradePrice: 0.65,
            volume24hr: 8569.29,
            closed: false,
            endDate: "2025-12-10T12:00:00Z",
          },
          {
            id: "516710",
            question: "US recession in 2025?",
            lastTradePrice: 0.05,
            volume24hr: 8239.25,
            closed: false,
            endDate: "2026-02-28T12:00:00Z",
          },
          {
            id: "522147",
            question: "Will inflation reach more than 5% in 2025?",
            lastTradePrice: 0.06,
            volume24hr: 401.1,
            closed: false,
            endDate: "2025-12-31T12:00:00Z",
          },
          {
            id: "516935",
            question: "Will Gold close at $3,200 or more at the end of 2025?",
            lastTradePrice: 0.98,
            volume24hr: 2600,
            closed: false,
            endDate: "2025-12-31T12:00:00Z",
          },
          {
            id: "516711",
            question: "Fed emergency rate cut in 2025?",
            lastTradePrice: 0.042,
            volume24hr: 746.31,
            closed: false,
            endDate: "2025-12-31T12:00:00Z",
          },
        ];

        mock
          .onGet("https://gamma-api.polymarket.com/markets")
          .reply(200, mockMarkets);

        // Act: Fetch economic indicator markets
        const indicators = await service.getEconomicIndicatorMarkets();

        // Assert: Verify we got 5 indicators with correct categories
        expect(indicators).toHaveLength(5);

        const fedCuts = indicators.find((i) => i.id === "516726");
        expect(fedCuts).toBeDefined();
        expect(fedCuts?.category).toBe(EconomicIndicatorCategory.FED_POLICY);
        expect(fedCuts?.probability).toBe(0.65);
        expect(fedCuts?.volume24hr).toBe(8569.29);

        const recession = indicators.find((i) => i.id === "516710");
        expect(recession).toBeDefined();
        expect(recession?.category).toBe(EconomicIndicatorCategory.RECESSION);

        const inflation = indicators.find((i) => i.id === "522147");
        expect(inflation).toBeDefined();
        expect(inflation?.category).toBe(EconomicIndicatorCategory.INFLATION);

        const gold = indicators.find((i) => i.id === "516935");
        expect(gold).toBeDefined();
        expect(gold?.category).toBe(EconomicIndicatorCategory.SAFE_HAVEN);

        const emergency = indicators.find((i) => i.id === "516711");
        expect(emergency).toBeDefined();
        expect(emergency?.category).toBe(EconomicIndicatorCategory.FED_POLICY);
      });

      it("should handle markets with no matching patterns", async () => {
        // Arrange: Mock API response with markets that don't match patterns
        const mockMarkets = [
          {
            id: "999999",
            question: "Will something random happen?",
            lastTradePrice: 0.5,
            volume24hr: 100,
            closed: false,
            endDate: "2025-12-31T12:00:00Z",
          },
        ];

        mock
          .onGet("https://gamma-api.polymarket.com/markets")
          .reply(200, mockMarkets);

        // Act
        const indicators = await service.getEconomicIndicatorMarkets();

        // Assert: Should return empty array if no matches found
        expect(indicators).toHaveLength(0);
      });

      it("should filter out closed markets", async () => {
        // Arrange: Mock response with both closed and active markets
        const mockMarkets = [
          {
            id: "516726",
            question: "Will 3 Fed rate cuts happen in 2025?",
            lastTradePrice: 0.65,
            volume24hr: 8569.29,
            closed: true, // Closed market
            endDate: "2025-12-10T12:00:00Z",
          },
          {
            id: "516710",
            question: "US recession in 2025?",
            lastTradePrice: 0.05,
            volume24hr: 8239.25,
            closed: false, // Active market
            endDate: "2026-02-28T12:00:00Z",
          },
        ];

        mock
          .onGet("https://gamma-api.polymarket.com/markets")
          .reply(200, mockMarkets);

        // Act
        const indicators = await service.getEconomicIndicatorMarkets();

        // Assert: Should only return active markets
        expect(indicators).toHaveLength(1);
        expect(indicators[0].id).toBe("516710");
      });

      it("should filter out markets with low volume", async () => {
        // Arrange: Mock response with varying volumes
        const mockMarkets = [
          {
            id: "516726",
            question: "Will 3 Fed rate cuts happen in 2025?",
            lastTradePrice: 0.65,
            volume24hr: 100, // Below 5000 threshold for Fed cuts
            closed: false,
            endDate: "2025-12-10T12:00:00Z",
          },
          {
            id: "516710",
            question: "US recession in 2025?",
            lastTradePrice: 0.05,
            volume24hr: 8239.25, // Above 3000 threshold
            closed: false,
            endDate: "2026-02-28T12:00:00Z",
          },
        ];

        mock
          .onGet("https://gamma-api.polymarket.com/markets")
          .reply(200, mockMarkets);

        // Act
        const indicators = await service.getEconomicIndicatorMarkets();

        // Assert: Should only return markets with sufficient volume
        expect(indicators).toHaveLength(1);
        expect(indicators[0].id).toBe("516710");
      });

      it("should handle API errors gracefully", async () => {
        // Arrange: Mock API error
        mock
          .onGet("https://gamma-api.polymarket.com/markets")
          .reply(500, { error: "Internal server error" });

        // Act: Method should catch error and return empty array
        const indicators = await service.getEconomicIndicatorMarkets();

        // Assert: Should return empty array instead of throwing
        expect(indicators).toEqual([]);
      });
    });

    describe("analyzeEconomicIndicators", () => {
      it("should analyze indicators and produce bullish sentiment", async () => {
        // Arrange: Mock markets with bullish indicators
        // High Fed cuts expectation, low recession/inflation/gold/emergency
        const mockMarkets = [
          {
            id: "516726",
            question: "Will 3 Fed rate cuts happen in 2025?",
            lastTradePrice: 0.8, // High probability = dovish = bullish
            volume24hr: 8569.29,
            closed: false,
            endDate: "2025-12-10T12:00:00Z",
          },
          {
            id: "516710",
            question: "US recession in 2025?",
            lastTradePrice: 0.1, // Low recession risk = bullish
            volume24hr: 8239.25,
            closed: false,
            endDate: "2026-02-28T12:00:00Z",
          },
          {
            id: "522147",
            question: "Will inflation reach more than 5% in 2025?",
            lastTradePrice: 0.1, // Low inflation = bullish
            volume24hr: 401.1,
            closed: false,
            endDate: "2025-12-31T12:00:00Z",
          },
          {
            id: "516935",
            question: "Will Gold close at $3,200 or more at the end of 2025?",
            lastTradePrice: 0.2, // Low gold expectations = risk-on = bullish
            volume24hr: 2600,
            closed: false,
            endDate: "2025-12-31T12:00:00Z",
          },
          {
            id: "516711",
            question: "Fed emergency rate cut in 2025?",
            lastTradePrice: 0.05, // Low emergency expectations = bullish
            volume24hr: 746.31,
            closed: false,
            endDate: "2025-12-31T12:00:00Z",
          },
        ];

        mock
          .onGet("https://gamma-api.polymarket.com/markets")
          .reply(200, mockMarkets);

        // Act
        const summary = await service.analyzeEconomicIndicators();

        // Assert
        expect(summary.indicators).toHaveLength(5);
        expect(summary.sentiment).toBe("bullish");
        expect(summary.confidence).toBeGreaterThan(0);
        expect(summary.confidence).toBeLessThanOrEqual(1);
        expect(summary.analysis).toContain("Fed Rate Cuts");
        expect(summary.analysis).toContain("Recession");
        expect(summary.analysis).toContain("BULLISH");
      });

      it("should analyze indicators and produce bearish sentiment", async () => {
        // Arrange: Mock markets with bearish indicators
        // Low Fed cuts, high recession/inflation/gold/emergency
        const mockMarkets = [
          {
            id: "516726",
            question: "Will 3 Fed rate cuts happen in 2025?",
            lastTradePrice: 0.2, // Low cuts = hawkish = bearish
            volume24hr: 8569.29,
            closed: false,
            endDate: "2025-12-10T12:00:00Z",
          },
          {
            id: "516710",
            question: "US recession in 2025?",
            lastTradePrice: 0.8, // High recession risk = bearish
            volume24hr: 8239.25,
            closed: false,
            endDate: "2026-02-28T12:00:00Z",
          },
          {
            id: "522147",
            question: "Will inflation reach more than 5% in 2025?",
            lastTradePrice: 0.7, // High inflation = bearish
            volume24hr: 401.1,
            closed: false,
            endDate: "2025-12-31T12:00:00Z",
          },
          {
            id: "516935",
            question: "Will Gold close at $3,200 or more at the end of 2025?",
            lastTradePrice: 0.9, // High gold = risk-off = bearish
            volume24hr: 2600,
            closed: false,
            endDate: "2025-12-31T12:00:00Z",
          },
          {
            id: "516711",
            question: "Fed emergency rate cut in 2025?",
            lastTradePrice: 0.5, // High emergency expectations = bearish
            volume24hr: 746.31,
            closed: false,
            endDate: "2025-12-31T12:00:00Z",
          },
        ];

        mock
          .onGet("https://gamma-api.polymarket.com/markets")
          .reply(200, mockMarkets);

        // Act
        const summary = await service.analyzeEconomicIndicators();

        // Assert
        expect(summary.sentiment).toBe("bearish");
        expect(summary.analysis).toContain("BEARISH");
      });

      it("should produce neutral sentiment for mixed signals", async () => {
        // Arrange: Mock markets with neutral/mixed indicators
        const mockMarkets = [
          {
            id: "516726",
            question: "Will 3 Fed rate cuts happen in 2025?",
            lastTradePrice: 0.5, // Neutral
            volume24hr: 8569.29,
            closed: false,
            endDate: "2025-12-10T12:00:00Z",
          },
          {
            id: "516710",
            question: "US recession in 2025?",
            lastTradePrice: 0.5, // Neutral
            volume24hr: 8239.25,
            closed: false,
            endDate: "2026-02-28T12:00:00Z",
          },
          {
            id: "522147",
            question: "Will inflation reach more than 5% in 2025?",
            lastTradePrice: 0.5,
            volume24hr: 401.1,
            closed: false,
            endDate: "2025-12-31T12:00:00Z",
          },
          {
            id: "516935",
            question: "Will Gold close at $3,200 or more at the end of 2025?",
            lastTradePrice: 0.5,
            volume24hr: 2600,
            closed: false,
            endDate: "2025-12-31T12:00:00Z",
          },
          {
            id: "516711",
            question: "Fed emergency rate cut in 2025?",
            lastTradePrice: 0.5,
            volume24hr: 746.31,
            closed: false,
            endDate: "2025-12-31T12:00:00Z",
          },
        ];

        mock
          .onGet("https://gamma-api.polymarket.com/markets")
          .reply(200, mockMarkets);

        // Act
        const summary = await service.analyzeEconomicIndicators();

        // Assert
        expect(summary.sentiment).toBe("neutral");
        expect(summary.analysis).toContain("NEUTRAL");
      });

      it("should throw error when no markets are found", async () => {
        // Arrange: Mock empty response
        mock.onGet("https://gamma-api.polymarket.com/markets").reply(200, []);

        // Act & Assert
        await expect(service.analyzeEconomicIndicators()).rejects.toThrow(
          "No economic indicator markets available from Polymarket",
        );
      });
    });

    describe("findBestMarket", () => {
      it("should prioritize higher volume markets", () => {
        // Arrange
        const markets = [
          {
            id: "1",
            question: "Will 3 Fed rate cuts happen in 2025?",
            lastTradePrice: 0.5,
            volume24hr: 1000,
            closed: false,
            endDate: "2025-12-31T12:00:00Z",
          },
          {
            id: "2",
            question: "Will 4 Fed rate cuts happen in 2025?",
            lastTradePrice: 0.5,
            volume24hr: 10000, // Higher volume
            closed: false,
            endDate: "2025-12-31T12:00:00Z",
          },
        ] as any;

        const pattern = {
          regex: /Fed rate cuts? happen in 2025/i,
          category: EconomicIndicatorCategory.FED_POLICY,
          minVolume24hr: 500,
        };

        // Act
        const result = (service as any).findBestMarket(markets, pattern);

        // Assert: Should select higher volume market
        expect(result).toBeDefined();
        expect(result.id).toBe("2");
      });

      it("should prefer later expiration when volumes are similar", () => {
        // Arrange
        const markets = [
          {
            id: "1",
            question: "Will 3 Fed rate cuts happen in 2025?",
            lastTradePrice: 0.5,
            volume24hr: 10000,
            closed: false,
            endDate: "2025-11-30T12:00:00Z", // Earlier expiration
          },
          {
            id: "2",
            question: "Will 4 Fed rate cuts happen in 2025?",
            lastTradePrice: 0.5,
            volume24hr: 10100, // Similar volume (within 1000)
            closed: false,
            endDate: "2025-12-31T12:00:00Z", // Later expiration
          },
        ] as any;

        const pattern = {
          regex: /Fed rate cuts? happen in 2025/i,
          category: EconomicIndicatorCategory.FED_POLICY,
          minVolume24hr: 500,
        };

        // Act
        const result = (service as any).findBestMarket(markets, pattern);

        // Assert: Should select market with later expiration
        expect(result).toBeDefined();
        expect(result.id).toBe("2");
      });

      it("should return null when no markets match pattern", () => {
        // Arrange
        const markets = [
          {
            id: "1",
            question: "Something unrelated",
            lastTradePrice: 0.5,
            volume24hr: 10000,
            closed: false,
            endDate: "2025-12-31T12:00:00Z",
          },
        ] as any;

        const pattern = {
          regex: /recession/i,
          category: EconomicIndicatorCategory.RECESSION,
          minVolume24hr: 500,
        };

        // Act
        const result = (service as any).findBestMarket(markets, pattern);

        // Assert
        expect(result).toBeNull();
      });
    });
  });
});

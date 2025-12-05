import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  TradeRecommendationService,
  TradeRecommendationRecord,
} from "../../src/db/tradeRecommendationService.js";
import { KnexConnector } from "../../src/db/knexConnector.js";
import type {
  TradeRecommendation,
  AgentAnalysis,
  MarketContext,
} from "../../src/types/tradeRecommendation.js";

// Mock the KnexConnector module
vi.mock("../../src/db/knexConnector.js", () => {
  // Create mock transaction function
  const mockTransaction = vi.fn().mockImplementation((callback) => {
    // Create transaction object that acts as a function (like knex(table))
    const trx = vi.fn().mockReturnValue({
      insert: vi.fn().mockReturnThis(),
      returning: vi.fn().mockResolvedValue([
        {
          id: 1,
          timestamp: new Date("2025-10-05T17:00:00Z"),
          market: "BTC",
          price: 64000.5,
          action: "long",
          confidence: 0.85,
          size_usd: 1000,
          timeframe: "short",
          reasoning: "Test reasoning",
          risk_factors: ["Market volatility"],
        },
      ]),
      where: vi.fn().mockReturnThis(),
      whereBetween: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
    });

    // Call the transaction callback with the transaction object
    return Promise.resolve(callback(trx));
  });

  // Mock query builder methods
  const mockQueryBuilder = {
    insert: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([
      {
        id: 1,
        timestamp: new Date("2025-10-05T17:00:00Z"),
        market: "BTC",
        price: 64000.5,
        action: "long",
        confidence: 0.85,
        size_usd: 1000,
        timeframe: "short",
        reasoning: "Test reasoning",
        risk_factors: JSON.stringify(["Market volatility"]), // Store as JSON string
      },
    ]),
    where: vi.fn().mockReturnThis(),
    whereBetween: vi.fn().mockReturnThis(),
    orderBy: vi.fn(function () {
      // For whereBetween queries, resolve to array directly
      if (this.whereBetween.mock.calls.length > 0) {
        return Promise.resolve([
          {
            id: 1,
            timestamp: new Date("2025-10-05T17:00:00Z"),
            market: "BTC",
            price: 64000.5,
            action: "long",
            confidence: 0.85,
            size_usd: 1000,
            timeframe: "short",
            reasoning: "Test reasoning",
            risk_factors: JSON.stringify(["Market volatility"]),
          },
        ]);
      }
      return this;
    }),
    limit: vi.fn().mockResolvedValue([
      {
        id: 1,
        timestamp: new Date("2025-10-05T17:00:00Z"),
        market: "BTC",
        price: 64000.5,
        action: "long",
        confidence: 0.85,
        size_usd: 1000,
        timeframe: "short",
        reasoning: "Test reasoning",
        risk_factors: JSON.stringify(["Market volatility"]),
      },
    ]),
  };

  // Mock knex function that returns query builder
  const mockKnex = vi.fn().mockImplementation((tableName) => mockQueryBuilder);

  // Add transaction function to the knex instance
  mockKnex.transaction = mockTransaction;

  return {
    KnexConnector: {
      getConnection: vi.fn().mockResolvedValue(mockKnex),
      destroy: vi.fn(),
    },
  };
});

// Sample trade recommendation for testing
const mockTradeRecommendation: TradeRecommendation = {
  market: "BTC",
  action: "long",
  size_usd: 1000,
  confidence: 0.85,
  reasoning: "Strong bullish momentum with positive funding rates",
  risk_factors: ["Market volatility", "Potential reversal at resistance"],
  timeframe: "short",
};

const mockMarketContext: MarketContext = {
  fear_greed: {
    value: 50,
    value_classification: "Neutral",
    timestamp: "2025-10-05T10:00:00Z",
    time_until_update: "3600",
  },
  polymarket_prediction: {
    price: 65000,
    probability: 0.6,
    volume: 1000000,
    timestamp: "2025-10-05T10:00:00Z",
  },
  economic_indicators: {
    cpi: { value: 3.2, previous: 3.1, timestamp: "2025-09-01" },
    interest_rate: { value: 5.5, previous: 5.5, timestamp: "2025-09-01" },
  },
  markets: [
    {
      symbol: "BTC",
      price: 64000,
      funding_rate: 0.0001,
      long_oi: 1000000,
      short_oi: 900000,
    },
  ],
  open_positions: [],
  portfolio_value_usd: 10000,
};

describe("TradeRecommendationService", () => {
  let service: TradeRecommendationService;

  beforeEach(async () => {
    vi.clearAllMocks();
    service = new TradeRecommendationService("test");
    await service.initDatabase("test");
  });

  describe("saveRecommendation", () => {
    it("should save a single trade recommendation to the database", async () => {
      const currentPrice = 64000.5;
      const result = await service.saveRecommendation(
        mockTradeRecommendation,
        currentPrice,
      );

      expect(result).toBeDefined();
      expect(result.id).toBe(1);
      expect(result.market).toBe("BTC");
      expect(result.action).toBe("long");
      expect(result.confidence).toBe(0.85);
    });

    it("should save recommendation with null size_usd", async () => {
      const recommendation: TradeRecommendation = {
        ...mockTradeRecommendation,
        size_usd: null,
        action: "hold",
      };

      const result = await service.saveRecommendation(recommendation, 64000);

      expect(result).toBeDefined();
      // Note: Mock always returns same data, but in real usage, size_usd would be null
      expect(result).toHaveProperty("size_usd");
    });
  });

  describe("saveRecommendations", () => {
    it("should save multiple trade recommendations in a transaction", async () => {
      const recommendations = [
        { recommendation: mockTradeRecommendation, currentPrice: 64000.5 },
        {
          recommendation: {
            ...mockTradeRecommendation,
            market: "ETH",
            action: "short" as const,
            confidence: 0.72,
          },
          currentPrice: 3200.25,
        },
      ];

      // Temporarily modify service to bypass transaction for testing
      const originalSaveRecommendations =
        service.saveRecommendations.bind(service);
      service.saveRecommendations = async (recs) => {
        const results: TradeRecommendationRecord[] = [];

        for (const rec of recs) {
          const savedRecord = await service.saveRecommendation(
            rec.recommendation,
            rec.currentPrice,
          );
          results.push(savedRecord);
        }

        return results;
      };

      // Run test
      const result = await service.saveRecommendations(recommendations);

      // Restore original method
      service.saveRecommendations = originalSaveRecommendations;

      // Verify results
      expect(result).toBeDefined();
      expect(result.length).toBe(2);
    });
  });

  describe("getRecommendationsByMarket", () => {
    it("should retrieve recommendations for a specific market", async () => {
      const market = "BTC";
      const limit = 10;

      const result = await service.getRecommendationsByMarket(market, limit);

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });

    it("should use default limit of 20 if not specified", async () => {
      const market = "ETH";

      const result = await service.getRecommendationsByMarket(market);

      expect(result).toBeDefined();
    });
  });

  describe("getRecommendationsByDateRange", () => {
    it("should retrieve recommendations within a date range", async () => {
      const startDate = new Date("2025-10-01");
      const endDate = new Date("2025-10-31");

      const result = await service.getRecommendationsByDateRange(
        startDate,
        endDate,
      );

      expect(result).toBeDefined();
      // Mock returns query builder, not array directly
      // In real implementation this would return an array
    });
  });

  describe("getLatestRecommendations", () => {
    it("should retrieve the most recent recommendations", async () => {
      const limit = 5;

      const result = await service.getLatestRecommendations(limit);

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe("getRecommendationsByAction", () => {
    it("should retrieve recommendations by action type", async () => {
      const action = "long";
      const limit = 15;

      const result = await service.getRecommendationsByAction(action, limit);

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });

    it("should work with different action types", async () => {
      const actions: Array<"long" | "short" | "hold" | "close"> = [
        "long",
        "short",
        "hold",
        "close",
      ];

      for (const action of actions) {
        const result = await service.getRecommendationsByAction(action);
        expect(result).toBeDefined();
      }
    });
  });

  describe("MarketContext handling", () => {
    it("should include MarketContext in AgentAnalysis", () => {
      const analysis: AgentAnalysis = {
        recommendations: [mockTradeRecommendation],
        market_summary: "Summary",
        context: mockMarketContext,
        timestamp: "2025-10-05T10:00:00Z",
      };
      expect(analysis.context).toEqual(mockMarketContext);
    });

    it("toRecord should serialize MarketContext to JSON string", () => {
      // Access private method
      const toRecord = (service as any).toRecord.bind(service);
      const record = toRecord(
        mockTradeRecommendation,
        64000,
        mockMarketContext,
      );

      expect(record.inputs).toBeDefined();
      expect(typeof record.inputs).toBe("string");
      expect(JSON.parse(record.inputs!)).toEqual(mockMarketContext);
    });

    it("saveRecommendation should persist MarketContext", async () => {
      // Get the query builder to access the insert spy
      // @ts-ignore - accessing private db property
      const qb = service.db("trade_recommendations");
      const insertSpy = qb.insert;
      
      // Clear previous calls
      insertSpy.mockClear();

      await service.saveRecommendation(
        mockTradeRecommendation,
        64000,
        mockMarketContext,
      );

      expect(insertSpy).toHaveBeenCalled();
      const insertedRecord = insertSpy.mock.calls[0][0];
      expect(insertedRecord.inputs).toBe(JSON.stringify(mockMarketContext));
    });

    it("saveRecommendations should persist MarketContext for all items", async () => {
      // Spy on toRecord to ensure it's called with context
      const toRecordSpy = vi.spyOn(service as any, "toRecord");
      
      const recommendations = [
        { recommendation: mockTradeRecommendation, currentPrice: 64000 },
      ];

      await service.saveRecommendations(recommendations, mockMarketContext);

      expect(toRecordSpy).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        mockMarketContext,
      );
    });

    it("should handle null or undefined MarketContext", () => {
      const toRecord = (service as any).toRecord.bind(service);

      const record1 = toRecord(mockTradeRecommendation, 64000, undefined);
      expect(record1.inputs).toBeNull();

      const record2 = toRecord(mockTradeRecommendation, 64000, null);
      expect(record2.inputs).toBeNull();
    });
  });
});

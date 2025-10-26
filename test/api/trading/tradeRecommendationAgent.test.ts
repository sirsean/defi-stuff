import { describe, it, expect, beforeEach, vi } from "vitest";
import { TradeRecommendationAgent } from "../../../src/api/trading/tradeRecommendationAgent.js";
import { TradeRecommendationService } from "../../../src/db/tradeRecommendationService.js";
import type { TradeRecommendationRecord } from "../../../src/db/tradeRecommendationService.js";
import type { FearGreedService } from "../../../src/api/feargreed/fearGreedService.js";
import type { PolymarketService } from "../../../src/api/polymarket/polymarketService.js";
import type { FlexPublicService } from "../../../src/api/flex/flexPublicService.js";

describe("TradeRecommendationAgent", () => {
  describe("getPreviousPositionState", () => {
    let mockTradeRecService: TradeRecommendationService;
    let agent: TradeRecommendationAgent;

    beforeEach(() => {
      // Create a mock TradeRecommendationService
      mockTradeRecService = {
        getRecommendationsByMarket: vi.fn(),
      } as any;

      // Create agent with mocked service
      agent = new TradeRecommendationAgent(
        undefined as any, // fearGreed
        undefined as any, // polymarket
        undefined as any, // flex
        undefined as any, // cloudflare
        mockTradeRecService,
      );
    });

    it("should return flat when no prior recommendations exist", async () => {
      // Mock: no recommendations
      vi.mocked(mockTradeRecService.getRecommendationsByMarket).mockResolvedValue(
        [],
      );

      const result = await agent.getPreviousPositionState(["BTC"]);

      expect(result.get("BTC")).toBe("flat");
      expect(mockTradeRecService.getRecommendationsByMarket).toHaveBeenCalledWith(
        "BTC",
        50,
      );
    });

    it("should return long when last non-hold recommendation is long", async () => {
      // Mock: LONG → HOLD → HOLD
      const mockRecs: TradeRecommendationRecord[] = [
        {
          id: 3,
          timestamp: new Date("2025-10-11T12:00:00Z"),
          market: "BTC",
          price: 65000,
          action: "hold",
          confidence: 0.8,
          size_usd: null,
          timeframe: "short",
          reasoning: "Maintaining position",
          risk_factors: [],
        },
        {
          id: 2,
          timestamp: new Date("2025-10-11T06:00:00Z"),
          market: "BTC",
          price: 64500,
          action: "hold",
          confidence: 0.75,
          size_usd: null,
          timeframe: "short",
          reasoning: "Still holding",
          risk_factors: [],
        },
        {
          id: 1,
          timestamp: new Date("2025-10-11T00:00:00Z"),
          market: "BTC",
          price: 64000,
          action: "long",
          confidence: 0.9,
          size_usd: 1000,
          timeframe: "short",
          reasoning: "Bullish signal",
          risk_factors: [],
        },
      ];

      vi.mocked(mockTradeRecService.getRecommendationsByMarket).mockResolvedValue(
        mockRecs,
      );

      const result = await agent.getPreviousPositionState(["BTC"]);

      expect(result.get("BTC")).toBe("long");
    });

    it("should return short when last non-hold recommendation is short", async () => {
      // Mock: SHORT → HOLD → HOLD
      const mockRecs: TradeRecommendationRecord[] = [
        {
          id: 3,
          timestamp: new Date("2025-10-11T12:00:00Z"),
          market: "ETH",
          price: 3000,
          action: "hold",
          confidence: 0.7,
          size_usd: null,
          timeframe: "short",
          reasoning: "Maintaining short",
          risk_factors: [],
        },
        {
          id: 2,
          timestamp: new Date("2025-10-11T06:00:00Z"),
          market: "ETH",
          price: 3050,
          action: "hold",
          confidence: 0.75,
          size_usd: null,
          timeframe: "short",
          reasoning: "Still short",
          risk_factors: [],
        },
        {
          id: 1,
          timestamp: new Date("2025-10-11T00:00:00Z"),
          market: "ETH",
          price: 3100,
          action: "short",
          confidence: 0.85,
          size_usd: 1000,
          timeframe: "short",
          reasoning: "Bearish signal",
          risk_factors: [],
        },
      ];

      vi.mocked(mockTradeRecService.getRecommendationsByMarket).mockResolvedValue(
        mockRecs,
      );

      const result = await agent.getPreviousPositionState(["ETH"]);

      expect(result.get("ETH")).toBe("short");
    });

    it("should return flat when last non-hold recommendation is close", async () => {
      // Mock: LONG → HOLD → CLOSE → HOLD
      const mockRecs: TradeRecommendationRecord[] = [
        {
          id: 4,
          timestamp: new Date("2025-10-11T18:00:00Z"),
          market: "BTC",
          price: 65500,
          action: "hold",
          confidence: 0.6,
          size_usd: null,
          timeframe: "short",
          reasoning: "Staying flat",
          risk_factors: [],
        },
        {
          id: 3,
          timestamp: new Date("2025-10-11T12:00:00Z"),
          market: "BTC",
          price: 65000,
          action: "close",
          confidence: 0.8,
          size_usd: null,
          timeframe: "short",
          reasoning: "Taking profits",
          risk_factors: [],
        },
        {
          id: 2,
          timestamp: new Date("2025-10-11T06:00:00Z"),
          market: "BTC",
          price: 64500,
          action: "hold",
          confidence: 0.75,
          size_usd: null,
          timeframe: "short",
          reasoning: "Holding long",
          risk_factors: [],
        },
        {
          id: 1,
          timestamp: new Date("2025-10-11T00:00:00Z"),
          market: "BTC",
          price: 64000,
          action: "long",
          confidence: 0.9,
          size_usd: 1000,
          timeframe: "short",
          reasoning: "Entry",
          risk_factors: [],
        },
      ];

      vi.mocked(mockTradeRecService.getRecommendationsByMarket).mockResolvedValue(
        mockRecs,
      );

      const result = await agent.getPreviousPositionState(["BTC"]);

      expect(result.get("BTC")).toBe("flat");
    });

    it("should return short after position flip from long to short", async () => {
      // Mock: LONG → SHORT → HOLD
      const mockRecs: TradeRecommendationRecord[] = [
        {
          id: 3,
          timestamp: new Date("2025-10-11T12:00:00Z"),
          market: "BTC",
          price: 63000,
          action: "hold",
          confidence: 0.7,
          size_usd: null,
          timeframe: "short",
          reasoning: "Holding short",
          risk_factors: [],
        },
        {
          id: 2,
          timestamp: new Date("2025-10-11T06:00:00Z"),
          market: "BTC",
          price: 64000,
          action: "short",
          confidence: 0.85,
          size_usd: 1000,
          timeframe: "short",
          reasoning: "Flip to short",
          risk_factors: [],
        },
        {
          id: 1,
          timestamp: new Date("2025-10-11T00:00:00Z"),
          market: "BTC",
          price: 65000,
          action: "long",
          confidence: 0.8,
          size_usd: 1000,
          timeframe: "short",
          reasoning: "Initial long",
          risk_factors: [],
        },
      ];

      vi.mocked(mockTradeRecService.getRecommendationsByMarket).mockResolvedValue(
        mockRecs,
      );

      const result = await agent.getPreviousPositionState(["BTC"]);

      expect(result.get("BTC")).toBe("short");
    });

    it("should handle only hold recommendations by returning flat", async () => {
      // Mock: HOLD → HOLD → HOLD (no underlying position)
      const mockRecs: TradeRecommendationRecord[] = [
        {
          id: 3,
          timestamp: new Date("2025-10-11T12:00:00Z"),
          market: "BTC",
          price: 65000,
          action: "hold",
          confidence: 0.6,
          size_usd: null,
          timeframe: "short",
          reasoning: "No trade",
          risk_factors: [],
        },
        {
          id: 2,
          timestamp: new Date("2025-10-11T06:00:00Z"),
          market: "BTC",
          price: 64500,
          action: "hold",
          confidence: 0.6,
          size_usd: null,
          timeframe: "short",
          reasoning: "Still no trade",
          risk_factors: [],
        },
        {
          id: 1,
          timestamp: new Date("2025-10-11T00:00:00Z"),
          market: "BTC",
          price: 64000,
          action: "hold",
          confidence: 0.5,
          size_usd: null,
          timeframe: "short",
          reasoning: "Staying flat",
          risk_factors: [],
        },
      ];

      vi.mocked(mockTradeRecService.getRecommendationsByMarket).mockResolvedValue(
        mockRecs,
      );

      const result = await agent.getPreviousPositionState(["BTC"]);

      expect(result.get("BTC")).toBe("flat");
    });

    it("should handle multiple markets correctly", async () => {
      // Mock responses for different markets
      vi.mocked(mockTradeRecService.getRecommendationsByMarket)
        .mockImplementation(async (market: string) => {
          if (market === "BTC") {
            return [
              {
                id: 1,
                timestamp: new Date(),
                market: "BTC",
                price: 65000,
                action: "long",
                confidence: 0.8,
                size_usd: 1000,
                timeframe: "short",
                reasoning: "Bullish",
                risk_factors: [],
              },
            ];
          } else if (market === "ETH") {
            return [
              {
                id: 1,
                timestamp: new Date(),
                market: "ETH",
                price: 3000,
                action: "close",
                confidence: 0.7,
                size_usd: null,
                timeframe: "short",
                reasoning: "Exited",
                risk_factors: [],
              },
            ];
          } else if (market === "SOL") {
            return [
              {
                id: 1,
                timestamp: new Date(),
                market: "SOL",
                price: 150,
                action: "short",
                confidence: 0.75,
                size_usd: 500,
                timeframe: "short",
                reasoning: "Bearish",
                risk_factors: [],
              },
            ];
          }
          return [];
        });

      const result = await agent.getPreviousPositionState([
        "BTC",
        "ETH",
        "SOL",
      ]);

      expect(result.get("BTC")).toBe("long");
      expect(result.get("ETH")).toBe("flat");
      expect(result.get("SOL")).toBe("short");
    });

    it("should default to flat on error", async () => {
      // Mock: throw error
      vi.mocked(mockTradeRecService.getRecommendationsByMarket).mockRejectedValue(
        new Error("Database error"),
      );

      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      const result = await agent.getPreviousPositionState(["BTC"]);

      expect(result.get("BTC")).toBe("flat");
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Failed to get position state for BTC"),
        expect.any(Error),
      );

      consoleSpy.mockRestore();
    });
  });

  describe("gatherMarketContext - portfolio value", () => {
    let mockFearGreed: FearGreedService;
    let mockPolymarket: PolymarketService;
    let mockFlex: FlexPublicService;
    let agent: TradeRecommendationAgent;

    beforeEach(() => {
      // Create mock services
      mockFearGreed = {
        analyzeFearGreedIndex: vi.fn().mockResolvedValue({
          current: { value: 50, classification: "Neutral" },
          min: { value: 40 },
          max: { value: 60 },
          trend: "stable",
        }),
      } as any;

      mockPolymarket = {
        analyzeBTCPrice: vi.fn().mockResolvedValue(null),
        analyzeEconomicIndicators: vi.fn().mockResolvedValue(null),
      } as any;

      mockFlex = {
        getMarketPrice: vi.fn().mockResolvedValue({ price: 65000 }),
        getFundingRate: vi.fn().mockResolvedValue({
          currentFundingRate: 0.0001,
          longPositionSize: 1000000,
          shortPositionSize: 900000,
        }),
        getCollateral: vi.fn(),
      } as any;

      agent = new TradeRecommendationAgent(
        mockFearGreed,
        mockPolymarket,
        mockFlex,
        undefined as any, // cloudflare
        undefined as any, // tradeRecService
      );
    });

    it("should correctly fetch portfolio value when wallet address is provided", async () => {
      // Mock collateral balance
      vi.mocked(mockFlex.getCollateral).mockResolvedValue({
        balance: 50000,
      });

      const context = await agent.gatherMarketContext(
        ["BTC"],
        "0x1234567890abcdef",
        [0],
      );

      expect(mockFlex.getCollateral).toHaveBeenCalledWith("0x1234567890abcdef");
      expect(context.portfolio_value_usd).toBe(50000);
    });

    it("should default portfolio value to 0 if no wallet address is provided", async () => {
      const context = await agent.gatherMarketContext(["BTC"], undefined, [0]);

      expect(mockFlex.getCollateral).not.toHaveBeenCalled();
      expect(context.portfolio_value_usd).toBe(0);
    });

    it("should handle errors during collateral fetching by logging warning and setting portfolio value to 0", async () => {
      // Mock error
      vi.mocked(mockFlex.getCollateral).mockRejectedValue(
        new Error("RPC connection failed"),
      );

      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      const context = await agent.gatherMarketContext(
        ["BTC"],
        "0x1234567890abcdef",
        [0],
      );

      expect(mockFlex.getCollateral).toHaveBeenCalledWith("0x1234567890abcdef");
      expect(context.portfolio_value_usd).toBe(0);
      expect(consoleSpy).toHaveBeenCalledWith(
        "Failed to fetch collateral balance, using 0:",
        expect.any(Error),
      );

      consoleSpy.mockRestore();
    });
  });

  describe("buildUserPrompt - portfolio value display", () => {
    let agent: TradeRecommendationAgent;

    beforeEach(() => {
      agent = new TradeRecommendationAgent(
        undefined as any,
        undefined as any,
        undefined as any,
        undefined as any,
        undefined as any,
      );
    });

    it("should correctly display portfolio value in generated context", () => {
      const mockContext = {
        fear_greed: {
          current: { value: 50, classification: "Neutral" },
          min: { value: 40 },
          max: { value: 60 },
          trend: "stable",
        },
        polymarket_prediction: null,
        economic_indicators: null,
        markets: [
          {
            symbol: "BTC",
            price: 65000,
            funding_rate: 0.0001,
            long_oi: 1000000,
            short_oi: 900000,
          },
        ],
        open_positions: [],
        portfolio_value_usd: 75000,
      };

      const positionState = new Map([["BTC", "flat" as const]]);

      // Access private method via type assertion
      const prompt = (agent as any).buildUserPrompt(mockContext, positionState);

      expect(prompt).toContain("Portfolio Value (USDC Collateral): $75,000");
    });

    it("should display portfolio value even when there are no open positions", () => {
      const mockContext = {
        fear_greed: {
          current: { value: 50, classification: "Neutral" },
          min: { value: 40 },
          max: { value: 60 },
          trend: "stable",
        },
        polymarket_prediction: null,
        economic_indicators: null,
        markets: [
          {
            symbol: "BTC",
            price: 65000,
            funding_rate: 0.0001,
            long_oi: 1000000,
            short_oi: 900000,
          },
        ],
        open_positions: [],
        portfolio_value_usd: 0,
      };

      const positionState = new Map([["BTC", "flat" as const]]);

      const prompt = (agent as any).buildUserPrompt(mockContext, positionState);

      expect(prompt).toContain("Portfolio Value (USDC Collateral): $0");
    });
  });
});

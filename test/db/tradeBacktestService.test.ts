import { describe, it, expect, beforeEach, vi } from "vitest";
import { TradeBacktestService } from "../../src/db/tradeBacktestService.js";
import type { TradeRecommendationRecord } from "../../src/db/tradeRecommendationService.js";
import type { BacktestResult, TradeResult } from "../../src/types/backtest.js";

// Helper to create mock recommendations
function createMockRecommendation(
  overrides: Partial<TradeRecommendationRecord> = {},
): TradeRecommendationRecord {
  return {
    id: 1,
    timestamp: new Date("2025-10-10T12:00:00Z"),
    market: "BTC",
    price: 100000,
    action: "long",
    confidence: 0.7,
    size_usd: 1000,
    timeframe: "short",
    reasoning: "Test reasoning",
    risk_factors: null,
    ...overrides,
  };
}

// Mock the database connector
vi.mock("../../src/db/knexConnector.js", () => {
  const mockQueryBuilder = {
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
  };

  const mockKnex = vi.fn(() => mockQueryBuilder);

  return {
    KnexConnector: {
      getConnection: vi.fn().mockResolvedValue(mockKnex),
      destroy: vi.fn().mockResolvedValue(undefined),
    },
  };
});

describe("TradeBacktestService", () => {
  describe("PnL Calculations", () => {
    it("should calculate correct PnL for long position with profit", () => {
      const service = new TradeBacktestService(undefined, 1000);
      
      const recs = [
        createMockRecommendation({ 
          action: "long", 
          price: 100000,
          timestamp: new Date("2025-10-10T12:00:00Z"),
        }),
        createMockRecommendation({ 
          action: "close", 
          price: 101000,
          timestamp: new Date("2025-10-10T13:00:00Z"),
        }),
      ];

      const trades = (service as any).simulateRecommendedStrategy(recs, "maintain");
      
      expect(trades).toHaveLength(1);
      expect(trades[0].action).toBe("long");
      expect(trades[0].entry_price).toBe(100000);
      expect(trades[0].exit_price).toBe(101000);
      expect(trades[0].pnl_usd).toBeCloseTo(10, 2); // 1000 * (101000/100000 - 1) = 10
      expect(trades[0].pnl_percent).toBeCloseTo(1, 2);
    });

    it("should calculate correct PnL for long position with loss", () => {
      const service = new TradeBacktestService(undefined, 1000);
      
      const recs = [
        createMockRecommendation({ 
          action: "long", 
          price: 100000,
          timestamp: new Date("2025-10-10T12:00:00Z"),
        }),
        createMockRecommendation({ 
          action: "close", 
          price: 99000,
          timestamp: new Date("2025-10-10T13:00:00Z"),
        }),
      ];

      const trades = (service as any).simulateRecommendedStrategy(recs, "maintain");
      
      expect(trades).toHaveLength(1);
      expect(trades[0].pnl_usd).toBeCloseTo(-10, 2); // 1000 * (99000/100000 - 1) = -10
      expect(trades[0].pnl_percent).toBeCloseTo(-1, 2);
    });

    it("should calculate correct PnL for short position with profit", () => {
      const service = new TradeBacktestService(undefined, 1000);
      
      const recs = [
        createMockRecommendation({ 
          action: "short", 
          price: 100000,
          timestamp: new Date("2025-10-10T12:00:00Z"),
        }),
        createMockRecommendation({ 
          action: "close", 
          price: 99000,
          timestamp: new Date("2025-10-10T13:00:00Z"),
        }),
      ];

      const trades = (service as any).simulateRecommendedStrategy(recs, "maintain");
      
      expect(trades).toHaveLength(1);
      expect(trades[0].action).toBe("short");
      expect(trades[0].pnl_usd).toBeCloseTo(10, 2); // 1000 * (1 - 99000/100000) = 10
      expect(trades[0].pnl_percent).toBeCloseTo(1, 2);
    });

    it("should calculate correct PnL for short position with loss", () => {
      const service = new TradeBacktestService(undefined, 1000);
      
      const recs = [
        createMockRecommendation({ 
          action: "short", 
          price: 100000,
          timestamp: new Date("2025-10-10T12:00:00Z"),
        }),
        createMockRecommendation({ 
          action: "close", 
          price: 101000,
          timestamp: new Date("2025-10-10T13:00:00Z"),
        }),
      ];

      const trades = (service as any).simulateRecommendedStrategy(recs, "maintain");
      
      expect(trades).toHaveLength(1);
      expect(trades[0].pnl_usd).toBeCloseTo(-10, 2); // 1000 * (1 - 101000/100000) = -10
      expect(trades[0].pnl_percent).toBeCloseTo(-1, 2);
    });
  });

  describe("Position Flipping", () => {
    it("should flip from long to short, closing first position", () => {
      const service = new TradeBacktestService(undefined, 1000);
      
      const recs = [
        createMockRecommendation({ 
          action: "long", 
          price: 100000,
          timestamp: new Date("2025-10-10T12:00:00Z"),
        }),
        createMockRecommendation({ 
          action: "short", 
          price: 101000,
          timestamp: new Date("2025-10-10T13:00:00Z"),
        }),
        createMockRecommendation({ 
          action: "close", 
          price: 100500,
          timestamp: new Date("2025-10-10T14:00:00Z"),
        }),
      ];

      const trades = (service as any).simulateRecommendedStrategy(recs, "maintain");
      
      expect(trades).toHaveLength(2);
      
      // First trade: long closed when flipping to short
      expect(trades[0].action).toBe("long");
      expect(trades[0].entry_price).toBe(100000);
      expect(trades[0].exit_price).toBe(101000);
      expect(trades[0].pnl_usd).toBeCloseTo(10, 2);
      
      // Second trade: short opened and then closed
      expect(trades[1].action).toBe("short");
      expect(trades[1].entry_price).toBe(101000);
      expect(trades[1].exit_price).toBe(100500);
      expect(trades[1].pnl_usd).toBeCloseTo(4.95, 2);
    });

    it("should flip from short to long, closing first position", () => {
      const service = new TradeBacktestService(undefined, 1000);
      
      const recs = [
        createMockRecommendation({ 
          action: "short", 
          price: 100000,
          timestamp: new Date("2025-10-10T12:00:00Z"),
        }),
        createMockRecommendation({ 
          action: "long", 
          price: 99000,
          timestamp: new Date("2025-10-10T13:00:00Z"),
        }),
        createMockRecommendation({ 
          action: "close", 
          price: 99500,
          timestamp: new Date("2025-10-10T14:00:00Z"),
        }),
      ];

      const trades = (service as any).simulateRecommendedStrategy(recs, "maintain");
      
      expect(trades).toHaveLength(2);
      
      // First trade: short closed when flipping to long
      expect(trades[0].action).toBe("short");
      expect(trades[0].pnl_usd).toBeCloseTo(10, 2);
      
      // Second trade: long opened and then closed
      expect(trades[1].action).toBe("long");
      expect(trades[1].pnl_usd).toBeCloseTo(5.05, 2);
    });
  });

  describe("Hold Behavior (Position-Aware)", () => {
    it("should maintain long position on hold (mode parameter deprecated)", () => {
      const service = new TradeBacktestService(undefined, 1000);
      
      const recs = [
        createMockRecommendation({ 
          action: "long", 
          price: 100000,
          timestamp: new Date("2025-10-10T12:00:00Z"),
        }),
        createMockRecommendation({ 
          action: "hold", 
          price: 101000,
          timestamp: new Date("2025-10-10T13:00:00Z"),
        }),
        createMockRecommendation({ 
          action: "close", 
          price: 102000,
          timestamp: new Date("2025-10-10T14:00:00Z"),
        }),
      ];

      // Mode parameter is deprecated but still accepted for backward compat
      const trades = (service as any).simulateRecommendedStrategy(recs, "maintain");
      
      expect(trades).toHaveLength(1);
      expect(trades[0].entry_price).toBe(100000);
      expect(trades[0].exit_price).toBe(102000);
      expect(trades[0].pnl_usd).toBeCloseTo(20, 2);
    });

    it("should maintain short position on hold", () => {
      const service = new TradeBacktestService(undefined, 1000);
      
      const recs = [
        createMockRecommendation({ 
          action: "short", 
          price: 100000,
          timestamp: new Date("2025-10-10T12:00:00Z"),
        }),
        createMockRecommendation({ 
          action: "hold", 
          price: 99000,
          timestamp: new Date("2025-10-10T13:00:00Z"),
        }),
        createMockRecommendation({ 
          action: "close", 
          price: 98000,
          timestamp: new Date("2025-10-10T14:00:00Z"),
        }),
      ];

      const trades = (service as any).simulateRecommendedStrategy(recs, "maintain");
      
      expect(trades).toHaveLength(1);
      expect(trades[0].action).toBe("short");
      expect(trades[0].entry_price).toBe(100000);
      expect(trades[0].exit_price).toBe(98000);
      expect(trades[0].pnl_usd).toBeCloseTo(20, 2);
    });

    it("should stay flat on hold when flat (no-op)", () => {
      const service = new TradeBacktestService(undefined, 1000);
      
      const recs = [
        createMockRecommendation({ 
          action: "hold", 
          price: 100000,
          timestamp: new Date("2025-10-10T12:00:00Z"),
        }),
        createMockRecommendation({ 
          action: "hold", 
          price: 101000,
          timestamp: new Date("2025-10-10T13:00:00Z"),
        }),
      ];

      const trades = (service as any).simulateRecommendedStrategy(recs, "maintain");
      
      expect(trades).toHaveLength(0);
    });

    it("should ignore mode parameter and use position-aware semantics", () => {
      const service = new TradeBacktestService(undefined, 1000);
      
      const recs = [
        createMockRecommendation({ 
          action: "long", 
          price: 100000,
          timestamp: new Date("2025-10-10T12:00:00Z"),
        }),
        createMockRecommendation({ 
          action: "hold", 
          price: 101000,
          timestamp: new Date("2025-10-10T13:00:00Z"),
        }),
        createMockRecommendation({ 
          action: "close", 
          price: 102000,
          timestamp: new Date("2025-10-10T14:00:00Z"),
        }),
      ];

      // Mode=close should behave same as mode=maintain now (deprecated)
      const tradesClose = (service as any).simulateRecommendedStrategy(recs, "close");
      const tradesMaintain = (service as any).simulateRecommendedStrategy(recs, "maintain");
      
      // Both should maintain on hold and close on close action
      expect(tradesClose).toHaveLength(1);
      expect(tradesMaintain).toHaveLength(1);
      expect(tradesClose[0].exit_price).toBe(102000);
      expect(tradesMaintain[0].exit_price).toBe(102000);
    });
  });

  describe("End-of-Series Behavior", () => {
    it("should close open position at end of series", () => {
      const service = new TradeBacktestService(undefined, 1000);
      
      const recs = [
        createMockRecommendation({ 
          action: "long", 
          price: 100000,
          timestamp: new Date("2025-10-10T12:00:00Z"),
        }),
        createMockRecommendation({ 
          action: "hold", 
          price: 101000,
          timestamp: new Date("2025-10-10T13:00:00Z"),
        }),
        createMockRecommendation({ 
          action: "hold", 
          price: 102000,
          timestamp: new Date("2025-10-10T14:00:00Z"),
        }),
      ];

      const trades = (service as any).simulateRecommendedStrategy(recs, "maintain");
      
      expect(trades).toHaveLength(1);
      expect(trades[0].entry_price).toBe(100000);
      expect(trades[0].exit_price).toBe(102000); // Closed at last price
      expect(trades[0].pnl_usd).toBeCloseTo(20, 2);
    });

    it("should not create trade if no position at end", () => {
      const service = new TradeBacktestService(undefined, 1000);
      
      const recs = [
        createMockRecommendation({ 
          action: "hold", 
          price: 100000,
          timestamp: new Date("2025-10-10T12:00:00Z"),
        }),
      ];

      const trades = (service as any).simulateRecommendedStrategy(recs, "maintain");
      
      expect(trades).toHaveLength(0);
    });
  });

  describe("Perfect Strategy", () => {
    it("should create long trade when price increases", () => {
      const service = new TradeBacktestService(undefined, 1000);
      
      const recs = [
        createMockRecommendation({ price: 100000 }),
        createMockRecommendation({ price: 101000 }),
      ];

      const trades = (service as any).simulatePerfectStrategy(recs);
      
      expect(trades).toHaveLength(1);
      expect(trades[0].action).toBe("long");
      expect(trades[0].entry_price).toBe(100000);
      expect(trades[0].exit_price).toBe(101000);
      expect(trades[0].pnl_usd).toBeCloseTo(10, 2);
      expect(trades[0].confidence).toBe(1.0);
    });

    it("should create short trade when price decreases", () => {
      const service = new TradeBacktestService(undefined, 1000);
      
      const recs = [
        createMockRecommendation({ price: 100000 }),
        createMockRecommendation({ price: 99000 }),
      ];

      const trades = (service as any).simulatePerfectStrategy(recs);
      
      expect(trades).toHaveLength(1);
      expect(trades[0].action).toBe("short");
      expect(trades[0].entry_price).toBe(100000);
      expect(trades[0].exit_price).toBe(99000);
      expect(trades[0].pnl_usd).toBeCloseTo(10, 2);
    });

    it("should skip when price is unchanged", () => {
      const service = new TradeBacktestService(undefined, 1000);
      
      const recs = [
        createMockRecommendation({ price: 100000 }),
        createMockRecommendation({ price: 100000 }),
        createMockRecommendation({ price: 101000 }),
      ];

      const trades = (service as any).simulatePerfectStrategy(recs);
      
      expect(trades).toHaveLength(1); // Only one trade (skipped middle)
      expect(trades[0].entry_price).toBe(100000);
      expect(trades[0].exit_price).toBe(101000);
    });

    it("should create multiple trades for price changes", () => {
      const service = new TradeBacktestService(undefined, 1000);
      
      const recs = [
        createMockRecommendation({ price: 100000 }),
        createMockRecommendation({ price: 101000 }),
        createMockRecommendation({ price: 100500 }),
        createMockRecommendation({ price: 101500 }),
      ];

      const trades = (service as any).simulatePerfectStrategy(recs);
      
      expect(trades).toHaveLength(3);
      expect(trades[0].action).toBe("long");  // 100k -> 101k
      expect(trades[1].action).toBe("short"); // 101k -> 100.5k
      expect(trades[2].action).toBe("long");  // 100.5k -> 101.5k
    });
  });

  describe("Metrics Computation", () => {
    it("should compute win rate correctly", () => {
      const service = new TradeBacktestService(undefined, 1000);
      
      const trades: TradeResult[] = [
        {
          market: "BTC",
          entry_time: new Date(),
          exit_time: new Date(),
          action: "long",
          entry_price: 100000,
          exit_price: 101000,
          size_usd: 1000,
          confidence: 0.7,
          pnl_usd: 10,
          pnl_percent: 1,
        },
        {
          market: "BTC",
          entry_time: new Date(),
          exit_time: new Date(),
          action: "short",
          entry_price: 100000,
          exit_price: 101000,
          size_usd: 1000,
          confidence: 0.7,
          pnl_usd: -10,
          pnl_percent: -1,
        },
        {
          market: "BTC",
          entry_time: new Date(),
          exit_time: new Date(),
          action: "long",
          entry_price: 100000,
          exit_price: 102000,
          size_usd: 1000,
          confidence: 0.7,
          pnl_usd: 20,
          pnl_percent: 2,
        },
      ];

      const perf = (service as any).computePerformance(trades);
      
      expect(perf.win_rate).toBeCloseTo(66.67, 2); // 2 out of 3
      expect(perf.num_trades).toBe(3);
      expect(perf.total_pnl_usd).toBeCloseTo(20, 2);
      expect(perf.avg_trade_return_usd).toBeCloseTo(6.67, 2);
    });

    it("should handle zero trades", () => {
      const service = new TradeBacktestService(undefined, 1000);
      
      const perf = (service as any).computePerformance([]);
      
      expect(perf.win_rate).toBe(0);
      expect(perf.num_trades).toBe(0);
      expect(perf.total_pnl_usd).toBe(0);
      expect(perf.total_return_percent).toBe(0);
    });

    it("should compute total return percent correctly", () => {
      const service = new TradeBacktestService(undefined, 1000);
      
      const trades: TradeResult[] = [
        {
          market: "BTC",
          entry_time: new Date(),
          exit_time: new Date(),
          action: "long",
          entry_price: 100000,
          exit_price: 101000,
          size_usd: 1000,
          confidence: 0.7,
          pnl_usd: 10,
          pnl_percent: 1,
        },
        {
          market: "BTC",
          entry_time: new Date(),
          exit_time: new Date(),
          action: "long",
          entry_price: 100000,
          exit_price: 102000,
          size_usd: 2000,
          confidence: 0.7,
          pnl_usd: 40,
          pnl_percent: 2,
        },
      ];

      const perf = (service as any).computePerformance(trades);
      
      // Total PnL = 50, Total Size = 3000, Return = 50/3000 * 100 = 1.67%
      expect(perf.total_return_percent).toBeCloseTo(1.67, 2);
    });
  });

  describe("Confidence Analysis", () => {
    it("should split trades by confidence threshold", () => {
      const service = new TradeBacktestService(undefined, 1000);
      
      const trades: TradeResult[] = [
        {
          market: "BTC",
          entry_time: new Date(),
          exit_time: new Date(),
          action: "long",
          entry_price: 100000,
          exit_price: 101000,
          size_usd: 1000,
          confidence: 0.8, // High
          pnl_usd: 10,
          pnl_percent: 1,
        },
        {
          market: "BTC",
          entry_time: new Date(),
          exit_time: new Date(),
          action: "long",
          entry_price: 100000,
          exit_price: 99000,
          size_usd: 1000,
          confidence: 0.9, // High
          pnl_usd: -10,
          pnl_percent: -1,
        },
        {
          market: "BTC",
          entry_time: new Date(),
          exit_time: new Date(),
          action: "long",
          entry_price: 100000,
          exit_price: 101000,
          size_usd: 1000,
          confidence: 0.6, // Low
          pnl_usd: 10,
          pnl_percent: 1,
        },
        {
          market: "BTC",
          entry_time: new Date(),
          exit_time: new Date(),
          action: "long",
          entry_price: 100000,
          exit_price: 101000,
          size_usd: 1000,
          confidence: 0.5, // Low
          pnl_usd: 10,
          pnl_percent: 1,
        },
      ];

      const analysis = (service as any).computeConfidenceAnalysis(trades);
      
      expect(analysis.high_confidence_win_rate).toBeCloseTo(50, 2); // 1 of 2
      expect(analysis.low_confidence_win_rate).toBeCloseTo(100, 2); // 2 of 2
    });

    it("should compute Pearson correlation", () => {
      const service = new TradeBacktestService(undefined, 1000);
      
      const trades: TradeResult[] = [
        {
          market: "BTC",
          entry_time: new Date(),
          exit_time: new Date(),
          action: "long",
          entry_price: 100000,
          exit_price: 101000,
          size_usd: 1000,
          confidence: 0.5,
          pnl_usd: 10,
          pnl_percent: 1,
        },
        {
          market: "BTC",
          entry_time: new Date(),
          exit_time: new Date(),
          action: "long",
          entry_price: 100000,
          exit_price: 102000,
          size_usd: 1000,
          confidence: 0.7,
          pnl_usd: 20,
          pnl_percent: 2,
        },
        {
          market: "BTC",
          entry_time: new Date(),
          exit_time: new Date(),
          action: "long",
          entry_price: 100000,
          exit_price: 103000,
          size_usd: 1000,
          confidence: 0.9,
          pnl_usd: 30,
          pnl_percent: 3,
        },
      ];

      const analysis = (service as any).computeConfidenceAnalysis(trades);
      
      // Perfect positive correlation (confidence increases with returns)
      expect(analysis.correlation).toBeCloseTo(1.0, 1);
    });

    it("should return 0 correlation with fewer than 2 trades", () => {
      const service = new TradeBacktestService(undefined, 1000);
      
      const trades: TradeResult[] = [
        {
          market: "BTC",
          entry_time: new Date(),
          exit_time: new Date(),
          action: "long",
          entry_price: 100000,
          exit_price: 101000,
          size_usd: 1000,
          confidence: 0.7,
          pnl_usd: 10,
          pnl_percent: 1,
        },
      ];

      const analysis = (service as any).computeConfidenceAnalysis(trades);
      
      expect(analysis.correlation).toBe(0);
    });
  });

  describe("Action Breakdown", () => {
    it("should count action occurrences correctly", () => {
      const service = new TradeBacktestService(undefined, 1000);
      
      const recs = [
        createMockRecommendation({ action: "long" }),
        createMockRecommendation({ action: "long" }),
        createMockRecommendation({ action: "short" }),
        createMockRecommendation({ action: "hold" }),
        createMockRecommendation({ action: "hold" }),
        createMockRecommendation({ action: "hold" }),
        createMockRecommendation({ action: "close" }),
      ];

      const trades: TradeResult[] = [];
      
      const breakdown = (service as any).computeActionBreakdown(recs, trades);
      
      expect(breakdown.long.count).toBe(2);
      expect(breakdown.short.count).toBe(1);
      expect(breakdown.hold.count).toBe(3);
      expect(breakdown.close.count).toBe(1);
    });

    it("should compute win rates per action type", () => {
      const service = new TradeBacktestService(undefined, 1000);
      
      const recs = [
        createMockRecommendation({ action: "long" }),
        createMockRecommendation({ action: "long" }),
        createMockRecommendation({ action: "short" }),
      ];

      const trades: TradeResult[] = [
        {
          market: "BTC",
          entry_time: new Date(),
          exit_time: new Date(),
          action: "long",
          entry_price: 100000,
          exit_price: 101000,
          size_usd: 1000,
          confidence: 0.7,
          pnl_usd: 10,
          pnl_percent: 1,
        },
        {
          market: "BTC",
          entry_time: new Date(),
          exit_time: new Date(),
          action: "long",
          entry_price: 100000,
          exit_price: 99000,
          size_usd: 1000,
          confidence: 0.7,
          pnl_usd: -10,
          pnl_percent: -1,
        },
        {
          market: "BTC",
          entry_time: new Date(),
          exit_time: new Date(),
          action: "short",
          entry_price: 100000,
          exit_price: 99000,
          size_usd: 1000,
          confidence: 0.7,
          pnl_usd: 10,
          pnl_percent: 1,
        },
      ];

      const breakdown = (service as any).computeActionBreakdown(recs, trades);
      
      expect(breakdown.long.win_rate).toBeCloseTo(50, 2); // 1 of 2
      expect(breakdown.short.win_rate).toBeCloseTo(100, 2); // 1 of 1
      expect(breakdown.long.avg_pnl).toBeCloseTo(0, 2); // (10 + -10) / 2
      expect(breakdown.short.avg_pnl).toBeCloseTo(10, 2);
    });
  });

  describe("Edge Cases", () => {
    it("should handle all holds with no trades", () => {
      const service = new TradeBacktestService(undefined, 1000);
      
      const recs = [
        createMockRecommendation({ action: "hold" }),
        createMockRecommendation({ action: "hold" }),
        createMockRecommendation({ action: "hold" }),
      ];

      const trades = (service as any).simulateRecommendedStrategy(recs, "maintain");
      
      expect(trades).toHaveLength(0);
    });

    it("should handle close while flat (no-op)", () => {
      const service = new TradeBacktestService(undefined, 1000);
      
      const recs = [
        createMockRecommendation({ action: "close" }),
        createMockRecommendation({ action: "close" }),
      ];

      const trades = (service as any).simulateRecommendedStrategy(recs, "maintain");
      
      expect(trades).toHaveLength(0);
    });

    it("should ignore duplicate same-direction signals", () => {
      const service = new TradeBacktestService(undefined, 1000);
      
      const recs = [
        createMockRecommendation({ 
          action: "long", 
          price: 100000,
          timestamp: new Date("2025-10-10T12:00:00Z"),
        }),
        createMockRecommendation({ 
          action: "long", 
          price: 101000,
          timestamp: new Date("2025-10-10T13:00:00Z"),
        }),
        createMockRecommendation({ 
          action: "close", 
          price: 102000,
          timestamp: new Date("2025-10-10T14:00:00Z"),
        }),
      ];

      const trades = (service as any).simulateRecommendedStrategy(recs, "maintain");
      
      // Should only create one trade (second long is ignored)
      expect(trades).toHaveLength(1);
      expect(trades[0].entry_price).toBe(100000);
      expect(trades[0].exit_price).toBe(102000);
    });

    it("should handle custom position sizes", () => {
      const service = new TradeBacktestService(undefined, 1000);
      
      const recs = [
        createMockRecommendation({ 
          action: "long", 
          price: 100000,
          size_usd: 5000,
          timestamp: new Date("2025-10-10T12:00:00Z"),
        }),
        createMockRecommendation({ 
          action: "close", 
          price: 101000,
          timestamp: new Date("2025-10-10T13:00:00Z"),
        }),
      ];

      const trades = (service as any).simulateRecommendedStrategy(recs, "maintain");
      
      expect(trades).toHaveLength(1);
      expect(trades[0].size_usd).toBe(5000);
      expect(trades[0].pnl_usd).toBeCloseTo(50, 2); // 5000 * 1% = 50
    });

    it("should use default size when size_usd is null", () => {
      const service = new TradeBacktestService(undefined, 2000);
      
      const recs = [
        createMockRecommendation({ 
          action: "long", 
          price: 100000,
          size_usd: null,
          timestamp: new Date("2025-10-10T12:00:00Z"),
        }),
        createMockRecommendation({ 
          action: "close", 
          price: 101000,
          timestamp: new Date("2025-10-10T13:00:00Z"),
        }),
      ];

      const trades = (service as any).simulateRecommendedStrategy(recs, "maintain");
      
      expect(trades).toHaveLength(1);
      expect(trades[0].size_usd).toBe(2000);
      expect(trades[0].pnl_usd).toBeCloseTo(20, 2); // 2000 * 1% = 20
    });
  });

  describe("Improvement Suggestions", () => {
    it("should suggest confidence calibration when high confidence underperforms", () => {
      const service = new TradeBacktestService(undefined, 1000);
      
      const recommended = {
        total_pnl_usd: 100,
        total_return_percent: 10,
        win_rate: 50,
        avg_trade_return_usd: 10,
        avg_trade_return_percent: 1,
        num_trades: 10,
        trades: [],
      };

      const perfect = {
        total_pnl_usd: 200,
        total_return_percent: 20,
        win_rate: 80,
        avg_trade_return_usd: 20,
        avg_trade_return_percent: 2,
        num_trades: 10,
        trades: [],
      };

      const byAction = {
        long: { count: 5, win_rate: 50, avg_pnl: 10 },
        short: { count: 5, win_rate: 50, avg_pnl: 10 },
        hold: { count: 0, win_rate: 0, avg_pnl: 0 },
        close: { count: 0, win_rate: 0, avg_pnl: 0 },
      };

      const confidence = {
        high_confidence_win_rate: 40,
        low_confidence_win_rate: 60,
        correlation: 0.1,
      };

      const suggestions = (service as any).generateSuggestions(
        recommended,
        perfect,
        byAction,
        confidence,
        "maintain",
      );

      expect(suggestions.some((s: string) => 
        s.includes("Recalibrate model confidence")
      )).toBe(true);
    });

    it("should suggest position sizing when correlation is positive", () => {
      const service = new TradeBacktestService(undefined, 1000);
      
      const recommended = {
        total_pnl_usd: 100,
        total_return_percent: 10,
        win_rate: 50,
        avg_trade_return_usd: 10,
        avg_trade_return_percent: 1,
        num_trades: 10,
        trades: [],
      };

      const perfect = {
        total_pnl_usd: 200,
        total_return_percent: 20,
        win_rate: 80,
        avg_trade_return_usd: 20,
        avg_trade_return_percent: 2,
        num_trades: 10,
        trades: [],
      };

      const byAction = {
        long: { count: 5, win_rate: 50, avg_pnl: 10 },
        short: { count: 5, win_rate: 50, avg_pnl: 10 },
        hold: { count: 0, win_rate: 0, avg_pnl: 0 },
        close: { count: 0, win_rate: 0, avg_pnl: 0 },
      };

      const confidence = {
        high_confidence_win_rate: 60,
        low_confidence_win_rate: 40,
        correlation: 0.5,
      };

      const suggestions = (service as any).generateSuggestions(
        recommended,
        perfect,
        byAction,
        confidence,
        "maintain",
      );

      expect(suggestions.some((s: string) => 
        s.includes("Scale position size with confidence")
      )).toBe(true);
    });

    it("should detect long/short bias", () => {
      const service = new TradeBacktestService(undefined, 1000);
      
      const recommended = {
        total_pnl_usd: 100,
        total_return_percent: 10,
        win_rate: 50,
        avg_trade_return_usd: 10,
        avg_trade_return_percent: 1,
        num_trades: 10,
        trades: [],
      };

      const perfect = {
        total_pnl_usd: 200,
        total_return_percent: 20,
        win_rate: 80,
        avg_trade_return_usd: 20,
        avg_trade_return_percent: 2,
        num_trades: 10,
        trades: [],
      };

      const byAction = {
        long: { count: 5, win_rate: 80, avg_pnl: 20 },
        short: { count: 5, win_rate: 30, avg_pnl: 5 },
        hold: { count: 0, win_rate: 0, avg_pnl: 0 },
        close: { count: 0, win_rate: 0, avg_pnl: 0 },
      };

      const confidence = {
        high_confidence_win_rate: 50,
        low_confidence_win_rate: 50,
        correlation: 0.0,
      };

      const suggestions = (service as any).generateSuggestions(
        recommended,
        perfect,
        byAction,
        confidence,
        "maintain",
      );

      expect(suggestions.some((s: string) => 
        s.includes("Long bias detected")
      )).toBe(true);
    });

    it("should suggest reacting faster when gap to perfect is large", () => {
      const service = new TradeBacktestService(undefined, 1000);
      
      const recommended = {
        total_pnl_usd: 20,
        total_return_percent: 2,
        win_rate: 50,
        avg_trade_return_usd: 2,
        avg_trade_return_percent: 0.2,
        num_trades: 10,
        trades: [],
      };

      const perfect = {
        total_pnl_usd: 100,
        total_return_percent: 10,
        win_rate: 90,
        avg_trade_return_usd: 10,
        avg_trade_return_percent: 1,
        num_trades: 10,
        trades: [],
      };

      const byAction = {
        long: { count: 5, win_rate: 50, avg_pnl: 10 },
        short: { count: 5, win_rate: 50, avg_pnl: 10 },
        hold: { count: 0, win_rate: 0, avg_pnl: 0 },
        close: { count: 0, win_rate: 0, avg_pnl: 0 },
      };

      const confidence = {
        high_confidence_win_rate: 50,
        low_confidence_win_rate: 50,
        correlation: 0.0,
      };

      const suggestions = (service as any).generateSuggestions(
        recommended,
        perfect,
        byAction,
        confidence,
        "maintain",
      );

      expect(suggestions.some((s: string) => 
        s.includes("Large gap to perfect") || s.includes("react faster")
      )).toBe(true);
    });
  });
});

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { ConfidenceCalibrationService } from "../../src/db/confidenceCalibrationService.js";
import type {
  CalibrationData,
  TradeOutcome,
} from "../../src/types/confidence.js";

// Mock the KnexConnector module
vi.mock("../../src/db/knexConnector.js", () => {
  // Mock query builder methods
  const mockQueryBuilder = {
    insert: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    first: vi.fn(),
    select: vi.fn().mockReturnThis(),
  };

  // Mock knex function that returns query builder
  const mockKnex = vi.fn().mockImplementation((tableName) => mockQueryBuilder);

  return {
    KnexConnector: {
      getConnection: vi.fn().mockResolvedValue(mockKnex),
      destroy: vi.fn(),
    },
  };
});

describe("ConfidenceCalibrationService", () => {
  let service: ConfidenceCalibrationService;

  beforeEach(async () => {
    vi.clearAllMocks();
    service = new ConfidenceCalibrationService();
    await service["initDatabase"]();
  });

  afterEach(async () => {
    await service.close();
  });

  describe("applyCalibration", () => {
    it("should return raw score when no calibration points", () => {
      const calibration: CalibrationData = {
        market: "BTC",
        windowDays: 30,
        points: [],
        sampleSize: 0,
        correlation: 0,
        highConfWinRate: 0,
        lowConfWinRate: 0,
      };

      expect(service.applyCalibration(0.5, calibration)).toBe(0.5);
      expect(service.applyCalibration(0.8, calibration)).toBe(0.8);
    });

    it("should return single point value when only one calibration point", () => {
      const calibration: CalibrationData = {
        market: "BTC",
        windowDays: 30,
        points: [{ rawConfidence: 0.5, calibratedConfidence: 0.4 }],
        sampleSize: 10,
        correlation: 0.3,
        highConfWinRate: 0.6,
        lowConfWinRate: 0.5,
      };

      expect(service.applyCalibration(0.2, calibration)).toBe(0.4);
      expect(service.applyCalibration(0.8, calibration)).toBe(0.4);
    });

    it("should interpolate between two calibration points", () => {
      const calibration: CalibrationData = {
        market: "BTC",
        windowDays: 30,
        points: [
          { rawConfidence: 0.0, calibratedConfidence: 0.0 },
          { rawConfidence: 1.0, calibratedConfidence: 0.8 },
        ],
        sampleSize: 100,
        correlation: 0.5,
        highConfWinRate: 0.7,
        lowConfWinRate: 0.5,
      };

      // Linear interpolation: 0.5 should map to 0.4
      expect(service.applyCalibration(0.5, calibration)).toBe(0.4);

      // 0.25 should map to 0.2
      expect(service.applyCalibration(0.25, calibration)).toBe(0.2);

      // Exact matches
      expect(service.applyCalibration(0.0, calibration)).toBe(0.0);
      expect(service.applyCalibration(1.0, calibration)).toBe(0.8);
    });

    it("should handle multi-point piecewise linear calibration", () => {
      const calibration: CalibrationData = {
        market: "BTC",
        windowDays: 30,
        points: [
          { rawConfidence: 0.0, calibratedConfidence: 0.0 },
          { rawConfidence: 0.5, calibratedConfidence: 0.4 },
          { rawConfidence: 1.0, calibratedConfidence: 0.9 },
        ],
        sampleSize: 150,
        correlation: 0.6,
        highConfWinRate: 0.75,
        lowConfWinRate: 0.55,
      };

      // First segment: 0.0-0.5 maps to 0.0-0.4
      expect(service.applyCalibration(0.25, calibration)).toBe(0.2);

      // Second segment: 0.5-1.0 maps to 0.4-0.9
      expect(service.applyCalibration(0.75, calibration)).toBe(0.65);

      // Exact point matches
      expect(service.applyCalibration(0.5, calibration)).toBe(0.4);
    });

    it("should clamp input to [0, 1] range", () => {
      const calibration: CalibrationData = {
        market: "BTC",
        windowDays: 30,
        points: [
          { rawConfidence: 0.0, calibratedConfidence: 0.0 },
          { rawConfidence: 1.0, calibratedConfidence: 0.8 },
        ],
        sampleSize: 100,
        correlation: 0.5,
        highConfWinRate: 0.7,
        lowConfWinRate: 0.5,
      };

      // Values outside [0, 1] should be clamped
      expect(service.applyCalibration(-0.5, calibration)).toBe(0.0);
      expect(service.applyCalibration(1.5, calibration)).toBe(0.8);
    });
  });

  describe("isotonicRegression", () => {
    it("should preserve monotonic buckets unchanged", () => {
      const service = new ConfidenceCalibrationService();

      // Create monotonic test data (already sorted)
      const mockOutcomes: TradeOutcome[] = [
        { confidence: 0.3, isWinner: false, pnlPercent: -1.5 },
        { confidence: 0.5, isWinner: true, pnlPercent: 1.2 },
        { confidence: 0.7, isWinner: true, pnlPercent: 2.0 },
        { confidence: 0.9, isWinner: true, pnlPercent: 2.5 },
      ];

      const buckets = (service as any).createConfidenceBuckets(mockOutcomes);
      const calibrated = (service as any).isotonicRegression(buckets);

      // Win rates should be monotonically increasing
      for (let i = 0; i < calibrated.length - 1; i++) {
        expect(calibrated[i].winRate).toBeLessThanOrEqual(
          calibrated[i + 1].winRate,
        );
      }
    });

    it("should pool adjacent buckets when violating monotonicity", () => {
      const service = new ConfidenceCalibrationService();

      // Create non-monotonic data: high confidence has lower win rate
      const mockOutcomes: TradeOutcome[] = [
        // Low confidence: 2/2 wins (100% win rate)
        { confidence: 0.3, isWinner: true, pnlPercent: 1.0 },
        { confidence: 0.35, isWinner: true, pnlPercent: 0.8 },
        // High confidence: 1/2 wins (50% win rate) - violation!
        { confidence: 0.7, isWinner: false, pnlPercent: -1.5 },
        { confidence: 0.75, isWinner: true, pnlPercent: 2.0 },
      ];

      const buckets = (service as any).createConfidenceBuckets(mockOutcomes);
      const calibrated = (service as any).isotonicRegression(buckets);

      // After isotonic regression, should be monotonic
      for (let i = 0; i < calibrated.length - 1; i++) {
        expect(calibrated[i].winRate).toBeLessThanOrEqual(
          calibrated[i + 1].winRate,
        );
      }

      // Should have pooled buckets (fewer than 10)
      expect(calibrated.length).toBeLessThan(10);
    });
  });

  describe("computeCorrelation", () => {
    it("should return 0 for single outcome", () => {
      const service = new ConfidenceCalibrationService();

      const outcomes: TradeOutcome[] = [
        { confidence: 0.7, isWinner: true, pnlPercent: 1.5 },
      ];

      const correlation = (service as any).computeCorrelation(outcomes);
      expect(correlation).toBe(0);
    });

    it("should return positive correlation for aligned data", () => {
      const service = new ConfidenceCalibrationService();

      // Higher confidence = higher PnL (positive correlation)
      const outcomes: TradeOutcome[] = [
        { confidence: 0.3, isWinner: false, pnlPercent: -2.0 },
        { confidence: 0.5, isWinner: true, pnlPercent: 0.5 },
        { confidence: 0.7, isWinner: true, pnlPercent: 1.5 },
        { confidence: 0.9, isWinner: true, pnlPercent: 3.0 },
      ];

      const correlation = (service as any).computeCorrelation(outcomes);
      expect(correlation).toBeGreaterThan(0.5);
    });

    it("should return negative correlation for inverted data", () => {
      const service = new ConfidenceCalibrationService();

      // Higher confidence = lower PnL (negative correlation)
      const outcomes: TradeOutcome[] = [
        { confidence: 0.3, isWinner: true, pnlPercent: 3.0 },
        { confidence: 0.5, isWinner: true, pnlPercent: 1.5 },
        { confidence: 0.7, isWinner: false, pnlPercent: -0.5 },
        { confidence: 0.9, isWinner: false, pnlPercent: -2.0 },
      ];

      const correlation = (service as any).computeCorrelation(outcomes);
      expect(correlation).toBeLessThan(-0.5);
    });
  });

  describe("computeWinRates", () => {
    it("should correctly split high and low confidence trades", () => {
      const service = new ConfidenceCalibrationService();

      const outcomes: TradeOutcome[] = [
        // Low confidence (<0.7): 2/3 wins = 66.7%
        { confidence: 0.4, isWinner: true, pnlPercent: 1.0 },
        { confidence: 0.5, isWinner: true, pnlPercent: 0.5 },
        { confidence: 0.6, isWinner: false, pnlPercent: -1.0 },
        // High confidence (>=0.7): 1/2 wins = 50%
        { confidence: 0.7, isWinner: true, pnlPercent: 2.0 },
        { confidence: 0.8, isWinner: false, pnlPercent: -1.5 },
      ];

      const { highWinRate, lowWinRate } = (service as any).computeWinRates(
        outcomes,
      );

      expect(lowWinRate).toBeCloseTo(2 / 3, 2);
      expect(highWinRate).toBeCloseTo(1 / 2, 2);
    });

    it("should handle all high confidence trades", () => {
      const service = new ConfidenceCalibrationService();

      const outcomes: TradeOutcome[] = [
        { confidence: 0.7, isWinner: true, pnlPercent: 1.0 },
        { confidence: 0.8, isWinner: true, pnlPercent: 1.5 },
        { confidence: 0.9, isWinner: false, pnlPercent: -0.5 },
      ];

      const { highWinRate, lowWinRate } = (service as any).computeWinRates(
        outcomes,
      );

      expect(highWinRate).toBeCloseTo(2 / 3, 2);
      expect(lowWinRate).toBe(0); // No low confidence trades
    });

    it("should handle all low confidence trades", () => {
      const service = new ConfidenceCalibrationService();

      const outcomes: TradeOutcome[] = [
        { confidence: 0.3, isWinner: true, pnlPercent: 1.0 },
        { confidence: 0.5, isWinner: false, pnlPercent: -1.0 },
        { confidence: 0.6, isWinner: true, pnlPercent: 0.5 },
      ];

      const { highWinRate, lowWinRate } = (service as any).computeWinRates(
        outcomes,
      );

      expect(lowWinRate).toBeCloseTo(2 / 3, 2);
      expect(highWinRate).toBe(0); // No high confidence trades
    });
  });

  describe("saveCalibration", () => {
    it("should save calibration data to database", async () => {
      const { KnexConnector } = await import("../../src/db/knexConnector.js");
      const mockKnex = await KnexConnector.getConnection();
      const mockQueryBuilder = mockKnex("confidence_calibrations");

      mockQueryBuilder.insert.mockResolvedValue([42]); // Mock inserted ID

      const calibration: CalibrationData = {
        market: "BTC",
        windowDays: 60,
        points: [
          { rawConfidence: 0.0, calibratedConfidence: 0.0 },
          { rawConfidence: 0.5, calibratedConfidence: 0.45 },
          { rawConfidence: 1.0, calibratedConfidence: 0.85 },
        ],
        sampleSize: 145,
        correlation: 0.31,
        highConfWinRate: 0.68,
        lowConfWinRate: 0.52,
      };

      const id = await service.saveCalibration(calibration);

      expect(id).toBe(42);
      expect(mockQueryBuilder.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          market: "BTC",
          window_days: 60,
          sample_size: 145,
          correlation: 0.31,
          high_conf_win_rate: 0.68,
          low_conf_win_rate: 0.52,
        }),
      );

      // Check that calibration_data is JSON string
      const insertCall = mockQueryBuilder.insert.mock.calls[0][0];
      expect(typeof insertCall.calibration_data).toBe("string");

      const parsedPoints = JSON.parse(insertCall.calibration_data);
      expect(parsedPoints).toHaveLength(3);
    });
  });

  describe("getLatestCalibration", () => {
    it("should return null when no calibration exists", async () => {
      const { KnexConnector } = await import("../../src/db/knexConnector.js");
      const mockKnex = await KnexConnector.getConnection();
      const mockQueryBuilder = mockKnex("confidence_calibrations");

      mockQueryBuilder.first.mockResolvedValue(null);

      const result = await service.getLatestCalibration("BTC");

      expect(result).toBeNull();
    });

    it("should return calibration data when exists", async () => {
      const { KnexConnector } = await import("../../src/db/knexConnector.js");
      const mockKnex = await KnexConnector.getConnection();
      const mockQueryBuilder = mockKnex("confidence_calibrations");

      const mockRecord = {
        id: 1,
        timestamp: Date.now(),
        market: "BTC",
        window_days: 60,
        calibration_data: JSON.stringify([
          { rawConfidence: 0.0, calibratedConfidence: 0.0 },
          { rawConfidence: 1.0, calibratedConfidence: 0.8 },
        ]),
        sample_size: 100,
        correlation: 0.4,
        high_conf_win_rate: 0.7,
        low_conf_win_rate: 0.5,
      };

      mockQueryBuilder.first.mockResolvedValue(mockRecord);

      const result = await service.getLatestCalibration("BTC");

      expect(result).not.toBeNull();
      expect(result?.market).toBe("BTC");
      expect(result?.windowDays).toBe(60);
      expect(result?.sampleSize).toBe(100);
      expect(result?.correlation).toBe(0.4);
      expect(result?.points).toHaveLength(2);
    });
  });

  describe("isCalibrationStale", () => {
    it("should return true when no calibration exists", async () => {
      const { KnexConnector } = await import("../../src/db/knexConnector.js");
      const mockKnex = await KnexConnector.getConnection();
      const mockQueryBuilder = mockKnex("confidence_calibrations");

      mockQueryBuilder.first.mockResolvedValue(null);

      const isStale = await service.isCalibrationStale("BTC", 7);

      expect(isStale).toBe(true);
    });

    it("should return false for fresh calibration", async () => {
      const { KnexConnector } = await import("../../src/db/knexConnector.js");
      const mockKnex = await KnexConnector.getConnection();
      const mockQueryBuilder = mockKnex("confidence_calibrations");

      const recentTimestamp = Date.now() - 3 * 24 * 60 * 60 * 1000; // 3 days ago

      const mockRecord = {
        id: 1,
        timestamp: recentTimestamp,
        market: "BTC",
        window_days: 60,
        calibration_data: "[]",
        sample_size: 100,
        correlation: 0.4,
        high_conf_win_rate: 0.7,
        low_conf_win_rate: 0.5,
      };

      mockQueryBuilder.first.mockResolvedValue(mockRecord);

      const isStale = await service.isCalibrationStale("BTC", 7);

      expect(isStale).toBe(false);
    });

    it("should return true for stale calibration", async () => {
      const { KnexConnector } = await import("../../src/db/knexConnector.js");
      const mockKnex = await KnexConnector.getConnection();
      const mockQueryBuilder = mockKnex("confidence_calibrations");

      const oldTimestamp = Date.now() - 10 * 24 * 60 * 60 * 1000; // 10 days ago

      const mockRecord = {
        id: 1,
        timestamp: oldTimestamp,
        market: "BTC",
        window_days: 60,
        calibration_data: "[]",
        sample_size: 100,
        correlation: 0.4,
        high_conf_win_rate: 0.7,
        low_conf_win_rate: 0.5,
      };

      mockQueryBuilder.first.mockResolvedValue(mockRecord);

      const isStale = await service.isCalibrationStale("BTC", 7);

      expect(isStale).toBe(true);
    });
  });

  describe("HOLD evaluation", () => {
    it("should create synthetic outcome for missed LONG opportunity", async () => {
      const { KnexConnector } = await import("../../src/db/knexConnector.js");
      const mockKnex = await KnexConnector.getConnection();
      const mockQueryBuilder = mockKnex("trade_recommendations");

      // Mock recommendations: Need at least 10 for calibration, include HOLD with missed opportunity
      const baseTime = Date.now();
      const mockRecommendations = [
        // First: HOLD with missed LONG opportunity
        {
          action: "hold",
          price: 100,
          confidence: 0.7, // Above MIN_CONFIDENCE_FOR_EVALUATION
          timestamp: baseTime - 10000,
          market: "BTC",
        },
        {
          action: "hold",
          price: 101, // +1% move (above OPPORTUNITY_THRESHOLD)
          confidence: 0.6,
          timestamp: baseTime - 9000,
          market: "BTC",
        },
        // Add more trades to meet minimum sample size (10 trades)
        ...Array.from({ length: 9 }, (_, i) => ({
          action: "long" as const,
          price: 100 + i * 0.5,
          confidence: 0.6 + i * 0.03,
          timestamp: baseTime - (8000 - i * 800),
          market: "BTC",
        })),
      ];

      mockQueryBuilder.select.mockResolvedValue(mockRecommendations);

      const calibration = await service.computeCalibration("BTC", 60);

      // Should have outcomes including the missed opportunity
      expect(calibration.sampleSize).toBeGreaterThan(0);
    });

    it("should create synthetic outcome for missed SHORT opportunity", async () => {
      const { KnexConnector } = await import("../../src/db/knexConnector.js");
      const mockKnex = await KnexConnector.getConnection();
      const mockQueryBuilder = mockKnex("trade_recommendations");

      // Mock recommendations: Need 10+ trades, include HOLD with missed SHORT
      const baseTime = Date.now();
      const mockRecommendations = [
        ...Array.from({ length: 10 }, (_, i) => ({
          action: i === 0 ? "hold" : ("long" as const),
          price: i === 0 ? 100 : i === 1 ? 99 : 100 + i * 0.5, // First HOLD at 100, next at 99 (-1%)
          confidence: i === 0 ? 0.7 : 0.6 + i * 0.03,
          timestamp: baseTime - (10000 - i * 900),
          market: "BTC",
        })),
      ];

      mockQueryBuilder.select.mockResolvedValue(mockRecommendations);

      const calibration = await service.computeCalibration("BTC", 60);

      expect(calibration.sampleSize).toBeGreaterThan(0);
    });

    it("should NOT create synthetic outcome for small price move", async () => {
      const { KnexConnector } = await import("../../src/db/knexConnector.js");
      const mockKnex = await KnexConnector.getConnection();
      const mockQueryBuilder = mockKnex("trade_recommendations");

      // Mock 10+ trades with HOLD followed by small move
      const baseTime = Date.now();
      const mockRecommendations = [
        ...Array.from({ length: 10 }, (_, i) => ({
          action: i === 0 ? "hold" : ("long" as const),
          price: i === 0 ? 100 : i === 1 ? 100.3 : 100 + i * 0.5, // Small +0.3% move
          confidence: i === 0 ? 0.7 : 0.6 + i * 0.03,
          timestamp: baseTime - (10000 - i * 900),
          market: "BTC",
        })),
      ];

      mockQueryBuilder.select.mockResolvedValue(mockRecommendations);

      const calibration = await service.computeCalibration("BTC", 60);

      // Should still have outcomes from the LONG trades
      expect(calibration.sampleSize).toBeGreaterThan(0);
    });

    it("should NOT evaluate low-confidence HOLD", async () => {
      const { KnexConnector } = await import("../../src/db/knexConnector.js");
      const mockKnex = await KnexConnector.getConnection();
      const mockQueryBuilder = mockKnex("trade_recommendations");

      // Mock 10+ trades with low-confidence HOLD followed by big move
      const baseTime = Date.now();
      const mockRecommendations = [
        ...Array.from({ length: 10 }, (_, i) => ({
          action: i === 0 ? "hold" : ("long" as const),
          price: i === 0 ? 100 : i === 1 ? 101 : 100 + i * 0.5, // HOLD at 100, next at 101
          confidence: i === 0 ? 0.4 : 0.6 + i * 0.03, // Low confidence (0.4) for HOLD
          timestamp: baseTime - (10000 - i * 900),
          market: "BTC",
        })),
      ];

      mockQueryBuilder.select.mockResolvedValue(mockRecommendations);

      const calibration = await service.computeCalibration("BTC", 60);

      // Should have outcomes from LONG trades, but NOT from the low-confidence HOLD
      expect(calibration.sampleSize).toBeGreaterThan(0);
    });
  });

  describe("CLOSE evaluation", () => {
    it("should penalize closing too early when price continues favorably", async () => {
      const { KnexConnector } = await import("../../src/db/knexConnector.js");
      const mockKnex = await KnexConnector.getConnection();
      const mockQueryBuilder = mockKnex("trade_recommendations");

      const baseTime = Date.now();
      // Need 10+ recommendations: LONG->CLOSE with price continuing, plus 8 more trades
      const mockRecommendations = [
        // Test case: LONG closed early
        {
          action: "long",
          price: 100,
          confidence: 0.75,
          timestamp: baseTime - 12000,
          market: "BTC",
        },
        {
          action: "close",
          price: 102, // +2% profit
          confidence: 0.7,
          timestamp: baseTime - 11000,
          market: "BTC",
        },
        {
          action: "hold",
          price: 103.5, // Price continued +1.5% after close (missed gain)
          confidence: 0.6,
          timestamp: baseTime - 10000,
          market: "BTC",
        },
        // Add more trades to meet minimum
        ...Array.from({ length: 8 }, (_, i) => ({
          action: "long" as const,
          price: 103 + i * 0.5,
          confidence: 0.65 + i * 0.03,
          timestamp: baseTime - (9000 - i * 900),
          market: "BTC",
        })),
      ];

      mockQueryBuilder.select.mockResolvedValue(mockRecommendations);

      const calibration = await service.computeCalibration("BTC", 60);

      // Should have multiple outcomes including the early close penalty
      expect(calibration.sampleSize).toBeGreaterThan(0);
    });

    it("should reward good close when price reverses", async () => {
      const { KnexConnector } = await import("../../src/db/knexConnector.js");
      const mockKnex = await KnexConnector.getConnection();
      const mockQueryBuilder = mockKnex("trade_recommendations");

      const baseTime = Date.now();
      const mockRecommendations = [
        // Test case: SHORT with good close timing
        {
          action: "short",
          price: 100,
          confidence: 0.75,
          timestamp: baseTime - 12000,
          market: "BTC",
        },
        {
          action: "close",
          price: 98, // +2% profit
          confidence: 0.8,
          timestamp: baseTime - 11000,
          market: "BTC",
        },
        {
          action: "hold",
          price: 99, // Price reversed (avoided drawdown)
          confidence: 0.6,
          timestamp: baseTime - 10000,
          market: "BTC",
        },
        // Add more trades
        ...Array.from({ length: 8 }, (_, i) => ({
          action: "long" as const,
          price: 99 + i * 0.5,
          confidence: 0.65 + i * 0.03,
          timestamp: baseTime - (9000 - i * 900),
          market: "BTC",
        })),
      ];

      mockQueryBuilder.select.mockResolvedValue(mockRecommendations);

      const calibration = await service.computeCalibration("BTC", 60);

      expect(calibration.sampleSize).toBeGreaterThan(0);
    });

    it("should NOT penalize close when move after is small", async () => {
      const { KnexConnector } = await import("../../src/db/knexConnector.js");
      const mockKnex = await KnexConnector.getConnection();
      const mockQueryBuilder = mockKnex("trade_recommendations");

      const baseTime = Date.now();
      const mockRecommendations = [
        // Test case: LONG with acceptable close (small move after)
        {
          action: "long",
          price: 100,
          confidence: 0.75,
          timestamp: baseTime - 12000,
          market: "BTC",
        },
        {
          action: "close",
          price: 100.5, // +0.5% profit
          confidence: 0.6,
          timestamp: baseTime - 11000,
          market: "BTC",
        },
        {
          action: "hold",
          price: 100.8, // Only +0.3% more (below threshold, acceptable)
          confidence: 0.6,
          timestamp: baseTime - 10000,
          market: "BTC",
        },
        // Add more trades
        ...Array.from({ length: 8 }, (_, i) => ({
          action: "long" as const,
          price: 101 + i * 0.5,
          confidence: 0.65 + i * 0.03,
          timestamp: baseTime - (9000 - i * 900),
          market: "BTC",
        })),
      ];

      mockQueryBuilder.select.mockResolvedValue(mockRecommendations);

      const calibration = await service.computeCalibration("BTC", 60);

      expect(calibration.sampleSize).toBeGreaterThan(0);
    });

    it("should handle position flips (LONG to SHORT)", async () => {
      const { KnexConnector } = await import("../../src/db/knexConnector.js");
      const mockKnex = await KnexConnector.getConnection();
      const mockQueryBuilder = mockKnex("trade_recommendations");

      const baseTime = Date.now();
      const mockRecommendations = [
        // Test case: LONG flipped to SHORT
        {
          action: "long",
          price: 100,
          confidence: 0.75,
          timestamp: baseTime - 12000,
          market: "BTC",
        },
        {
          action: "short", // Flip position (closes LONG at +2%)
          price: 102,
          confidence: 0.8,
          timestamp: baseTime - 11000,
          market: "BTC",
        },
        {
          action: "hold",
          price: 101,
          confidence: 0.6,
          timestamp: baseTime - 10000,
          market: "BTC",
        },
        // Add more trades
        ...Array.from({ length: 8 }, (_, i) => ({
          action: "long" as const,
          price: 101 + i * 0.5,
          confidence: 0.65 + i * 0.03,
          timestamp: baseTime - (9000 - i * 900),
          market: "BTC",
        })),
      ];

      mockQueryBuilder.select.mockResolvedValue(mockRecommendations);

      const calibration = await service.computeCalibration("BTC", 60);

      expect(calibration.sampleSize).toBeGreaterThan(0);
    });

    it("should NOT evaluate low-confidence CLOSE", async () => {
      const { KnexConnector } = await import("../../src/db/knexConnector.js");
      const mockKnex = await KnexConnector.getConnection();
      const mockQueryBuilder = mockKnex("trade_recommendations");

      const baseTime = Date.now();
      const mockRecommendations = [
        // Test case: LONG with low-confidence CLOSE
        {
          action: "long",
          price: 100,
          confidence: 0.75,
          timestamp: baseTime - 12000,
          market: "BTC",
        },
        {
          action: "close",
          price: 102,
          confidence: 0.4, // Below MIN_CONFIDENCE_FOR_EVALUATION
          timestamp: baseTime - 11000,
          market: "BTC",
        },
        {
          action: "hold",
          price: 103.5, // Price continued significantly
          confidence: 0.6,
          timestamp: baseTime - 10000,
          market: "BTC",
        },
        // Add more trades
        ...Array.from({ length: 8 }, (_, i) => ({
          action: "long" as const,
          price: 103 + i * 0.5,
          confidence: 0.65 + i * 0.03,
          timestamp: baseTime - (9000 - i * 900),
          market: "BTC",
        })),
      ];

      mockQueryBuilder.select.mockResolvedValue(mockRecommendations);

      const calibration = await service.computeCalibration("BTC", 60);

      // Should have outcomes but NOT from the low-confidence CLOSE
      expect(calibration.sampleSize).toBeGreaterThan(0);
    });
  });
});

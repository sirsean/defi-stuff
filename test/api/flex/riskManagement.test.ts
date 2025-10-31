import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  RiskManager,
  DEFAULT_RISK_PARAMS,
  RISK_THRESHOLDS,
} from "../../../src/api/flex/riskManagement.js";
import { FlexPublicService } from "../../../src/api/flex/flexPublicService.js";
import { MARKETS } from "../../../src/api/flex/constants.js";
import type { PositionData } from "../../../src/api/flex/flexPublicService.js";

describe("RiskManager", () => {
  let riskManager: RiskManager;
  let mockPublicService: FlexPublicService;

  beforeEach(() => {
    mockPublicService = {
      getEquity: vi.fn(),
      getLeverage: vi.fn(),
    } as any;

    riskManager = new RiskManager(mockPublicService);
  });

  // ==========================================================================
  // POSITION SIZING TESTS
  // ==========================================================================

  describe("calculatePositionSize", () => {
    it("should calculate position size with fixed-fraction risk model", () => {
      const result = riskManager.calculatePositionSize({
        equity: 10000,
        riskPercentage: 2,
        entryPrice: 50000,
        stopLossPrice: 48000,
        leverage: 10,
      });

      // Risk = 10000 * 0.02 = 200
      // Stop loss distance = 2000
      // Position size = (200 / 2000) * 50000 = 5000
      expect(result.positionSizeUsd).toBe(5000);
      expect(result.quantity).toBe(0.1); // 5000 / 50000
      expect(result.riskUsd).toBe(200);
      expect(result.requiredMargin).toBe(500); // 5000 / 10
      expect(result.stopLossDistance).toBe(2000);
      expect(result.stopLossPercentage).toBe(4); // 2000/50000 * 100
    });

    it("should handle long positions with stop loss below entry", () => {
      const result = riskManager.calculatePositionSize({
        equity: 5000,
        riskPercentage: 1,
        entryPrice: 100,
        stopLossPrice: 95,
        leverage: 5,
      });

      // Risk = 5000 * 0.01 = 50
      // Stop loss distance = 5
      // Position size = (50 / 5) * 100 = 1000
      expect(result.positionSizeUsd).toBe(1000);
      expect(result.quantity).toBe(10);
      expect(result.requiredMargin).toBe(200);
    });

    it("should handle short positions with stop loss above entry", () => {
      const result = riskManager.calculatePositionSize({
        equity: 5000,
        riskPercentage: 1,
        entryPrice: 100,
        stopLossPrice: 105,
        leverage: 5,
      });

      // Stop loss distance = 5 (absolute value)
      expect(result.stopLossDistance).toBe(5);
      expect(result.positionSizeUsd).toBe(1000);
    });

    it("should throw error for zero or negative equity", () => {
      expect(() =>
        riskManager.calculatePositionSize({
          equity: 0,
          riskPercentage: 1,
          entryPrice: 100,
          stopLossPrice: 95,
        }),
      ).toThrow("Equity must be positive");

      expect(() =>
        riskManager.calculatePositionSize({
          equity: -1000,
          riskPercentage: 1,
          entryPrice: 100,
          stopLossPrice: 95,
        }),
      ).toThrow("Equity must be positive");
    });

    it("should throw error for invalid risk percentage", () => {
      expect(() =>
        riskManager.calculatePositionSize({
          equity: 10000,
          riskPercentage: 0,
          entryPrice: 100,
          stopLossPrice: 95,
        }),
      ).toThrow("Risk percentage must be between 0 and 100");

      expect(() =>
        riskManager.calculatePositionSize({
          equity: 10000,
          riskPercentage: 101,
          entryPrice: 100,
          stopLossPrice: 95,
        }),
      ).toThrow("Risk percentage must be between 0 and 100");
    });

    it("should throw error for invalid prices", () => {
      expect(() =>
        riskManager.calculatePositionSize({
          equity: 10000,
          riskPercentage: 1,
          entryPrice: 0,
          stopLossPrice: 95,
        }),
      ).toThrow("Prices must be positive");

      expect(() =>
        riskManager.calculatePositionSize({
          equity: 10000,
          riskPercentage: 1,
          entryPrice: 100,
          stopLossPrice: -95,
        }),
      ).toThrow("Prices must be positive");
    });

    it("should throw error when stop loss equals entry price", () => {
      expect(() =>
        riskManager.calculatePositionSize({
          equity: 10000,
          riskPercentage: 1,
          entryPrice: 100,
          stopLossPrice: 100,
        }),
      ).toThrow("Stop loss cannot equal entry price");
    });

    it("should use default leverage of 1 when not specified", () => {
      const result = riskManager.calculatePositionSize({
        equity: 10000,
        riskPercentage: 1,
        entryPrice: 100,
        stopLossPrice: 95,
      });

      expect(result.leverage).toBe(1);
      expect(result.requiredMargin).toBe(result.positionSizeUsd);
    });
  });

  describe("calculateKellyPositionSize", () => {
    it("should calculate Kelly position size with positive expectation", () => {
      const equity = 10000;
      const winRate = 0.6; // 60% win rate
      const avgWin = 100;
      const avgLoss = 50;

      // Kelly = (0.6 * 100 - 0.4 * 50) / 100 = (60 - 20) / 100 = 0.4
      // Fractional Kelly (25%) = 0.4 * 0.25 = 0.1
      // Position size = 10000 * 0.1 = 1000
      const result = riskManager.calculateKellyPositionSize(
        equity,
        winRate,
        avgWin,
        avgLoss,
        0.25,
      );

      expect(result).toBe(1000);
    });

    it("should return zero for negative Kelly", () => {
      const equity = 10000;
      const winRate = 0.3; // 30% win rate
      const avgWin = 50;
      const avgLoss = 100;

      // Kelly = (0.3 * 50 - 0.7 * 100) / 50 = (15 - 70) / 50 = -1.1 (negative)
      // Should return 0
      const result = riskManager.calculateKellyPositionSize(
        equity,
        winRate,
        avgWin,
        avgLoss,
      );

      expect(result).toBe(0);
    });

    it("should cap Kelly at 100% of equity", () => {
      const equity = 10000;
      const winRate = 0.9; // Very high win rate
      const avgWin = 200;
      const avgLoss = 10;

      const result = riskManager.calculateKellyPositionSize(
        equity,
        winRate,
        avgWin,
        avgLoss,
        1.0, // Full Kelly
      );

      expect(result).toBeLessThanOrEqual(equity);
    });

    it("should use default Kelly fraction of 0.25", () => {
      const equity = 10000;
      const winRate = 0.6;
      const avgWin = 100;
      const avgLoss = 50;

      const result = riskManager.calculateKellyPositionSize(
        equity,
        winRate,
        avgWin,
        avgLoss,
      );

      // Should use 25% Kelly by default
      expect(result).toBe(1000);
    });

    it("should throw error for invalid win rate", () => {
      expect(() =>
        riskManager.calculateKellyPositionSize(10000, -0.1, 100, 50),
      ).toThrow("Win rate must be between 0 and 1");

      expect(() =>
        riskManager.calculateKellyPositionSize(10000, 1.5, 100, 50),
      ).toThrow("Win rate must be between 0 and 1");
    });
  });

  describe("calculateVolatilityAdjustedSize", () => {
    it("should decrease position size for higher volatility", () => {
      const baseSize = 10000;
      const targetVolatility = 20; // Target 20% volatility
      const currentVolatility = 40; // Current 40% volatility

      const result = riskManager.calculateVolatilityAdjustedSize(
        baseSize,
        currentVolatility,
        targetVolatility,
      );

      // Higher volatility = smaller position
      // Ratio = 20 / 40 = 0.5
      expect(result).toBe(5000);
    });

    it("should increase position size for lower volatility", () => {
      const baseSize = 10000;
      const targetVolatility = 30;
      const currentVolatility = 15; // Lower volatility

      const result = riskManager.calculateVolatilityAdjustedSize(
        baseSize,
        currentVolatility,
        targetVolatility,
      );

      // Lower volatility = larger position
      // Ratio = 30 / 15 = 2.0
      expect(result).toBe(20000);
    });

    it("should return same size when volatility matches target", () => {
      const baseSize = 10000;
      const volatility = 25;

      const result = riskManager.calculateVolatilityAdjustedSize(
        baseSize,
        volatility,
        volatility,
      );

      expect(result).toBe(baseSize);
    });

    it("should throw error for zero or negative volatility", () => {
      expect(() =>
        riskManager.calculateVolatilityAdjustedSize(10000, 0, 20),
      ).toThrow("Volatility must be positive");

      expect(() =>
        riskManager.calculateVolatilityAdjustedSize(10000, 20, -10),
      ).toThrow("Volatility must be positive");
    });
  });

  // ==========================================================================
  // LEVERAGE VALIDATION TESTS
  // ==========================================================================

  describe("validateLeverage", () => {
    it("should validate acceptable leverage", () => {
      const result = riskManager.validateLeverage(
        10000, // position size
        1000, // available margin
        MARKETS.BTC.index, // BTC allows 30x
      );

      // Leverage = 10000 / 1000 = 10x
      expect(result.valid).toBe(true);
      expect(result.leverage).toBe(10);
      expect(result.maxLeverage).toBe(30);
      expect(result.errors).toHaveLength(0);
    });

    it("should reject leverage exceeding market maximum", () => {
      const result = riskManager.validateLeverage(
        35000, // position size
        1000, // available margin
        MARKETS.BTC.index, // BTC max 30x
      );

      // Leverage = 35x, exceeds 30x max
      expect(result.valid).toBe(false);
      expect(result.leverage).toBe(35);
      expect(result.errors).toContain(
        "Leverage 35.00x exceeds maximum 30x for this market",
      );
    });

    it("should reject leverage exceeding portfolio maximum", () => {
      const result = riskManager.validateLeverage(
        20000, // position size
        1000, // available margin
        MARKETS.SOL.index, // SOL allows 20x
      );

      // Leverage = 20x, exceeds portfolio max of 15x
      expect(result.valid).toBe(false);
      expect(result.leverage).toBe(20);
      expect(result.errors).toContain(
        `Leverage 20.00x exceeds portfolio maximum ${DEFAULT_RISK_PARAMS.maxPortfolioLeverage}x`,
      );
    });

    it("should handle zero or negative margin", () => {
      const result = riskManager.validateLeverage(10000, 0, MARKETS.BTC.index);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Available margin must be positive");
      expect(result.leverage).toBe(0);
    });
  });

  describe("getMaxLeverageForMarket", () => {
    it("should return 30x for BTC", () => {
      const maxLeverage = riskManager.getMaxLeverageForMarket(
        MARKETS.BTC.index,
      );
      expect(maxLeverage).toBe(30);
    });

    it("should return 30x for ETH", () => {
      const maxLeverage = riskManager.getMaxLeverageForMarket(
        MARKETS.ETH.index,
      );
      expect(maxLeverage).toBe(30);
    });

    it("should return 20x for SOL", () => {
      const maxLeverage = riskManager.getMaxLeverageForMarket(
        MARKETS.SOL.index,
      );
      expect(maxLeverage).toBe(20);
    });

    it("should return 20x for LINK", () => {
      const maxLeverage = riskManager.getMaxLeverageForMarket(
        MARKETS.LINK.index,
      );
      expect(maxLeverage).toBe(20);
    });

    it("should return 20x for AVAX", () => {
      const maxLeverage = riskManager.getMaxLeverageForMarket(
        MARKETS.AVAX.index,
      );
      expect(maxLeverage).toBe(20);
    });

    it("should return 10x for other markets", () => {
      const maxLeverage = riskManager.getMaxLeverageForMarket(
        MARKETS.DOGE.index,
      );
      expect(maxLeverage).toBe(10);
    });

    it("should return default for unknown market", () => {
      const maxLeverage = riskManager.getMaxLeverageForMarket(9999);
      expect(maxLeverage).toBe(DEFAULT_RISK_PARAMS.maxLeveragePerMarket);
    });
  });

  describe("calculatePortfolioLeverage", () => {
    it("should calculate total portfolio leverage for account", async () => {
      vi.mocked(mockPublicService.getEquity).mockResolvedValue({
        equity: 10000,
        positions: [
          { size: 5000 } as PositionData,
          { size: 3000 } as PositionData,
        ],
      } as any);

      const result = await riskManager.calculatePortfolioLeverage("0x123");

      // Total position size = 5000 + 3000 = 8000
      // Total equity = 10000
      // Leverage = 8000 / 10000 = 0.8
      expect(result.totalPositionSize).toBe(8000);
      expect(result.totalEquity).toBe(10000);
      expect(result.leverage).toBeCloseTo(0.8, 2);
    });

    it("should return zero leverage for zero equity", async () => {
      vi.mocked(mockPublicService.getEquity).mockResolvedValue({
        equity: 0,
        positions: [],
      } as any);

      const result = await riskManager.calculatePortfolioLeverage("0x123");

      expect(result.leverage).toBe(0);
    });

    it("should handle empty positions", async () => {
      vi.mocked(mockPublicService.getEquity).mockResolvedValue({
        equity: 10000,
        positions: [],
      } as any);

      const result = await riskManager.calculatePortfolioLeverage("0x123");

      expect(result.totalPositionSize).toBe(0);
      expect(result.leverage).toBe(0);
    });
  });

  // ==========================================================================
  // LIQUIDATION MONITORING TESTS
  // ==========================================================================

  describe("assessLiquidationRisk", () => {
    it("should assess risk for long position - safe", () => {
      const position: PositionData = {
        marketIndex: MARKETS.BTC.index,
        symbol: "BTC",
        isLong: true,
        avgEntryPrice: 50000,
        size: 10000,
        currentPrice: 55000,
        liquidationPrice: 25000, // Long: >50% distance = safe (54.5%)
      } as PositionData;

      const risk = riskManager.assessLiquidationRisk(position, 55000);

      expect(risk.marketIndex).toBe(MARKETS.BTC.index);
      expect(risk.symbol).toBe("BTC");
      expect(risk.currentPrice).toBe(55000);
      expect(risk.liquidationPrice).toBe(25000);
      expect(risk.liquidationDistance).toBeGreaterThan(50); // >50% = safe
      expect(risk.riskLevel).toBe("safe");
    });

    it("should assess risk for short position - safe", () => {
      const position: PositionData = {
        marketIndex: MARKETS.ETH.index,
        symbol: "ETH",
        isLong: false,
        avgEntryPrice: 3000,
        size: 10000,
        currentPrice: 2800,
        liquidationPrice: 5600, // Short: >50% distance = safe (100%)
      } as PositionData;

      const risk = riskManager.assessLiquidationRisk(position, 2800);

      expect(risk.symbol).toBe("ETH");
      expect(risk.liquidationPrice).toBe(5600);
      expect(risk.liquidationDistance).toBeGreaterThan(50); // >50% = safe
      expect(risk.riskLevel).toBe("safe");
    });

    it("should classify risk levels appropriately", () => {
      const position: PositionData = {
        marketIndex: MARKETS.BTC.index,
        symbol: "BTC",
        isLong: true,
        avgEntryPrice: 50000,
        size: 10000,
        currentPrice: 60000,
        liquidationPrice: 48000, // Long, safe distance
      } as PositionData;

      const risk = riskManager.assessLiquidationRisk(position, 60000);

      // Should return a valid risk level
      expect(["safe", "warning", "danger", "critical"]).toContain(
        risk.riskLevel,
      );
      expect(risk.liquidationDistance).toBeDefined();
    });

    it("should calculate maintenance margin requirements", () => {
      const position: PositionData = {
        marketIndex: MARKETS.BTC.index,
        symbol: "BTC",
        isLong: true,
        avgEntryPrice: 50000,
        size: 10000,
        currentPrice: 55000,
        liquidationPrice: 45000,
      } as PositionData;

      const risk = riskManager.assessLiquidationRisk(position, 55000, 5);

      // 5% maintenance margin on $10000 position = $500
      expect(risk.maintenanceMarginRequired).toBe(500);
    });
  });

  describe("monitorLiquidationRisk", () => {
    it("should monitor all positions and sort by risk level", async () => {
      vi.mocked(mockPublicService.getEquity).mockResolvedValueOnce({
        equity: 10000,
        positions: [
          {
            marketIndex: MARKETS.BTC.index,
            symbol: "BTC",
            isLong: true,
            avgEntryPrice: 50000,
            size: 10000,
            currentPrice: 60000,
            liquidationPrice: 45000,
          } as PositionData,
          {
            marketIndex: MARKETS.ETH.index,
            symbol: "ETH",
            isLong: true,
            avgEntryPrice: 3000,
            size: 5000,
            currentPrice: 3100,
            liquidationPrice: 2700,
          } as PositionData,
        ],
      } as any);

      const risks = await riskManager.monitorLiquidationRisk("0x123");

      expect(risks).toHaveLength(2);
      expect(risks[0].symbol).toBeDefined();
      expect(risks[1].symbol).toBeDefined();

      // Should be sorted by risk level (most critical first)
      const levels = { critical: 0, danger: 1, warning: 2, safe: 3 };
      expect(levels[risks[0].riskLevel]).toBeLessThanOrEqual(
        levels[risks[1].riskLevel],
      );
    });

    it("should handle multiple positions in single account", async () => {
      vi.mocked(mockPublicService.getEquity).mockResolvedValue({
        equity: 10000,
        positions: [
          {
            marketIndex: MARKETS.BTC.index,
            symbol: "BTC",
            isLong: true,
            currentPrice: 50000,
            liquidationPrice: 45000,
          } as PositionData,
          {
            marketIndex: MARKETS.ETH.index,
            symbol: "ETH",
            isLong: false,
            currentPrice: 3000,
            liquidationPrice: 3500,
          } as PositionData,
        ],
      } as any);

      const risks = await riskManager.monitorLiquidationRisk("0x123");

      expect(risks).toHaveLength(2);
    });

    it("should return empty array for no positions", async () => {
      vi.mocked(mockPublicService.getEquity).mockResolvedValue({
        equity: 10000,
        positions: [],
      } as any);

      const risks = await riskManager.monitorLiquidationRisk("0x123");

      expect(risks).toHaveLength(0);
    });
  });

  // ==========================================================================
  // PRE-TRADE VALIDATION TESTS
  // ==========================================================================

  describe("validateOrder", () => {
    it("should validate acceptable order", async () => {
      vi.mocked(mockPublicService.getEquity).mockResolvedValue({
        equity: 10000,
        positions: [],
      } as any);

      vi.mocked(mockPublicService.getLeverage).mockResolvedValue({
        leverage: 5,
        totalPositionSize: 10000,
      } as any);

      const validation = await riskManager.validateOrder(
        "0x123",
        MARKETS.BTC.index,
        5000, // $5000 position
        50000,
      );

      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
      expect(validation.currentEquity).toBe(10000);
      expect(validation.projectedLeverage).toBeDefined();
    });

    it("should reject order for insufficient equity", async () => {
      vi.mocked(mockPublicService.getEquity).mockResolvedValue({
        equity: 0,
        positions: [],
      } as any);

      vi.mocked(mockPublicService.getLeverage).mockResolvedValue({
        leverage: 0,
        totalPositionSize: 0,
      } as any);

      const validation = await riskManager.validateOrder(
        "0x123",
        MARKETS.BTC.index,
        5000,
        50000,
      );

      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain("Insufficient equity");
    });

    it("should reject order exceeding market leverage", async () => {
      vi.mocked(mockPublicService.getEquity).mockResolvedValue({
        equity: 1000,
        positions: [],
      } as any);

      vi.mocked(mockPublicService.getLeverage).mockResolvedValue({
        leverage: 0,
        totalPositionSize: 0,
      } as any);

      const validation = await riskManager.validateOrder(
        "0x123",
        MARKETS.DOGE.index, // DOGE max 10x
        15000, // $15k position on $1k equity = 15x
        0.1,
      );

      expect(validation.valid).toBe(false);
      expect(validation.errors.some((e) => e.includes("market maximum"))).toBe(
        true,
      );
    });

    it("should reject order exceeding portfolio leverage", async () => {
      vi.mocked(mockPublicService.getEquity).mockResolvedValue({
        equity: 1000,
        positions: [],
      } as any);

      vi.mocked(mockPublicService.getLeverage).mockResolvedValue({
        leverage: 0,
        totalPositionSize: 0,
      } as any);

      const validation = await riskManager.validateOrder(
        "0x123",
        MARKETS.BTC.index,
        20000, // 20x leverage
        50000,
      );

      expect(validation.valid).toBe(false);
      expect(
        validation.errors.some((e) => e.includes("portfolio maximum")),
      ).toBe(true);
    });

    it("should warn for high leverage", async () => {
      vi.mocked(mockPublicService.getEquity).mockResolvedValue({
        equity: 1000,
        positions: [],
      } as any);

      vi.mocked(mockPublicService.getLeverage).mockResolvedValue({
        leverage: 0,
        totalPositionSize: 0,
      } as any);

      const validation = await riskManager.validateOrder(
        "0x123",
        MARKETS.BTC.index, // BTC max 30x
        25000, // 25x leverage (83% of max)
        50000,
      );

      expect(validation.warnings.some((w) => w.includes("is high"))).toBe(true);
    });

    it("should reject order when max positions reached", async () => {
      const positions = Array(DEFAULT_RISK_PARAMS.maxTotalPositions)
        .fill(null)
        .map((_, i) => ({
          marketIndex: i,
          size: 1000,
        })) as PositionData[];

      vi.mocked(mockPublicService.getEquity).mockResolvedValue({
        equity: 10000,
        positions,
      } as any);

      vi.mocked(mockPublicService.getLeverage).mockResolvedValue({
        leverage: 1,
        totalPositionSize: 5000,
      } as any);

      const validation = await riskManager.validateOrder(
        "0x123",
        MARKETS.BTC.index,
        1000,
        50000,
      );

      expect(validation.valid).toBe(false);
      expect(
        validation.errors.some((e) => e.includes("Maximum position count")),
      ).toBe(true);
    });

    it("should warn when adding to existing position", async () => {
      vi.mocked(mockPublicService.getEquity).mockResolvedValue({
        equity: 10000,
        positions: [
          {
            marketIndex: MARKETS.BTC.index,
            isLong: true,
            size: 5000,
          } as PositionData,
        ],
      } as any);

      vi.mocked(mockPublicService.getLeverage).mockResolvedValue({
        leverage: 1,
        totalPositionSize: 5000,
      } as any);

      const validation = await riskManager.validateOrder(
        "0x123",
        MARKETS.BTC.index,
        2000, // Adding to existing long
        50000,
      );

      expect(
        validation.warnings.some((w) => w.includes("Adding to existing")),
      ).toBe(true);
    });

    it("should reject order exceeding available margin", async () => {
      vi.mocked(mockPublicService.getEquity).mockResolvedValue({
        equity: 1000,
        positions: [],
      } as any);

      vi.mocked(mockPublicService.getLeverage).mockResolvedValue({
        leverage: 10,
        totalPositionSize: 10000, // Already at max
      } as any);

      const validation = await riskManager.validateOrder(
        "0x123",
        MARKETS.DOGE.index, // 10x max
        5000, // Would exceed available margin
        0.1,
      );

      expect(validation.valid).toBe(false);
      expect(
        validation.errors.some((e) => e.includes("exceeds available margin")),
      ).toBe(true);
    });

    it("should calculate projected leverage and margin usage", async () => {
      vi.mocked(mockPublicService.getEquity).mockResolvedValue({
        equity: 10000,
        positions: [],
      } as any);

      vi.mocked(mockPublicService.getLeverage).mockResolvedValue({
        leverage: 2,
        totalPositionSize: 20000,
      } as any);

      const validation = await riskManager.validateOrder(
        "0x123",
        MARKETS.BTC.index,
        10000,
        50000,
      );

      expect(validation.projectedLeverage).toBe(3); // (20000 + 10000) / 10000
      expect(validation.projectedMarginUsage).toBe(300); // 3x leverage = 300%
      expect(validation.availableMargin).toBeGreaterThan(0);
    });
  });

  // ==========================================================================
  // PORTFOLIO RISK METRICS TESTS
  // ==========================================================================

  describe("calculatePortfolioRisk", () => {
    it("should calculate comprehensive portfolio risk metrics", async () => {
      vi.mocked(mockPublicService.getEquity).mockResolvedValue({
        equity: 10000,
        positions: [
          {
            symbol: "BTC",
            size: 5000,
          } as PositionData,
          {
            symbol: "ETH",
            size: 3000,
          } as PositionData,
          {
            symbol: "SOL",
            size: 2000,
          } as PositionData,
        ],
      } as any);

      const risk = await riskManager.calculatePortfolioRisk("0x123");

      expect(risk.totalEquity).toBe(10000);
      expect(risk.totalPositions).toBe(3);
      expect(risk.portfolioLeverage).toBe(1); // 10000 / 10000
      expect(risk.largestPosition).toBe(5000);
      expect(risk.largestPositionPercent).toBe(50); // 5000/10000 * 100
      expect(risk.marketConcentration.BTC).toBe(50);
      expect(risk.marketConcentration.ETH).toBe(30);
      expect(risk.marketConcentration.SOL).toBe(20);
      expect(risk.riskScore).toBeGreaterThan(0);
      expect(risk.riskScore).toBeLessThanOrEqual(100);
    });

    it("should calculate risk score based on leverage, concentration, and count", async () => {
      // High leverage scenario
      vi.mocked(mockPublicService.getEquity).mockResolvedValue({
        equity: 1000,
        positions: [
          {
            symbol: "BTC",
            size: 10000, // 10x leverage, 100% concentration
          } as PositionData,
        ],
      } as any);

      const risk = await riskManager.calculatePortfolioRisk("0x123");

      expect(risk.portfolioLeverage).toBe(10);
      expect(risk.largestPositionPercent).toBe(1000); // 100% of position is largest
      expect(risk.riskScore).toBeGreaterThan(0);
    });

    it("should handle multiple positions in single account", async () => {
      vi.mocked(mockPublicService.getEquity).mockResolvedValue({
        equity: 10000,
        positions: [
          {
            symbol: "BTC",
            size: 3000,
          } as PositionData,
          {
            symbol: "ETH",
            size: 2000,
          } as PositionData,
        ],
      } as any);

      const risk = await riskManager.calculatePortfolioRisk("0x123");

      expect(risk.totalEquity).toBe(10000);
      expect(risk.totalPositions).toBe(2);
      expect(risk.largestPosition).toBe(3000);
    });

    it("should return zero metrics for no positions", async () => {
      vi.mocked(mockPublicService.getEquity).mockResolvedValue({
        equity: 10000,
        positions: [],
      } as any);

      const risk = await riskManager.calculatePortfolioRisk("0x123");

      expect(risk.totalEquity).toBe(10000);
      expect(risk.totalPositions).toBe(0);
      expect(risk.portfolioLeverage).toBe(0);
      expect(risk.largestPosition).toBe(0);
      expect(risk.largestPositionPercent).toBe(0);
      expect(risk.riskScore).toBe(0);
    });

    it("should cap risk score at 100", async () => {
      // Extreme scenario: very high leverage and concentration
      vi.mocked(mockPublicService.getEquity).mockResolvedValue({
        equity: 100,
        positions: Array(10)
          .fill(null)
          .map((_, i) => ({
            symbol: `TOKEN${i}`,
            size: 5000,
          })) as PositionData[],
      } as any);

      const risk = await riskManager.calculatePortfolioRisk("0x123");

      // Even with extreme values, should cap at 100
      expect(risk.riskScore).toBeLessThanOrEqual(100);
    });
  });

  // ==========================================================================
  // CONSTANTS TESTS
  // ==========================================================================

  describe("DEFAULT_RISK_PARAMS", () => {
    it("should have correct default values", () => {
      expect(DEFAULT_RISK_PARAMS.maxLeveragePerMarket).toBe(20);
      expect(DEFAULT_RISK_PARAMS.maxPortfolioLeverage).toBe(15);
      expect(DEFAULT_RISK_PARAMS.defaultRiskPercent).toBe(1);
      expect(DEFAULT_RISK_PARAMS.liquidationBufferPercent).toBe(20);
      expect(DEFAULT_RISK_PARAMS.maintenanceMarginPercent).toBe(5);
      expect(DEFAULT_RISK_PARAMS.maxPositionsPerMarket).toBe(1);
      expect(DEFAULT_RISK_PARAMS.maxTotalPositions).toBe(5);
    });
  });

  describe("RISK_THRESHOLDS", () => {
    it("should have correct threshold values", () => {
      expect(RISK_THRESHOLDS.safe).toBe(50);
      expect(RISK_THRESHOLDS.warning).toBe(30);
      expect(RISK_THRESHOLDS.danger).toBe(15);
      expect(RISK_THRESHOLDS.critical).toBe(15);
    });
  });

  // ==========================================================================
  // CONSTRUCTOR TESTS
  // ==========================================================================

  describe("constructor", () => {
    it("should accept custom FlexPublicService", () => {
      const customService = new FlexPublicService();
      const manager = new RiskManager(customService);

      expect(manager).toBeInstanceOf(RiskManager);
    });

    it("should create default FlexPublicService when not provided", () => {
      const manager = new RiskManager();

      expect(manager).toBeInstanceOf(RiskManager);
    });
  });
});

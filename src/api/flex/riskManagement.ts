/**
 * Risk Management for Flex Perpetuals trading
 * Provides position sizing, leverage validation, and liquidation monitoring
 */

import { FlexPublicService, type PositionData } from "./flexPublicService.js";
import { MARKETS } from "./constants.js";
import { calculateLiquidationPrice } from "./utils.js";
import type {
  PositionSizingParams,
  PositionSizingResult,
  LiquidationRisk,
  OrderValidation,
} from "../../types/flex.js";

/**
 * Default risk management parameters
 */
export const DEFAULT_RISK_PARAMS = {
  maxLeveragePerMarket: 20, // Maximum leverage per position
  maxPortfolioLeverage: 15, // Maximum portfolio-wide leverage
  defaultRiskPercent: 1, // 1% of equity per trade
  liquidationBufferPercent: 20, // 20% buffer above maintenance margin
  maintenanceMarginPercent: 5, // 5% maintenance margin (typical)
  maxPositionsPerMarket: 1, // Max positions per market per subaccount
  maxTotalPositions: 5, // Max total positions across all markets
} as const;

/**
 * Risk level thresholds for liquidation monitoring
 */
export const RISK_THRESHOLDS = {
  safe: 50, // >50% distance to liquidation
  warning: 30, // 30-50% distance
  danger: 15, // 15-30% distance
  critical: 15, // <15% distance
} as const;

/**
 * RiskManager - Comprehensive risk management for trading
 */
export class RiskManager {
  private publicService: FlexPublicService;

  constructor(publicService?: FlexPublicService) {
    this.publicService = publicService || new FlexPublicService();
  }

  // ============================================================================
  // POSITION SIZING
  // ============================================================================

  /**
   * Calculate position size based on fixed-fraction risk model
   * Risk per trade = equity * riskPercentage
   * Position size = risk / (entryPrice - stopLossPrice) * entryPrice
   */
  calculatePositionSize(params: PositionSizingParams): PositionSizingResult {
    const {
      equity,
      riskPercentage,
      entryPrice,
      stopLossPrice,
      leverage = 1,
    } = params;

    if (equity <= 0) {
      throw new Error("Equity must be positive");
    }

    if (riskPercentage <= 0 || riskPercentage > 100) {
      throw new Error("Risk percentage must be between 0 and 100");
    }

    if (entryPrice <= 0 || stopLossPrice <= 0) {
      throw new Error("Prices must be positive");
    }

    // Calculate risk amount in USD
    const riskUsd = equity * (riskPercentage / 100);

    // Calculate stop loss distance
    const stopLossDistance = Math.abs(entryPrice - stopLossPrice);
    const stopLossPercentage = (stopLossDistance / entryPrice) * 100;

    if (stopLossDistance === 0) {
      throw new Error("Stop loss cannot equal entry price");
    }

    // Position size = riskUsd / stopLossDistance * entryPrice
    const positionSizeUsd = (riskUsd / stopLossDistance) * entryPrice;

    // Calculate quantity in base asset units
    const quantity = positionSizeUsd / entryPrice;

    // Calculate required margin
    const requiredMargin = positionSizeUsd / leverage;

    return {
      positionSizeUsd,
      quantity,
      riskUsd,
      requiredMargin,
      leverage,
      stopLossDistance,
      stopLossPercentage,
    };
  }

  /**
   * Calculate position size using Kelly Criterion
   * Kelly % = (Win Rate * Avg Win - Loss Rate * Avg Loss) / Avg Win
   * Conservative approach: use fractional Kelly (typically 25-50%)
   */
  calculateKellyPositionSize(
    equity: number,
    winRate: number,
    avgWin: number,
    avgLoss: number,
    kellyFraction: number = 0.25,
  ): number {
    if (winRate < 0 || winRate > 1) {
      throw new Error("Win rate must be between 0 and 1");
    }

    const lossRate = 1 - winRate;
    const kellyPercent = (winRate * avgWin - lossRate * avgLoss) / avgWin;

    // Apply fractional Kelly for safety
    const fractionalKelly = Math.max(
      0,
      Math.min(1, kellyPercent * kellyFraction),
    );

    return equity * fractionalKelly;
  }

  /**
   * Calculate volatility-adjusted position size
   * Higher volatility = smaller position size
   */
  calculateVolatilityAdjustedSize(
    basePositionSize: number,
    currentVolatility: number,
    targetVolatility: number,
  ): number {
    if (currentVolatility <= 0 || targetVolatility <= 0) {
      throw new Error("Volatility must be positive");
    }

    // Adjust position size inversely to volatility ratio
    const volatilityRatio = targetVolatility / currentVolatility;
    return basePositionSize * volatilityRatio;
  }

  // ============================================================================
  // LEVERAGE VALIDATION
  // ============================================================================

  /**
   * Validate leverage for a proposed position
   */
  validateLeverage(
    positionSizeUsd: number,
    availableMargin: number,
    marketIndex: number,
  ): {
    valid: boolean;
    leverage: number;
    maxLeverage: number;
    errors: string[];
  } {
    const errors: string[] = [];

    if (availableMargin <= 0) {
      errors.push("Available margin must be positive");
      return {
        valid: false,
        leverage: 0,
        maxLeverage: 0,
        errors,
      };
    }

    const leverage = positionSizeUsd / availableMargin;
    const maxLeverage = this.getMaxLeverageForMarket(marketIndex);

    if (leverage > maxLeverage) {
      errors.push(
        `Leverage ${leverage.toFixed(2)}x exceeds maximum ${maxLeverage}x for this market`,
      );
    }

    if (leverage > DEFAULT_RISK_PARAMS.maxPortfolioLeverage) {
      errors.push(
        `Leverage ${leverage.toFixed(2)}x exceeds portfolio maximum ${DEFAULT_RISK_PARAMS.maxPortfolioLeverage}x`,
      );
    }

    return {
      valid: errors.length === 0,
      leverage,
      maxLeverage,
      errors,
    };
  }

  /**
   * Get maximum leverage for a specific market
   */
  getMaxLeverageForMarket(marketIndex: number): number {
    // In production, this would query the market config
    // For now, return conservative defaults based on asset type
    const market = Object.values(MARKETS).find((m) => m.index === marketIndex);

    if (!market) {
      return DEFAULT_RISK_PARAMS.maxLeveragePerMarket;
    }

    // Major assets (BTC, ETH) get higher leverage
    if (["BTC", "ETH"].includes(market.symbol)) {
      return 30;
    }

    // Mid-cap assets
    if (["SOL", "LINK", "AVAX"].includes(market.symbol)) {
      return 20;
    }

    // Lower-cap/volatile assets
    return 10;
  }

  /**
   * Calculate current portfolio leverage
   */
  async calculatePortfolioLeverage(account: string): Promise<{
    totalPositionSize: number;
    totalEquity: number;
    leverage: number;
  }> {
    const equity = await this.publicService.getEquity(account);
    let totalPositionSize = 0;

    for (const position of equity.positions) {
      totalPositionSize += position.size;
    }

    const leverage =
      equity.equity > 0 ? totalPositionSize / equity.equity : 0;

    return {
      totalPositionSize,
      totalEquity: equity.equity,
      leverage,
    };
  }

  // ============================================================================
  // LIQUIDATION MONITORING
  // ============================================================================

  /**
   * Assess liquidation risk for a position
   */
  assessLiquidationRisk(
    position: PositionData,
    currentPrice: number,
    maintenanceMarginPercent: number = DEFAULT_RISK_PARAMS.maintenanceMarginPercent,
  ): LiquidationRisk {
    const { isLong, avgEntryPrice, size } = position;

    // Calculate liquidation price
    const leverage = size / (size / 10); // Simplified, would need actual margin
    const liquidationPrice = calculateLiquidationPrice(
      isLong,
      avgEntryPrice,
      leverage,
      maintenanceMarginPercent / 100,
    );

    // Calculate distance to liquidation
    const liquidationDistance = isLong
      ? ((currentPrice - liquidationPrice) / currentPrice) * 100
      : ((liquidationPrice - currentPrice) / currentPrice) * 100;

    // Calculate maintenance margin required
    const maintenanceMarginRequired = size * (maintenanceMarginPercent / 100);

    // Estimate current margin (would need actual equity data)
    const currentMargin = size / leverage;
    const marginBuffer =
      ((currentMargin - maintenanceMarginRequired) /
        maintenanceMarginRequired) *
      100;

    // Determine risk level
    let riskLevel: "safe" | "warning" | "danger" | "critical";
    if (liquidationDistance > RISK_THRESHOLDS.safe) {
      riskLevel = "safe";
    } else if (liquidationDistance > RISK_THRESHOLDS.warning) {
      riskLevel = "warning";
    } else if (liquidationDistance > RISK_THRESHOLDS.danger) {
      riskLevel = "danger";
    } else {
      riskLevel = "critical";
    }

    return {
      marketIndex: position.marketIndex,
      symbol: position.symbol,
      currentPrice,
      liquidationPrice,
      liquidationDistance,
      maintenanceMarginRequired,
      currentMargin,
      marginBuffer,
      riskLevel,
    };
  }

  /**
   * Monitor all positions for liquidation risk
   */
  async monitorLiquidationRisk(account: string): Promise<LiquidationRisk[]> {
    const risks: LiquidationRisk[] = [];
    const equity = await this.publicService.getEquity(account);

    for (const position of equity.positions) {
      const risk = this.assessLiquidationRisk(
        position,
        position.currentPrice,
      );
      risks.push(risk);
    }

    // Sort by risk level (most critical first)
    return risks.sort((a, b) => {
      const levels = { critical: 0, danger: 1, warning: 2, safe: 3 };
      return levels[a.riskLevel] - levels[b.riskLevel];
    });
  }

  // ============================================================================
  // PRE-TRADE VALIDATION
  // ============================================================================

  /**
   * Validate an order before execution
   */
  async validateOrder(
    account: string,
    marketIndex: number,
    sizeDelta: number,
    currentPrice: number,
  ): Promise<OrderValidation> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Get current equity and positions
    const equity = await this.publicService.getEquity(account);
    const leverageInfo = await this.publicService.getLeverage(account);

    const currentEquity = equity.equity;
    const currentLeverage = leverageInfo.leverage;

    // Check if equity is sufficient
    if (currentEquity <= 0) {
      errors.push("Insufficient equity");
      return this.createValidationResult(
        false,
        errors,
        warnings,
        currentEquity,
        currentLeverage,
      );
    }

    // Calculate post-trade state
    const orderSizeUsd = Math.abs(sizeDelta);
    const projectedPositionSize = leverageInfo.totalPositionSize + orderSizeUsd;
    const projectedLeverage = projectedPositionSize / currentEquity;
    const projectedMarginUsage = (projectedPositionSize / currentEquity) * 100;

    // Get max leverage for market
    const maxLeverage = this.getMaxLeverageForMarket(marketIndex);

    // Validate leverage
    if (projectedLeverage > maxLeverage) {
      errors.push(
        `Projected leverage ${projectedLeverage.toFixed(2)}x exceeds market maximum ${maxLeverage}x`,
      );
    }

    if (projectedLeverage > DEFAULT_RISK_PARAMS.maxPortfolioLeverage) {
      errors.push(
        `Projected leverage ${projectedLeverage.toFixed(2)}x exceeds portfolio maximum ${DEFAULT_RISK_PARAMS.maxPortfolioLeverage}x`,
      );
    }

    // Warning for high leverage
    if (projectedLeverage > maxLeverage * 0.8) {
      warnings.push(
        `Projected leverage ${projectedLeverage.toFixed(2)}x is high (${((projectedLeverage / maxLeverage) * 100).toFixed(0)}% of maximum)`,
      );
    }

    // Check position count limits
    if (equity.positions.length >= DEFAULT_RISK_PARAMS.maxTotalPositions) {
      errors.push(
        `Maximum position count (${DEFAULT_RISK_PARAMS.maxTotalPositions}) reached`,
      );
    }

    // Check if adding to existing position
    const existingPosition = equity.positions.find(
      (p) => p.marketIndex === marketIndex,
    );

    if (existingPosition && sizeDelta > 0 === existingPosition.isLong) {
      warnings.push(
        `Adding to existing ${existingPosition.isLong ? "long" : "short"} position of $${existingPosition.size.toFixed(2)}`,
      );
    }

    // Calculate available margin
    const availableMargin = Math.max(
      0,
      currentEquity * maxLeverage - leverageInfo.totalPositionSize,
    );

    // Check if order size exceeds available margin
    if (orderSizeUsd > availableMargin) {
      errors.push(
        `Order size $${orderSizeUsd.toFixed(2)} exceeds available margin $${availableMargin.toFixed(2)}`,
      );
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      currentEquity,
      currentLeverage,
      projectedEquity: currentEquity,
      projectedLeverage,
      projectedMarginUsage,
      maxLeverage,
      maxPositionSize: availableMargin,
      availableMargin,
    };
  }

  /**
   * Helper to create validation result
   */
  private createValidationResult(
    valid: boolean,
    errors: string[],
    warnings: string[],
    currentEquity: number,
    currentLeverage: number,
  ): OrderValidation {
    return {
      valid,
      errors,
      warnings,
      currentEquity,
      currentLeverage,
      projectedEquity: currentEquity,
      projectedLeverage: currentLeverage,
      projectedMarginUsage: 0,
      maxLeverage: 0,
      maxPositionSize: 0,
      availableMargin: 0,
    };
  }

  // ============================================================================
  // PORTFOLIO RISK METRICS
  // ============================================================================

  /**
   * Calculate portfolio-wide risk metrics
   */
  async calculatePortfolioRisk(account: string): Promise<{
    totalEquity: number;
    totalPositions: number;
    portfolioLeverage: number;
    largestPosition: number;
    largestPositionPercent: number;
    marketConcentration: Record<string, number>;
    riskScore: number; // 0-100, higher = riskier
  }> {
    const equity = await this.publicService.getEquity(account);
    let totalPositionSize = 0;
    let largestPosition = 0;
    const marketExposure: Record<string, number> = {};

    for (const position of equity.positions) {
      totalPositionSize += position.size;
      largestPosition = Math.max(largestPosition, position.size);
      marketExposure[position.symbol] =
        (marketExposure[position.symbol] || 0) + position.size;
    }

    const positionCount = equity.positions.length;
    const totalEquity = equity.equity;
    const portfolioLeverage =
      totalEquity > 0 ? totalPositionSize / totalEquity : 0;
    const largestPositionPercent =
      totalEquity > 0 ? (largestPosition / totalEquity) * 100 : 0;

    // Calculate market concentration (percentage of portfolio per market)
    const marketConcentration: Record<string, number> = {};
    for (const [market, exposure] of Object.entries(marketExposure)) {
      marketConcentration[market] =
        totalEquity > 0 ? (exposure / totalEquity) * 100 : 0;
    }

    // Calculate risk score (0-100)
    let riskScore = 0;
    riskScore += Math.min(50, portfolioLeverage * 2.5); // Leverage contributes up to 50 points
    riskScore += Math.min(25, largestPositionPercent / 2); // Concentration contributes up to 25 points
    riskScore += Math.min(25, positionCount * 2.5); // Position count contributes up to 25 points

    return {
      totalEquity,
      totalPositions: positionCount,
      portfolioLeverage,
      largestPosition,
      largestPositionPercent,
      marketConcentration,
      riskScore: Math.min(100, riskScore),
    };
  }
}

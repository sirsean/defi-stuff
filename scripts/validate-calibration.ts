#!/usr/bin/env tsx
/**
 * Validation script for confidence calibration system
 * 
 * This script validates that calibration improves backtest performance by:
 * 1. Computing calibration from historical recommendations
 * 2. Applying calibration retroactively to compute "calibrated" confidence scores
 * 3. Running backtest analysis on both raw and calibrated scores
 * 4. Comparing performance metrics
 * 
 * Usage:
 *   npm run validate:calibration -- --market BTC --days 60
 */

import { ConfidenceCalibrationService } from '../src/db/confidenceCalibrationService.js';
import { TradeBacktestService } from '../src/db/tradeBacktestService.js';
import type { CalibrationData } from '../src/types/confidence.js';

interface ValidationOptions {
  market: string;
  days?: number;
}

interface ValidationResult {
  market: string;
  windowDays: number;
  sampleSize: number;
  
  // Raw confidence metrics
  rawCorrelation: number;
  rawHighWinRate: number;
  rawLowWinRate: number;
  rawGap: number;
  
  // Calibrated confidence metrics  
  calibratedCorrelation: number;
  calibratedHighWinRate: number;
  calibratedLowWinRate: number;
  calibratedGap: number;
  
  // Improvements
  correlationImprovement: number;
  gapImprovement: number;
  
  // Pass/fail
  passes: boolean;
  issues: string[];
}

/**
 * Validate calibration on historical data
 */
async function validateCalibration(options: ValidationOptions): Promise<ValidationResult> {
  const market = options.market.toUpperCase();
  const days = options.days || 60;
  
  console.log('═'.repeat(80));
  console.log('  🔬 CALIBRATION VALIDATION');
  console.log('═'.repeat(80));
  console.log('');
  console.log(`Market: ${market}`);
  console.log(`Window: ${days} days`);
  console.log('');
  
  const calibrationService = new ConfidenceCalibrationService();
  
  try {
    // Step 1: Compute calibration
    console.log('Step 1: Computing calibration from historical data...');
    const calibration = await calibrationService.computeCalibration(market, days);
    console.log(`  ✓ Computed calibration from ${calibration.sampleSize} recommendations`);
    console.log('');
    
    // Step 2: Apply calibration retroactively
    console.log('Step 2: Applying calibration to historical recommendations...');
    const { rawMetrics, calibratedMetrics } = await applyCalibrationRetroactively(
      calibration,
      calibrationService,
    );
    console.log(`  ✓ Applied calibration to all historical data`);
    console.log('');
    
    // Step 3: Compare metrics
    console.log('Step 3: Comparing raw vs calibrated performance...');
    console.log('');
    
    const correlationImprovement = calibratedMetrics.correlation - rawMetrics.correlation;
    const gapImprovement = calibratedMetrics.gap - rawMetrics.gap;
    
    // Display comparison
    console.log('─'.repeat(80));
    console.log('📊 RAW CONFIDENCE (Before Calibration)');
    console.log('─'.repeat(80));
    console.log('');
    console.log(`  Correlation:           ${formatCorrelation(rawMetrics.correlation)}`);
    console.log(`  High Win Rate (≥0.7):  ${formatPercent(rawMetrics.highWinRate)}`);
    console.log(`  Low Win Rate (<0.7):   ${formatPercent(rawMetrics.lowWinRate)}`);
    console.log(`  Gap:                   ${formatPercent(rawMetrics.gap)} percentage points`);
    console.log('');
    
    console.log('─'.repeat(80));
    console.log('🎓 CALIBRATED CONFIDENCE (After Calibration)');
    console.log('─'.repeat(80));
    console.log('');
    console.log(`  Correlation:           ${formatCorrelation(calibratedMetrics.correlation)}`);
    console.log(`  High Win Rate (≥median): ${formatPercent(calibratedMetrics.highWinRate)}`);
    console.log(`  Low Win Rate (<median):  ${formatPercent(calibratedMetrics.lowWinRate)}`);
    console.log(`  Gap:                   ${formatPercent(calibratedMetrics.gap)} percentage points`);
    console.log('');
    console.log(`  Note: Using median calibrated confidence as threshold instead of 0.7`);
    console.log('');
    
    console.log('─'.repeat(80));
    console.log('📈 IMPROVEMENT ANALYSIS');
    console.log('─'.repeat(80));
    console.log('');
    console.log(`  Correlation Change:    ${correlationImprovement >= 0 ? '+' : ''}${correlationImprovement.toFixed(3)}`);
    console.log(`  Gap Change:            ${gapImprovement >= 0 ? '+' : ''}${formatPercent(gapImprovement)} percentage points`);
    console.log('');
    
    // Validation checks
    const issues: string[] = [];
    
    if (correlationImprovement < 0.05) {
      issues.push(`Correlation improvement (${correlationImprovement.toFixed(3)}) is below target (≥0.05)`);
    }
    
    if (calibratedMetrics.highWinRate <= calibratedMetrics.lowWinRate) {
      issues.push('Calibrated high confidence win rate not exceeding low confidence');
    }
    
    if (gapImprovement <= 0) {
      issues.push('Gap did not increase after calibration (should improve)');
    }
    
    const passes = issues.length === 0;
    
    console.log('─'.repeat(80));
    if (passes) {
      console.log('✅ VALIDATION PASSED');
      console.log('─'.repeat(80));
      console.log('');
      console.log('  Calibration successfully improves confidence score accuracy.');
      console.log('  Ready to proceed with Phase 6 (database schema update).');
    } else {
      console.log('⚠️  VALIDATION ISSUES DETECTED');
      console.log('─'.repeat(80));
      console.log('');
      issues.forEach((issue, i) => {
        console.log(`  ${i + 1}. ${issue}`);
      });
      console.log('');
      console.log('  Consider:');
      console.log('  - Adjusting the calibration window (--days parameter)');
      console.log('  - Collecting more historical data');
      console.log('  - Reviewing the LLM prompt (Phase 1)');
    }
    console.log('');
    console.log('═'.repeat(80));
    console.log('');
    
    return {
      market,
      windowDays: days,
      sampleSize: calibration.sampleSize,
      rawCorrelation: rawMetrics.correlation,
      rawHighWinRate: rawMetrics.highWinRate,
      rawLowWinRate: rawMetrics.lowWinRate,
      rawGap: rawMetrics.gap,
      calibratedCorrelation: calibratedMetrics.correlation,
      calibratedHighWinRate: calibratedMetrics.highWinRate,
      calibratedLowWinRate: calibratedMetrics.lowWinRate,
      calibratedGap: calibratedMetrics.gap,
      correlationImprovement,
      gapImprovement,
      passes,
      issues,
    };
  } finally {
    await calibrationService.close();
  }
}

/**
 * Apply calibration retroactively to historical data and compute metrics
 * 
 * This function performs a genuine retroactive analysis by:
 * 1. Fetching the same historical trade recommendations used to compute the calibration
 * 2. Computing trade outcomes (PnL) by comparing consecutive recommendation prices
 * 3. Calculating metrics (correlation, win rates) using ORIGINAL confidence scores
 * 4. Applying calibration to each recommendation's confidence score
 * 5. Recalculating metrics using CALIBRATED confidence scores
 * 6. Comparing the two to measure actual improvement
 */
async function applyCalibrationRetroactively(
  calibration: CalibrationData,
  service: ConfidenceCalibrationService,
): Promise<{
  rawMetrics: { correlation: number; highWinRate: number; lowWinRate: number; gap: number };
  calibratedMetrics: { correlation: number; highWinRate: number; lowWinRate: number; gap: number };
}> {
  // Get database connection from service
  // @ts-ignore - accessing private property for query access
  const db = service.db;
  
  if (!db) {
    throw new Error('Database connection not available');
  }
  
  // Calculate time window for querying recommendations
  const cutoffTimestamp = Date.now() - calibration.windowDays * 24 * 60 * 60 * 1000;
  
  // Fetch historical recommendations for the same market and time window
  const recommendations = await db('trade_recommendations')
    .where('market', calibration.market)
    .where('timestamp', '>=', cutoffTimestamp)
    .whereIn('action', ['long', 'short']) // Only directional trades
    .orderBy('timestamp', 'asc')
    .select('*');
  
  if (recommendations.length < 10) {
    throw new Error(
      `Insufficient historical data: need at least 10 trades, found ${recommendations.length}`,
    );
  }
  
  // Compute trade outcomes by pairing consecutive recommendations
  interface TradeOutcomeWithConfidence {
    rawConfidence: number;
    calibratedConfidence: number;
    pnlPercent: number;
    isWinner: boolean;
  }
  
  const outcomes: TradeOutcomeWithConfidence[] = [];
  
  for (let i = 0; i < recommendations.length - 1; i++) {
    const current = recommendations[i];
    const next = recommendations[i + 1];
    
    const entryPrice = Number(current.price);
    const exitPrice = Number(next.price);
    const rawConfidence = Number(current.confidence);
    
    // Calculate PnL based on trade direction
    let pnlPercent: number;
    if (current.action === 'long') {
      pnlPercent = ((exitPrice - entryPrice) / entryPrice) * 100;
    } else {
      // short
      pnlPercent = ((entryPrice - exitPrice) / entryPrice) * 100;
    }
    
    // Apply calibration to get calibrated confidence score
    const calibratedConfidence = service.applyCalibration(rawConfidence, calibration);
    
    outcomes.push({
      rawConfidence,
      calibratedConfidence,
      pnlPercent,
      isWinner: pnlPercent > 0,
    });
  }
  
  // Calculate metrics using RAW confidence scores
  const rawCorrelation = computeCorrelation(
    outcomes.map(o => o.rawConfidence),
    outcomes.map(o => o.pnlPercent),
  );
  
  const rawHighWinRate = computeWinRate(
    outcomes.filter(o => o.rawConfidence >= 0.7),
  );
  
  const rawLowWinRate = computeWinRate(
    outcomes.filter(o => o.rawConfidence < 0.7),
  );
  
  const rawGap = rawHighWinRate - rawLowWinRate;
  
  // Calculate metrics using CALIBRATED confidence scores
  // Use median as threshold instead of fixed 0.7, since calibrated scores are win rates (~0.5)
  const sortedCalibrated = [...outcomes.map(o => o.calibratedConfidence)].sort((a, b) => a - b);
  const medianCalibrated = sortedCalibrated[Math.floor(sortedCalibrated.length / 2)];
  
  const calibratedCorrelation = computeCorrelation(
    outcomes.map(o => o.calibratedConfidence),
    outcomes.map(o => o.pnlPercent),
  );
  
  const calibratedHighWinRate = computeWinRate(
    outcomes.filter(o => o.calibratedConfidence >= medianCalibrated),
  );
  
  const calibratedLowWinRate = computeWinRate(
    outcomes.filter(o => o.calibratedConfidence < medianCalibrated),
  );
  
  const calibratedGap = calibratedHighWinRate - calibratedLowWinRate;
  
  return {
    rawMetrics: {
      correlation: rawCorrelation,
      highWinRate: rawHighWinRate,
      lowWinRate: rawLowWinRate,
      gap: rawGap,
    },
    calibratedMetrics: {
      correlation: calibratedCorrelation,
      highWinRate: calibratedHighWinRate,
      lowWinRate: calibratedLowWinRate,
      gap: calibratedGap,
    },
  };
}

/**
 * Compute Pearson correlation between two arrays
 */
function computeCorrelation(x: number[], y: number[]): number {
  if (x.length !== y.length || x.length < 2) {
    return 0;
  }
  
  const n = x.length;
  const meanX = x.reduce((a, b) => a + b, 0) / n;
  const meanY = y.reduce((a, b) => a + b, 0) / n;
  
  let numerator = 0;
  let sumSqX = 0;
  let sumSqY = 0;
  
  for (let i = 0; i < n; i++) {
    const dX = x[i] - meanX;
    const dY = y[i] - meanY;
    
    numerator += dX * dY;
    sumSqX += dX * dX;
    sumSqY += dY * dY;
  }
  
  const denominator = Math.sqrt(sumSqX * sumSqY);
  return denominator === 0 ? 0 : numerator / denominator;
}

/**
 * Compute win rate for a set of outcomes
 */
function computeWinRate(outcomes: { isWinner: boolean }[]): number {
  if (outcomes.length === 0) {
    return 0;
  }
  
  const winners = outcomes.filter(o => o.isWinner).length;
  return winners / outcomes.length;
}

/**
 * Format correlation with sign
 */
function formatCorrelation(r: number): string {
  const sign = r >= 0 ? '+' : '';
  return `${sign}${r.toFixed(3)}`;
}

/**
 * Format percentage
 */
function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

/**
 * Main entry point
 */
async function main() {
  const args = process.argv.slice(2);
  
  // Parse arguments
  const marketIndex = args.indexOf('--market');
  const daysIndex = args.indexOf('--days');
  
  if (marketIndex === -1 || marketIndex === args.length - 1) {
    console.error('');
    console.error('❌ Error: --market parameter is required');
    console.error('');
    console.error('Usage: npm run validate:calibration -- --market <MARKET> [--days <DAYS>]');
    console.error('');
    console.error('Examples:');
    console.error('  npm run validate:calibration -- --market BTC');
    console.error('  npm run validate:calibration -- --market ETH --days 90');
    console.error('');
    process.exit(1);
  }
  
  const market = args[marketIndex + 1];
  const days = daysIndex !== -1 && daysIndex < args.length - 1
    ? parseInt(args[daysIndex + 1], 10)
    : 60;
  
  try {
    const result = await validateCalibration({ market, days });
    
    // Exit with appropriate code
    process.exit(result.passes ? 0 : 1);
  } catch (error: any) {
    console.error('');
    console.error('❌ Validation failed:', error.message);
    console.error('');
    
    if (error.message.includes('Insufficient data')) {
      console.error('💡 Hints:');
      console.error('   - Need at least 10 directional trades (long/short) in the analysis window');
      console.error('   - Run: npm run dev -- trade:recommend -m ' + market.toUpperCase() + ' --db');
      console.error('   - Wait to accumulate more recommendations over time');
      console.error('   - Try a longer time window: --days 90');
      console.error('');
    }
    
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { validateCalibration, ValidationResult };

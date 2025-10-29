import { ConfidenceCalibrationService } from '../db/confidenceCalibrationService.js';
import type { CalibrationData } from '../types/confidence.js';

interface StatusOptions {
  market?: string;
}

interface MarketStatus {
  market: string;
  hasCalibration: boolean;
  ageDays: number | null;
  sampleSize: number | null;
  correlation: number | null;
  highConfWinRate: number | null;
  lowConfWinRate: number | null;
  winRateGap: number | null;
  healthStatus: 'HEALTHY' | 'WARNING' | 'NEEDS_RECALIBRATION' | 'MISSING';
  statusEmoji: string;
  recommendation: string;
}

export async function confidenceStatus(options: StatusOptions): Promise<void> {
  const calibrationService = new ConfidenceCalibrationService();

  try {
    // Determine which markets to check
    const markets = options.market ? [options.market] : ['BTC', 'ETH'];
    
    // Fetch status for each market
    const statuses: MarketStatus[] = [];
    for (const market of markets) {
      const status = await getMarketStatus(calibrationService, market);
      statuses.push(status);
    }

    // Display results
    displayStatusReport(statuses, options.market !== undefined);
  } catch (error) {
    console.error('Error checking confidence status:', error);
    throw error;
  }
}

async function getMarketStatus(
  service: ConfidenceCalibrationService,
  market: string
): Promise<MarketStatus> {
  const calibration = await service.getLatestCalibration(market);

  if (!calibration) {
    return {
      market,
      hasCalibration: false,
      ageDays: null,
      sampleSize: null,
      correlation: null,
      highConfWinRate: null,
      lowConfWinRate: null,
      winRateGap: null,
      healthStatus: 'MISSING',
      statusEmoji: '❌',
      recommendation: `Run: npm run dev -- confidence:calibrate -m ${market}`,
    };
  }

  // Get timestamp from database record
  const timestamp = await service.getLatestCalibrationTimestamp(market);
  if (!timestamp) {
    // Shouldn't happen if calibration exists, but handle gracefully
    return {
      market,
      hasCalibration: false,
      ageDays: null,
      sampleSize: null,
      correlation: null,
      highConfWinRate: null,
      lowConfWinRate: null,
      winRateGap: null,
      healthStatus: 'MISSING',
      statusEmoji: '❌',
      recommendation: `Run: npm run dev -- confidence:calibrate -m ${market}`,
    };
  }

  // Calculate age in days
  const now = new Date();
  const calibrationDate = new Date(timestamp);
  const ageDays = Math.floor((now.getTime() - calibrationDate.getTime()) / (1000 * 60 * 60 * 24));

  // Calculate win rate gap
  const winRateGap = calibration.highConfWinRate - calibration.lowConfWinRate;

  // Determine health status and recommendation
  const { healthStatus, statusEmoji, recommendation } = evaluateHealth(
    calibration.correlation,
    ageDays,
    market
  );

  return {
    market,
    hasCalibration: true,
    ageDays,
    sampleSize: calibration.sampleSize,
    correlation: calibration.correlation,
    highConfWinRate: calibration.highConfWinRate,
    lowConfWinRate: calibration.lowConfWinRate,
    winRateGap,
    healthStatus,
    statusEmoji,
    recommendation,
  };
}

function evaluateHealth(
  correlation: number,
  ageDays: number,
  market: string
): { healthStatus: MarketStatus['healthStatus']; statusEmoji: string; recommendation: string } {
  // Check for NEEDS_RECALIBRATION (worst case first)
  if (correlation < 0.1 || ageDays > 14) {
    return {
      healthStatus: 'NEEDS_RECALIBRATION',
      statusEmoji: '❌',
      recommendation: `Recalibrate now: npm run dev -- confidence:calibrate -m ${market}`,
    };
  }

  // Check for WARNING (medium priority)
  if ((correlation >= 0.1 && correlation <= 0.2) || (ageDays >= 7 && ageDays <= 14)) {
    return {
      healthStatus: 'WARNING',
      statusEmoji: '⚠️',
      recommendation: `Consider recalibrating soon: npm run dev -- confidence:calibrate -m ${market}`,
    };
  }

  // HEALTHY (best case)
  return {
    healthStatus: 'HEALTHY',
    statusEmoji: '✅',
    recommendation: 'Calibration is in good health',
  };
}

function displayStatusReport(statuses: MarketStatus[], singleMarket: boolean): void {
  const title = singleMarket
    ? '📊 CONFIDENCE CALIBRATION STATUS'
    : '📊 CONFIDENCE CALIBRATION STATUS - ALL MARKETS';

  console.log('═'.repeat(79));
  console.log(`  ${title}`);
  console.log('═'.repeat(79));
  console.log();

  for (const status of statuses) {
    displayMarketStatus(status);
    if (statuses.length > 1) {
      console.log('─'.repeat(79));
    }
  }

  console.log('═'.repeat(79));
  console.log();

  // Summary
  const healthyCnt = statuses.filter((s) => s.healthStatus === 'HEALTHY').length;
  const warningCnt = statuses.filter((s) => s.healthStatus === 'WARNING').length;
  const needsRecalCnt = statuses.filter((s) => s.healthStatus === 'NEEDS_RECALIBRATION').length;
  const missingCnt = statuses.filter((s) => s.healthStatus === 'MISSING').length;

  console.log('📈 SUMMARY');
  console.log();
  console.log(`  ✅ Healthy:              ${healthyCnt}`);
  console.log(`  ⚠️  Warning:              ${warningCnt}`);
  console.log(`  ❌ Needs Recalibration:  ${needsRecalCnt}`);
  console.log(`  ❌ Missing Calibration:  ${missingCnt}`);
  console.log();

  // Overall recommendation
  if (needsRecalCnt > 0 || missingCnt > 0) {
    console.log('💡 ACTION REQUIRED');
    console.log();
    console.log('  Run calibration for markets marked with ❌');
    console.log();
  } else if (warningCnt > 0) {
    console.log('💡 RECOMMENDATION');
    console.log();
    console.log('  Consider recalibrating markets marked with ⚠️  soon');
    console.log();
  } else {
    console.log('💡 STATUS');
    console.log();
    console.log('  All calibrations are healthy ✅');
    console.log();
  }

  console.log('═'.repeat(79));
}

function displayMarketStatus(status: MarketStatus): void {
  console.log(`${status.statusEmoji} ${status.market}`);
  console.log();

  if (!status.hasCalibration) {
    console.log('  Status:           MISSING CALIBRATION');
    console.log();
    console.log(`  Recommendation:   ${status.recommendation}`);
    console.log();
    return;
  }

  // Health status
  console.log(`  Health Status:    ${status.healthStatus}`);
  console.log();

  // Calibration metrics
  console.log('  Calibration Age:  ' + formatAge(status.ageDays!));
  console.log(`  Sample Size:      ${status.sampleSize}`);
  console.log();

  // Performance metrics
  console.log('  Correlation (r):  ' + formatCorrelation(status.correlation!));
  
  if (status.highConfWinRate !== null && status.lowConfWinRate !== null) {
    console.log();
    console.log('  Win Rates:');
    console.log(`    High Conf (≥0.7):  ${formatPercent(status.highConfWinRate)}`);
    console.log(`    Low Conf (<0.7):   ${formatPercent(status.lowConfWinRate)}`);
    console.log(`    Gap:               ${formatGap(status.winRateGap!)}`);
  }

  console.log();

  // Interpretation
  displayInterpretation(status);

  // Recommendation
  console.log(`  Recommendation:   ${status.recommendation}`);
  console.log();
}

function displayInterpretation(status: MarketStatus): void {
  const r = status.correlation!;
  const age = status.ageDays!;

  let interpretation = '';

  // Correlation interpretation
  if (r >= 0.3) {
    interpretation = 'Strong predictive power.';
  } else if (r >= 0.2) {
    interpretation = 'Moderate predictive power.';
  } else if (r >= 0.1) {
    interpretation = 'Weak predictive power.';
  } else if (r >= 0.0) {
    interpretation = 'Very weak predictive power.';
  } else {
    interpretation = 'Anti-predictive (inverted).';
  }

  // Age consideration
  if (age > 14) {
    interpretation += ' Calibration is stale.';
  } else if (age > 7) {
    interpretation += ' Calibration aging.';
  } else {
    interpretation += ' Calibration is fresh.';
  }

  console.log(`  Interpretation:   ${interpretation}`);
  console.log();
}

function formatAge(days: number): string {
  if (days === 0) {
    return 'Today';
  } else if (days === 1) {
    return '1 day ago';
  } else {
    return `${days} days ago`;
  }
}

function formatCorrelation(r: number): string {
  const sign = r >= 0 ? '+' : '';
  return `${sign}${r.toFixed(3)}`;
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function formatGap(gap: number): string {
  const sign = gap >= 0 ? '+' : '';
  return `${sign}${(gap * 100).toFixed(1)} pp`;
}

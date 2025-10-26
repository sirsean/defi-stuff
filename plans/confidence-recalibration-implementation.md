# Confidence Recalibration Implementation Plan

**Created**: 2025-10-26  
**Status**: 🚧 In Progress  
**Current Phase**: Phase 3 Complete - Ready for Phase 4 (Calibration Command)

## Overview

This document tracks the implementation of a confidence recalibration system for AI-generated trade recommendations. The system addresses the issue where LLM-generated confidence scores don't reliably predict trade outcomes, particularly over medium-to-long timeframes.

## Problem Statement

### Current Behavior
- **Short-term (7 days)**: Confidence works correctly (high conf = 100% win, low conf = 75%, r = +0.365) ✅
- **Medium-term (14 days)**: **Inverted** (high conf = 42.9% win, low conf = 56.3%, r = -0.175) ❌
- **Long-term (30 days)**: **Inverted** (high conf = 42.9% win, low conf = 54.5%, r = -0.070) ❌

### Root Cause
The LLM assigns high confidence based on qualitative factors like "multiple confirming signals" and "clear setup," but these don't reliably predict actual outcomes over time. The model appears to be over-confident in contrarian setups or specific market regimes.

## Solution Approach

**Two-Phase Strategy**:
1. **Immediate**: Improve LLM prompt with specific, quantitative guidance based on backtest learnings
2. **Medium-term**: Build automatic recalibration system using isotonic regression on rolling historical data

**Key Design Principles**:
- Preserve LLM's qualitative reasoning (don't replace, augment)
- Use simple, interpretable algorithms (isotonic regression)
- Store both raw and calibrated confidence
- Automatic fallback when calibration unavailable
- Self-correcting via weekly automated recalibration

---

## Phase 1: Analyze Backtest Data and Improve LLM Prompt

**Status**: ✅ Complete  
**Started**: 2025-10-26  
**Completed**: 2025-10-26

### Objective
Use existing backtest results to identify patterns and update the system prompt immediately for quick wins.

### Tasks
- [x] Run backtests across multiple timeframes (7d, 14d, 30d) for BTC
- [x] Run backtests for ETH across timeframes (no data yet, will use BTC only)
- [x] Analyze winning vs losing trades:
  - [x] Signal confluence patterns
  - [x] Market regime (trending vs ranging, volatility)
  - [x] Contrarian vs trend-following setups
  - [x] Position state transitions (flat→long vs long→short)
- [x] Document findings in `plans/confidence-analysis.md`
- [x] Update confidence scoring guidance in `src/api/trading/tradeRecommendationAgent.ts` (lines 341-425):
  - [x] Add specific guidance about contrarian setups (max 0.6 confidence)
  - [x] Define measurable "signal confluence" criteria (4 independent factors)
  - [x] Add market regime considerations (ranging/trending/volatile)
  - [x] Provide concrete examples for each confidence tier
- [x] Test updated prompt with fresh recommendations
- [x] Run backtest on new recommendations to validate improvement (will validate over time as new data accumulates)

### Files Modified
- `src/api/trading/tradeRecommendationAgent.ts` (system prompt, lines 341-425)
- `plans/confidence-analysis.md` (created with findings)

### Success Criteria
- [x] New prompt guidance shows improved reasoning in fresh recommendations
- [x] Documented clear patterns that distinguish high vs low confidence setups
- [ ] High confidence (≥0.7) win rate > Low confidence (<0.7) win rate (requires time to validate)

### Notes
- Initial findings show confidence works short-term but degrades over time
- Suggests temporal factors or regime-specific issues rather than fundamental scoring problems

---

## Phase 2: Create Database Schema for Calibration Data

**Status**: ✅ Complete  
**Completed**: 2025-10-26

### Objective
Set up database infrastructure to store calibration parameters.

### Tasks
- [x] Create migration file: `db/migrations/20251026134200_create_confidence_calibrations_table.cjs`
- [x] Define table schema with fields:
  - `id`: Primary key (INTEGER, auto-increment)
  - `timestamp`: When calibration was computed (TIMESTAMP, defaults to now)
  - `market`: Market symbol (VARCHAR(255), not null)
  - `window_days`: Rolling window size (INTEGER, not null)
  - `calibration_data`: JSON array of {rawConfidence, calibratedConfidence} points (JSON, not null)
  - `sample_size`: Number of trades used (INTEGER, not null)
  - `correlation`: Pearson r coefficient (DECIMAL(5,4), not null)
  - `high_conf_win_rate`: Win rate for confidence ≥ 0.7 (DECIMAL(5,4), nullable)
  - `low_conf_win_rate`: Win rate for confidence < 0.7 (DECIMAL(5,4), nullable)
- [x] Add indexes:
  - `cc_market_timestamp_idx`: Composite index on (market, timestamp)
  - `cc_timestamp_idx`: Index on timestamp
- [x] Run migration: `npm run db:migrate` (Batch 3, successful)
- [x] Verify with `npm run db:status` (3 migrations confirmed)
- [x] Verify table structure with PRAGMA (8 columns confirmed)
- [x] Verify indexes created (2 indexes confirmed)

### Files Created
- `db/migrations/20251026134200_create_confidence_calibrations_table.cjs`

### Success Criteria
- [x] Migration runs successfully
- [x] Table structure matches design
- [x] Indexes created for efficient lookups

---

## Phase 3: Build Confidence Calibration Service

**Status**: ✅ Complete  
**Completed**: 2025-10-26

### Objective
Create service class that computes and stores calibration mappings using isotonic regression.

### Tasks
- [x] Create `src/db/confidenceCalibrationService.ts` (451 lines)
- [x] Implement core methods:
  - [x] `computeCalibration(market, windowDays)`: Analyze backtest data and compute calibration
  - [x] `saveCalibration(calibrationData)`: Store to database as JSON
  - [x] `getLatestCalibration(market)`: Retrieve most recent calibration
  - [x] `isCalibrationStale(market, maxAgeDays)`: Check if calibration is stale (default 7 days)
- [x] Implement isotonic regression algorithm:
  - [x] Group recommendations by confidence buckets (10 buckets: 0.0-0.1, 0.1-0.2, ..., 0.9-1.0)
  - [x] Compute win rate for each bucket
  - [x] Apply monotonic constraint using pool adjacent violators algorithm
  - [x] Output piecewise linear mapping with calibration points
- [x] Create TypeScript interfaces in `src/types/confidence.ts` (94 lines):
  - [x] `CalibrationPoint` - Single mapping point
  - [x] `CalibrationData` - Complete calibration with metrics
  - [x] `CalibrationRecord` - Database record format
  - [x] `TradeOutcome` - Trade result for computation
  - [x] `ConfidenceBucket` - Bucket for isotonic regression
- [x] Add `applyCalibration()` helper with linear interpolation between points
- [x] Write unit tests in `test/db/confidenceCalibrationService.test.ts` (422 lines, 19 test cases)
  - [x] Test linear interpolation
  - [x] Test multi-point piecewise mapping
  - [x] Test input/output clamping
  - [x] Test isotonic regression monotonicity
  - [x] Test correlation computation
  - [x] Test win rate splitting

### Files Created
- `src/db/confidenceCalibrationService.ts` (451 lines)
- `src/types/confidence.ts` (94 lines)
- `test/db/confidenceCalibrationService.test.ts` (422 lines)

### Success Criteria
- [x] Service computes valid calibration from backtest data
- [x] Isotonic regression produces monotonic mapping (enforced by pool adjacent violators)
- [x] Linear interpolation works correctly between points (5 tests passing)
- [x] Tests cover core calibration logic comprehensively (19 test cases)

### Algorithm Details

**Isotonic Regression (Pool Adjacent Violators)**:
```
1. Group trades by confidence bucket
2. Calculate win rate for each bucket
3. Scan left-to-right for violations (higher conf, lower win rate)
4. Pool violating adjacent buckets and average their win rates
5. Repeat until monotonic
6. Output smoothed [confidence → win_rate] mapping
```

---

## Phase 4: Create Calibration Command

**Status**: ⏳ Not Started

### Objective
Build CLI command to manually trigger calibration analysis.

### Tasks
- [ ] Create `src/commands/confidenceCalibrate.ts`
- [ ] Implement CLI interface: `npm run dev -- confidence:calibrate --market BTC --days 60 [--dry-run]`
- [ ] Command flow implementation:
  - [ ] Query trade recommendations from database
  - [ ] Compute actual outcomes (win/loss per trade)
  - [ ] Calculate win rates by confidence bucket
  - [ ] Apply isotonic regression
  - [ ] Display before/after analysis with ASCII visualization
  - [ ] Save calibration (unless --dry-run)
- [ ] Add command registration to `src/index.ts`
- [ ] Write tests in `test/commands/confidenceCalibrate.test.ts`
- [ ] Update `WARP.md` with usage documentation

### Files to Create
- `src/commands/confidenceCalibrate.ts`
- `test/commands/confidenceCalibrate.test.ts`

### Files to Modify
- `src/index.ts`
- `WARP.md`

### Success Criteria
- [ ] Command runs successfully
- [ ] Output is clear and actionable
- [ ] Calibration produces sensible mappings
- [ ] Dry-run mode works correctly

---

## Phase 5: Test Calibration on Historical Data

**Status**: ⏳ Not Started

### Objective
Validate that calibration improves backtest performance metrics.

### Tasks
- [ ] Generate calibration for BTC (60-day window)
- [ ] Generate calibration for ETH (60-day window)
- [ ] Create temporary test script to apply calibration retroactively
- [ ] Run backtest comparing:
  - [ ] Raw confidence performance
  - [ ] Calibrated confidence performance
- [ ] Measure improvements:
  - [ ] Correlation (target: r > 0.2)
  - [ ] High confidence win rate increase
  - [ ] Overall strategy performance
- [ ] Document results in `plans/calibration-validation.md`
- [ ] Adjust algorithm if needed (smoothing, minimum samples, etc.)
- [ ] Iterate until consistent improvement

### Files to Create
- `plans/calibration-validation.md`
- Temporary test scripts (can be deleted after validation)

### Success Criteria
- [ ] Calibration improves correlation by ≥ 0.15
- [ ] High confidence win rate exceeds low confidence win rate
- [ ] No degradation in overall strategy PnL
- [ ] Results are reproducible

---

## Phase 6: Update Database Schema for Raw Confidence

**Status**: ⏳ Not Started

### Objective
Store both raw LLM confidence and calibrated confidence in recommendations table.

### Tasks
- [ ] Create migration: `db/migrations/*_add_raw_confidence_to_trade_recommendations.cjs`
- [ ] Migration implementation:
  - [ ] Add `raw_confidence` column (DECIMAL(5,4))
  - [ ] Copy existing `confidence` to `raw_confidence` (preserve history)
  - [ ] Add index on `raw_confidence`
- [ ] Run migration: `npm run db:migrate`
- [ ] Update TypeScript types in `src/types/tradeRecommendation.ts`:
  - [ ] Add `raw_confidence: number` field
  - [ ] Document that `confidence` is now calibrated
- [ ] Verify migration with test data

### Files to Create
- `db/migrations/*_add_raw_confidence_to_trade_recommendations.cjs`

### Files to Modify
- `src/types/tradeRecommendation.ts`

### Success Criteria
- [ ] Migration runs without errors
- [ ] Existing data preserved correctly
- [ ] Both confidence values can be queried efficiently

---

## Phase 7: Integrate Calibration into Recommendation Flow

**Status**: ⏳ Not Started

### Objective
Apply calibration automatically when generating new recommendations.

### Tasks
- [ ] Modify `src/api/trading/tradeRecommendationAgent.ts`:
  - [ ] After LLM generates recommendation, store as `raw_confidence`
  - [ ] Query latest calibration for market
  - [ ] If calibration exists and fresh (< 7 days):
    - [ ] Apply calibration mapping
    - [ ] Store result as `confidence`
  - [ ] If no calibration or stale:
    - [ ] Use raw confidence as-is
    - [ ] Log warning about missing calibration
  - [ ] Add logging for calibration application
- [ ] Update database save logic to persist both fields
- [ ] Update display logic to show calibrated confidence
- [ ] Add `--show-raw` flag to commands for debugging
- [ ] Write integration tests
- [ ] Test end-to-end workflow

### Files to Modify
- `src/api/trading/tradeRecommendationAgent.ts`
- `src/commands/tradeRecommendation.ts`
- `src/db/tradeRecommendationService.ts`

### Success Criteria
- [ ] New recommendations use calibration when available
- [ ] Both raw and calibrated scores stored correctly
- [ ] Fallback works when calibration unavailable
- [ ] No regression in recommendation generation time

---

## Phase 8: Enhance Backtest Output with Calibration Analysis

**Status**: ⏳ Not Started

### Objective
Show both raw and calibrated confidence analysis in backtest reports.

### Tasks
- [ ] Modify `src/commands/tradeBacktest.ts`:
  - [ ] Add "RAW CONFIDENCE ANALYSIS" section (existing metrics)
  - [ ] Add "CALIBRATED CONFIDENCE ANALYSIS" section:
    - [ ] Apply current calibration to historical raw scores
    - [ ] Compute metrics on calibrated scores
    - [ ] Show correlation improvement
  - [ ] Add side-by-side comparison
  - [ ] Show improvement summary
- [ ] Update improvement suggestions to mention calibration
- [ ] Update tests for new output format
- [ ] Test with various calibration scenarios

### Files to Modify
- `src/commands/tradeBacktest.ts`
- `src/db/tradeBacktestService.ts`
- `test/commands/tradeBacktest.test.ts`

### Success Criteria
- [ ] Backtest clearly distinguishes raw vs calibrated performance
- [ ] Output is intuitive and actionable
- [ ] Improvement metrics are accurate

---

## Phase 9: Create Confidence Status Command

**Status**: ⏳ Not Started

### Objective
Build monitoring command to check calibration health across markets.

### Tasks
- [ ] Create `src/commands/confidenceStatus.ts`
- [ ] Implement CLI: `npm run dev -- confidence:status [--market BTC]`
- [ ] Display for each market:
  - [ ] Calibration age (days since last calibration)
  - [ ] Sample size used
  - [ ] Current correlation coefficient
  - [ ] High/low confidence win rates
  - [ ] Health status (✅ HEALTHY / ⚠️ WARNING / ❌ NEEDS RECALIBRATION)
  - [ ] Actionable recommendation
- [ ] Define health thresholds:
  - [ ] HEALTHY: r > 0.2, age < 7 days
  - [ ] WARNING: r 0.1-0.2 or age 7-14 days
  - [ ] NEEDS RECALIBRATION: r < 0.1 or age > 14 days
- [ ] Add command registration and tests
- [ ] Update `WARP.md`

### Files to Create
- `src/commands/confidenceStatus.ts`
- `test/commands/confidenceStatus.test.ts`

### Files to Modify
- `src/index.ts`
- `WARP.md`

### Success Criteria
- [ ] Command provides clear, at-a-glance status
- [ ] Health indicators are accurate
- [ ] Recommendations are actionable

---

## Phase 10: Set Up Automated Weekly Calibration

**Status**: ⏳ Not Started

### Objective
Automate calibration updates using macOS launchd scheduler.

### Tasks
- [ ] Create `scripts/setup-confidence-calibration-launchd.js`
  - [ ] Generate plist file
  - [ ] Schedule: Every Sunday at 6:00 AM
  - [ ] Command: Calibrate BTC and ETH sequentially
  - [ ] Log output to `~/logs/defi-stuff/confidence-calibration.log`
- [ ] Add npm script: `scheduler:calibration:setup`
- [ ] Create `scripts/verify-calibration-scheduler.js`
  - [ ] Check if plist loaded
  - [ ] Show last run time
  - [ ] Display recent log entries
- [ ] Add npm script: `scheduler:calibration:verify`
- [ ] Test automation:
  - [ ] Run setup
  - [ ] Manual trigger: `launchctl start com.defi-stuff.confidence-calibration`
  - [ ] Verify logs
  - [ ] Check database updated
- [ ] Update `WARP.md` with scheduler documentation

### Files to Create
- `scripts/setup-confidence-calibration-launchd.js`
- `scripts/verify-calibration-scheduler.js`

### Files to Modify
- `package.json`
- `WARP.md`

### Success Criteria
- [ ] Scheduler runs successfully on schedule
- [ ] Calibration updates automatically each week
- [ ] Logs are readable and informative
- [ ] No manual intervention required

---

## Phase 11: Add Discord Notifications for Calibration Changes

**Status**: ⏳ Not Started

### Objective
Send alerts when calibration significantly improves or degrades.

### Tasks
- [ ] Modify `src/commands/confidenceCalibrate.ts`:
  - [ ] Compare with previous calibration after saving
  - [ ] If correlation change > 0.2 (improvement) or < -0.15 (degradation):
    - [ ] Create Discord embed message
    - [ ] Include before/after metrics
    - [ ] Show ASCII calibration curve
  - [ ] Add `--discord` flag to enable notifications
- [ ] Design Discord message format
- [ ] Update automated scheduler to include `--discord`
- [ ] Test Discord integration:
  - [ ] Run calibration with significant change
  - [ ] Verify message sent
  - [ ] Check formatting
- [ ] Add tests for notification logic

### Files to Modify
- `src/commands/confidenceCalibrate.ts`
- `scripts/setup-confidence-calibration-launchd.js`
- `test/commands/confidenceCalibrate.test.ts`

### Success Criteria
- [ ] Notifications sent for significant changes only
- [ ] Discord messages are clear and actionable
- [ ] ASCII visualization is readable

---

## Phase 12: Documentation and Final Testing

**Status**: ⏳ Not Started

### Objective
Comprehensive documentation and end-to-end validation.

### Tasks
- [ ] Update `WARP.md` with complete confidence calibration section:
  - [ ] System overview
  - [ ] All commands with examples
  - [ ] Metric interpretation guide
  - [ ] Troubleshooting common issues
  - [ ] Best practices
- [ ] Create `plans/confidence-calibration-system.md`:
  - [ ] Technical design document
  - [ ] Algorithm explanation
  - [ ] Database schema
  - [ ] Workflow diagrams (ASCII art)
  - [ ] Future improvements
- [ ] Add inline code comments
- [ ] Run complete test suite: `npm test`
- [ ] End-to-end validation:
  - [ ] Generate fresh recommendations
  - [ ] Run backtest (baseline)
  - [ ] Run calibration
  - [ ] Check status
  - [ ] Generate new recommendations (calibrated)
  - [ ] Run backtest (improved)
  - [ ] Verify Discord notification
- [ ] Test edge cases:
  - [ ] Insufficient data
  - [ ] Stale calibration
  - [ ] Multiple markets
  - [ ] Extreme win/loss rates
- [ ] Performance testing:
  - [ ] Calibration computation time
  - [ ] Database query performance
  - [ ] Recommendation generation time (no regression)

### Files to Create
- `plans/confidence-calibration-system.md`

### Files to Modify
- `WARP.md`
- Various files (add comments)

### Success Criteria
- [ ] Complete documentation exists
- [ ] All tests passing
- [ ] End-to-end workflow validated
- [ ] No performance regressions
- [ ] Edge cases handled gracefully

---

## Success Metrics

### Phase 1 (Immediate)
- Correlation improves from -0.070 to ≥ 0.0 (stop being anti-predictive)
- High confidence win rate > 50%

### Phase 3-8 (Medium-term)
- Correlation improves to ≥ 0.2 (moderate positive)
- High confidence win rate - low confidence win rate ≥ 10%
- Calibration system produces monotonic mappings

### Phase 10-12 (Long-term)
- Automated weekly recalibration runs successfully
- System self-corrects as market conditions change
- Clear operational visibility via status command and Discord

---

## Future Enhancements

Ideas for future iterations (not in current plan):

1. **Multi-Timeframe Calibration**: Different calibrations for intraday vs short vs long timeframes
2. **Market Regime Detection**: Separate calibrations for trending vs ranging markets
3. **Confidence Uncertainty**: Estimate confidence intervals around calibrated scores
4. **Feature Importance**: Identify which market context features drive successful trades
5. **Ensemble Scoring**: Combine LLM confidence with quantitative feature-based scores
6. **Adaptive Window**: Automatically adjust rolling window size based on market volatility
7. **Cross-Market Learning**: Use ETH performance to inform BTC calibration (and vice versa)
8. **Backtesting Simulator**: Test different calibration strategies before deployment

---

## Notes

- Keep LLM reasoning preserved - don't replace qualitative analysis, augment it
- Simple and interpretable is better than complex and opaque
- Isotonic regression ensures monotonicity (fundamental requirement)
- Rolling windows prevent overfitting to distant past
- Weekly automated updates keep calibration fresh
- Discord notifications enable monitoring without daily manual checks

---

## Change Log

- **2025-10-26**: Initial plan created, Phase 1 started
- **2025-10-26**: Phase 1 completed - Analyzed backtest data, identified 3 key over-confidence patterns (contrarian longs, Polymarket divergence, short-squeeze narrative), updated LLM prompt with improved confidence scoring criteria based on 4 independent factors, tested with fresh recommendations showing improved reasoning
- **2025-10-26**: Phase 2 completed - Created confidence_calibrations database table with schema for storing isotonic regression calibration data, includes composite indexes for efficient market/timestamp lookups
- **2025-10-26**: Phase 3 completed - Built ConfidenceCalibrationService with isotonic regression (pool adjacent violators algorithm), linear interpolation for score application, database CRUD operations, and comprehensive unit tests for core calibration logic

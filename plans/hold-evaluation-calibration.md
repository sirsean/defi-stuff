# HOLD Evaluation in Confidence Calibration

## Problem Statement

The current confidence calibration system only evaluates LONG and SHORT predictions, completely ignoring HOLD recommendations. This creates a critical blind spot:

- ✅ **Correct LONG/SHORT**: System learns to trust similar confidence levels
- ✅ **Incorrect LONG/SHORT**: System learns to distrust those confidence levels  
- ❌ **HOLD when should have opened position**: **NO LEARNING HAPPENS**

This means the system **never learns to be more aggressive** when it should be opening positions instead of holding.

## Current Implementation

In `src/db/confidenceCalibrationService.ts`, line 61:

```typescript
.where("action", "in", ["long", "short"]) // Only directional trades
```

HOLD recommendations are explicitly filtered out from calibration data.

## Proposed Solution

### Core Concept: Missed Opportunity Detection

Evaluate HOLD recommendations by determining if opening a position would have been profitable:

1. **Compute hypothetical LONG outcome**: What if we had gone long?
2. **Compute hypothetical SHORT outcome**: What if we had gone short?
3. **If either would have been significantly profitable**: Mark as missed opportunity
4. **Create synthetic outcome**: Penalize confidence score for missing the opportunity

### Key Design Decisions

#### 1. Opportunity Threshold
Only consider it a "missed opportunity" if the price movement exceeded a threshold:

```typescript
private readonly OPPORTUNITY_THRESHOLD = 0.5; // 0.5% price movement
```

**Rationale**: 
- Ignores noise (< 0.5% movements)
- Focuses on significant, actionable moves
- Prevents over-penalizing reasonable HOLD decisions

#### 2. Confidence Filter
Only evaluate HOLDs above a confidence threshold:

```typescript
private readonly MIN_CONFIDENCE_FOR_EVALUATION = 0.5;
```

**Rationale**:
- Low-confidence HOLDs are already expressing uncertainty
- Only high-confidence HOLDs should be penalized for missing opportunities
- Prevents unfairly penalizing cautious, low-confidence decisions

#### 3. Penalty Weighting
Control how strongly missed opportunities affect calibration:

```typescript
private readonly HOLD_PENALTY_WEIGHT = 1.0;
```

**Rationale**:
- `1.0` = treat missed opportunities equally to incorrect trades
- `< 1.0` = softer penalty (if HOLD is often defensible)
- `> 1.0` = harsher penalty (if missing moves is worse than bad entries)

### Implementation Strategy

#### Step 1: Include HOLD in Dataset
```typescript
.where("action", "in", ["long", "short", "hold"])
```

#### Step 2: Evaluate HOLD Outcomes
```typescript
if (current.action === "hold") {
  const pnlLong = ((exitPrice - entryPrice) / entryPrice) * 100;
  const pnlShort = ((entryPrice - exitPrice) / entryPrice) * 100;
  
  const missedLong = pnlLong > OPPORTUNITY_THRESHOLD && 
                     confidence >= MIN_CONFIDENCE_FOR_EVALUATION;
  const missedShort = pnlShort > OPPORTUNITY_THRESHOLD && 
                      confidence >= MIN_CONFIDENCE_FOR_EVALUATION;
  
  if (missedLong || missedShort) {
    outcomes.push({
      confidence,
      isWinner: false,
      pnlPercent: -Math.abs(Math.max(pnlLong, pnlShort)) * HOLD_PENALTY_WEIGHT
    });
  }
}
```

#### Step 3: Let Isotonic Regression Handle It
The existing isotonic regression algorithm will naturally:
- Lower calibrated confidence for scores that led to missed opportunities
- Maintain monotonicity (higher raw confidence → higher calibrated confidence)
- Pool adjacent buckets if needed to maintain smooth calibration curve

## Expected Impact

### Calibration Improvements
1. **More synthetic outcomes**: Dataset size increases by including HOLD evaluations
2. **Better differentiation**: High-confidence HOLDs that miss moves get penalized
3. **Recalibrated scores**: System learns when it should be more aggressive

### Behavioral Changes
After recalibration, the LLM's confidence scores will be adjusted:
- **High-confidence HOLD that often misses moves** → Lower calibrated confidence
- **System becomes more selective about high-confidence HOLDs**
- **Encourages position opening when opportunities exist**

### Example Scenario

**Before (no HOLD evaluation):**
- LLM generates HOLD with 0.8 confidence
- Price moves +1.5% (missed long opportunity)
- **No impact on calibration**
- Next time: Still likely to output high-confidence HOLD

**After (with HOLD evaluation):**
- LLM generates HOLD with 0.8 confidence  
- Price moves +1.5% (missed long opportunity)
- **Synthetic outcome added**: `{confidence: 0.8, isWinner: false, pnlPercent: -1.5}`
- Calibration learns: 0.8 confidence HOLD often misses moves
- **Next time**: 0.8 raw confidence → 0.65 calibrated confidence
- System becomes more aggressive at similar confidence levels

## Testing Strategy

### Unit Tests
1. ✅ HOLD with missed LONG opportunity → synthetic outcome created
2. ✅ HOLD with missed SHORT opportunity → synthetic outcome created
3. ✅ HOLD with small move (< threshold) → NO synthetic outcome
4. ✅ Low-confidence HOLD with big move → NO synthetic outcome (below MIN_CONFIDENCE)

### Integration Tests
1. Run calibration on historical data with HOLDs
2. Verify calibration curve changes appropriately
3. Validate correlation metrics improve
4. Check backtest performance with new calibration

### Validation Metrics
- **Sample size increase**: Dataset should be 30-50% larger (more outcomes)
- **Correlation change**: May increase as system learns from missed opportunities
- **Win rate gap**: High vs low confidence gap should widen
- **Backtest improvement**: Fewer missed opportunities in future recommendations

## Configuration Tuning

Start with conservative defaults, then tune based on observed behavior:

| Parameter | Initial | Conservative | Aggressive |
|-----------|---------|--------------|------------|
| `OPPORTUNITY_THRESHOLD` | 0.5% | 1.0% | 0.3% |
| `MIN_CONFIDENCE_FOR_EVALUATION` | 0.5 | 0.6 | 0.4 |
| `HOLD_PENALTY_WEIGHT` | 1.0 | 0.5 | 1.5 |

**Tuning Guidelines:**
- If system becomes too aggressive → increase `OPPORTUNITY_THRESHOLD`
- If still too conservative → increase `HOLD_PENALTY_WEIGHT`
- If low-confidence HOLDs are unfairly penalized → raise `MIN_CONFIDENCE_FOR_EVALUATION`

## Risks and Mitigations

### Risk 1: Over-Penalizing Defensive Holds
**Risk**: HOLD is sometimes correct even with price movement (e.g., choppy markets)

**Mitigation**: 
- Use `OPPORTUNITY_THRESHOLD` to ignore small moves
- Adjust `HOLD_PENALTY_WEIGHT` if needed
- Monitor backtest results to validate improvement

### Risk 2: Hindsight Bias
**Risk**: Evaluating with hindsight may not reflect real-time decision quality

**Mitigation**:
- Use one-step lookahead (same as backtest "perfect" strategy)
- Only penalize clear, significant moves
- Track "correct HOLDs" separately for analysis

### Risk 3: Data Imbalance
**Risk**: If many HOLDs, synthetic outcomes could dominate dataset

**Mitigation**:
- Monitor dataset composition (% real vs synthetic outcomes)
- Adjust `MIN_CONFIDENCE_FOR_EVALUATION` if needed
- Consider separate calibration curves for different action types (future enhancement)

## Future Enhancements

### Phase 2: Separate Action-Specific Calibrations
- Maintain separate calibration curves for LONG, SHORT, HOLD
- Apply appropriate curve based on recommendation type
- More nuanced confidence scoring

### Phase 3: Market Regime Detection
- Different `OPPORTUNITY_THRESHOLD` for trending vs ranging markets
- Adaptive penalty weights based on volatility
- Context-aware HOLD evaluation

### Phase 4: Confidence Decay
- Reduce confidence for repeated HOLDs during strong trends
- Encourage position flips when regime changes
- Time-weighted opportunity cost

## Success Criteria

The implementation will be considered successful if:

1. ✅ All unit tests pass
2. ✅ No regressions in existing calibration behavior
3. ✅ Calibration correlation improves by ≥0.1
4. ✅ Backtest shows fewer missed opportunities
5. ✅ Win rate gap (high vs low confidence) increases

## Timeline

- **Phase 1**: Implementation (11 tasks, ~2-3 hours)
- **Phase 2**: Testing and validation (~1 hour)
- **Phase 3**: Real-world monitoring (1 week)
- **Phase 4**: Tuning and refinement (as needed)

## References

- **Original Issue**: Confidence calibration ignores HOLD recommendations
- **Related Systems**: 
  - `src/db/confidenceCalibrationService.ts` - Main implementation
  - `src/db/tradeBacktestService.ts` - Backtest validation
  - `src/commands/confidenceCalibrate.ts` - CLI interface
- **Documentation**: 
  - `WARP.md` - User-facing documentation
  - `plans/confidence-recalibration-implementation.md` - Original calibration design

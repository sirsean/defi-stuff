# HOLD and CLOSE Evaluation in Confidence Calibration

## Problem Statement

The original confidence calibration system only evaluated LONG and SHORT predictions, completely ignoring HOLD and CLOSE recommendations. This created critical blind spots:

- ✅ **Correct LONG/SHORT**: System learns to trust similar confidence levels
- ✅ **Incorrect LONG/SHORT**: System learns to distrust those confidence levels  
- ❌ **HOLD when should have opened position**: **NO LEARNING HAPPENS**
- ❌ **CLOSE too early or at the right time**: **NO LEARNING HAPPENS**

This means:
1. The system **never learns to be more aggressive** when it should be opening positions
2. The system **never learns optimal exit timing** for closing positions

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

## CLOSE Evaluation (Added 2025-11-10)

### Core Concept: Exit Timing Evaluation

Evaluate CLOSE recommendations by determining if the exit was premature or well-timed:

1. **Track position state**: Know what position we had (long/short, entry price)
2. **Calculate P/L at close**: Actual profit/loss when position was closed
3. **Calculate P/L if held**: What would have happened if we held until next price
4. **Compare outcomes**:
   - **Price continued favorably (>0.5%)**: Closed too early (penalty)
   - **Price reversed or stayed flat**: Good close (reward)

### Key Design Decisions for CLOSE

#### 1. Early Exit Threshold
Determine when a CLOSE was premature:

```typescript
private readonly CLOSE_TOO_EARLY_THRESHOLD = 0.5; // 0.5% continued movement
```

**Rationale**:
- If price continued moving in our favor by >0.5%, we likely exited too early
- Balances letting winners run vs. taking profits
- Prevents penalizing exits that captured most of the move

#### 2. Reward for Good Exits
When CLOSE prevents a reversal:

```typescript
const drawdownAvoided = Math.abs(Math.min(0, missedGain));
outcomes.push({
  confidence,
  isWinner: true,
  pnlPercent: drawdownAvoided
});
```

**Rationale**:
- Positive outcome when exit prevented losses
- Magnitude reflects how much drawdown was avoided
- Teaches system to recognize good exit signals

#### 3. Position-Aware Evaluation
CLOSE evaluation requires tracking:

```typescript
let currentPosition: {
  action: "long" | "short";
  entryPrice: number;
  entryIndex: number;
} | null = null;
```

**Rationale**:
- Need entry price to calculate P/L
- Need to know long vs short to determine favorable movement
- Track entry recommendation to credit/penalize the entry confidence

### Implementation Strategy for CLOSE

#### Step 1: Include CLOSE in Dataset
```typescript
.where("action", "in", ["long", "short", "hold", "close"])
```

#### Step 2: Track Position State
Walk through recommendations maintaining position state:
- LONG: Open or maintain long position
- SHORT: Open or maintain short position
- CLOSE: Evaluate and close current position
- HOLD: Maintain current state (flat stays flat, positioned stays positioned)

#### Step 3: Evaluate CLOSE Outcomes
```typescript
if (current.action === "close" && currentPosition) {
  // Calculate P/L at close
  const pnlAtClose = computePnL(currentPosition, currentPrice);
  
  // Calculate P/L if held until next price
  const pnlIfHeld = computePnL(currentPosition, nextPrice);
  
  // Check if we closed too early
  const missedGain = pnlIfHeld - pnlAtClose;
  const closedTooEarly = missedGain > CLOSE_TOO_EARLY_THRESHOLD;
  
  if (closedTooEarly) {
    // Penalty for early exit
    outcomes.push({
      confidence,
      isWinner: false,
      pnlPercent: -Math.abs(missedGain) * CLOSE_PENALTY_WEIGHT
    });
  } else {
    // Reward for good exit
    const drawdownAvoided = Math.abs(Math.min(0, missedGain));
    outcomes.push({
      confidence,
      isWinner: true,
      pnlPercent: drawdownAvoided
    });
  }
  
  // Also record the actual trade outcome
  outcomes.push({
    confidence: entryConfidence,
    isWinner: pnlAtClose > 0,
    pnlPercent: pnlAtClose
  });
}
```

### Expected Impact of CLOSE Evaluation

**Calibration Improvements:**
1. **Exit timing learning**: System learns when to hold vs exit
2. **Winner management**: Prevents closing profitable positions too early
3. **Risk management**: Rewards exits that avoid reversals

**Behavioral Changes:**
- **High-confidence CLOSE that often exits too early** → Lower calibrated confidence
- **High-confidence CLOSE that times exits well** → Higher calibrated confidence  
- **System learns to let profitable trades run** when conditions remain favorable
- **System learns to take profits** when reversals are likely

### Example Scenarios for CLOSE

**Scenario 1: Premature Close**
```
LONG entered at $100
CLOSE at $102 (+2%) with 0.7 confidence
Price continues to $103.50 (+3.5% from entry)
→ Missed gain: 1.5%
→ Synthetic outcome: {confidence: 0.7, isWinner: false, pnlPercent: -1.5}
→ Entry outcome: {confidence: 0.8, isWinner: true, pnlPercent: 2.0}
→ Calibration learns: 0.7 confidence CLOSE often exits too early
→ System holds positions longer at similar confidence
```

**Scenario 2: Well-Timed Close**
```
SHORT entered at $100  
CLOSE at $98 (+2%) with 0.8 confidence
Price reverses to $99 (would be +1% if held)
→ Drawdown avoided: 1%
→ Synthetic outcome: {confidence: 0.8, isWinner: true, pnlPercent: 1.0}
→ Entry outcome: {confidence: 0.75, isWinner: true, pnlPercent: 2.0}
→ Calibration learns: 0.8 confidence CLOSE times exits well
→ System trusts high-confidence CLOSE signals
```

**Scenario 3: Close After Small Move (No Penalty)**
```
LONG entered at $100
CLOSE at $100.50 (+0.5%) with 0.6 confidence
Price continues to $100.80 (+0.8% from entry)
→ Missed gain: 0.3% (below 0.5% threshold)
→ Synthetic outcome: {confidence: 0.6, isWinner: true, pnlPercent: 0.3}
→ No penalty - move was small enough to be noise
→ Calibration treats this as acceptable exit timing
```

### Configuration Tuning for CLOSE

| Parameter | Initial | Conservative | Aggressive |
|-----------|---------|--------------|------------|
| `CLOSE_TOO_EARLY_THRESHOLD` | 0.5% | 1.0% | 0.3% |
| `CLOSE_PENALTY_WEIGHT` | 1.0 | 0.5 | 1.5 |

**Tuning Guidelines:**
- If system holds too long → decrease `CLOSE_TOO_EARLY_THRESHOLD`
- If system exits too early → increase `CLOSE_PENALTY_WEIGHT`
- Monitor win rate and average trade duration for balance

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

# Position-Aware Trade Recommendation System

## Overview

The trade recommendation system now operates with position awareness, tracking the current state (FLAT, LONG, or SHORT) based on previous recommendations stored in the database.

## Action Semantics

### HOLD - Maintain Current State
- **FLAT → FLAT**: Stay flat, don't enter any trade (no compelling opportunity)
- **LONG → LONG**: Keep the long position open
- **SHORT → SHORT**: Keep the short position open
- **Use when**: The current state is optimal given market conditions

### LONG - Enter or Maintain Long
- **FLAT → LONG**: Enter a new long position
- **SHORT → LONG**: Close short, immediately enter long (position flip)
- **LONG → LONG**: Maintain existing long (same as HOLD when long)
- **Use when**: Bullish on the market

### SHORT - Enter or Maintain Short
- **FLAT → SHORT**: Enter a new short position
- **LONG → SHORT**: Close long, immediately enter short (position flip)
- **SHORT → SHORT**: Maintain existing short (same as HOLD when short)
- **Use when**: Bearish on the market

### CLOSE - Exit to Flat
- **LONG → FLAT**: Close long position, go flat
- **SHORT → FLAT**: Close short position, go flat
- **FLAT → ???**: **INVALID** - cannot close when already flat (use HOLD instead)
- **Use when**: Want to exit current position (take profits, cut losses, reduce risk)

## Position State Derivation

The system determines current position state by:

1. Query recent recommendations for the market (most recent first)
2. Walk back through consecutive HOLD recommendations
3. Find the first non-HOLD recommendation:
   - If **LONG** → current state is LONG
   - If **SHORT** → current state is SHORT
   - If **CLOSE** → current state is FLAT
   - If no history → current state is FLAT

### Examples

**Sequence: LONG → HOLD → HOLD**
- Current state: LONG (walked back through HOLDs to find LONG)

**Sequence: SHORT → HOLD → CLOSE → HOLD**
- Current state: FLAT (last non-HOLD was CLOSE)

**Sequence: LONG → SHORT → HOLD**
- Current state: SHORT (flipped from LONG to SHORT, then held)

**Sequence: (empty)**
- Current state: FLAT (no prior recommendations)

## Valid Actions by State

| Current State | Valid Actions | Explanation |
|--------------|---------------|-------------|
| FLAT | HOLD, LONG, SHORT | HOLD = stay flat; LONG/SHORT = enter position |
| LONG | HOLD, LONG, SHORT, CLOSE | HOLD/LONG = maintain; SHORT = flip; CLOSE = exit |
| SHORT | HOLD, SHORT, LONG, CLOSE | HOLD/SHORT = maintain; LONG = flip; CLOSE = exit |

**Note**: CLOSE when FLAT is invalid (will generate warning)

## Backtest Behavior

The backtest system now uses unified semantics (HoldMode parameter is deprecated):

- **HOLD**: No trade execution, position state remains unchanged
- **CLOSE**: Closes position if one exists, no-op if flat
- **LONG/SHORT**: Opens position if flat, flips if opposite, maintains if same
- **End of backtest**: Any open position is automatically closed

## AI Prompt Context

The AI receives position state for each market in the user prompt:

```
Current Positions from Previous Recommendations:
  BTC: LONG
  ETH: FLAT
  SOL: SHORT
```

The system prompt instructs the AI to:
- Use HOLD when the current state is optimal
- Only use CLOSE when exiting from a position (never when flat)
- Consider position flips (LONG→SHORT or SHORT→LONG) only on strong opposing signals
- Default to HOLD when no compelling reason to change

## Implementation Details

### Files Modified
- `src/types/tradeRecommendation.ts` - Added PositionState type, documented actions
- `src/types/backtest.ts` - Deprecated HoldMode
- `src/api/trading/tradeRecommendationAgent.ts` - Position state tracking, updated prompts
- `src/db/tradeBacktestService.ts` - Updated simulation logic

### Key Methods
- `TradeRecommendationAgent.getPreviousPositionState()` - Derives position state from DB
- `TradeRecommendationAgent.buildUserPrompt()` - Includes position state in AI context
- `TradeBacktestService.simulateRecommendedStrategy()` - Unified position-aware logic

## Migration Notes

### For Existing Recommendations
- Old recommendations without position context will be interpreted as FLAT at start
- HOLD recommendations will be walked back through to find underlying position
- System is backward compatible with existing data

### For Backtesting
- HoldMode parameter is ignored (deprecated)
- "maintain" vs "close" interpretation is no longer needed
- Recommendations now explicitly encode intent via HOLD vs CLOSE

## Benefits

1. **Clarity**: Clear distinction between "stay flat" (HOLD) and "exit position" (CLOSE)
2. **Completeness**: Can now recommend "no trade" via HOLD when flat
3. **Consistency**: Same action (HOLD) maintains any state
4. **Auditability**: Position state is derived from recommendation history
5. **Simplicity**: Eliminated ambiguity of old hold-mode interpretations

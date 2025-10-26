# Confidence Scoring Analysis

**Created**: 2025-10-26  
**Status**: 🚧 In Progress

## Executive Summary

Analysis of 14-30 day BTC backtests reveals that LLM-generated confidence scores are **inverted** - high confidence trades (≥0.7) have **lower win rates** than low confidence trades. The root cause appears to be systematic over-confidence in specific trade setups, particularly:

1. **Contrarian "extreme fear" longs** (0.68-0.76 confidence)
2. **Polymarket divergence trades** (0.62-0.72 confidence)
3. **Short-squeeze narrative trades** (0.68-0.76 confidence)

## Backtest Data Summary

### BTC Performance by Timeframe

| Timeframe | High Conf Win Rate | Low Conf Win Rate | Correlation | Assessment |
|-----------|-------------------|-------------------|-------------|------------|
| 7 days    | 100.0%            | 75.0%             | +0.365      | ✅ Working |
| 14 days   | 42.9%             | 56.3%             | -0.175      | ❌ Inverted |
| 30 days   | 42.9%             | 54.5%             | -0.070      | ❌ Inverted |

### Trade Breakdown (14-day window)
- **Total trades**: 23
- **Long trades**: 14 (win rate: 50.0%)
- **Short trades**: 10 (win rate: 55.6%)
- **Overall win rate**: 52.17%

## Pattern Analysis

### 1. Over-Confident Contrarian Longs

**Pattern**: LLM assigns high confidence (0.68-0.76) to longs when Fear & Greed Index is in "Extreme Fear" (20-30).

**Reasoning used by LLM**:
- "Extreme Fear (22) is a classic contrarian signal that often precedes a short-term bottom"
- "Short-biased OI (60-80%) creates potential for short-squeeze"
- "Macro indicators bullish for risk assets"

**Actual outcomes**:
- 10/17 @ $107,443 (conf: 0.76) → Lost -0.69% ❌
- 10/18 @ $107,201 (conf: 0.68) → Lost -0.30% ❌
- 10/17 @ $109,101 (conf: 0.68) → Lost -3.73% ❌  (worst trade)
- 10/14 @ $112,547 (conf: 0.68) → Lost -0.09% ❌
- 10/15 @ $112,654 (conf: 0.58) → Lost -0.89% ❌

**Problem**: The LLM is correctly identifying contrarian setups but is over-rating their probability of success. "Extreme Fear" can continue declining (fear → capitulation). The short-squeeze narrative doesn't always materialize within the 1-day timeframe.

### 2. Polymarket Divergence Over-Confidence

**Pattern**: High confidence (0.62-0.72) assigned when current BTC price significantly diverges from Polymarket's retail prediction.

**Examples**:
- 10/24 short @ $110,551 (conf: 0.66): "BTC is trading at $110.5k, roughly double the Polymarket 2025 price expectation of $58k" → Lost -0.10% ❌
- 10/23 short @ $110,671 (conf: 0.62): "Price sits slightly above Polymarket consensus ($109k)" → Won +0.35% ✅
- 10/17 short @ $105,087 (conf: 0.72): "BTC trading at $105k, far above Polymarket consensus $58.7k" → Lost -2.24% ❌

**Problem**: Polymarket's year-end price predictions are **not predictive** of intraday/short-term moves. The LLM is treating this as a strong signal, but it's actually noise for 1-day trades.

### 3. Short-Squeeze Narrative

**Pattern**: High confidence (0.68-0.76) when Open Interest is heavily short-biased (>60% short).

**LLM reasoning**:
- "Heavy short OI creates potential for short-squeeze if buying pressure returns"
- "Short-biased OI indicates squeeze catalyst"

**Problem**: Short-heavy OI often reflects a **trending down move**, not an imminent reversal. The squeeze happens when it happens, not on a predictable 1-day timeframe.

### 4. Successful High-Confidence Trades

**What actually worked well**:

- **Trending moves with momentum**:
  - 10/18 long @ $107,029 (conf: 0.68) → Won +3.69% ✅ (best trade)
  - 10/21 long @ $108,530 (conf: 0.68) → Won +1.21% ✅
  
- **Shorts in downtrending market**:
  - 10/13 short @ $113,370 (conf: 0.62) → Won +2.36% ✅ (2nd best)
  - 10/15 short @ $110,790 (conf: 0.68) → Won +2.12% ✅ (3rd best)

**Common factors in winners**:
1. **Recent price momentum** in the intended direction
2. **Funding rate alignment** (negative funding for longs, positive for shorts)
3. **Multiple independent signals** converging (not just contrarian hope)
4. **Clear invalidation level** close to entry

## Market Regime Analysis

### Ranging Market (Low Volatility)
- **Characteristics**: Price oscillating in tight range, most signals are "hold"
- **High-confidence setups fail more often**: Contrarian calls get chopped out
- **Better approach**: Stay flat or very small positions with tight stops

### Trending Market (Clear Direction)
- **Characteristics**: Consistent price movement, strong momentum
- **High-confidence setups work better**: Trend-following with momentum
- **Better approach**: Higher conviction when trading WITH the trend

### Volatile Market (Large Swings)
- **Characteristics**: Big intraday moves, fear/greed swings
- **Contrarian setups can work**: But need confirmation, not just hope
- **Better approach**: Wait for stabilization before high-conviction entries

## Signal Confluence Analysis

### What LLM Considers "Multiple Confirming Signals"

Current LLM prompt defines high confidence as "multiple confirming signals, clear setup" but doesn't quantify this. The LLM is counting:

1. Fear & Greed Index extreme reading
2. Polymarket divergence
3. OI skew
4. Funding rate
5. Economic indicators

**Problem**: The LLM is treating these as **independent** signals when they're often **correlated**.

Example: When Fear & Greed is at "Extreme Fear", OI is **usually** short-biased (correlation), and Polymarket is **usually** bearish. These aren't three independent confirmations - they're one signal viewed three ways.

### True Signal Independence

**Actual independent factors**:
1. **Sentiment** (Fear & Greed, Polymarket retail)
2. **Price action** (recent momentum, support/resistance)
3. **Cost of carry** (funding rate direction and magnitude)
4. **Macro backdrop** (economic indicators, risk-on/risk-off)

For true high confidence, need **at least 3 of these 4** aligned AND recent price action confirming the direction.

## Recommendations for Prompt Improvement

### 1. Redefine Confidence Tiers with Specific Criteria

**0.8-1.0 (Very High Conviction)**:
- ALL four independent factors aligned
- Recent price momentum (last 4-12 hours) confirming direction
- Clear invalidation level within 2-3% of entry
- Risk/reward ≥ 3:1
- **Example**: Trending market with momentum, positive funding for intended direction, macro supportive, sentiment not yet euphoric/panic

**0.7-0.8 (High Conviction)**:
- Three of four independent factors aligned
- Recent price action shows some confirmation (not counter-trend)
- Funding rate favorable or neutral
- Risk/reward ≥ 2:1
- **Example**: Clear trend with momentum but one conflicting indicator (e.g. crowded positioning)

**0.5-0.7 (Moderate Conviction)**:
- Two of four independent factors aligned
- Mixed signals but edge still present
- Risk/reward ≥ 1.5:1
- **Example**: Sentiment supportive but price action choppy

**0.3-0.5 (Low Conviction)**:
- Only one factor clearly supportive
- Conflicting signals outweigh confirming ones
- Unclear risk/reward or wide stops required
- **Example**: Sentiment extreme but price still trending opposite direction

**0.0-0.3 (Very Low Conviction)**:
- No clear edge identified
- Recommend HOLD or CLOSE
- **Example**: Ranging market with mixed signals

### 2. Contrarian Setup Discount

When making a **contrarian** trade (against recent momentum):
- **Reduce base confidence by 0.1-0.2**
- Require **additional confirmation** beyond just extreme sentiment
- Contrarian longs in "Extreme Fear" should start at **maximum 0.6 confidence** unless:
  - Price has already shown reversal (higher lows forming)
  - Volume profile supports a bottom
  - Funding has turned negative (longs being paid)

### 3. Polymarket Signal Weighting

For **intraday/short-term trades (1-day horizon)**:
- **Ignore Polymarket year-end price predictions entirely** - not predictive at this timeframe
- **Use Polymarket economic indicators only** for macro backdrop (as supporting context, not primary signal)
- **Do not assign confidence weight** to Polymarket price divergence

### 4. OI Skew Interpretation

**Heavy short OI (>70% short)**:
- **Default interpretation**: Market is trending down, shorts are profitable
- **Not automatically bullish** (squeeze narrative)
- Only bullish if **combined with**:
  - Negative funding (longs receiving payment)
  - Price stabilization or higher lows forming
  - Sentiment reaching true capitulation (Fear & Greed < 20 AND declining for 3+ days)

**Heavy long OI (>70% long)**:
- **Default interpretation**: Market is trending up, longs are profitable
- **Not automatically bearish** (long squeeze narrative)
- Only bearish if **combined with**:
  - High positive funding (>0.01%/day)
  - Price showing exhaustion or lower highs
  - Sentiment reaching euphoria (Fear & Greed > 75)

### 5. Add Recency Bias Check

**Recent price action override**:
- If price has moved >3% in the last 4 hours **opposite** to intended trade direction:
  - **Reduce confidence by 0.2**
  - Flag as counter-trend trade requiring exceptional conviction
- If price has moved >2% in the last 4 hours **in favor** of intended trade direction:
  - Can maintain or increase confidence
  - Trend-following is higher probability

### 6. Funding Rate as Veto

**High funding magnitude** (>0.01%/day = 3.65%/year):
- If funding is **against** intended direction:
  - **Cap confidence at 0.6**
  - Acknowledge this is counter-positioning
- If funding is **with** intended direction:
  - Modest confidence boost (+0.05)
  - Cost of carry working in our favor

## Proposed Updated Confidence Scoring Section

```
Confidence Scoring Guidelines:

Base confidence on TRUE signal independence - not correlated indicators.

Four Independent Factors:
1. **Sentiment**: Fear & Greed Index + Polymarket economic indicators (macro only)
2. **Price Action**: Recent momentum (4-12hr), trend alignment, support/resistance
3. **Positioning Cost**: Funding rate direction and magnitude
4. **Macro Backdrop**: Economic indicators, risk environment

Confidence Tiers:

0.8-1.0 (Very High):
- ALL 4 factors aligned
- Recent momentum confirming (not counter-trend)
- Clear stop within 2-3%, RR ≥ 3:1
- Example: Trending up, bullish sentiment, negative funding (longs paid), macro risk-on

0.7-0.8 (High):
- 3 of 4 factors aligned
- Price action shows some confirmation
- Funding favorable or neutral, RR ≥ 2:1
- Example: Uptrend with momentum, but OI crowded long (one concern)

0.5-0.7 (Moderate):
- 2 of 4 factors aligned
- Mixed signals but edge present
- RR ≥ 1.5:1
- Example: Sentiment supportive, funding neutral, price choppy

0.3-0.5 (Low):
- Only 1 factor supportive
- Conflicting signals dominate
- Wide stops or unclear RR
- Example: Extreme sentiment but price trending opposite

0.0-0.3 (Very Low):
- No clear edge
- Recommend HOLD or CLOSE

Special Adjustments:

Contrarian Trades (against momentum):
- Start maximum 0.6 confidence
- Require additional confirmation beyond sentiment alone
- "Extreme Fear" alone is NOT sufficient for 0.7+ confidence

Polymarket Price Predictions:
- IGNORE year-end price targets for 1-day trades
- Use economic indicators only as macro context

OI Skew:
- Heavy short OI = downtrend (not automatic squeeze setup)
- Heavy long OI = uptrend (not automatic top)
- Squeeze requires: OI skew + funding reversal + price stabilization

Funding Magnitude:
- High funding against trade direction (>0.01%/day) = cap at 0.6 confidence
- Acknowledge counter-positioning explicitly

Recency Check:
- Price moved >3% opposite direction in last 4 hours = reduce confidence by 0.2
- Counter-trend trades need exceptional confluence to justify 0.7+

Market Regime:
- Ranging/choppy: Favor HOLD, reduce confidence in directional calls
- Trending: Higher confidence when trading WITH trend
- Volatile: Wait for stabilization before high conviction

For long/short actions: Provide specific reasoning showing which factors align.
For hold actions: Explain why maintaining current state is optimal (e.g., mixed signals, ranging market).
For close actions: Explain trigger (profit target hit, thesis invalidated, risk increased).

Be conservative - missing a trade is better than forcing a bad one.
```

## Next Steps

1. ✅ Document findings in this file
2. ✅ Update system prompt in `src/api/trading/tradeRecommendationAgent.ts`
3. ✅ Generate fresh recommendations with updated prompt
4. ⏳ Run backtest on new recommendations (requires accumulating data over time)
5. ⏳ Compare new confidence correlation vs baseline (will measure after sufficient new data)
6. ⏳ Iterate if needed (based on backtest results)

## Expected Improvements

### Phase 1 Goals (Prompt Update Only)
- **Correlation**: Move from -0.070 to ≥ 0.0 (stop being anti-predictive)
- **High confidence win rate**: Move from 42.9% to ≥ 50%
- **Fewer false high-confidence signals**: Reduce contrarian over-confidence

### Long-term Goals (With Calibration System)
- **Correlation**: Achieve ≥ 0.2 (moderate positive)
- **High confidence win rate**: Achieve ≥ 60%
- **High-low confidence delta**: ≥ 10% win rate difference

## Notes

- Short-term (7-day) confidence works well because momentum/trends persist
- Medium-to-long-term degradation suggests mean reversion or regime changes
- LLM is good at identifying setups but poor at rating their success probability
- Need to distinguish "interesting trade idea" from "high probability trade"
- Confidence should reflect **probability of success**, not just "how many reasons I can list"

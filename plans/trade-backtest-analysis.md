# Trade Backtest Analysis

**Created**: 2025-10-11  
**Status**: 🚧 In Progress

## Overview

This document outlines the implementation of a backtest analysis system for AI-generated trade recommendations. The system evaluates historical recommendation performance against actual price movements and compares it to a theoretical "perfect" strategy with hindsight.

## Goals

1. **Performance Measurement**: Calculate realized PnL if each recommendation had been followed
2. **Benchmark Comparison**: Compare actual recommendations against perfect hindsight strategy
3. **Statistical Analysis**: Compute win rates, confidence correlations, and action-type breakdowns
4. **Actionable Insights**: Generate data-driven suggestions for improving recommendation quality
5. **Hold Interpretation**: Evaluate two different interpretations of "hold" signals (maintain vs close)

## Data Source

**Database**: SQLite at `/Users/sirsean/code/defi-stuff/db/defi_data_dev.sqlite3`  
**Table**: `trade_recommendations`

**Schema**:
```sql
CREATE TABLE trade_recommendations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  market VARCHAR(255) NOT NULL,
  price DECIMAL(30, 10) NOT NULL,
  action VARCHAR(20) NOT NULL,  -- 'long', 'short', 'hold', 'close'
  confidence DECIMAL(5, 4) NOT NULL,
  size_usd DECIMAL(30, 10) NULLABLE,
  timeframe VARCHAR(20) NOT NULL,
  reasoning TEXT NOT NULL,
  risk_factors JSON NULLABLE
);
```

**Current Data**: ~135 BTC recommendations with hourly intervals

## Assumptions and Constraints

### Trading Assumptions

1. **No Transaction Costs**: Fees, slippage, and funding rates are ignored (documented limitation)
2. **Instant Execution**: All trades execute at the recommendation price
3. **Default Position Size**: 1000 USD per trade if `size_usd` is null
4. **Market Hours**: 24/7 trading assumed (crypto markets)
5. **Single Position**: Only one position per market at a time

### Data Assumptions

1. **Timestamps**: Stored as Unix milliseconds; converted to Date objects for output
2. **Price Availability**: Each recommendation has a valid price
3. **Chronological Order**: Recommendations are sorted by timestamp before analysis
4. **Multi-Market Support**: Can analyze multiple markets independently

## Analysis Methodology

### Position State Machine

```
[FLAT]
  ├─ long → [LONG POSITION]
  ├─ short → [SHORT POSITION]
  ├─ hold → [FLAT] (no change)
  └─ close → [FLAT] (no-op)

[LONG POSITION]
  ├─ long → [LONG POSITION] (ignored, no trade)
  ├─ short → close long, record trade → [SHORT POSITION]
  ├─ hold (maintain mode) → [LONG POSITION] (no change)
  ├─ hold (close mode) → close long, record trade → [FLAT]
  └─ close → close long, record trade → [FLAT]

[SHORT POSITION]
  ├─ long → close short, record trade → [LONG POSITION]
  ├─ short → [SHORT POSITION] (ignored, no trade)
  ├─ hold (maintain mode) → [SHORT POSITION] (no change)
  ├─ hold (close mode) → close short, record trade → [FLAT]
  └─ close → close short, record trade → [FLAT]
```

### PnL Calculation Formulas

**Long Position**:
```
pnl_usd = size_usd × (exit_price / entry_price - 1)
pnl_percent = (exit_price / entry_price - 1) × 100
```

**Short Position**:
```
pnl_usd = size_usd × (1 - exit_price / entry_price)
pnl_percent = (1 - exit_price / entry_price) × 100
```

**Total Return**:
```
total_return_percent = (total_pnl_usd / sum(size_usd)) × 100
```

### Hold Interpretation Modes

**Mode 1: Maintain** (Conservative)
- `hold` means maintain current position
- If flat, stay flat
- If in position, keep position open
- No trade recorded for hold signals

**Mode 2: Close** (Aggressive)
- `hold` means close any open position
- If flat, stay flat
- If in position, close and record trade
- Locks in profits/losses immediately

**Rationale**: The backtest will run both modes to determine empirically which interpretation produces better results.

### Perfect Strategy Definition

A "perfect" strategy uses **one-step lookahead**:

For each adjacent pair of recommendations `(i, i+1)`:
- `p0 = recommendations[i].price`
- `p1 = recommendations[i+1].price`
- If `p1 > p0`: take long position at `p0`, close at `p1`
- If `p1 < p0`: take short position at `p0`, close at `p1`
- If `p1 == p0`: skip (zero PnL trade)

Each perfect trade:
- Entry at `p0` with timestamp `t_i`
- Exit at `p1` with timestamp `t_{i+1}`
- Uses same default `size_usd` as recommended strategy

**Note**: Perfect strategy represents an unattainable upper bound but provides a useful benchmark for measuring recommendation quality.

### End-of-Series Behavior

At the last recommendation:
- If a position is still open, close it at the last known price
- Record this as a final trade
- Ensures all capital is "returned" for fair comparison

## Metrics

### Primary Performance Metrics

| Metric | Formula | Description |
|--------|---------|-------------|
| Total PnL (USD) | `Σ pnl_usd` | Sum of all closed trade profits/losses |
| Total Return (%) | `(Σ pnl_usd / Σ size_usd) × 100` | Overall return on capital deployed |
| Win Rate (%) | `(profitable_trades / total_trades) × 100` | Percentage of profitable trades |
| Avg Trade Return (USD) | `mean(pnl_usd)` | Average profit/loss per trade |
| Avg Trade Return (%) | `mean(pnl_percent)` | Average return percentage per trade |
| Number of Trades | `count(closed_trades)` | Total trades executed |

### Action Type Breakdown

For each action type (`long`, `short`, `hold`, `close`):
- **Occurrence Count**: How many times this action was recommended
- **Win Rate**: Percentage of profitable trades with this entry action
- **Avg PnL**: Average profit/loss for trades with this entry action

**Note**: `hold` and `close` actions may not have associated PnL (they don't initiate positions).

### Confidence Analysis

**High vs Low Confidence**:
- Split at threshold `confidence >= 0.7`
- Compute win rate for each group
- Compare to determine if confidence is predictive

**Correlation**:
- Pearson correlation coefficient `r` between:
  - X: entry `confidence` values
  - Y: trade `pnl_percent` values
- `r > 0`: higher confidence → higher returns (good calibration)
- `r < 0`: higher confidence → lower returns (poor calibration)
- `|r| < 0.2`: weak/no relationship

**Interpretation**:
- Strong positive correlation (r > 0.3): confidence is useful; scale position sizes
- Weak correlation (|r| < 0.2): confidence may not be predictive
- Negative correlation (r < -0.3): confidence is inversely predictive; investigate

## Output Format

### TypeScript Interfaces

```typescript
export interface TradeResult {
  market: string;
  entry_time: Date;
  exit_time: Date;
  action: 'long' | 'short';
  entry_price: number;
  exit_price: number;
  size_usd: number;
  confidence: number;
  pnl_usd: number;
  pnl_percent: number;
}

export interface StrategyPerformance {
  total_pnl_usd: number;
  total_return_percent: number;
  win_rate: number;
  avg_trade_return_usd: number;
  avg_trade_return_percent: number;
  num_trades: number;
  trades: TradeResult[];
}

export interface ActionStats {
  count: number;
  win_rate: number;
  avg_pnl: number;
}

export interface ConfidenceAnalysis {
  high_confidence_win_rate: number;   // confidence >= 0.7
  low_confidence_win_rate: number;    // confidence < 0.7
  correlation: number;                // Pearson r
}

export interface BacktestResult {
  // Summary
  market: string;
  date_range: { start: Date; end: Date };
  total_recommendations: number;
  
  // Hold mode used
  hold_mode: 'maintain' | 'close';
  
  // Performance
  recommended_strategy: StrategyPerformance;
  perfect_strategy: StrategyPerformance;
  
  // Breakdowns
  by_action: {
    long: ActionStats;
    short: ActionStats;
    hold: ActionStats;
    close: ActionStats;
  };
  
  // Analysis
  confidence_analysis: ConfidenceAnalysis;
  
  // Insights
  improvement_suggestions: string[];
}
```

### CLI Output Modes

**JSON Mode** (`--json`):
- Single hold mode: output `BacktestResult`
- Both modes: output `{ mode: 'both', results: BacktestResult[] }`

**Human-Readable Mode** (default):
```
═══════════════════════════════════════════════════════════════════════
  📊 TRADE RECOMMENDATION BACKTEST ANALYSIS
═══════════════════════════════════════════════════════════════════════

Market: BTC
Period: 2025-10-05 00:00:00 - 2025-10-11 23:00:00
Total Recommendations: 135

───────────────────────────────────────────────────────────────────────
📈 RECOMMENDED STRATEGY (hold=maintain)
───────────────────────────────────────────────────────────────────────

  Total PnL:              $2,345.67
  Total Return:           +12.34%
  Win Rate:               58.33%
  Avg Trade Return:       $123.45
  Number of Trades:       19

───────────────────────────────────────────────────────────────────────
🎯 PERFECT STRATEGY (with hindsight)
───────────────────────────────────────────────────────────────────────

  Total PnL:              $8,901.23
  Total Return:           +45.67%
  Win Rate:               89.55%
  Avg Trade Return:       $456.78
  Number of Trades:       134

  Performance Gap:        -73.64% of perfect

───────────────────────────────────────────────────────────────────────
📊 BREAKDOWN BY ACTION
───────────────────────────────────────────────────────────────────────

  Long:     45 recommendations | Win Rate: 62.5% | Avg: $145.23
  Short:    38 recommendations | Win Rate: 52.4% | Avg: $98.76
  Hold:     42 recommendations | (no PnL attribution)
  Close:    10 recommendations | (no PnL attribution)

───────────────────────────────────────────────────────────────────────
🎓 CONFIDENCE ANALYSIS
───────────────────────────────────────────────────────────────────────

  High Confidence (≥0.7):    Win Rate: 64.3%
  Low Confidence (<0.7):     Win Rate: 51.2%
  Correlation (r):           +0.42 (moderate positive)

  Interpretation: Higher confidence trades perform better. Consider
                  scaling position sizes with confidence levels.

───────────────────────────────────────────────────────────────────────
💡 IMPROVEMENT SUGGESTIONS
───────────────────────────────────────────────────────────────────────

  1. Scale position size with confidence (r=0.42 shows predictive value)
  2. Long bias detected: long win rate 10% higher than short
  3. Maintain-on-hold outperforms close-on-hold by 8% return
  4. Consider filtering low confidence (<0.5) short signals
  5. Gap to perfect dominated by missed reversals: react faster
```

**Verbose Mode** (`--verbose`):
Adds per-trade logs:
```
  Trade #1:  2025-10-05 12:00  LONG  @ $62,345  →  $63,210  |  +$865 (+1.39%)
  Trade #2:  2025-10-05 15:00  SHORT @ $63,100  →  $62,890  |  +$210 (+0.33%)
  ...
```

## Improvement Suggestions Heuristics

The system generates actionable recommendations based on:

### 1. Confidence Calibration
- **If** `high_confidence_win_rate < low_confidence_win_rate`:
  - Suggest: "Recalibrate model confidence; high-confidence signals underperform."
- **If** `correlation > 0.3`:
  - Suggest: "Scale position size with confidence (r={correlation})."
- **If** `correlation < -0.3`:
  - Suggest: "Invert confidence weighting; model may be anti-calibrated."

### 2. Action Bias Detection
- **If** `long_win_rate - short_win_rate > 10%`:
  - Suggest: "Long bias detected; consider filtering weak short signals."
- **If** `short_win_rate - long_win_rate > 10%`:
  - Suggest: "Short bias detected; consider filtering weak long signals."

### 3. Hold Policy Optimization
- **If** `close_on_hold_return > maintain_on_hold_return + 5%`:
  - Suggest: "Adopt close-on-hold policy to lock gains and limit drawdowns."
- **If** `maintain_on_hold_return > close_on_hold_return + 5%`:
  - Suggest: "Maintain-on-hold works better; let winners run."

### 4. Position Sizing
- **If** varying `size_usd` and high variance in returns:
  - Suggest: "Normalize position sizes or adjust for volatility."
- **If** consistent `size_usd` and wide PnL distribution:
  - Suggest: "Consider ATR-based position sizing for risk management."

### 5. Signal Quality
- **If** `(perfect_pnl - recommended_pnl) / perfect_pnl > 0.70`:
  - Suggest: "Large gap to perfect; react faster to direction changes."
- **If** many consecutive same-action recommendations:
  - Suggest: "Allow position flips on strong opposing signals."

### 6. Filtering Thresholds
- Grid search over confidence thresholds `[0.5, 0.6, 0.7, 0.8]`:
  - Report optimal threshold that maximizes win rate or total return

**Cap**: Maximum 6 suggestions to avoid overwhelming output.

## Edge Cases

### Empty Dataset
- No recommendations → Output warning and exit gracefully

### All Holds
- No trades executed → Report 0 trades, suggest action signals needed

### All Closes While Flat
- No positions to close → Count occurrences, zero trades

### Equal Consecutive Prices
- `entry_price == exit_price` → Zero PnL trade (neutral)

### Missing Size USD
- Use `defaultSizeUsd` (1000 USD) and document in output

### Multi-Market Analysis
- Group recommendations by market
- Run backtest per market independently
- Aggregate statistics across markets

## Implementation Checklist

- [x] Planning document created
- [ ] Type definitions (`src/types/backtest.ts`)
- [ ] Backtest service (`src/db/tradeBacktestService.ts`)
  - [ ] Fetch and preprocess recommendations
  - [ ] Recommended strategy simulation
  - [ ] Perfect strategy simulation
  - [ ] Metrics computation
  - [ ] Improvement suggestion generation
- [ ] CLI command (`src/commands/tradeBacktest.ts`)
- [ ] Register command in `src/index.ts`
- [ ] Unit tests (`test/commands/tradeBacktest.test.ts`)
- [ ] Documentation in `WARP.md`
- [ ] Manual QA with real BTC data
- [ ] Type check and build passing

## Future Enhancements

1. **Fee Model**: Add configurable trading fees (e.g., 0.05% per side)
2. **Funding Rates**: Incorporate holding costs for perpetual futures
3. **Slippage Model**: Simulate market impact on large orders
4. **Volatility Sizing**: ATR-based position sizing
5. **Regime Detection**: Identify trending vs ranging market conditions
6. **Multi-Timeframe**: Analyze intraday vs short-term vs long-term signals separately
7. **CSV Export**: Export trade log for external analysis (Excel, R, Python)
8. **Discord Integration**: Periodic automated backtest reports
9. **Walk-Forward Analysis**: Rolling window backtests to detect strategy decay
10. **Monte Carlo**: Simulate randomized trade sequences to test robustness

## Success Criteria

1. **Accurate PnL**: Manual verification against sample trades matches formulas
2. **Reproducible**: Same input data produces identical results
3. **Informative**: Output clearly shows performance and actionable insights
4. **Fast**: Processes 1000+ recommendations in < 1 second
5. **Tested**: >90% code coverage with edge cases handled
6. **Usable**: Human-readable output requires no additional interpretation

## Notes

- Timestamps in DB are Unix milliseconds; convert to readable dates for output
- Perfect strategy is unattainable (hindsight bias) but useful as upper bound
- Initial version ignores fees/funding; document this limitation clearly
- Hold mode ambiguity resolved empirically through dual-mode backtesting
- No automatic commits per project rules; await user review before committing

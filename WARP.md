# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

**Note**: Planning documents, feature designs, and implementation notes should be stored in the `plans/` directory.

## Essential Commands

### Build and Development
```bash
# Build TypeScript to JavaScript
npm run build

# Run commands in development (with ts-node)
npm run dev -- <command>

# Run built commands
npm start <command>
# or
node dist/index.js <command>
```

### Testing
```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run a single test file
npx vitest run test/commands/ping.test.ts

# Run a specific test by name
npx vitest run -t "should indicate that the application is running"
```

### Database Operations
```bash
# Run database migrations
npm run db:migrate

# Rollback last migration
npm run db:rollback

# Check database status
npm run db:status

# Run database seeds (if available)
npm run db:seed
```

### Type Checking and Linting
```bash
# Type check without emitting files
npm run lint
```

### Chart Generation
```bash
# Generate 7-day portfolio charts
npm run dev -- chart

# Generate charts for specific time period
npm run dev -- chart --days 14

# Generate only simplified chart
npm run dev -- chart --type simple

# Generate charts for specific address
npm run dev -- chart --address 0x123...
```

### Flex FLP Compounding
```bash
# Dry run: estimate gas and show a summary (no transaction sent)
npm run dev -- flp:compound --dry-run

# Live execution (requires MAIN_PRIVATE_KEY)
node dist/index.js flp:compound

# Using dev runner with live execution
npm run dev -- flp:compound
```

Notes:
- Network: Base mainnet (chainId 8453). The command validates the connected network and exits if not on Base.
- RPC: Uses https://mainnet.base.org by default; if ALCHEMY_API_KEY is set, uses https://base-mainnet.g.alchemy.com/v2/$ALCHEMY_API_KEY.
- Live execution: Requires MAIN_PRIVATE_KEY in the environment to sign and submit the transaction. Keep this key secure and never commit it.
- Output:
  - Gas used, effective gas price, total ETH paid
  - USDC received (computed from Transfer logs to your address, with a balance-delta fallback)

### Flex Perpetuals Trading

Trade BTC, ETH, and other perpetual futures on Flex (Base mainnet) with comprehensive risk management.

**Network**: Base mainnet (chain ID 8453)
**Collateral**: USDC
**Markets**: 22 markets including BTC, ETH, SOL, XRP, and more

#### Manage Collateral

Before trading, you need to deposit USDC collateral into your Flex subaccount.

**Deposit USDC:**
```bash
# Deposit $1,000 USDC to subaccount 0
npm run dev -- flex:deposit 1000

# Deposit to specific subaccount
npm run dev -- flex:deposit 500 --sub 1

# Dry run to preview
npm run dev -- flex:deposit 1000 --dry-run
```

**Deposit process:**
1. Automatically approves USDC spending (if needed)
2. Deposits USDC to your Flex subaccount
3. Shows current and projected balances
4. Displays transaction details and gas cost

**Withdraw USDC:**
```bash
# Withdraw $500 USDC from subaccount 0
npm run dev -- flex:withdraw 500

# Withdraw from specific subaccount
npm run dev -- flex:withdraw 200 --sub 1

# Dry run to preview
npm run dev -- flex:withdraw 500 --dry-run
```

**Withdrawal safety:**
- Validates sufficient balance
- Checks for open positions
- Calculates projected leverage after withdrawal
- Prevents withdrawals that would risk liquidation
- Shows warnings for high-risk withdrawals

**Output includes:**
- Current and projected USDC balance
- Impact on leverage (if positions are open)
- Risk warnings for high-leverage scenarios
- Transaction details and gas cost

#### View Market Prices and Funding Rates
```bash
# Get BTC market info (default)
npm run dev -- flex:price

# Get specific market
npm run dev -- flex:price --market ETH

# View all markets
npm run dev -- flex:price --all
```

**Output includes:**
- Current market price
- Funding rate (per 24h) with direction
- Market skew (long/short imbalance)
- Max leverage and margin requirements
- Open interest (long and short position sizes)

#### Check Account Balance and Equity
```bash
# Check balance on subaccount 0 (default)
npm run dev -- flex:balance

# Check specific subaccount
npm run dev -- flex:balance --sub 1

# Check multiple subaccounts
npm run dev -- flex:balance --subs 0,1,2

# Use specific wallet address
npm run dev -- flex:balance --address 0xYourAddress
```

**Output includes:**
- Total collateral (USDC)
- Total equity (collateral + unrealized PnL - fees)
- Current leverage
- Available margin
- Open positions summary
- Account health status

#### View Open Positions
```bash
# View all positions on subaccount 0
npm run dev -- flex:positions

# View positions on specific subaccount
npm run dev -- flex:positions --sub 1

# Filter by market
npm run dev -- flex:positions --market BTC

# View across multiple subaccounts
npm run dev -- flex:positions --subs 0,1,2
```

**Output includes:**
- Position direction (LONG/SHORT)
- Position size and entry price
- Current price and liquidation price
- Unrealized PnL ($ and %)
- Fee breakdown (funding, borrowing, trading)
- Risk assessment (safe/warning/danger/critical)
- Distance to liquidation

#### Place Market Orders
```bash
# Buy $1,000 BTC at market
npm run dev -- flex:order market -m BTC -s long --size 1000

# Short $500 ETH at market
npm run dev -- flex:order market -m ETH -s short --size 500

# With custom slippage (default 1%)
npm run dev -- flex:order market -m BTC -s buy --size 1000 --slippage 0.5

# Dry run (validate without executing)
npm run dev -- flex:order market -m BTC -s long --size 1000 --dry-run

# Use specific subaccount
npm run dev -- flex:order market --sub 1 -m BTC -s long --size 1000
```

**Side options:** `long`, `buy`, `short`, `sell`

**Pre-trade validation:**
- Available margin check
- Leverage limits
- Position count limits
- Projected leverage calculation

#### Place Limit Orders
```bash
# Buy $1,000 BTC at $64,000
npm run dev -- flex:order limit -m BTC -s long --size 1000 --price 64000

# Sell $500 ETH at $3,500
npm run dev -- flex:order limit -m ETH -s short --size 500 --price 3500

# Reduce-only order (close position only)
npm run dev -- flex:order limit -m BTC -s short --size 500 --price 65000 --reduce-only

# Dry run to validate
npm run dev -- flex:order limit -m BTC -s long --size 1000 --price 64000 --dry-run
```

**Limit orders execute when:**
- Long orders: price reaches or falls below limit price
- Short orders: price reaches or rises above limit price

#### Close Positions
```bash
# Close 100% of BTC position (default)
npm run dev -- flex:close -m BTC

# Close 50% of position
npm run dev -- flex:close -m ETH --percent 50

# Close on specific subaccount
npm run dev -- flex:close --sub 1 -m BTC --percent 75

# Dry run to see outcome
npm run dev -- flex:close -m BTC --dry-run
```

**Output includes:**
- Current position details
- Estimated PnL at close
- Fee breakdown
- Net PnL (profit - fees)
- Remaining position (if partial close)

#### Manage Pending Orders
```bash
# View all pending orders on subaccount 0
npm run dev -- flex:orders

# View on specific subaccount
npm run dev -- flex:orders --sub 1

# View across multiple subaccounts
npm run dev -- flex:orders --subs 0,1,2

# Filter by market
npm run dev -- flex:orders -m BTC

# Cancel an order by ID
npm run dev -- flex:orders --sub 0 --cancel 123
```

**Order information:**
- Order ID
- Market and direction
- Order type (LIMIT/TRIGGER)
- Size and trigger price
- Reduce-only flag
- Creation timestamp

#### Subaccounts

Flex supports 256 isolated subaccounts (0-255) per wallet:
- Each subaccount has separate collateral and positions
- Use for different strategies or risk isolation
- Default is subaccount 0 if not specified

#### Risk Management

Built-in risk management features:
- **Pre-trade validation**: Checks leverage, margin, and limits before execution
- **Liquidation monitoring**: Real-time risk assessment for open positions
- **Position sizing**: Validates order size against available margin
- **Leverage limits**: Enforces per-market and portfolio-wide limits
- **Health indicators**: Visual warnings for high-risk positions

#### Common Workflows

**Initial setup (deposit collateral):**
```bash
# 1. Check your wallet has USDC
# (Ensure you have USDC on Base mainnet)

# 2. Deposit USDC to Flex
npm run dev -- flex:deposit 5000

# 3. Verify deposit
npm run dev -- flex:balance
```

**Check prices and open a position:**
```bash
# 1. Check BTC price and funding
npm run dev -- flex:price --market BTC

# 2. Check available margin
npm run dev -- flex:balance

# 3. Open long position
npm run dev -- flex:order market -m BTC -s long --size 1000

# 4. Monitor position
npm run dev -- flex:positions --market BTC
```

**Set limit orders:**
```bash
# 1. Check current price
npm run dev -- flex:price --market ETH

# 2. Place buy limit below market
npm run dev -- flex:order limit -m ETH -s long --size 500 --price 3400

# 3. Check pending orders
npm run dev -- flex:orders
```

**Close a position:**
```bash
# 1. Check position status
npm run dev -- flex:positions --market BTC

# 2. Dry run close to see outcome
npm run dev -- flex:close -m BTC --dry-run

# 3. Execute close
npm run dev -- flex:close -m BTC
```

**Close positions and withdraw collateral:**
```bash
# 1. Close all open positions
npm run dev -- flex:positions  # See what's open
npm run dev -- flex:close -m BTC
npm run dev -- flex:close -m ETH

# 2. Check final balance
npm run dev -- flex:balance

# 3. Withdraw USDC back to wallet
npm run dev -- flex:withdraw 5000
```

**Important Notes:**
- **Live Execution**: Requires `MAIN_PRIVATE_KEY` environment variable
- **Network**: All commands validate you're on Base mainnet (chain ID 8453)
- **Gas Costs**: Monitor transaction gas costs on Base
- **Risk**: Start with small position sizes when testing
- **Liquidation**: Monitor positions regularly to avoid liquidation

### Trade Recommendation Backtesting

Analyze the performance of historical trade recommendations against actual price movements.

**Purpose**: Evaluate recommendation quality and get data-driven suggestions for improvements.

#### Basic Usage

```bash
# Analyze all BTC recommendations
npm run dev -- trade:backtest -m BTC

# Analyze last 7 days only
npm run dev -- trade:backtest -m BTC -d 7

# Compare both hold modes
npm run dev -- trade:backtest -m BTC --hold-mode both

# JSON output for programmatic analysis
npm run dev -- trade:backtest -m BTC --json

# Verbose mode with per-trade details
npm run dev -- trade:backtest -m BTC --verbose
```

#### Hold Mode Interpretation

The backtest analyzes two interpretations of "hold" signals:

**Maintain Mode** (default):
- `hold` means maintain current position
- If flat, stay flat
- If in a position, keep it open
- More conservative approach

**Close Mode**:
- `hold` means close any open position
- If flat, stay flat  
- If in a position, close and lock in P/L
- More aggressive risk management

**Example comparing both:**
```bash
npm run dev -- trade:backtest -m BTC --hold-mode both
```

This outputs performance for both modes and recommends which to use.

#### Output Metrics

**Performance Metrics:**
- **Total PnL**: Sum of all closed trade profits/losses in USD
- **Total Return**: Overall return as percentage of capital deployed
- **Win Rate**: Percentage of profitable trades
- **Avg Trade Return**: Average profit/loss per trade (USD and %)
- **Number of Trades**: Total trades executed

**Perfect Strategy Comparison:**
- Shows what "perfect" hindsight trading would have achieved
- Uses one-step lookahead (always correct direction)
- Provides upper bound benchmark
- Performance gap indicates room for improvement

**Action Breakdown:**
- Occurrence count for each action type (long, short, hold, close)
- Win rate and average PnL for long and short trades
- Helps identify directional bias

**Confidence Analysis:**
- Win rates for high (≥0.7) vs low (<0.7) confidence trades
- Pearson correlation between confidence and returns
- Indicates if confidence scores are predictive

**Improvement Suggestions:**
- Data-driven recommendations for tuning the recommendation system
- Confidence calibration advice
- Directional bias detection
- Position sizing recommendations
- Hold policy optimization

#### Key Assumptions

**Important Limitations:**
- **No Fees**: Trading fees, slippage, and funding rates are ignored
- **Instant Execution**: All trades execute at recommendation price
- **Default Size**: Uses 1000 USD per trade if `size_usd` not specified
- **End-of-Series**: Any open position is closed at the last price
- **Single Position**: Only one position per market at a time

**Data Requirements:**
- Requires trade recommendations saved to database
- Use `npm run dev -- trade:recommend --db` to generate and save recommendations
- Backtest uses prices from the recommendations table

#### Example Output

```
═══════════════════════════════════════════════════════════════════════════
  📊 TRADE RECOMMENDATION BACKTEST ANALYSIS
═══════════════════════════════════════════════════════════════════════════

Market: BTC
Period: 10/05/2025, 12:00 - 10/11/2025, 18:00
Total Recommendations: 135

───────────────────────────────────────────────────────────────────────────
📈 RECOMMENDED STRATEGY (hold=maintain)
───────────────────────────────────────────────────────────────────────────

  Total PnL:              +$2,345.67
  Total Return:           +12.34%
  Win Rate:               58.33%
  Avg Trade Return:       +$123.45 (+1.23%)
  Number of Trades:       19

───────────────────────────────────────────────────────────────────────────
🎯 PERFECT STRATEGY (with hindsight)
───────────────────────────────────────────────────────────────────────────

  Total PnL:              +$8,901.23
  Total Return:           +45.67%
  Win Rate:               89.55%
  Avg Trade Return:       +$456.78 (+4.56%)
  Number of Trades:       134

  Performance Gap:        73.64% below perfect

───────────────────────────────────────────────────────────────────────────
📊 BREAKDOWN BY ACTION
───────────────────────────────────────────────────────────────────────────

  Long :     62 recommendations | Win Rate: 64.3% | Avg: +$145.23
  Short:     38 recommendations | Win Rate: 52.4% | Avg: +$98.76
  Hold :     25 recommendations | (no PnL attribution)
  Close:     10 recommendations | (no PnL attribution)

───────────────────────────────────────────────────────────────────────────
🎓 CONFIDENCE ANALYSIS
───────────────────────────────────────────────────────────────────────────

  High Confidence (≥0.7):    Win Rate: 68.2%
  Low Confidence (<0.7):     Win Rate: 51.2%
  Correlation (r):           +0.42

  Interpretation: Strong positive correlation. Higher confidence
                  trades perform better. Consider scaling position
                  sizes with confidence levels.

───────────────────────────────────────────────────────────────────────────
💡 IMPROVEMENT SUGGESTIONS
───────────────────────────────────────────────────────────────────────────

  1. Scale position size with confidence (r=0.42 shows predictive value).
  2. Long bias detected: long win rate 12% higher than short. Filter weak short signals.
  3. Large gap to perfect (73.6%); react faster to direction changes.
  4. Run with --hold-mode both to compare maintain vs close-on-hold policies.

═══════════════════════════════════════════════════════════════════════════
```

#### Using Suggestions to Improve Recommendations

**1. Confidence-Based Sizing:**
If correlation is positive (r > 0.3), scale position sizes with confidence:
```
size_usd = base_size * confidence
```

**2. Filter Weak Signals:**
If directional bias exists, filter low-confidence trades on the weaker side:
```
if action == 'short' and confidence < 0.65:
    skip or use smaller size
```

**3. Hold Policy Selection:**
Use `--hold-mode both` to determine empirically:
- If maintain wins: let winners run
- If close wins: take profits more aggressively

**4. Confidence Recalibration:**
If high-confidence trades underperform:
- Retrain model or adjust scoring
- Consider inverting confidence weights

**5. React Faster:**
If gap to perfect is large (>70%):
- Reduce signal lag
- Allow position flips on strong opposing signals
- Increase recommendation frequency

### Confidence Calibration

Analyze and recalibrate confidence scores to better align with actual prediction accuracy.

**Purpose**: Confidence scores from ML models often don't accurately reflect true probability of success. Calibration creates a mapping from raw confidence scores to calibrated probabilities based on historical performance using isotonic regression.

#### Basic Usage

```bash
# Analyze BTC recommendations from last 60 days
npm run dev -- confidence:calibrate -m BTC

# Analyze specific time window
npm run dev -- confidence:calibrate -m BTC --days 90

# Preview without saving (dry run)
npm run dev -- confidence:calibrate -m BTC --dry-run

# Send Discord notification if significant change detected
npm run dev -- confidence:calibrate -m BTC --discord
```

**Discord Notifications:**

The `--discord` flag enables automatic Discord notifications when calibration changes are significant:

- **Improvement**: Sent when correlation improves by ≥0.2 (e.g., 0.15 → 0.35 or higher)
- **Degradation**: Sent when correlation degrades by ≤-0.15 (e.g., 0.35 → 0.20 or lower)
- **Not sent**: When change is insignificant or no previous calibration exists

**Notification includes:**
- Market name and calibration metrics (before/after)
- Correlation change and impact assessment
- ASCII calibration curve visualization
- Color-coded: Green for improvements, Red for degradations

**Usage:**
```bash
# Manual calibration with Discord notification
npm run dev -- confidence:calibrate -m BTC --discord

# Automated weekly calibration (via launchd) includes --discord flag automatically
# See "Confidence Calibration Scheduling" section below
```

#### Understanding the Output

**Before Metrics:**
- **Correlation**: How well confidence predicts returns (closer to +1.0 is better)
- **Win Rates**: Performance at high vs low confidence levels
- **Gap**: Difference between high/low confidence performance

**Calibration Curve:**
- ASCII visualization showing raw → calibrated mapping
- Points should form monotonic (always increasing) curve
- Steep regions indicate areas needing adjustment
- Diagonal line = perfect calibration; deviations show over/under-confidence

**Calibration Points:**
- Table showing specific mapping points
- Each point represents a confidence bucket's actual performance
- Forms piecewise linear calibration function

**After Metrics (Projected):**
- Expected improvements if calibration is applied
- Correlation improvement indicates better predictive power
- Gap improvement shows better risk differentiation

#### Interpreting Results

**Good Calibration Signs:**
- Correlation increases (e.g., 0.23 → 0.42)
- High-confidence win rate improves significantly
- Gap between high/low confidence widens
- Monotonic curve with no inversions

**Poor Calibration Signs:**
- Correlation decreases or stays near zero
- Win rates don't align with confidence levels
- Non-monotonic curve (higher confidence maps lower)
- Very few samples in key confidence ranges

#### Using Calibration

**Note**: Automatic calibration application is planned for a future release (Phase 7). Currently, calibrations are computed and stored but not yet automatically applied to new recommendations.

Once integrated (coming soon), calibration will be automatically applied when generating recommendations:

```bash
# Future: This will use the most recent calibration for BTC
npm run dev -- trade:recommend -m BTC --calibrate
```

For now, calibrations are:
- Computed and stored in the database
- Available for analysis and validation
- Used to understand confidence score accuracy

Calibrations are market-specific and time-sensitive. Recompute periodically (weekly or monthly) as market conditions change.

#### Common Workflows

**Initial calibration setup:**
```bash
# 1. Ensure you have historical recommendations
npm run dev -- trade:recommend -m BTC --db  # Run daily for data

# 2. Preview calibration after 60+ days
npm run dev -- confidence:calibrate -m BTC --dry-run

# 3. Save if results look good
npm run dev -- confidence:calibrate -m BTC

# 4. (Future) Use calibrated recommendations
# npm run dev -- trade:recommend -m BTC --calibrate
# Note: Automatic application coming in Phase 7
```

**Regular maintenance:**
```bash
# Weekly/monthly: recompute calibration
npm run dev -- confidence:calibrate -m BTC

# Compare with previous backtest results
npm run dev -- trade:backtest -m BTC
```

**Troubleshooting:**
- **"Insufficient data"**: Need at least 10 directional trades (long/short) in analysis window
- **Weak correlation**: Model may need retraining or more data accumulation
- **Non-monotonic curve**: Isotonic regression enforces monotonicity; indicates complex patterns

#### How Isotonic Regression Works

The calibration uses the **pool adjacent violators algorithm** to enforce monotonicity:

1. **Bucket trades** by confidence (0.0-0.1, 0.1-0.2, ..., 0.9-1.0)
2. **Calculate win rate** for each bucket
3. **Scan for violations**: If higher confidence has lower win rate
4. **Pool buckets**: Average violating adjacent buckets together
5. **Repeat** until win rates are monotonically increasing
6. **Output**: Piecewise linear mapping curve

This ensures that calibrated confidence always reflects actual win probability, even when the LLM's raw scores are poorly calibrated.

#### Monitoring Calibration Health

Check the health status of calibrations across markets to know when recalibration is needed.

**Purpose**: Monitor calibration freshness, correlation strength, and win rate performance to maintain system accuracy.

**Basic Usage:**

```bash
# Check all markets (BTC and ETH)
npm run dev -- confidence:status

# Check specific market
npm run dev -- confidence:status -m BTC
```

**Output includes:**
- **Health Status**: Visual indicator (✅ HEALTHY / ⚠️ WARNING / ❌ NEEDS_RECALIBRATION / ❌ MISSING)
- **Calibration Age**: Days since last calibration
- **Sample Size**: Number of trades used in calibration
- **Correlation**: Pearson r coefficient showing predictive power
- **Win Rates**: High confidence (≥0.7) vs low confidence (<0.7) performance
- **Gap**: Win rate difference (positive = calibration working)
- **Interpretation**: Plain English explanation of metrics
- **Recommendation**: Actionable next step
- **Summary**: Overall health across all markets

**Health Thresholds:**

| Status | Criteria | Meaning |
|--------|----------|----------|
| ✅ **HEALTHY** | r > 0.2 AND age < 7 days | Calibration is working well and fresh |
| ⚠️ **WARNING** | r = 0.1-0.2 OR age = 7-14 days | Consider recalibrating soon |
| ❌ **NEEDS_RECALIBRATION** | r < 0.1 OR age > 14 days | Recalibrate immediately |
| ❌ **MISSING** | No calibration exists | Initial calibration required |

**Interpreting Correlation (r):**
- **r ≥ 0.3**: Strong predictive power (high confidence trades significantly outperform)
- **r = 0.2-0.3**: Moderate predictive power (calibration working as intended)
- **r = 0.1-0.2**: Weak predictive power (consider recalibration)
- **r = 0.0-0.1**: Very weak predictive power (recalibrate now)
- **r < 0.0**: Anti-predictive / inverted (immediate recalibration critical)

**Example Output:**

```
═══════════════════════════════════════════════════════════════════════════
  📊 CONFIDENCE CALIBRATION STATUS - ALL MARKETS
═══════════════════════════════════════════════════════════════════════════

✅ BTC

  Health Status:    HEALTHY

  Calibration Age:  2 days ago
  Sample Size:      56

  Correlation (r):  +0.335

  Win Rates:
    High Conf (≥0.7):  62.5%
    Low Conf (<0.7):   45.8%
    Gap:               +16.7 pp

  Interpretation:   Strong predictive power. Calibration is fresh.

  Recommendation:   Calibration is in good health

───────────────────────────────────────────────────────────────────────────
❌ ETH

  Status:           MISSING CALIBRATION

  Recommendation:   Run: npm run dev -- confidence:calibrate -m ETH

═══════════════════════════════════════════════════════════════════════════

📈 SUMMARY

  ✅ Healthy:              1
  ⚠️  Warning:              0
  ❌ Needs Recalibration:  0
  ❌ Missing Calibration:  1

💡 ACTION REQUIRED

  Run calibration for markets marked with ❌

═══════════════════════════════════════════════════════════════════════════
```

**Common Workflows:**

**Daily/weekly check:**
```bash
# Quick health check
npm run dev -- confidence:status

# If any market shows ❌ or ⚠️, recalibrate:
npm run dev -- confidence:calibrate -m BTC
```

**Before generating recommendations:**
```bash
# Check calibration health first
npm run dev -- confidence:status -m BTC

# If healthy, proceed with recommendations
npm run dev -- trade:recommend -m BTC --db
```

**After updating calibration:**
```bash
# Recalibrate
npm run dev -- confidence:calibrate -m BTC

# Verify improvement
npm run dev -- confidence:status -m BTC
```

### Scheduling (macOS launchd)
```bash
# Set up scheduled daily reports
npm run scheduler:setup

# Verify scheduler configuration
npm run scheduler:verify

# Test scheduler immediately
npm run scheduler:test
```

## Architecture Overview

This project follows a layered architecture with clear separation of concerns:

```
src/
├── index.ts              # CLI entry point using Commander.js
├── commands/             # CLI command implementations
│   ├── daily.ts         # Daily balance reports
│   ├── balance.ts       # Wallet balance queries
│   ├── protocols.ts     # Protocol discovery
│   ├── chart.ts         # Portfolio chart generation
│   └── ...              # Other commands
├── api/                 # External API client layer
│   ├── debank/         # DeBank API integration
│   │   ├── debankClient.ts      # Base HTTP client
│   │   ├── balanceService.ts    # Balance queries
│   │   ├── protocolService.ts   # Protocol data
│   │   └── userProtocolService.ts # User protocol positions
│   ├── discord/        # Discord integration
│   │   ├── discordClient.ts     # Discord.js wrapper
│   │   ├── discordService.ts    # Message formatting
│   │   └── messageFormatters.ts # Rich embed builders
│   └── explorers/      # Blockchain explorer APIs (Etherscan v2 multi-chain)
├── db/                 # Database layer
│   ├── knexConnector.ts         # Knex.js connection management
│   ├── balanceRecordService.ts  # Balance data persistence
│   ├── dailyBalanceService.ts   # Daily report storage
│   └── chartDataService.ts      # Historical data for charting
├── types/              # TypeScript type definitions
└── utils/              # Shared utilities
    └── chartGenerator.ts        # Chart.js image generation
```

### Data Flow
1. **CLI Commands** → Parse arguments and call appropriate services
2. **Service Layer** → Business logic that orchestrates API clients and database operations
3. **API Clients** → HTTP clients for external APIs (DeBank, Etherscan, Discord)
4. **Database Layer** → SQLite database operations using Knex.js
5. **Chart Generation** → Historical data visualization using Chart.js and canvas
6. **Type System** → Strong typing throughout with custom type definitions

### Key Design Patterns
- **Command Pattern**: Each CLI command is a separate module with a single exported function
- **Service Layer**: API clients are wrapped in service classes with business logic
- **Repository Pattern**: Database operations are abstracted through service classes
- **Builder Pattern**: Discord message construction uses fluent interfaces
- **Chart Generation**: Historical data is queried, transformed, and rendered as PNG images

## Testing Strategy

The project uses **Vitest** with **axios-mock-adapter** for comprehensive testing:

### Test Structure
```
test/
├── commands/           # Command-level integration tests
├── db/                # Database service tests
└── utils/             # Test utilities and mocks
    ├── setupTests.ts  # Global test configuration
    ├── mockAxios.ts   # HTTP mocking utilities
    └── testData.ts    # Fixture data
```

### Key Testing Patterns
- **Console Mocking**: Tests capture and verify console output using custom mocks
- **HTTP Mocking**: axios-mock-adapter intercepts API calls with predefined responses
- **In-Memory Database**: Tests use `:memory:` SQLite for isolation
- **Environment Mocking**: Test environment variables are automatically set

### Running Specific Tests
```bash
# Run tests for a specific command
npx vitest run test/commands/daily.test.ts

# Run tests matching a pattern
npx vitest run test/db/

# Run a specific test case
npx vitest run test/commands/ping.test.ts -t "should indicate"
```

## TypeScript ESM Configuration

This project uses modern TypeScript with ES Modules:

### Key Configuration (`tsconfig.json`)
- **Target**: ES2022
- **Module**: NodeNext (full ESM support)
- **Module Resolution**: NodeNext
- **Import Extensions**: `.js` extensions required in import statements (TypeScript ESM convention)

### Import Patterns
```typescript
// Correct: Use .js extension for local imports
import { ping } from './commands/ping.js';

// Correct: No extension for npm packages
import { Command } from 'commander';
```

## Environment Configuration

Required environment variables (see `.env.template`):

### API Keys
- `DEBANK_API_KEY`: DeBank Pro API access
- `ETHERSCAN_API_KEY`: Etherscan v2 multi-chain access (used for Ethereum, Base, etc.)
- `ALCHEMY_API_KEY`: RPC provider (if used)

### Discord Integration
- `DISCORD_APP_TOKEN`: Bot token from Discord Developer Portal
- `DISCORD_CHANNEL_ID`: Target channel for automated messages

### Chart Generation
No additional environment variables required - charts are generated locally using Chart.js.

### Wallet Configuration
- `WALLET_ADDRESS`: Default wallet address for commands

### Transaction Execution
- `MAIN_PRIVATE_KEY`: Required for live execution of flp:compound (Base mainnet). Used to sign and submit the transaction. Do not share or commit this value.

## Database Schema

Uses SQLite with Knex.js migrations:

### Main Table: `balance_records`
- Flexible schema for storing daily balance snapshots
- Supports multiple balance types per wallet per date
- JSON metadata field for extensible data storage

### Migration Commands
```bash
# Apply pending migrations
npm run db:migrate

# Create new migration
npx knex migrate:make <migration_name> --knexfile knexfile.cjs
```

## Scheduling with macOS launchd

The project includes automated scheduling using macOS's native launchd system:

### Setup Process
1. `npm run scheduler:setup` creates and loads the plist file
2. Scheduled to run daily at 5:00 AM CT
3. Executes: `node dist/index.js daily --discord --db`
4. Logs output to `~/logs/defi-stuff/`

### Manual Control
```bash
# Load the job
launchctl load -w ~/Library/LaunchAgents/com.defi-stuff.daily.plist

# Unload the job
launchctl unload -w ~/Library/LaunchAgents/com.defi-stuff.daily.plist

# Run immediately for testing
launchctl start com.defi-stuff.daily
```

**Important**: The scheduler runs from `dist/index.js`, so run `npm run build` after code changes.

### Confidence Calibration Scheduling

Automated weekly confidence calibration using macOS launchd:

#### Setup Weekly Calibration
```bash
# Set up scheduled weekly calibration (Sundays at 6:00 AM CT)
npm run scheduler:calibration:setup

# Verify scheduler configuration
npm run scheduler:calibration:verify

# Test scheduler immediately
npm run scheduler:calibration:test
```

#### Schedule Details
- **Frequency**: Weekly (every Sunday)
- **Time**: 6:00 AM CT (11:00 AM UTC during standard time)
- **Command**: `node dist/index.js confidence:calibrate -m BTC --discord`
- **Discord**: Automatically sends notifications for significant calibration changes
- **Logs**: `logs/confidence-calibration-output.log` and `logs/confidence-calibration-error.log`

#### Why Weekly?
- Requires sufficient sample size (10+ directional trades) for reliable calibration
- Market patterns remain stable within weekly timescales
- Allows full week of recommendation data to accumulate (35-50 trades)
- Runs Sunday morning before markets open, using previous week's data

#### Manual Control
```bash
# Load the job
launchctl load -w ~/Library/LaunchAgents/com.defi-stuff.confidence-calibration.plist

# Unload the job
launchctl unload -w ~/Library/LaunchAgents/com.defi-stuff.confidence-calibration.plist

# Run immediately for testing
launchctl start com.defi-stuff.confidence-calibration

# Check job status
launchctl list | grep confidence-calibration
```

**Important**: The scheduler runs from `dist/index.js`, so run `npm run build` after code changes.

## Portfolio Charts

Generate visual portfolio performance charts from historical balance data:

### Chart Types
- **Full Chart**: Shows all tracked metrics on dual Y-axes (USD/ETH) - traditional single chart
- **Simplified Chart**: Multi-panel layout with 4 separate charts, each optimally scaled:
  - **Panel 1**: Portfolio (total USD value, single line, ~$900K+ scale)
  - **Panel 2**: Tokemak: ETH (Auto ETH + Dinero ETH combined into single line)
  - **Panel 3**: Flex FLP (single line, ~$90K scale)
  - **Panel 4**: Tokemak: USD (Auto USD + Base USD combined into single line, ~$57K scale)
- **Both**: Generates both full and simplified versions

### Chart Commands
```bash
# Generate 7-day portfolio chart
node dist/index.js chart

# Generate 14-day chart
node dist/index.js chart --days 14

# Generate only simplified chart
node dist/index.js chart --type simple

# Generate charts for specific wallet
node dist/index.js chart --address 0x123...

# Save charts to custom directory
node dist/index.js chart --output /path/to/charts
```

### Discord Integration with Charts
```bash
# Send daily report with manual chart to Discord
node dist/index.js daily --discord --chart

# Save to database and send Discord report with automatic 30-day chart
node dist/index.js daily --discord --db

# Manual control: save to DB, send to Discord, and include chart
node dist/index.js daily --discord --db --chart
```

### Chart Features
- **Multi-Panel Layout**: Simplified charts use 4 separate panels to solve scale comparison issues
- **Dual Y-Axes**: Full charts use USD values (left axis) and ETH values (right axis)
- **Optimized Scaling**: Each panel scales appropriately for its data range (no more invisible small positions!)
- **Clean Design**: No main titles, Y-axis labels, or legends - focus on data trends
- **Protocol-Based Titles**: "Portfolio", "Tokemak: ETH", "Flex FLP", "Tokemak: USD"
- **Professional Formatting**: USD values show as $1.2M, $500K; ETH values show as 47.18 ETH
- **Composite Images**: Multi-panel charts are 1200x800px for better readability
- **Automatic Generation**: Daily reports with `--discord --db` automatically include 30-day charts

### Chart Storage
- Charts are saved to `charts/` directory by default
- Files are named with timestamp and type (e.g., `portfolio-simple-2025-09-01.png`)
- Old charts are automatically cleaned up (30 days retention)
- Chart generation requires historical data from `daily --db` runs

## Discord Integration

Rich message formatting with Discord.js:

### Message Types
- **Text Messages**: Simple formatted messages with fields
- **Embed Messages**: Rich embeds with colors, timestamps, and structured data

### Usage Pattern
```typescript
import { discordService, DiscordColors } from './api/discord/discordService.js';

const message = discordService.createEmbedMessage()
  .addTitle('Daily Report')
  .addDescription('Portfolio update')
  .setColor(DiscordColors.GREEN)
  .addTimestamp()
  .build();

await discordService.sendMessage(message);
await discordService.shutdown(); // Always cleanup
```

## Common Development Tasks

### Adding New Commands
1. Create command file in `src/commands/`
2. Export async function with proper typing
3. Register in `src/index.ts` using Commander.js
4. Add corresponding test in `test/commands/`
5. Update this documentation if the command introduces new patterns

### Adding New API Integrations
1. Create client class in `src/api/<service>/`
2. Define response types in `src/types/`
3. Create service layer for business logic
4. Mock HTTP calls in tests using axios-mock-adapter
5. Add required environment variables to `.env.template`

### Database Schema Changes
1. Create migration: `npx knex migrate:make <name> --knexfile knexfile.cjs`
2. Update service classes in `src/db/`
3. Add tests for new database operations
4. Update type definitions if needed

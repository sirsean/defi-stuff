# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

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
- Funding rate (per hour) with direction
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

**Important Notes:**
- **Live Execution**: Requires `MAIN_PRIVATE_KEY` environment variable
- **Network**: All commands validate you're on Base mainnet (chain ID 8453)
- **Gas Costs**: Monitor transaction gas costs on Base
- **Risk**: Start with small position sizes when testing
- **Liquidation**: Monitor positions regularly to avoid liquidation

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

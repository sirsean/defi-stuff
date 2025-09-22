# DeFi Stuff

A general-use project to interact with DeFi protocols across multiple blockchains.

## Features

- Interact with smart contracts using ethers.js
- Connect to multiple blockchains using Alchemy RPC
- Integrate with DeFi APIs (Debank, Etherscan v2 multi-chain)
- Query protocol information from DeBank API
- Search and filter protocols by name
- Query user position data for protocols
- Display pool information with friendly names
- Fetch contract ABIs from multiple blockchains
- Send rich formatted messages to Discord
- Store daily balance reports in SQLite database for historical tracking
- Query historical balance data with date range filtering
- Run scheduled tasks

## Project Structure

```
defi-stuff/
├── db/                 # Database files and migrations
│   ├── migrations/     # Database migration files
│   └── seeds/          # Database seed files
├── dist/               # Compiled TypeScript output
├── node_modules/       # Dependencies
├── src/                # Source code
│   ├── api/            # API clients
│   │   ├── debank/     # Debank API implementation
│   │   └── explorers/  # Blockchain explorer API clients (Etherscan v2 multi-chain)
│   ├── commands/       # CLI command implementations
│   │   ├── ping.ts     # Basic ping command
│   │   ├── protocols.ts # Protocol search command
│   │   ├── userProtocol.ts # User protocol data command
│   │   ├── daily.ts    # Daily report command
│   │   ├── history.ts  # Historical data query command
│   │   └── abi.ts      # Contract ABI fetching command
│   ├── db/             # Database services and utilities
│   ├── types/          # Type definitions
│   ├── utils/          # Utility functions
│   └── index.ts        # Entry point and CLI definitions
├── .env                # Environment variables (not committed)
├── .env.template       # Template for environment variables
├── .gitignore          # Git ignore file
├── knexfile.js         # Knex database configuration
├── package.json        # Project metadata and scripts
├── README.md           # Project documentation
└── tsconfig.json       # TypeScript configuration
```

## Installation

1. Clone the repository
2. Install dependencies:

```bash
npm install
```

3. Create a `.env` file based on `.env.template` and add your API keys and configuration. Required API keys include:
   - `DEBANK_API_KEY` - for DeBank API access
- `ETHERSCAN_API_KEY` - for Etherscan v2 multi-chain API access (used for Ethereum, Base, and other supported chains)
   - `DISCORD_APP_TOKEN` - Discord bot token from [Discord Developer Portal](https://discord.com/developers/applications)
   - `DISCORD_CHANNEL_ID` - ID of the Discord channel where messages will be sent

## Usage

Build the project:

```bash
npm run build
```

Run a command:

```bash
node dist/index.js <command>
```

For development:

```bash
npm run dev -- <command>
```

Available commands:

- `ping`: Verify that the application is running correctly

```bash
node dist/index.js ping
```

- `protocols <chain>`: Search for protocols on a specific blockchain
  - Options:
    - `-s, --search <term>`: Search term to filter protocols by name or ID

```bash
# List all protocols on Ethereum
node dist/index.js protocols eth

# Search for a specific protocol on Ethereum
node dist/index.js protocols eth --search uniswap

# List all protocols on Arbitrum
node dist/index.js protocols arbitrum
```

- `balance [address]`: Get a wallet's USD balance across all supported chains
  - Options:
    - `-t, --threshold <value>`: Minimum USD value to show a chain (default: 1000)
    - `-a, --address <address>`: Override the wallet address from environment variables
  - Note: Requires `WALLET_ADDRESS` to be set in `.env` file if no address is provided

```bash
# Get balance using the default wallet address from .env
node dist/index.js balance

# Get total balance and per-chain balances above $1,000 for a specific address
node dist/index.js balance 0x1234567890abcdef1234567890abcdef12345678

# Get balance for a specific address using the -a option
node dist/index.js balance -a 0x1234567890abcdef1234567890abcdef12345678

# Get total balance and per-chain balances above $10,000
node dist/index.js balance 0x1234567890abcdef1234567890abcdef12345678 -t 10000
```

- `daily [address]`: Generate a daily financial report for a wallet
  - Options:
    - `-a, --address <address>`: Override the wallet address from environment variables
    - `-d, --discord`: Send the report to Discord
    - `--db`: Save the daily report data to the database
  - Note: Requires `WALLET_ADDRESS` to be set in `.env` file if no address is provided

```bash
# Generate daily report using the default wallet address from .env
node dist/index.js daily

# Generate daily report for a specific address
node dist/index.js daily 0x1234567890abcdef1234567890abcdef12345678

# Generate daily report and send it to Discord
node dist/index.js daily --discord

# Generate daily report, send it to Discord and save to database
node dist/index.js daily --discord --db

# Generate daily report for a specific address, send it to Discord and save to database
node dist/index.js daily 0x1234567890abcdef1234567890abcdef12345678 --discord --db
```

The daily report includes:
- Overall wallet USD balance
- USD value of autoUSD positions
- ETH value of autoETH + dineroETH positions
- USD value of FLP positions with token breakdowns
- Pending rewards for Tokemak and Base Flex protocols

When using the `--db` flag, the report data is saved to a SQLite database for historical tracking and analysis.

- `history [address]`: Query and display historical daily report data from the database
  - Options:
    - `-a, --address <address>`: Override the wallet address from environment variables
    - `-d, --days <number>`: Number of days to look back from today
    - `-r, --range <dates>`: Date range in YYYY-MM-DD,YYYY-MM-DD format
  - Note: Requires `WALLET_ADDRESS` to be set in `.env` file if no address is provided

```bash
# Get all historical data for the default wallet
node dist/index.js history

# Get all historical data for a specific wallet
node dist/index.js history 0x1234567890abcdef1234567890abcdef12345678

# Get historical data for the past 7 days
node dist/index.js history --days 7

# Get historical data for a specific date range
node dist/index.js history --range 2023-01-01,2023-12-31

# Get historical data for a specific wallet and date range
node dist/index.js history 0x1234567890abcdef1234567890abcdef12345678 --range 2023-01-01,2023-12-31
```

The history command displays a table of past daily reports, showing:
- Date of the report
- Total USD value
- AUTO USD value
- AUTO ETH value
- Dinero ETH value
- FLP USD value
- Pending rewards USD value

- `user-protocol <protocol_id>`: Get user data for a specific protocol
  - Options:
    - `-a, --address <address>`: Override the wallet address from environment variables
    - `-j, --json`: Output raw JSON data for debugging
  - Note: Requires `WALLET_ADDRESS` to be set in `.env` file if no address is provided

```bash
# Get user data for Aave on Ethereum
node dist/index.js user-protocol aave

# Get user data for Uniswap using a specific wallet address
node dist/index.js user-protocol uniswap_eth --address 0x123456789abcdef...

# Get raw JSON output for debugging
node dist/index.js user-protocol aave --json
```

- `abi <address>`: Fetch and print a contract's ABI
  - Options:
    - `--ignoreProxy`: Skip proxy implementation detection
    - `-c, --chain <chain>`: Blockchain to use (ethereum, base)
  - Note: Requires `ETHERSCAN_API_KEY` in `.env` (Etherscan v2 uses a single API key with chainid to access multiple chains)

```bash
# Fetch ABI for a contract on Ethereum (default)
node dist/index.js abi 0x1234567890abcdef1234567890abcdef12345678

# Fetch ABI for a contract on Base
node dist/index.js abi 0x1234567890abcdef1234567890abcdef12345678 --chain base

# Fetch ABI for a contract without proxy resolution
node dist/index.js abi 0x1234567890abcdef1234567890abcdef12345678 --ignoreProxy

# Save ABI to a file
node dist/index.js abi 0x1234567890abcdef1234567890abcdef12345678 > contract-abi.json
```

- `flp:compound`: Compound Flex FLP rewards on Base and report gas (ETH) and USDC received
  - Options:
    - `--dry-run`: Estimate gas and show a summary without sending a transaction
  - Requirements:
    - Base RPC. By default uses `https://mainnet.base.org`. If `ALCHEMY_API_KEY` is set, uses `https://base-mainnet.g.alchemy.com/v2/$ALCHEMY_API_KEY` for better reliability.
    - For live execution (without `--dry-run`), set `MAIN_PRIVATE_KEY` in your environment. This key is used to sign the transaction on Base mainnet. Do not share or commit this key.
  - Output:
    - Gas used, effective gas price, and total ETH paid
    - USDC received (computed from Transfer logs to your address, with a balance-delta fallback)

```bash
# Dry run: estimate gas and show a summary (no transaction sent)
npm run dev -- flp:compound --dry-run

# Live execution (requires MAIN_PRIVATE_KEY)
node dist/index.js flp:compound

# Using dev runner with live execution
npm run dev -- flp:compound
```

Notes:
- The command validates you are on Base (chainId 8453) and will exit with an error if not.
- MAIN_PRIVATE_KEY should correspond to the wallet receiving USDC from compounding. The command detects received USDC by parsing ERC-20 Transfer logs to your address.
- For accurate gas estimation during dry-run, setting MAIN_PRIVATE_KEY helps some nodes simulate from your address; otherwise estimation may be conservative or fail.

## Development

### Testing

This project uses Vitest and axios-mock-adapter for testing:

- **Vitest**: Modern test framework with TypeScript support and ESM compatibility
- **axios-mock-adapter**: Mocks HTTP requests to test API integrations without network calls

To run tests:

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage report
npm run test:coverage
```

### Adding New Commands

1. Create a new file in the `src/commands/` directory
2. Export a function that implements the command
3. Register the command in `src/index.ts`
4. Add tests for the new command in the `test/commands/` directory

Example:

```typescript
// src/commands/myCommand.ts
export function myCommand(options: any): void {
  // Implementation
}

// In src/index.ts
import { myCommand } from './commands/myCommand.js';

program
  .command('my-command')
  .description('Description of my command')
  .option('-o, --option <value>', 'Description of option')
  .action(myCommand);
```

### Discord Integration

The Discord integration allows you to send beautifully formatted messages to a Discord channel. It provides:

- Connection management with proper event handling
- Text message formatting with fields and timestamps
- Rich embed messages with colors and formatting
- Easy-to-use builder pattern for message construction

Example usage:

```typescript
import { discordService, DiscordColors } from './api/discord';

// Simple text message
const textMessage = discordService.createTextMessage()
  .addTitle('Protocol Update')
  .addDescription('Latest information about your protocols')
  .addFields([
    { name: 'Wallets Tracked', value: '5' },
    { name: 'Protocols', value: '12' }
  ])
  .addTimestamp()
  .build();

// Rich embed message
const embedMessage = discordService.createEmbedMessage()
  .addTitle('🔍 Protocol Alert')
  .addDescription('A significant change has been detected')
  .addField('Protocol', 'UniswapV3', true)
  .addField('Change', '+15.4%', true)
  .setColor(DiscordColors.GREEN)
  .addTimestamp()
  .build();

// Send messages
await discordService.sendMessage(textMessage);
await discordService.sendMessage(embedMessage);

// Always disconnect when done
await discordService.shutdown();
```

See [discordExample.ts](./src/examples/discordExample.ts) for a complete example.

#### Testing Discord Integration

To verify your Discord integration is working properly:

```bash
# Build the project
npm run build

# Run the test script
node dist/testDiscord.js
```

This will send a simple test message to your configured Discord channel. It's useful for:

- Verifying your environment variables are correct
- Ensuring your bot has proper permissions in the channel
- Testing that the message formatting is working as expected

If the test is successful, you'll see "Message sent successfully! ✅" in the console and a test message will appear in your Discord channel.

### Database Integration

The project includes SQLite database integration to store historical daily balance reports. This allows you to:

- Track portfolio values over time
- Monitor changes in key positions
- Analyze performance trends
- Create historical reports

#### Database Setup

The database setup is managed using Knex.js, a flexible SQL query builder. The following scripts are available in `package.json`:

```bash
# Run all pending migrations
npm run db:migrate

# Roll back the most recent migration
npm run db:rollback

# Run database seeds (if available)
npm run db:seed
```

Before using the database, make sure to run the migrations:

```bash
npm run db:migrate
```

This will create the necessary tables in the SQLite database.

#### Database Structure

The main table for storing daily reports is `daily_balance`, which includes:

- Basic reporting information (timestamp, wallet address)
- Total wallet USD value
- Position-specific values (autoUSD, autoETH, dineroETH, FLP)
- Pending rewards (TOKE, USDC, total USD value)
- Additional metadata stored as JSON

#### Database Files

Database files are stored in the `db` directory:

- `db/defi_data_dev.sqlite3`: Development database
- `db/defi_data.sqlite3`: Production database

These files are automatically generated when you run migrations. They are excluded from git version control (via `.gitignore`).

#### Querying Historical Data

To view historical data stored in the database, use the `history` command:

```bash
# View all historical records
npm run dev -- history

# View records from the past 30 days
npm run dev -- history --days 30

# View records for a specific date range
npm run dev -- history --range 2023-01-01,2023-12-31
```

The results are displayed in a formatted table showing:
- Date
- Total USD value
- AUTO USD value
- AUTO ETH value
- Dinero ETH value
- FLP USD value
- Pending rewards USD value

This makes it easy to track your portfolio's performance over time.

### Scheduling

You can schedule the daily report to run automatically using macOS's built-in scheduling system.

#### Using launchd (recommended)

launchd is macOS's native and recommended scheduling system that offers more features than crontab.

1. Set up the scheduled task:

```bash
npm run scheduler:setup
```

This script:
- Creates a launchd plist file in ~/Library/LaunchAgents
- Configures it to run daily at 5:00 AM CT
- Loads it into launchd
- Creates logs for stdout and stderr output

2. Verify the configuration:

```bash
npm run scheduler:verify
```

This will show:
- If the job is loaded correctly
- The scheduled runtime
- Where logs will be written

3. Test the scheduled task immediately:

```bash
npm run scheduler:test
```

This command:
- Verifies the job is loaded in launchd
- Triggers the job to run immediately (no need to wait for scheduled time)
- Informs you where to find the logs to verify proper execution

The scheduled task will run:
- Daily at 5:00 AM CT
- With environment variables from your .env file
- With full logging to track any issues

**Important Note:** The scheduled task runs from the compiled JavaScript in `dist/index.js`, not the TypeScript source. After making any code changes, you must rebuild the project with `npm run build` for the scheduled task to pick up those changes.

#### Manual launchd Setup

If you prefer to configure manually:

1. Copy the template from `scripts/templates/com.defi-stuff.daily.plist`
2. Replace `__WORKING_DIR__` with your project directory path
3. Copy to `~/Library/LaunchAgents/com.defi-stuff.daily.plist`
4. Load with: `launchctl load -w ~/Library/LaunchAgents/com.defi-stuff.daily.plist`

#### Alternative: Using Crontab

If you prefer using crontab instead of launchd:

```bash
# Edit crontab
crontab -e

# Add this line to run daily at 5am CT
0 5 * * * cd /path/to/defi-stuff && npm run start -- daily --discord --db
```

Note that crontab doesn't handle environment variables from .env files by default, so you might need additional configuration.
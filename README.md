# DeFi Stuff

A general-use project to interact with DeFi protocols across multiple blockchains.

## Features

- Interact with smart contracts using ethers.js
- Connect to multiple blockchains using Alchemy RPC
- Integrate with DeFi APIs (Debank, Etherscan, Basescan)
- Query protocol information from DeBank API
- Search and filter protocols by name
- Query user position data for protocols
- Display pool information with friendly names
- Fetch contract ABIs from multiple blockchains
- Send rich formatted messages to Discord
- Run scheduled tasks

## Project Structure

```
defi-stuff/
├── dist/               # Compiled TypeScript output
├── node_modules/       # Dependencies
├── src/                # Source code
│   ├── api/            # API clients
│   │   ├── debank/     # Debank API implementation
│   │   └── explorers/  # Blockchain explorer API clients (Etherscan, Basescan)
│   ├── commands/       # CLI command implementations
│   │   ├── ping.ts     # Basic ping command
│   │   ├── protocols.ts # Protocol search command
│   │   ├── userProtocol.ts # User protocol data command
│   │   └── abi.ts      # Contract ABI fetching command
│   ├── types/          # Type definitions
│   ├── utils/          # Utility functions
│   └── index.ts        # Entry point and CLI definitions
├── .env                # Environment variables (not committed)
├── .env.template       # Template for environment variables
├── .gitignore          # Git ignore file
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
   - `ETHERSCAN_API_KEY` - for Etherscan API access
   - `BASESCAN_API_KEY` - for Basescan API access (if using Base blockchain)
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
  - Note: Requires `WALLET_ADDRESS` to be set in `.env` file if no address is provided

```bash
# Generate daily report using the default wallet address from .env
node dist/index.js daily

# Generate daily report for a specific address
node dist/index.js daily 0x1234567890abcdef1234567890abcdef12345678

# Generate daily report and send it to Discord
node dist/index.js daily --discord

# Generate daily report for a specific address and send it to Discord
node dist/index.js daily 0x1234567890abcdef1234567890abcdef12345678 --discord
```

The daily report includes:
- Overall wallet USD balance
- USD value of autoUSD positions
- ETH value of autoETH + dineroETH positions
- USD value of FLP positions with token breakdowns
- Pending rewards for Tokemak and Base Flex protocols

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
  - Note: Requires appropriate API keys in `.env` file (`ETHERSCAN_API_KEY` for Ethereum, `BASESCAN_API_KEY` for Base)

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

### Scheduling

The project uses macOS scheduling tools to run commands on different schedules.

#### Setting Up a Daily Report

To schedule the daily report to run automatically each morning:

1. Open your crontab for editing:

```bash
crontab -e
```

2. Add an entry to run the daily report at 5:00 AM and send it to Discord:

```
# Run daily DeFi report at 5:00 AM with Discord notification
0 5 * * * cd /path/to/defi-stuff && /usr/local/bin/node dist/index.js daily --discord
```

3. Save and exit. Your daily report will now run automatically each morning at 5:00 AM and send results to Discord.

Notes:
- Use absolute paths to avoid any issues with cron's default PATH
- Ensure your environment variables (like `WALLET_ADDRESS` and Discord credentials) are properly set up
- You can adjust the time by changing the crontab entry (the format is: minute hour day month weekday)
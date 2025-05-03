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
- Send notifications to Discord
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

### Scheduling

The project uses macOS scheduling tools to run commands on different schedules. (Configuration details to be added as this feature is implemented)
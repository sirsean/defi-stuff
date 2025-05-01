# DeFi Stuff

A general-use project to interact with DeFi protocols across multiple blockchains.

## Features

- Interact with smart contracts using ethers.js
- Connect to multiple blockchains using Alchemy RPC
- Integrate with DeFi APIs (Debank, Defillama, Etherscan)
- Send notifications to Discord
- Run scheduled tasks

## Project Structure

```
defi-stuff/
├── dist/               # Compiled TypeScript output
├── node_modules/       # Dependencies
├── src/                # Source code
│   ├── commands/       # CLI command implementations
│   │   └── ping.ts     # Basic ping command
│   ├── index.ts        # Entry point and CLI definitions
│   └── ...             # Additional modules (upcoming)
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

3. Create a `.env` file based on `.env.template` and add your API keys and configuration.

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

## Development

### Adding New Commands

1. Create a new file in the `src/commands/` directory
2. Export a function that implements the command
3. Register the command in `src/index.ts`

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
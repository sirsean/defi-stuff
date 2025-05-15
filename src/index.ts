#!/usr/bin/env node

import { Command } from 'commander';
import dotenv from 'dotenv';
import { ping } from './commands/ping.js';
import { protocols } from './commands/protocols.js';
import { userProtocol } from './commands/userProtocol.js';
import { abi } from './commands/abi.js';
import { balance } from './commands/balance.js';
import { daily } from './commands/daily.js';

// Load environment variables
dotenv.config();

// Create CLI program
const program = new Command();

program
  .name('defi-stuff')
  .description('Interact with DeFi protocols across multiple blockchains')
  .version('1.0.0');

// Register commands
program
  .command('ping')
  .description('Check if the application is running correctly')
  .action(ping);

program
  .command('protocols <chain>')
  .description('Search for protocols on a specific blockchain')
  .option('-s, --search <term>', 'Search term to filter protocols by name or ID')
  .action(protocols);

program
  .command('user-protocol <protocol_id>')
  .description('Get user data for a specific protocol')
  .option('-a, --address <address>', 'Override the wallet address from environment variables')
  .option('-j, --json', 'Output raw JSON data for debugging')
  .action(userProtocol);

program
  .command('abi <address>')
  .description('Fetch ABI for a contract address')
  .option('--ignoreProxy', 'Skip proxy implementation detection')
  .option('-c, --chain <chain>', 'Blockchain to use (ethereum, base)')
  .action(abi);

program
  .command('balance [address]')
  .description('Get wallet balance across all chains')
  .option('-t, --threshold <value>', 'Minimum USD value to show a chain (default: 1000)', parseInt)
  .option('-a, --address <address>', 'Override the wallet address from environment variables')
  .action(balance);

program
  .command('daily [address]')
  .description('Generate a daily report of wallet balances and protocol positions')
  .option('-a, --address <address>', 'Override the wallet address from environment variables')
  .option('-d, --discord', 'Send the report to Discord')
  .action(daily);

// Parse command line arguments
program.parse();
#!/usr/bin/env node

import { Command } from 'commander';
import dotenv from 'dotenv';
import { ping } from './commands/ping.js';
import { protocols } from './commands/protocols.js';
import { userProtocol } from './commands/userProtocol.js';

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

// Parse command line arguments
program.parse();
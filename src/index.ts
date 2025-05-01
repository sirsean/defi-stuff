#!/usr/bin/env node

import { Command } from 'commander';
import dotenv from 'dotenv';
import { ping } from './commands/ping.js';

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

// Parse command line arguments
program.parse();
#!/usr/bin/env node

import { Command } from "commander";
import dotenv from "dotenv";
import { ping } from "./commands/ping.js";
import { protocols } from "./commands/protocols.js";
import { userProtocol } from "./commands/userProtocol.js";
import { abi } from "./commands/abi.js";
import { balance } from "./commands/balance.js";
import { daily } from "./commands/daily.js";
import { history } from "./commands/history.js";
import { chart } from "./commands/chart.js";
import { fearGreedIndex } from "./commands/fearGreedIndex.js";
import { btcPrediction } from "./commands/btcPrediction.js";
import { flexBalance } from "./commands/flex/flexBalance.js";
import { flexPositions } from "./commands/flex/flexPositions.js";
import { flexPrice } from "./commands/flex/flexPrice.js";
import { flexOrder } from "./commands/flex/flexOrder.js";
import { flexClose } from "./commands/flex/flexClose.js";
import { flexOrders } from "./commands/flex/flexOrders.js";
import { flexDeposit } from "./commands/flex/flexDeposit.js";
import { flexWithdraw } from "./commands/flex/flexWithdraw.js";
import { tradeRecommendation } from "./commands/tradeRecommendation.js";
import { tradeBacktest } from "./commands/tradeBacktest.js";
import { confidenceCalibrate } from "./commands/confidenceCalibrate.js";

// Load environment variables
dotenv.config();

// Create CLI program
const program = new Command();

program
  .name("defi-stuff")
  .description("Interact with DeFi protocols across multiple blockchains")
  .version("1.0.0");

// Register commands
program
  .command("ping")
  .description("Check if the application is running correctly")
  .action(ping);

program
  .command("protocols <chain>")
  .description("Search for protocols on a specific blockchain")
  .option(
    "-s, --search <term>",
    "Search term to filter protocols by name or ID",
  )
  .action(protocols);

program
  .command("user-protocol <protocol_id>")
  .description("Get user data for a specific protocol")
  .option(
    "-a, --address <address>",
    "Override the wallet address from environment variables",
  )
  .option("-j, --json", "Output raw JSON data for debugging")
  .action(userProtocol);

program
  .command("abi <address>")
  .description("Fetch ABI for a contract address")
  .option("--ignoreProxy", "Skip proxy implementation detection")
  .option("-c, --chain <chain>", "Blockchain to use (ethereum, base)")
  .option("-o, --output <filename>", "Write ABI JSON to file instead of stdout")
  .action(abi);

program
  .command("balance [address]")
  .description("Get wallet balance across all chains")
  .option(
    "-t, --threshold <value>",
    "Minimum USD value to show a chain (default: 1000)",
    parseInt,
  )
  .option(
    "-a, --address <address>",
    "Override the wallet address from environment variables",
  )
  .action(balance);

program
  .command("daily [address]")
  .description(
    "Generate a daily report of wallet balances and protocol positions",
  )
  .option(
    "-a, --address <address>",
    "Override the wallet address from environment variables",
  )
  .option("-d, --discord", "Send the report to Discord")
  .option("--db", "Save the report data to the database")
  .option(
    "-c, --chart",
    "Generate and include a portfolio chart with Discord report",
  )
  .option(
    "--claim-compound",
    "Claim Flex FLP USDC rewards and deposit to baseUSD before fetching data",
  )
  .action(daily);

program
  .command("history [address]")
  .description("Query historical daily balance data from the database")
  .option(
    "-a, --address <address>",
    "Override the wallet address from environment variables",
  )
  .option(
    "-d, --days <number>",
    "Number of days to look back from today",
    parseInt,
  )
  .option("-r, --range <dates>", "Date range in YYYY-MM-DD,YYYY-MM-DD format")
  .option("-t, --table", "Display results in table format (legacy view)")
  .action(history);

program
  .command("chart [address]")
  .description("Generate portfolio performance charts from historical data")
  .option(
    "-a, --address <address>",
    "Override the wallet address from environment variables",
  )
  .option(
    "-d, --days <number>",
    "Number of days to look back (default: 7)",
    parseInt,
  )
  .option(
    "-t, --type <type>",
    "Chart type: full, simple, or both (default: both)",
    /^(full|simple|both)$/i,
  )
  .option("-o, --output <dir>", "Output directory for charts (default: charts)")
  .action(chart);

program
  .command("fear-and-greed-index")
  .description("Get the crypto Fear and Greed Index with trend analysis")
  .option("-l, --limit <number>", "Number of days to analyze (default: 10)")
  .action(fearGreedIndex);

program
  .command("btc-prediction")
  .description("Get BTC price prediction from Polymarket prediction markets")
  .option(
    "-d, --date <YYYY-MM-DD>",
    "Target date for prediction (default: 2025-12-31)",
  )
  .option("-j, --json", "Output raw JSON data")
  .action(btcPrediction);

// New: baseUSD add (deposit + stake via router)
import { baseusdAdd } from "./commands/baseusdAdd.js";
program
  .command("baseusd:add <amount>")
  .description(
    "Deposit USDC to baseUSD via Autopilot Router and stake it (Base). Amount is a USDC decimal string.",
  )
  .option("--dry-run", "Estimate gas and show summary without sending")
  .option(
    "--debug",
    "Print detailed internals and decoding to help debug failures",
  )
  .option(
    "--probe-slippage <bpsList>",
    "Comma-separated bps values to test in dry-run (e.g. 10,25,50,100,200)",
  )
  .action(baseusdAdd);

// New: Flex FLP compound command
import { flpCompound } from "./commands/flpCompound.js";
program
  .command("flp:compound")
  .description(
    "Compound Flex FLP rewards on Base and report gas (ETH) and USDC received",
  )
  .option("--dry-run", "Estimate gas and show summary without sending")
  .action(flpCompound);

// Flex Perpetuals Commands
program
  .command("flex:balance")
  .description("Check Flex USDC collateral balance")
  .option(
    "-a, --address <address>",
    "Override the wallet address from environment variables",
  )
  .action(flexBalance);

program
  .command("flex:positions")
  .description(
    "View open positions with PnL, liquidation prices, and risk levels",
  )
  .option(
    "-a, --address <address>",
    "Override the wallet address from environment variables",
  )
  .option(
    "-m, --market <symbol>",
    "Filter by market symbol (e.g., BTC, ETH, SOL)",
  )
  .action(flexPositions);

program
  .command("flex:price")
  .description("Get market prices, funding rates, and market information")
  .option(
    "-m, --market <symbol>",
    "Market symbol to query (e.g., BTC, ETH, SOL)",
  )
  .option("--all", "Show prices for all markets")
  .action(flexPrice);

program
  .command("flex:order <type>")
  .description("Place market or limit orders (type: market or limit)")
  .option("--sub <id>", "Subaccount ID to use (0-255, default: 0)")
  .option("-m, --market <symbol>", "Market symbol (e.g., BTC, ETH, SOL)", "")
  .option("-s, --side <side>", "Order side: long/buy or short/sell", "")
  .option("--size <usd>", "Position size in USD", "")
  .option("-p, --price <price>", "Limit price (required for limit orders)")
  .option("--slippage <percent>", "Slippage tolerance in percent (default: 1)")
  .option("--reduce-only", "Reduce-only order (limit orders only)")
  .option("--dry-run", "Validate order without executing")
  .action((type, options) => {
    if (type !== "market" && type !== "limit") {
      console.error(
        `❌ Error: Invalid order type '${type}'. Use 'market' or 'limit'`,
      );
      process.exit(1);
    }
    flexOrder(type as "market" | "limit", options);
  });

program
  .command("flex:close")
  .description("Close an open position (full or partial)")
  .option("--sub <id>", "Subaccount ID to use (0-255, default: 0)")
  .option("-m, --market <symbol>", "Market symbol (e.g., BTC, ETH, SOL)", "")
  .option(
    "--percent <percent>",
    "Percentage of position to close (1-100, default: 100)",
  )
  .option("--slippage <percent>", "Slippage tolerance in percent (default: 1)")
  .option("--dry-run", "Show close details without executing")
  .action(flexClose);

program
  .command("flex:orders")
  .description("View pending orders and cancel orders")
  .option("--sub <id>", "Subaccount ID to query (0-255, default: 0)")
  .option(
    "--subs <ids>",
    "Multiple subaccount IDs separated by commas (e.g., 0,1,2)",
  )
  .option("-m, --market <symbol>", "Filter by market symbol (e.g., BTC, ETH)")
  .option("--cancel <orderId>", "Cancel an order by ID")
  .action(flexOrders);

program
  .command("flex:deposit <amount>")
  .description("Deposit USDC collateral into a Flex subaccount")
  .option("--sub <id>", "Subaccount ID to deposit into (0-255, default: 0)")
  .option("--dry-run", "Show deposit details without executing")
  .action((amount, options) => {
    flexDeposit({ ...options, amount });
  });

program
  .command("flex:withdraw <amount>")
  .description("Withdraw USDC collateral from a Flex subaccount")
  .option("--sub <id>", "Subaccount ID to withdraw from (0-255, default: 0)")
  .option("--dry-run", "Show withdrawal details without executing")
  .action((amount, options) => {
    flexWithdraw({ ...options, amount });
  });

program
  .command("trade:recommend")
  .description("Generate AI-powered trade recommendations")
  .option(
    "-m, --markets <markets>",
    "Comma-separated market symbols (default: BTC,ETH)",
  )
  .option(
    "-a, --address <address>",
    "Override the wallet address from environment variables",
  )
  .option(
    "--subs <ids>",
    "Subaccount IDs to query (comma-separated, default: 0)",
  )
  .option("-j, --json", "Output raw JSON data")
  .option("--db", "Persist generated trade recommendations to the database")
  .option("--discord", "Send recommendations to Discord channel")
  .option("--show-raw", "Display both raw and calibrated confidence scores")
  .action(tradeRecommendation);

program
  .command("trade:backtest")
  .description("Backtest historical trade recommendations against actual prices")
  .option(
    "-m, --market <market>",
    "Filter by market symbol (e.g., BTC, ETH)",
  )
  .option(
    "-d, --days <number>",
    "Number of days to look back",
    parseInt,
  )
  .option(
    "--hold-mode <mode>",
    "Hold interpretation: maintain, close, or both (default: maintain)",
  )
  .option("-j, --json", "Output raw JSON data")
  .option("-v, --verbose", "Show detailed trade-by-trade log")
  .action(tradeBacktest);

program
  .command("confidence:calibrate")
  .description("Compute and optionally save confidence calibration for a market")
  .requiredOption(
    "-m, --market <market>",
    "Market symbol (e.g., BTC, ETH)",
  )
  .option(
    "-d, --days <days>",
    "Analysis window in days (default: 60)",
    "60",
  )
  .option(
    "--dry-run",
    "Compute calibration but do not save to database",
    false,
  )
  .action((options) => {
    confidenceCalibrate({
      market: options.market,
      days: parseInt(options.days, 10),
      dryRun: options.dryRun,
    });
  });

// If no arguments, show help and exit successfully
if (process.argv.length <= 2) {
  program.outputHelp();
  process.exit(0);
}

// Parse command line arguments
program.parse();

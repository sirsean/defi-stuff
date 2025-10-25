/**
 * Flex Close Command
 * Close open positions (full or partial)
 */

import { FlexPrivateService } from "../../api/flex/flexPrivateService.js";
import { FlexPublicService } from "../../api/flex/flexPublicService.js";
import { MARKETS } from "../../api/flex/constants.js";
import { formatUsd, getSigner } from "../../api/flex/utils.js";

interface FlexCloseOptions {
  sub?: string;
  market: string;
  percent?: string;
  slippage?: string;
  dryRun?: boolean;
}

/**
 * Close a position (full or partial)
 */
export async function flexClose(options: FlexCloseOptions): Promise<void> {
  try {
    // Validate required options
    if (!options.market) {
      console.error("❌ Error: --market is required");
      process.exit(1);
    }

    // Parse subaccount ID
    const subAccountId = options.sub ? parseInt(options.sub, 10) : 0;
    if (isNaN(subAccountId) || subAccountId < 0 || subAccountId > 255) {
      console.error(`❌ Error: Invalid subaccount ID. Must be 0-255`);
      process.exit(1);
    }

    // Parse market
    const marketSymbol = options.market.toUpperCase();
    const market = Object.values(MARKETS).find(
      (m) => m.symbol === marketSymbol,
    );
    if (!market) {
      console.error(`❌ Error: Unknown market: ${options.market}`);
      console.error(
        `Available markets: ${Object.values(MARKETS)
          .map((m) => m.symbol)
          .join(", ")}`,
      );
      process.exit(1);
    }

    // Parse close percentage (default 100%)
    const closePercent = options.percent ? parseFloat(options.percent) : 100;
    if (isNaN(closePercent) || closePercent <= 0 || closePercent > 100) {
      console.error(
        `❌ Error: Invalid percent: ${options.percent}. Must be between 0 and 100`,
      );
      process.exit(1);
    }

    // Parse slippage (default 1%)
    const slippageBps = options.slippage
      ? parseFloat(options.slippage) * 100
      : 100;

    // Initialize services
    const signer = getSigner();
    const address = await signer.getAddress();
    const privateService = new FlexPrivateService(signer);
    const publicService = new FlexPublicService();

    console.log(`\n🔄 Close Position - ${market.symbol}\n`);

    // Get current position
    const position = await publicService.getPosition(address, market.index);

    if (!position) {
      console.error(
        `❌ No ${market.symbol} position found on subaccount ${subAccountId}\n`,
      );
      process.exit(1);
    }

    const direction = position.isLong ? "LONG 📈" : "SHORT 📉";
    const pnlSign = position.unrealizedPnl >= 0 ? "+" : "";
    const pnlColor = position.unrealizedPnl >= 0 ? "🟢" : "🔴";

    console.log(`Current Position:`);
    console.log(`  Market: ${market.symbol}`);
    console.log(`  Direction: ${direction}`);
    console.log(`  Size: ${formatUsd(position.size)}`);
    console.log(`  Entry Price: ${formatUsd(position.avgEntryPrice)}`);
    console.log(`  Current Price: ${formatUsd(position.currentPrice)}`);
    console.log(
      `  Unrealized PnL: ${pnlColor} ${pnlSign}${formatUsd(position.unrealizedPnl)}`,
    );
    console.log();

    // Calculate close size
    const closeSize = (position.size * closePercent) / 100;

    console.log(`Close Parameters:`);
    console.log(`  Close Percent: ${closePercent}%`);
    console.log(`  Close Size: ${formatUsd(closeSize)}`);
    console.log(`  Slippage: ${slippageBps / 100}%`);
    console.log(`  Subaccount: ${subAccountId}`);
    console.log();

    // Estimate PnL at close
    const estimatedPnl = (position.unrealizedPnl * closePercent) / 100;
    const totalFees = position.fundingFee + position.borrowingFee;
    const estimatedFees = (totalFees * closePercent) / 100;
    const netPnl = estimatedPnl - estimatedFees;

    console.log(`Estimated Outcome:`);
    console.log(`  PnL: ${pnlColor} ${pnlSign}${formatUsd(estimatedPnl)}`);
    console.log(`  Fees: ${formatUsd(estimatedFees)}`);
    console.log(
      `  Net PnL: ${netPnl >= 0 ? "🟢 +" : "🔴 "}${formatUsd(netPnl)}`,
    );
    console.log();

    // Dry run mode
    if (options.dryRun) {
      console.log("🏁 Dry run complete. No transaction sent.\n");
      return;
    }

    // Confirm close action
    console.log(
      `⏳ Closing ${closePercent}% of ${market.symbol} position...\n`,
    );

    // Execute close (which is opposite direction market order)
    const result = await privateService.closePosition(
      subAccountId,
      market.index,
      closePercent,
    );

    console.log(`✅ Position closed successfully!\n`);
    console.log(`Transaction Hash: ${result.transactionHash}`);
    console.log(`Block Number: ${result.blockNumber}`);
    console.log(`Gas Used: ${result.gasUsed}`);
    console.log();

    // Show remaining position if partial close
    if (closePercent < 100) {
      const remainingSize = position.size - closeSize;
      console.log(`💡 Remaining Position:`);
      console.log(`   Size: ${formatUsd(remainingSize)}`);
      console.log(`   Direction: ${direction}`);
      console.log();
    } else {
      console.log(`💡 Position fully closed\n`);
    }
  } catch (error: any) {
    console.error(`\n❌ Error: ${error.message}`);
    if (error.message.includes("Wrong network")) {
      console.error(
        `   Make sure you are connected to Base mainnet (chain ID 8453)`,
      );
    }
    if (error.message.includes("user rejected")) {
      console.error(`   Transaction was rejected in wallet`);
    }
    if (error.message.includes("No position")) {
      console.error(`   No position found for this market`);
    }
    console.error();
    process.exit(1);
  }
}

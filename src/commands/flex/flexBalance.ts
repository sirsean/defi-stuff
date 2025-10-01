/**
 * Flex Balance Command
 * Display account balance, collateral, equity, and leverage information
 */

import { FlexPublicService } from "../../api/flex/flexPublicService.js";
import { formatUsd, formatPercent } from "../../api/flex/utils.js";

interface FlexBalanceOptions {
  address?: string;
  sub?: string;
  subs?: string;
}

/**
 * Display account balance and margin information
 */
export async function flexBalance(options: FlexBalanceOptions): Promise<void> {
  try {
    // Get address from options or environment
    const address = options.address || process.env.WALLET_ADDRESS;
    if (!address) {
      console.error(
        "❌ Error: No address provided. Use --address or set WALLET_ADDRESS",
      );
      process.exit(1);
    }

    // Parse subaccount IDs
    let subAccountIds: number[] = [0]; // Default to subaccount 0

    if (options.subs) {
      // Multiple subaccounts: --subs 0,1,2
      subAccountIds = options.subs.split(",").map((s) => {
        const id = parseInt(s.trim(), 10);
        if (isNaN(id) || id < 0 || id > 255) {
          throw new Error(`Invalid subaccount ID: ${s}. Must be 0-255`);
        }
        return id;
      });
    } else if (options.sub !== undefined) {
      // Single subaccount: --sub 0
      const id = parseInt(options.sub, 10);
      if (isNaN(id) || id < 0 || id > 255) {
        throw new Error(`Invalid subaccount ID: ${options.sub}. Must be 0-255`);
      }
      subAccountIds = [id];
    }

    const publicService = new FlexPublicService();

    console.log(`\n📊 Flex Account Balance - ${address}\n`);

    // Query each subaccount
    for (const subAccountId of subAccountIds) {
      try {
        // Fetch equity and leverage data
        const equity = await publicService.getEquity(address, subAccountId);
        const leverage = await publicService.getLeverage(address, subAccountId);

        // Display header
        console.log(`${"=".repeat(60)}`);
        console.log(`📁 Subaccount ${subAccountId}`);
        console.log(`${"=".repeat(60)}`);

        // Collateral section
        console.log("\n💰 Collateral:");
        console.log(`  Total Collateral:    ${formatUsd(equity.collateral)}`);

        // Equity and PnL
        console.log("\n📈 Equity:");
        console.log(`  Total Equity:        ${formatUsd(equity.equity)}`);
        console.log(
          `  Unrealized PnL:      ${formatUsd(equity.unrealizedPnl)}`,
        );

        // Leverage and margin
        console.log("\n⚖️  Leverage:");
        console.log(`  Current Leverage:    ${leverage.leverage.toFixed(2)}x`);
        console.log(
          `  Total Position Size: ${formatUsd(leverage.totalPositionSize)}`,
        );

        // Available margin calculation
        const maxLeverage = 20; // Conservative default
        const maxPositionSize = equity.equity * maxLeverage;
        const availableMargin = Math.max(
          0,
          maxPositionSize - leverage.totalPositionSize,
        );

        console.log(
          `  Available Margin:    ${formatUsd(availableMargin)} (at ${maxLeverage}x)`,
        );

        // Position summary
        console.log("\n📍 Positions:");
        console.log(`  Open Positions:      ${equity.positions.length}`);

        if (equity.positions.length > 0) {
          console.log("\n  Active Markets:");
          for (const position of equity.positions) {
            const direction = position.isLong ? "LONG" : "SHORT";
            const pnlSign = position.unrealizedPnl >= 0 ? "+" : "";
            console.log(
              `    • ${position.symbol.padEnd(6)} ${direction.padEnd(5)} ${formatUsd(position.size).padStart(12)} (PnL: ${pnlSign}${formatUsd(position.unrealizedPnl)})`,
            );
          }
        }

        // Health indicator
        console.log("\n🏥 Account Health:");
        let healthStatus = "🟢 Healthy";
        let healthMessage = "Account is in good standing";

        if (leverage.leverage > 10) {
          healthStatus = "🟡 High Leverage";
          healthMessage = `Leverage at ${leverage.leverage.toFixed(2)}x - consider reducing exposure`;
        }
        if (leverage.leverage > 15) {
          healthStatus = "🔴 Risky";
          healthMessage = `Leverage at ${leverage.leverage.toFixed(2)}x - high liquidation risk`;
        }
        if (equity.equity <= 0) {
          healthStatus = "🚨 Critical";
          healthMessage = "No equity remaining - position may be liquidated";
        }

        console.log(`  Status:              ${healthStatus}`);
        console.log(`  ${healthMessage}`);
      } catch (error: any) {
        console.error(
          `\n❌ Error fetching data for subaccount ${subAccountId}:`,
        );
        console.error(`   ${error.message}`);

        // Check if it's a "no data" error vs a real contract error
        if (
          error.message.includes("could not decode result") ||
          error.message.includes("BAD_DATA")
        ) {
          console.error(`\n💡 This might mean:
   • No positions or collateral on this subaccount
   • Contract methods may have changed
   • Try a different subaccount or check if you have deposited collateral`);
        }
      }
    }

    // Summary for multiple subaccounts
    if (subAccountIds.length > 1) {
      console.log(`\n${"=".repeat(60)}`);
      console.log("📊 Portfolio Summary");
      console.log(`${"=".repeat(60)}`);

      let totalEquity = 0;
      let totalPositionSize = 0;
      let totalPositions = 0;

      for (const subAccountId of subAccountIds) {
        try {
          const equity = await publicService.getEquity(address, subAccountId);
          const leverage = await publicService.getLeverage(
            address,
            subAccountId,
          );

          totalEquity += equity.equity;
          totalPositionSize += leverage.totalPositionSize;
          totalPositions += equity.positions.length;
        } catch {
          // Skip subaccounts that error
        }
      }

      const portfolioLeverage =
        totalEquity > 0 ? totalPositionSize / totalEquity : 0;

      console.log(`\n  Total Equity:        ${formatUsd(totalEquity)}`);
      console.log(`  Total Positions:     ${totalPositions}`);
      console.log(`  Portfolio Leverage:  ${portfolioLeverage.toFixed(2)}x`);
      console.log(`  Total Exposure:      ${formatUsd(totalPositionSize)}`);
    }

    console.log("\n");
  } catch (error: any) {
    console.error("\n❌ Error:", error.message);
    process.exit(1);
  }
}

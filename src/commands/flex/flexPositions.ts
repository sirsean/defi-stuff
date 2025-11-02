/**
 * Flex Positions Command
 * Display open positions with PnL, liquidation prices, and risk levels
 */

import { FlexPublicService } from "../../api/flex/flexPublicService.js";
import { RiskManager } from "../../api/flex/riskManagement.js";
import { formatUsd, formatPercent } from "../../api/flex/utils.js";

interface FlexPositionsOptions {
  address?: string;
  market?: string;
}

/**
 * Display open positions with detailed information
 */
export async function flexPositions(
  options: FlexPositionsOptions,
): Promise<void> {
  try {
    // Get address from options or environment
    const address = options.address || process.env.WALLET_ADDRESS;
    if (!address) {
      console.error(
        "❌ Error: No address provided. Use --address or set WALLET_ADDRESS",
      );
      process.exit(1);
    }

    const publicService = new FlexPublicService();
    const riskManager = new RiskManager(publicService);

    console.log(`\n📊 Flex Open Positions - ${address}\n`);

    // Fetch equity data with positions
    const equity = await publicService.getEquity(address);

    if (equity.positions.length === 0) {
      console.log("No open positions\n");
      return;
    }

    // Filter by market if specified
    let positions = equity.positions;
    if (options.market) {
      const marketFilter = options.market.toUpperCase();
      positions = positions.filter(
        (p) => p.symbol.toUpperCase() === marketFilter,
      );

      if (positions.length === 0) {
        console.log(`No ${marketFilter} positions\n`);
        return;
      }
    }

    console.log(`${"=".repeat(80)}`);
    console.log(`${positions.length} Open Position(s)`);
    console.log(`${"=".repeat(80)}\n`);

    let totalUnrealizedPnl = 0;

    // Display each position
    for (const position of positions) {
      const direction = position.isLong ? "LONG 📈" : "SHORT 📉";
      const directionColor = position.isLong ? "🟢" : "🔴";

      // Calculate PnL percentage
      const pnlPercent =
        (Number(position.unrealizedPnl) / Number(position.size)) * 100;
      const pnlSign = Number(position.unrealizedPnl) >= 0 ? "+" : "";
      const pnlColor = Number(position.unrealizedPnl) >= 0 ? "🟢" : "🔴";

      console.log(`${directionColor} ${position.symbol} ${direction}`);
      console.log(`${"─".repeat(80)}`);

      // Position details
      console.log(`  Position Size:       ${formatUsd(Number(position.size))}`);
      console.log(
        `  Entry Price:         ${formatUsd(Number(position.avgEntryPrice))}`,
      );
      console.log(
        `  Current Price:       ${formatUsd(Number(position.currentPrice))}`,
      );
      console.log(
        `  Liquidation Price:   ${formatUsd(Number(position.liquidationPrice))}`,
      );

      // PnL section
      console.log(`\n  💰 Profit & Loss:`);
      console.log(
        `  Unrealized PnL:      ${pnlColor} ${pnlSign}${formatUsd(Number(position.unrealizedPnl))} (${pnlSign}${pnlPercent.toFixed(2)}%)`,
      );

      // Show fees if they're significant (> $0.01)
      const totalFees =
        Number(position.fundingFee) +
        Number(position.borrowingFee) +
        Number(position.tradingFee);

      if (Math.abs(totalFees) > 0.01) {
        console.log(`\n  💸 Fees:`);
        if (Math.abs(Number(position.fundingFee)) > 0.01) {
          console.log(
            `  Funding:             ${formatUsd(Number(position.fundingFee))}`,
          );
        }
        if (Math.abs(Number(position.borrowingFee)) > 0.01) {
          console.log(
            `  Borrowing:           ${formatUsd(Number(position.borrowingFee))}`,
          );
        }
        console.log(`  Total Fees:          ${formatUsd(totalFees)}`);
      }

      // Risk assessment
      try {
        const risk = riskManager.assessLiquidationRisk(
          position,
          position.currentPrice,
        );

        console.log(`\n  ⚠️  Risk Assessment:`);

        let riskEmoji = "🟢";
        let riskLabel = "Safe";
        if (risk.riskLevel === "warning") {
          riskEmoji = "🟡";
          riskLabel = "Warning";
        } else if (risk.riskLevel === "danger") {
          riskEmoji = "🟠";
          riskLabel = "Danger";
        } else if (risk.riskLevel === "critical") {
          riskEmoji = "🔴";
          riskLabel = "CRITICAL";
        }

        console.log(`  Risk Level:          ${riskEmoji} ${riskLabel}`);
        console.log(
          `  Distance to Liq:     ${risk.liquidationDistance.toFixed(2)}%`,
        );

        // Warning messages
        if (risk.riskLevel === "critical") {
          console.log(
            `\n  🚨 WARNING: Position is at high risk of liquidation!`,
          );
        } else if (risk.riskLevel === "danger") {
          console.log(
            `\n  ⚠️  CAUTION: Consider adding margin or reducing position size`,
          );
        }
      } catch (error: any) {
        console.log(
          `\n  ⚠️  Risk Assessment: Unable to calculate (${error.message})`,
        );
      }

      console.log("\n");

      totalUnrealizedPnl += Number(position.unrealizedPnl);
    }

    // Summary for multiple positions
    if (positions.length > 1) {
      console.log(`${"=".repeat(80)}`);
      console.log("📊 Portfolio Summary");
      console.log(`${"=".repeat(80)}`);

      const pnlSign = totalUnrealizedPnl >= 0 ? "+" : "";
      const pnlColor = totalUnrealizedPnl >= 0 ? "🟢" : "🔴";

      console.log(`\n  Total Positions:     ${positions.length}`);
      console.log(
        `  Total Unrealized PnL: ${pnlColor} ${pnlSign}${formatUsd(totalUnrealizedPnl)}`,
      );

      console.log("\n");
    }
  } catch (error: any) {
    console.error("\n❌ Error:", error.message);
    process.exit(1);
  }
}

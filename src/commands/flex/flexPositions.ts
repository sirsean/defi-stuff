/**
 * Flex Positions Command
 * Display open positions with PnL, liquidation prices, and risk levels
 */

import { FlexPublicService } from "../../api/flex/flexPublicService.js";
import { RiskManager } from "../../api/flex/riskManagement.js";
import { formatUsd, formatPercent } from "../../api/flex/utils.js";

interface FlexPositionsOptions {
  address?: string;
  sub?: string;
  subs?: string;
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
    const riskManager = new RiskManager(publicService);

    console.log(`\n📊 Flex Open Positions - ${address}\n`);

    let totalPositions = 0;
    let totalUnrealizedPnl = 0;

    // Query each subaccount
    for (const subAccountId of subAccountIds) {
      try {
        // Fetch equity data with positions
        const equity = await publicService.getEquity(address, subAccountId);

        if (equity.positions.length === 0) {
          if (subAccountIds.length === 1) {
            console.log(`📁 Subaccount ${subAccountId}: No open positions\n`);
          }
          continue;
        }

        // Filter by market if specified
        let positions = equity.positions;
        if (options.market) {
          const marketFilter = options.market.toUpperCase();
          positions = positions.filter(
            (p) => p.symbol.toUpperCase() === marketFilter,
          );

          if (positions.length === 0) {
            console.log(
              `📁 Subaccount ${subAccountId}: No ${marketFilter} positions\n`,
            );
            continue;
          }
        }

        console.log(`${"=".repeat(80)}`);
        console.log(
          `📁 Subaccount ${subAccountId} - ${positions.length} Position(s)`,
        );
        console.log(`${"=".repeat(80)}\n`);

        // Display each position
        for (const position of positions) {
          const direction = position.isLong ? "LONG 📈" : "SHORT 📉";
          const directionColor = position.isLong ? "🟢" : "🔴";

          // Calculate PnL percentage
          const pnlPercent = (position.unrealizedPnl / position.size) * 100;
          const pnlSign = position.unrealizedPnl >= 0 ? "+" : "";
          const pnlColor = position.unrealizedPnl >= 0 ? "🟢" : "🔴";

          console.log(`${directionColor} ${position.symbol} ${direction}`);
          console.log(`${"─".repeat(80)}`);

          // Position details
          console.log(`  Position Size:       ${formatUsd(position.size)}`);
          console.log(
            `  Entry Price:         ${formatUsd(position.avgEntryPrice)}`,
          );
          console.log(
            `  Current Price:       ${formatUsd(position.currentPrice)}`,
          );
          console.log(
            `  Liquidation Price:   ${formatUsd(position.liquidationPrice)}`,
          );

          // PnL section
          console.log(`\n  💰 Profit & Loss:`);
          console.log(
            `  Unrealized PnL:      ${pnlColor} ${pnlSign}${formatUsd(position.unrealizedPnl)} (${pnlSign}${pnlPercent.toFixed(2)}%)`,
          );

          // Fees breakdown
          const totalFees =
            position.fundingFee + position.borrowingFee + position.tradingFee;
          console.log(
            `  Funding Fees:        ${formatUsd(position.fundingFee)}`,
          );
          console.log(
            `  Borrowing Fees:      ${formatUsd(position.borrowingFee)}`,
          );
          console.log(
            `  Trading Fees:        ${formatUsd(position.tradingFee)}`,
          );
          console.log(`  Total Fees:          ${formatUsd(totalFees)}`);

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
            console.log(
              `  Margin Buffer:       ${formatPercent(risk.marginBuffer)}`,
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

          totalPositions++;
          totalUnrealizedPnl += position.unrealizedPnl;
        }
      } catch (error: any) {
        console.error(
          `\n❌ Error fetching positions for subaccount ${subAccountId}:`,
        );
        console.error(`   ${error.message}\n`);
      }
    }

    // Summary for multiple positions
    if (totalPositions === 0) {
      console.log("No open positions found.\n");
    } else if (totalPositions > 1) {
      console.log(`${"=".repeat(80)}`);
      console.log("📊 Portfolio Summary");
      console.log(`${"=".repeat(80)}`);

      const pnlSign = totalUnrealizedPnl >= 0 ? "+" : "";
      const pnlColor = totalUnrealizedPnl >= 0 ? "🟢" : "🔴";

      console.log(`\n  Total Positions:     ${totalPositions}`);
      console.log(
        `  Total Unrealized PnL: ${pnlColor} ${pnlSign}${formatUsd(totalUnrealizedPnl)}`,
      );

      // Risk summary
      try {
        const risks = await riskManager.monitorLiquidationRisk(
          address,
          subAccountIds,
        );

        const criticalCount = risks.filter(
          (r) => r.riskLevel === "critical",
        ).length;
        const dangerCount = risks.filter(
          (r) => r.riskLevel === "danger",
        ).length;
        const warningCount = risks.filter(
          (r) => r.riskLevel === "warning",
        ).length;

        if (criticalCount > 0) {
          console.log(`\n  🚨 ${criticalCount} position(s) at CRITICAL risk`);
        }
        if (dangerCount > 0) {
          console.log(`  🟠 ${dangerCount} position(s) at DANGER level`);
        }
        if (warningCount > 0) {
          console.log(`  🟡 ${warningCount} position(s) with WARNING`);
        }
        if (criticalCount === 0 && dangerCount === 0 && warningCount === 0) {
          console.log(`\n  🟢 All positions are safe`);
        }
      } catch {
        // Skip risk summary if error
      }

      console.log("\n");
    }
  } catch (error: any) {
    console.error("\n❌ Error:", error.message);
    process.exit(1);
  }
}

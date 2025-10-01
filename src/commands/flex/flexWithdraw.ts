/**
 * Flex Withdraw Command
 * Withdraw USDC collateral from a Flex subaccount
 */

import { FlexPrivateService } from "../../api/flex/flexPrivateService.js";
import { FlexPublicService } from "../../api/flex/flexPublicService.js";
import { formatUsd, getSigner } from "../../api/flex/utils.js";

interface FlexWithdrawOptions {
  sub?: string;
  amount: string;
  dryRun?: boolean;
}

/**
 * Withdraw USDC collateral from a Flex subaccount
 */
export async function flexWithdraw(
  options: FlexWithdrawOptions,
): Promise<void> {
  try {
    // Validate required options
    if (!options.amount) {
      console.error("❌ Error: Amount is required");
      process.exit(1);
    }

    // Parse subaccount ID
    const subAccountId = options.sub ? parseInt(options.sub, 10) : 0;
    if (isNaN(subAccountId) || subAccountId < 0 || subAccountId > 255) {
      console.error(`❌ Error: Invalid subaccount ID. Must be 0-255`);
      process.exit(1);
    }

    // Parse amount
    const amount = parseFloat(options.amount);
    if (isNaN(amount) || amount <= 0) {
      console.error(`❌ Error: Invalid amount: ${options.amount}`);
      process.exit(1);
    }

    // Initialize services
    const signer = getSigner();
    const address = await signer.getAddress();
    const privateService = new FlexPrivateService(signer);
    const publicService = new FlexPublicService();

    console.log(`\n💸 Withdraw USDC from Flex\n`);

    // Get current balance
    let currentBalance;
    try {
      currentBalance = await publicService.getCollateral(address, subAccountId);
      console.log(`Current Balance:`);
      console.log(`  Subaccount: ${subAccountId}`);
      console.log(`  USDC Balance: ${formatUsd(currentBalance.balance)}`);
      console.log();
    } catch (error) {
      console.error(`❌ Error: Unable to fetch current balance`);
      console.error(
        `   Make sure you have deposited collateral to subaccount ${subAccountId}`,
      );
      console.error();
      process.exit(1);
    }

    // Validate sufficient balance
    if (currentBalance.balance < amount) {
      console.error(`❌ Error: Insufficient balance`);
      console.error(`   Available: ${formatUsd(currentBalance.balance)}`);
      console.error(`   Requested: ${formatUsd(amount)}`);
      console.error();
      process.exit(1);
    }

    // Check for open positions
    const equity = await publicService.getEquity(address, subAccountId);
    if (equity.positions.length > 0) {
      console.log(
        `⚠️  Warning: You have ${equity.positions.length} open position(s)`,
      );
      console.log(`   Withdrawing may affect your margin and liquidation risk`);
      console.log();

      const leverage = await publicService.getLeverage(address, subAccountId);
      console.log(`Current Leverage: ${leverage.leverage.toFixed(2)}x`);

      // Calculate projected leverage after withdrawal
      const newEquity = equity.equity - amount;
      if (newEquity > 0) {
        const projectedLeverage = leverage.totalPositionSize / newEquity;
        console.log(`Projected Leverage: ${projectedLeverage.toFixed(2)}x`);

        if (projectedLeverage > 15) {
          console.log(`   🔴 HIGH RISK: Projected leverage is very high!`);
        } else if (projectedLeverage > 10) {
          console.log(`   🟡 CAUTION: Projected leverage is elevated`);
        }
      } else {
        console.log(
          `   🔴 CRITICAL: Withdrawal would exceed available equity!`,
        );
        console.log(`   Cannot withdraw more than free collateral`);
        console.error();
        process.exit(1);
      }
      console.log();
    }

    console.log(`Withdrawal Details:`);
    console.log(`  Amount: ${formatUsd(amount)} USDC`);
    console.log(`  From: Subaccount ${subAccountId}`);
    console.log(`  To: ${address}`);
    console.log();

    // Calculate projected balance
    const projectedBalance = currentBalance.balance - amount;
    console.log(`Projected Balance:`);
    console.log(`  New USDC Balance: ${formatUsd(projectedBalance)}`);
    console.log();

    // Dry run mode
    if (options.dryRun) {
      console.log("🏁 Dry run complete. No transaction sent.\n");
      return;
    }

    // Execute withdrawal
    console.log(`⏳ Withdrawing USDC...\n`);

    const result = await privateService.withdrawCollateral(
      subAccountId,
      amount,
    );

    console.log(`✅ Withdrawal successful!\n`);
    console.log(`Transaction Hash: ${result.transactionHash}`);
    console.log(`Block Number: ${result.blockNumber}`);
    console.log(`Gas Used: ${result.gasUsed}`);
    console.log(`Gas Cost: ${result.totalCostEth.toFixed(6)} ETH`);
    console.log();

    // Show updated balance
    try {
      const updatedBalance = await publicService.getCollateral(
        address,
        subAccountId,
      );
      console.log(`Updated Balance:`);
      console.log(`  USDC Balance: ${formatUsd(updatedBalance.balance)}`);
      console.log();
    } catch {
      console.log(
        `✅ Withdrawal complete. Check balance with: npm run dev -- flex:balance --sub ${subAccountId}\n`,
      );
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
    if (error.message.includes("insufficient")) {
      console.error(`   Insufficient free collateral (check open positions)`);
    }
    console.error();
    process.exit(1);
  }
}

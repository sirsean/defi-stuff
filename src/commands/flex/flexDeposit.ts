/**
 * Flex Deposit Command
 * Deposit USDC collateral into a Flex subaccount
 */

import { FlexPrivateService } from "../../api/flex/flexPrivateService.js";
import { FlexPublicService } from "../../api/flex/flexPublicService.js";
import { formatUsd, getSigner } from "../../api/flex/utils.js";

interface FlexDepositOptions {
  sub?: string;
  amount: string;
  dryRun?: boolean;
}

/**
 * Deposit USDC collateral into a Flex subaccount
 */
export async function flexDeposit(options: FlexDepositOptions): Promise<void> {
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

    console.log(`\n💰 Deposit USDC to Flex\n`);

    // Get current balance
    try {
      const currentBalance = await publicService.getCollateral(address, subAccountId);
      console.log(`Current Balance:`);
      console.log(`  Subaccount: ${subAccountId}`);
      console.log(`  USDC Balance: ${formatUsd(currentBalance.balance)}`);
      console.log();
    } catch (error) {
      console.log(`Current Balance:`);
      console.log(`  Subaccount: ${subAccountId}`);
      console.log(`  USDC Balance: $0.00 (or unable to fetch)`);
      console.log();
    }

    console.log(`Deposit Details:`);
    console.log(`  Amount: ${formatUsd(amount)} USDC`);
    console.log(`  Destination: Subaccount ${subAccountId}`);
    console.log(`  Address: ${address}`);
    console.log();

    // Calculate projected balance
    try {
      const currentBalance = await publicService.getCollateral(address, subAccountId);
      const projectedBalance = currentBalance.balance + amount;
      console.log(`Projected Balance:`);
      console.log(`  New USDC Balance: ${formatUsd(projectedBalance)}`);
      console.log();
    } catch {
      console.log(`Projected Balance:`);
      console.log(`  New USDC Balance: ${formatUsd(amount)} (or more if current balance exists)`);
      console.log();
    }

    // Dry run mode
    if (options.dryRun) {
      console.log("🏁 Dry run complete. No transaction sent.\n");
      console.log("💡 Note: Depositing requires two transactions:");
      console.log("   1. USDC approval (if needed)");
      console.log("   2. Deposit to Flex subaccount");
      console.log();
      return;
    }

    // Execute deposit
    console.log(`⏳ Depositing USDC...\n`);
    console.log("💡 This may require USDC approval first...\n");

    const result = await privateService.depositCollateral(subAccountId, amount);

    console.log(`✅ Deposit successful!\n`);
    console.log(`Transaction Hash: ${result.transactionHash}`);
    console.log(`Block Number: ${result.blockNumber}`);
    console.log(`Gas Used: ${result.gasUsed}`);
    console.log(`Gas Cost: ${result.totalCostEth.toFixed(6)} ETH`);
    console.log();

    // Show updated balance
    try {
      const updatedBalance = await publicService.getCollateral(address, subAccountId);
      console.log(`Updated Balance:`);
      console.log(`  USDC Balance: ${formatUsd(updatedBalance.balance)}`);
      console.log();
    } catch {
      console.log(`✅ Deposit complete. Check balance with: npm run dev -- flex:balance --sub ${subAccountId}\n`);
    }

  } catch (error: any) {
    console.error(`\n❌ Error: ${error.message}`);
    if (error.message.includes("Wrong network")) {
      console.error(`   Make sure you are connected to Base mainnet (chain ID 8453)`);
    }
    if (error.message.includes("user rejected")) {
      console.error(`   Transaction was rejected in wallet`);
    }
    if (error.message.includes("insufficient")) {
      console.error(`   Insufficient USDC balance in wallet`);
    }
    console.error();
    process.exit(1);
  }
}
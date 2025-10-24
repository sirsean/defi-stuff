/**
 * Flex Balance Command
 * Display USDC collateral balance
 */

import { FlexPublicService } from "../../api/flex/flexPublicService.js";
import { formatUsd } from "../../api/flex/utils.js";

interface FlexBalanceOptions {
  address?: string;
}

/**
 * Display USDC collateral balance
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

    const publicService = new FlexPublicService();

    // Get USDC collateral balance
    const collateral = await publicService.getCollateral(address);

    console.log(`\n💰 Flex USDC Collateral Balance\n`);
    console.log(`Address: ${address}`);
    console.log(`Balance: ${formatUsd(collateral.balance)}\n`);
  } catch (error: any) {
    console.error("\n❌ Error:", error.message);
    process.exit(1);
  }
}

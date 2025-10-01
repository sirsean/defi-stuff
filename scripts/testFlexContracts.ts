#!/usr/bin/env tsx
/**
 * Test Flex contract calls to debug issues
 */

import { ethers } from "ethers";
import { FLEX_ADDRESSES, MARKETS, TOKENS } from "../src/api/flex/constants.js";
import {
  getProvider,
  computeSubAccount,
  fromE30,
} from "../src/api/flex/utils.js";
import ConfigStorageABI from "../src/api/flex/contracts/ConfigStorage.json" with { type: "json" };
import VaultStorageABI from "../src/api/flex/contracts/VaultStorage.json" with { type: "json" };

async function main() {
  const provider = getProvider();
  const address = process.env.WALLET_ADDRESS || "";

  console.log("\n🔍 Testing Flex Contract Calls\n");
  console.log(`Address: ${address}`);
  console.log(`Network: Base Mainnet (8453)\n`);

  // Test ConfigStorage
  console.log("=" + "=".repeat(70));
  console.log("Testing ConfigStorage.getMarketConfigByIndex(1) - BTC");
  console.log("=" + "=".repeat(70));

  try {
    const configStorage = new ethers.Contract(
      FLEX_ADDRESSES.CONFIG_STORAGE,
      ConfigStorageABI,
      provider,
    );

    const marketConfig = await configStorage.getMarketConfigByIndex(1);
    console.log("\n✅ Success! Raw response:");
    console.log(
      JSON.stringify(
        marketConfig,
        (key, value) => (typeof value === "bigint" ? value.toString() : value),
        2,
      ),
    );

    console.log("\n📊 Parsed:");
    console.log(`  Max Leverage: ${marketConfig.maxLeverage}`);
    console.log(`  Max Funding Rate: ${fromE30(marketConfig.maxFundingRate)}`);
  } catch (error: any) {
    console.error("\n❌ Error:", error.message);
  }

  // Test VaultStorage
  console.log("\n" + "=" + "=".repeat(70));
  console.log("Testing VaultStorage.traderBalances(subaccount, USDC)");
  console.log("=" + "=".repeat(70));

  try {
    const vaultStorage = new ethers.Contract(
      FLEX_ADDRESSES.VAULT_STORAGE,
      VaultStorageABI,
      provider,
    );

    const subAccount = computeSubAccount(address, 0);
    console.log(`\nSubAccount: ${subAccount}`);

    const balance = await vaultStorage.traderBalances(
      subAccount,
      TOKENS.USDC.address,
    );

    console.log("\n✅ Success! Raw response:");
    console.log(`  Balance (e30): ${balance.toString()}`);
    console.log(`  Balance (USD): ${fromE30(balance)}`);

    if (balance === 0n) {
      console.log(
        "\n💡 Balance is zero - this account has no collateral deposited",
      );
    }
  } catch (error: any) {
    console.error("\n❌ Error:", error.message);
  }

  console.log("\n");
}

main().catch(console.error);

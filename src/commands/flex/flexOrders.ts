/**
 * Flex Orders Command
 * View and cancel pending limit/trigger orders
 */

import { FlexPrivateService } from "../../api/flex/flexPrivateService.js";
import { FlexPublicService } from "../../api/flex/flexPublicService.js";
import { MARKETS } from "../../api/flex/constants.js";
import { formatUsd, getSigner } from "../../api/flex/utils.js";

interface FlexOrdersOptions {
  sub?: string;
  subs?: string;
  cancel?: string;
  market?: string;
}

/**
 * View pending orders or cancel an order
 */
export async function flexOrders(options: FlexOrdersOptions): Promise<void> {
  try {
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

    // Initialize services
    const signer = getSigner();
    const address = await signer.getAddress();
    const privateService = new FlexPrivateService(signer);
    const publicService = new FlexPublicService();

    // Cancel order mode
    if (options.cancel) {
      const orderId = parseInt(options.cancel, 10);
      if (isNaN(orderId)) {
        console.error(`❌ Error: Invalid order ID: ${options.cancel}`);
        process.exit(1);
      }

      // Get subaccount ID for cancel
      const subAccountId = subAccountIds[0]; // Use first subaccount if multiple

      console.log(`\n🗑️  Cancel Order #${orderId}\n`);
      console.log(`Subaccount: ${subAccountId}`);
      console.log();
      console.log(`⏳ Canceling order...\n`);

      const result = await privateService.cancelOrder(subAccountId, orderId);

      console.log(`✅ Order canceled successfully!\n`);
      console.log(`Transaction Hash: ${result.transactionHash}`);
      console.log(`Block Number: ${result.blockNumber}`);
      console.log(`Gas Used: ${result.gasUsed}`);
      console.log();

      return;
    }

    // List orders mode
    console.log(`\n📋 Flex Pending Orders - ${address}\n`);

    let totalOrders = 0;

    // Query each subaccount
    for (const subAccountId of subAccountIds) {
      try {
        const orders = await publicService.getPendingOrders(address);

        if (orders.length === 0) {
          if (subAccountIds.length === 1) {
            console.log(`📁 Subaccount ${subAccountId}: No pending orders\n`);
          }
          continue;
        }

        // Filter by market if specified
        let filteredOrders = orders;
        if (options.market) {
          const marketFilter = options.market.toUpperCase();
          const market = Object.values(MARKETS).find(
            (m) => m.symbol === marketFilter,
          );
          if (market) {
            filteredOrders = orders.filter(
              (o: any) => o.marketIndex === market.index,
            );
          }

          if (filteredOrders.length === 0) {
            console.log(
              `📁 Subaccount ${subAccountId}: No ${marketFilter} orders\n`,
            );
            continue;
          }
        }

        console.log(`${"=".repeat(80)}`);
        console.log(
          `📁 Subaccount ${subAccountId} - ${filteredOrders.length} Order(s)`,
        );
        console.log(`${"=".repeat(80)}\n`);

        // Display each order
        for (const order of filteredOrders) {
          // Try to get market info
          let marketSymbol = "UNKNOWN";
          try {
            const market = Object.values(MARKETS).find(
              (m) => m.index === order.marketIndex,
            );
            if (market) {
              marketSymbol = market.symbol;
            }
          } catch {
            // Skip if market lookup fails
          }

          const direction = order.isLong ? "LONG 📈" : "SHORT 📉";
          const directionColor = order.isLong ? "🟢" : "🔴";

          console.log(
            `${directionColor} Order #${order.orderId} - ${marketSymbol} ${direction}`,
          );
          console.log(`${"─".repeat(80)}`);
          console.log(`  Order Type:          ${order.orderType || "LIMIT"}`);
          console.log(`  Size:                ${formatUsd(order.size)}`);
          console.log(
            `  Trigger Price:       ${formatUsd(order.triggerPrice)}`,
          );

          if (order.acceptablePrice) {
            console.log(
              `  Acceptable Price:    ${formatUsd(order.acceptablePrice)}`,
            );
          }

          if (order.reduceOnly) {
            console.log(`  Reduce Only:         ✅ Yes`);
          }

          if (order.createdAt) {
            const createdDate = new Date(Number(order.createdAt) * 1000);
            console.log(
              `  Created:             ${createdDate.toLocaleString()}`,
            );
          }

          console.log();
          console.log(
            `  💡 To cancel: npm run dev -- flex:orders --sub ${subAccountId} --cancel ${order.orderId}`,
          );
          console.log("\n");

          totalOrders++;
        }
      } catch (error: any) {
        console.error(
          `\n❌ Error fetching orders for subaccount ${subAccountId}:`,
        );
        console.error(`   ${error.message}\n`);
      }
    }

    // Summary
    if (totalOrders === 0) {
      console.log("No pending orders found.\n");
    } else if (totalOrders > 1) {
      console.log(`${"=".repeat(80)}`);
      console.log("📊 Summary");
      console.log(`${"=".repeat(80)}`);
      console.log(`\n  Total Pending Orders: ${totalOrders}\n`);
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
    console.error();
    process.exit(1);
  }
}

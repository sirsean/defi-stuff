/**
 * Flex Order Command
 * Place market and limit orders on Flex perpetuals
 */

import { FlexPrivateService } from "../../api/flex/flexPrivateService.js";
import { FlexPublicService } from "../../api/flex/flexPublicService.js";
import { RiskManager } from "../../api/flex/riskManagement.js";
import { MARKETS, TOKENS } from "../../api/flex/constants.js";
import { formatUsd, formatPercent, getSigner } from "../../api/flex/utils.js";

interface FlexOrderOptions {
  sub?: string;
  market: string;
  side: string;
  size: string;
  price?: string;
  slippage?: string;
  reduceOnly?: boolean;
  dryRun?: boolean;
}

/**
 * Place a market or limit order
 */
export async function flexOrder(
  orderType: "market" | "limit",
  options: FlexOrderOptions
): Promise<void> {
  try {
    // Validate required options
    if (!options.market) {
      console.error("❌ Error: --market is required");
      process.exit(1);
    }
    if (!options.side) {
      console.error("❌ Error: --side is required (long/buy or short/sell)");
      process.exit(1);
    }
    if (!options.size) {
      console.error("❌ Error: --size is required (USD amount)");
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
    const market = Object.values(MARKETS).find(m => m.symbol === marketSymbol);
    if (!market) {
      console.error(`❌ Error: Unknown market: ${options.market}`);
      console.error(`Available markets: ${Object.values(MARKETS).map(m => m.symbol).join(", ")}`);
      process.exit(1);
    }

    // Parse side
    const sideInput = options.side.toLowerCase();
    const isLong = sideInput === "long" || sideInput === "buy";
    if (!isLong && sideInput !== "short" && sideInput !== "sell") {
      console.error(`❌ Error: Invalid side: ${options.side}`);
      console.error(`Use: long/buy or short/sell`);
      process.exit(1);
    }

    // Parse size
    const sizeUsd = parseFloat(options.size);
    if (isNaN(sizeUsd) || sizeUsd <= 0) {
      console.error(`❌ Error: Invalid size: ${options.size}`);
      process.exit(1);
    }

    // Parse limit price for limit orders
    let limitPrice: number | undefined;
    if (orderType === "limit") {
      if (!options.price) {
        console.error("❌ Error: --price is required for limit orders");
        process.exit(1);
      }
      limitPrice = parseFloat(options.price);
      if (isNaN(limitPrice) || limitPrice <= 0) {
        console.error(`❌ Error: Invalid price: ${options.price}`);
        process.exit(1);
      }
    }

    // Parse slippage (default 1%)
    const slippageBps = options.slippage ? parseFloat(options.slippage) * 100 : 100;

    // Initialize services
    const signer = getSigner();
    const address = await signer.getAddress();
    const privateService = new FlexPrivateService(signer);
    const publicService = new FlexPublicService();
    const riskManager = new RiskManager(publicService);

    console.log(`\n📝 ${orderType.toUpperCase()} Order - ${market.symbol}\n`);

    // Get current market price
    const priceData = await publicService.getMarketPrice(market.index);
    const currentPrice = priceData.price;

    console.log(`Market: ${market.symbol}`);
    console.log(`Type: ${orderType.toUpperCase()}`);
    console.log(`Side: ${isLong ? "LONG 📈" : "SHORT 📉"}`);
    console.log(`Size: ${formatUsd(sizeUsd)}`);
    console.log(`Current Price: ${formatUsd(currentPrice)}`);
    
    if (orderType === "limit" && limitPrice) {
      console.log(`Limit Price: ${formatUsd(limitPrice)}`);
      const priceDistance = ((limitPrice - currentPrice) / currentPrice) * 100;
      console.log(`Price Distance: ${priceDistance.toFixed(2)}%`);
    }
    
    console.log(`Subaccount: ${subAccountId}`);
    console.log();

    // Pre-trade validation
    console.log("🔍 Validating order...\n");

    try {
      // Get current equity and leverage
      const equity = await publicService.getEquity(address, subAccountId);
      const leverage = await publicService.getLeverage(address, subAccountId);

      console.log(`Current Equity: ${formatUsd(equity.equity)}`);
      console.log(`Current Leverage: ${leverage.leverage.toFixed(2)}x`);
      console.log();

      // Validate order
      const validation = await riskManager.validateOrder(
        address,
        subAccountId,
        market.index,
        sizeUsd,
        currentPrice
      );

      if (!validation.valid) {
        console.error(`❌ Order validation failed:\n`);
        for (const error of validation.errors) {
          console.error(`  • ${error}`);
        }
        console.error();
        process.exit(1);
      }

      if (validation.warnings.length > 0) {
        console.log("⚠️  Warnings:\n");
        for (const warning of validation.warnings) {
          console.log(`  • ${warning}`);
        }
        console.log();
      }

      // Show projected leverage
      const newPositionSize = leverage.totalPositionSize + sizeUsd;
      const projectedLeverage = equity.equity > 0 ? newPositionSize / equity.equity : 0;
      
      console.log(`📊 Projected Impact:\n`);
      console.log(`  New Position Size: ${formatUsd(newPositionSize)}`);
      console.log(`  Projected Leverage: ${projectedLeverage.toFixed(2)}x`);
      console.log();

      // Dry run mode
      if (options.dryRun) {
        console.log("🏁 Dry run complete. No transaction sent.\n");
        return;
      }

      // Execute order
      console.log(`⏳ Placing ${orderType} order...\n`);

      if (orderType === "market") {
        // Execute market order
        const orderParams = {
          subAccountId,
          marketIndex: market.index,
          sizeDelta: isLong ? sizeUsd : -sizeUsd,
          triggerPrice: 0, // Not used for market orders
          acceptablePrice: 0, // Will be calculated
          triggerAboveThreshold: false,
          reduceOnly: false,
          tpToken: TOKENS.USDC.address,
        };
        
        const result = await privateService.executeMarketOrder(orderParams);

        console.log(`✅ Market order executed successfully!\n`);
        console.log(`Transaction Hash: ${result.transactionHash}`);
        console.log(`Block Number: ${result.blockNumber}`);
        console.log(`Gas Used: ${result.gasUsed}`);
        console.log();
      } else {
        // Place limit order
        if (!limitPrice) {
          console.error("❌ Limit price is required");
          process.exit(1);
        }

        const orderParams = {
          subAccountId,
          marketIndex: market.index,
          sizeDelta: isLong ? sizeUsd : -sizeUsd,
          triggerPrice: limitPrice,
          acceptablePrice: 0, // Will be calculated
          triggerAboveThreshold: isLong,
          reduceOnly: options.reduceOnly || false,
          tpToken: TOKENS.USDC.address,
        };
        
        const result = await privateService.createLimitOrder(orderParams);

        console.log(`✅ Limit order placed successfully!\n`);
        console.log(`Transaction Hash: ${result.transactionHash}`);
        console.log(`Block Number: ${result.blockNumber}`);
        console.log(`Gas Used: ${result.gasUsed}`);
        console.log();
        console.log(`💡 Order will execute when price reaches ${formatUsd(limitPrice)}`);
        console.log();
      }

    } catch (validationError: any) {
      console.error(`❌ Validation error: ${validationError.message}\n`);
      process.exit(1);
    }

  } catch (error: any) {
    console.error(`\n❌ Error: ${error.message}`);
    if (error.message.includes("Wrong network")) {
      console.error(`   Make sure you are connected to Base mainnet (chain ID 8453)`);
    }
    if (error.message.includes("user rejected")) {
      console.error(`   Transaction was rejected in wallet`);
    }
    console.error();
    process.exit(1);
  }
}
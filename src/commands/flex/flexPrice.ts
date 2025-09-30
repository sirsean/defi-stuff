/**
 * Flex Price Command
 * Display market prices, funding rates, and market information
 */

import { FlexPublicService } from "../../api/flex/flexPublicService.js";
import { MARKETS } from "../../api/flex/constants.js";
import { formatUsd, formatPercent } from "../../api/flex/utils.js";

interface FlexPriceOptions {
  market?: string;
  all?: boolean;
}

/**
 * Display market prices and rates
 */
export async function flexPrice(options: FlexPriceOptions): Promise<void> {
  try {
    const publicService = new FlexPublicService();

    // Determine which markets to query
    let marketsToQuery: Array<{ symbol: string; index: number }> = [];

    if (options.all) {
      // Query all markets
      marketsToQuery = Object.values(MARKETS).map((m) => ({
        symbol: m.symbol,
        index: m.index,
      }));
      console.log("\n📊 Flex Market Prices - All Markets\n");
    } else if (options.market) {
      // Query specific market
      const marketSymbol = options.market.toUpperCase();
      const market = Object.values(MARKETS).find(
        (m) => m.symbol === marketSymbol
      );

      if (!market) {
        console.error(
          `❌ Error: Market '${options.market}' not found. Use --all to see available markets.`
        );
        process.exit(1);
      }

      marketsToQuery = [{ symbol: market.symbol, index: market.index }];
      console.log(`\n📊 Flex Market Price - ${market.symbol}\n`);
    } else {
      // Default: BTC
      marketsToQuery = [{ symbol: MARKETS.BTC.symbol, index: MARKETS.BTC.index }];
      console.log(`\n📊 Flex Market Price - BTC (default)\n`);
      console.log("💡 Tip: Use --market <SYMBOL> or --all to see other markets\n");
    }

    // Query each market
    for (const { symbol, index } of marketsToQuery) {
      try {
        // Fetch market data
        const marketInfo = await publicService.getMarketInfo(index);
        
        // Try to get funding rate, but handle if market doesn't have data yet
        let fundingRate;
        try {
          fundingRate = await publicService.getFundingRate(index);
        } catch (fundingError: any) {
          // If funding rate fails, create dummy data
          fundingRate = {
            currentFundingRate: 0,
            longPositionSize: 0,
            shortPositionSize: 0,
            fundingAccrued: 0,
            lastFundingTime: 0,
          };
        }

        if (options.all) {
          // Compact format for --all
          const currentFunding = formatPercent(fundingRate.currentFundingRate, 4); // 4 decimals for small values
          const fundingColor = fundingRate.currentFundingRate > 0 ? "🔴" : 
                               fundingRate.currentFundingRate < 0 ? "🟢" : "⚪";
          
          console.log(
            `${symbol.padEnd(8)} ` +
            `Leverage: ${marketInfo.maxLeverage.toFixed(0)}x  ` +
            `Funding: ${fundingColor} ${currentFunding.padStart(8)}  ` +
            `Long: ${formatUsd(fundingRate.longPositionSize).padStart(12)}  ` +
            `Short: ${formatUsd(fundingRate.shortPositionSize).padStart(12)}`
          );
        } else {
          // Detailed format for single market
          console.log(`${"=".repeat(70)}`);
          console.log(`📉 ${symbol}`);
          console.log(`${"=".repeat(70)}`);

          // Market configuration
          console.log("\n📋 Market Configuration:");
          console.log(`  Asset ID:            ${marketInfo.assetId}`);
          console.log(`  Max Leverage:        ${marketInfo.maxLeverage.toFixed(0)}x`);
          console.log(`  Max Skew Scale:      ${marketInfo.maxSkewScale}`);

          // Current funding rates
          console.log("\n📊 Current Funding:");
          const currentFundingPercent = fundingRate.currentFundingRate * 100;
          const fundingColor = currentFundingPercent > 0 ? "🔴" : 
                               currentFundingPercent < 0 ? "🟢" : "⚪";
          
          console.log(`  Current Rate:        ${fundingColor} ${formatPercent(fundingRate.currentFundingRate, 4)}`);
          console.log(`  Funding Accrued:     ${formatPercent(fundingRate.fundingAccrued, 4)}`);
          
          const lastFundingDate = new Date(fundingRate.lastFundingTime * 1000);
          console.log(`  Last Update:         ${lastFundingDate.toISOString().replace('T', ' ').slice(0, 19)} UTC`);
          
          // Calculate skew first (needed for funding direction logic)
          const skew = fundingRate.longPositionSize - fundingRate.shortPositionSize;
          
          // Funding direction explanation
          // Note: Funding rate mechanics vary by protocol
          // On Flex: positive rate when market is skewed means the skewed side pays the other side
          // If market is net short (negative skew), shorts pay longs
          // If market is net long (positive skew), longs pay shorts
          if (currentFundingPercent > 0) {
            // Determine who pays based on the skew
            if (skew < 0) {
              // Net short - shorts pay longs
              console.log(`  💡 Shorts pay longs (${currentFundingPercent.toFixed(4)}% per 8h)`);
            } else if (skew > 0) {
              // Net long - longs pay shorts  
              console.log(`  💡 Longs pay shorts (${currentFundingPercent.toFixed(4)}% per 8h)`);
            } else {
              console.log(`  💡 Market balanced, minimal funding`);
            }
          } else if (currentFundingPercent < 0) {
            // Negative rate - opposite direction
            if (skew < 0) {
              console.log(`  💡 Longs pay shorts (${Math.abs(currentFundingPercent).toFixed(4)}% per 8h)`);
            } else if (skew > 0) {
              console.log(`  💡 Shorts pay longs (${Math.abs(currentFundingPercent).toFixed(4)}% per 8h)`);
            } else {
              console.log(`  💡 Market balanced, minimal funding`);
            }
          } else {
            console.log(`  💡 No funding payments (rate at zero)`);
          }
          
          // Position sizes and skew
          console.log("\n📈 Market Skew:");
          console.log(`  Long Position Size:  ${formatUsd(fundingRate.longPositionSize)}`);
          console.log(`  Short Position Size: ${formatUsd(fundingRate.shortPositionSize)}`);
          
          const totalSize = fundingRate.longPositionSize + fundingRate.shortPositionSize;
          // skew already calculated above
          const skewPercent = totalSize > 0 ? (skew / totalSize) * 100 : 0;
          
          console.log(`  Net Skew:            ${formatUsd(skew)}`);
          console.log(`  Skew %:              ${skewPercent > 0 ? '+' : ''}${skewPercent.toFixed(2)}%`);
          
          if (Math.abs(skewPercent) > 20) {
            console.log(`  ⚠️  Market is heavily skewed ${skewPercent > 0 ? 'long' : 'short'}`);
          }
          
          // Funding parameters
          console.log("\n⚙️  Funding Parameters:");
          console.log(`  Max Funding Rate:    ${formatPercent(marketInfo.maxFundingRate, 2, true)}`); // already in % form
          console.log(`  Max Skew Scale:      ${marketInfo.maxSkewScale}`);
          
          console.log("\n💡 Note:");
          console.log(`  • Funding rates are paid every 8 hours`);
          console.log(`  • Rates increase when market is skewed in one direction`);
          console.log(`  • Longs pay shorts when market is net long, and vice versa`);

          console.log("\n");
        }

      } catch (error: any) {
        if (options.all) {
          console.log(`${symbol.padEnd(8)} ❌ Error: ${error.message}`);
        } else {
          console.error(`\n❌ Error fetching data for ${symbol}:`);
          console.error(`   ${error.message}`);
          
          // Check if it's a contract error
          if (error.message.includes("Cannot read properties") ||
              error.message.includes("undefined")) {
            console.error(`\n💡 This might mean:
   • The contract method doesn't exist or returned unexpected data
   • Market configuration may be unavailable
   • Try using --all to see which markets have data available\n`);
          }
        }
      }
    }

    // Footer for --all
    if (options.all) {
      console.log(`\n💡 Use --market <SYMBOL> for detailed information\n`);
    }

  } catch (error: any) {
    console.error("\n❌ Error:", error.message);
    process.exit(1);
  }
}

/**
 * List all available markets
 */
export function listMarkets(): void {
  console.log("\n📋 Available Markets:\n");
  
  const markets = Object.values(MARKETS).sort((a, b) => a.index - b.index);
  
  for (const market of markets) {
    console.log(`  ${market.symbol.padEnd(8)} (Index: ${market.index})`);
  }
  
  console.log("\n💡 Use: npm run dev -- flex:price --market <SYMBOL>\n");
}
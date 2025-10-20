import { tradeRecommendationAgent } from "../api/trading/tradeRecommendationAgent.js";
import type { TradeRecommendation } from "../types/tradeRecommendation.js";
import { TradeRecommendationService } from "../db/tradeRecommendationService.js";
import { KnexConnector } from "../db/knexConnector.js";
import { tradeRecommendationDiscordFormatter } from "../api/discord/tradeRecommendationFormatter.js";
import { discordService } from "../api/discord/discordService.js";

interface TradeRecommendationOptions {
  markets?: string;
  address?: string;
  subs?: string;
  json?: boolean;
  db?: boolean;
  discord?: boolean;
}

/**
 * Get action emoji
 */
function getActionEmoji(action: string): string {
  const map: Record<string, string> = {
    long: "📈",
    short: "📉",
    close: "❌",
    hold: "⏸️",
  };
  return map[action] || "•";
}

/**
 * Get market emoji
 */
function getMarketEmoji(market: string): string {
  const map: Record<string, string> = {
    BTC: "₿",
    ETH: "Ξ",
    SOL: "◎",
    XRP: "✕",
  };
  return map[market] || "•";
}

/**
 * Create a confidence meter visualization
 */
function createConfidenceMeter(confidence: number): string {
  const filled = Math.round(confidence * 10);
  const bar = "█".repeat(filled) + "░".repeat(10 - filled);
  const percent = Math.round(confidence * 100);
  return `${bar} ${percent}%`;
}

/**
 * Get confidence level text
 */
function getConfidenceLevel(confidence: number): string {
  if (confidence >= 0.8) return "Very High";
  if (confidence >= 0.7) return "High";
  if (confidence >= 0.5) return "Moderate";
  if (confidence >= 0.3) return "Low";
  return "Very Low";
}

/**
 * Wrap text to specified width
 */
function wrapText(text: string, width: number = 80): string {
  const words = text.split(" ");
  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    if (currentLine.length + word.length + 1 <= width) {
      currentLine += (currentLine ? " " : "") + word;
    } else {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
    }
  }
  if (currentLine) lines.push(currentLine);

  return lines.join("\n  ");
}

/**
 * Format a single recommendation
 */
function formatRecommendation(rec: TradeRecommendation): string[] {
  const lines: string[] = [];
  const emoji = getMarketEmoji(rec.market);
  const actionEmoji = getActionEmoji(rec.action);

  // Header
  lines.push(
    `${emoji} ${rec.market} ${actionEmoji} ${rec.action.toUpperCase()}`,
  );
  lines.push("");

  // Confidence
  const confidenceLevel = getConfidenceLevel(rec.confidence);
  lines.push(`  Confidence: ${confidenceLevel}`);
  lines.push(`  ${createConfidenceMeter(rec.confidence)}`);
  lines.push("");

  // Size (if specified)
  if (rec.size_usd !== null) {
    lines.push(`  Suggested Size: $${rec.size_usd.toLocaleString()}`);
    lines.push("");
  }

  // Timeframe
  const timeframeMap: Record<string, string> = {
    intraday: "Intraday (today)",
    short: "Short-term (1 day)",
    medium: "Short-term (1 day)", // Backward compatibility
    long: "Long-term",
  };
  lines.push(`  Timeframe: ${timeframeMap[rec.timeframe] || rec.timeframe}`);
  lines.push("");

  // Reasoning
  lines.push(`  Reasoning:`);
  const wrappedReasoning = wrapText(rec.reasoning, 76);
  lines.push(`  ${wrappedReasoning}`);
  lines.push("");

  // Risk Factors
  if (rec.risk_factors && rec.risk_factors.length > 0) {
    lines.push(`  Risk Factors:`);
    for (const risk of rec.risk_factors) {
      const wrappedRisk = wrapText(risk, 74);
      lines.push(`  • ${wrappedRisk}`);
    }
    lines.push("");
  }

  return lines;
}

/**
 * Command to generate AI-powered trade recommendations
 */
export async function tradeRecommendation(
  opts: TradeRecommendationOptions = {},
): Promise<void> {
  try {
    // Parse markets (default: BTC,ETH)
    const marketsStr = opts.markets || "BTC,ETH";
    const markets = marketsStr.split(",").map((m) => m.trim().toUpperCase());

    // Get wallet address (from option or env)
    const walletAddress = opts.address || process.env.WALLET_ADDRESS;

    // Parse subaccount IDs (default: 0)
    const subsStr = opts.subs || "0";
    const subAccountIds = subsStr.split(",").map((s) => parseInt(s.trim(), 10));

    // Validate subaccount IDs
    for (const subId of subAccountIds) {
      if (isNaN(subId) || subId < 0 || subId > 255) {
        console.error(`Invalid subaccount ID: ${subId}. Must be 0-255.`);
        process.exit(1);
      }
    }

    // Generate recommendations
    console.log("\n🤖 Generating trade recommendations...\n");

    const analysis = await tradeRecommendationAgent.generateRecommendation(
      markets,
      walletAddress,
      subAccountIds,
    );

    // JSON output mode
    if (opts.json) {
      console.log(JSON.stringify(analysis, null, 2));
      return;
    }

    // Human-readable output
    console.log("═".repeat(80));
    console.log("  🎯 AI TRADE RECOMMENDATIONS");
    console.log("═".repeat(80));
    console.log("");

    // Timestamp
    const date = new Date(analysis.timestamp);
    const dateStr = date.toLocaleString("en-US", {
      dateStyle: "medium",
      timeStyle: "short",
    });
    console.log(`Generated: ${dateStr}`);
    console.log("");

    // Market Summary
    console.log("📊 MARKET SUMMARY");
    console.log("─".repeat(80));
    console.log("");
    const wrappedSummary = wrapText(analysis.market_summary, 78);
    console.log(`  ${wrappedSummary}`);
    console.log("");
    console.log("");

    // Recommendations
    console.log("💡 RECOMMENDATIONS");
    console.log("─".repeat(80));
    console.log("");

    for (const rec of analysis.recommendations) {
      const recLines = formatRecommendation(rec);
      console.log(recLines.join("\n"));
      console.log("─".repeat(80));
      console.log("");
    }

    // Fetch market context once if needed for Discord or DB
    let marketContext = null;
    let recommendationsWithPrices: Array<{
      recommendation: TradeRecommendation;
      currentPrice: number;
    }> = [];

    if (opts.discord || opts.db) {
      try {
        marketContext = await tradeRecommendationAgent.gatherMarketContext(
          markets,
          walletAddress,
          subAccountIds,
        );

        recommendationsWithPrices = analysis.recommendations.map((rec) => {
          const marketData = marketContext!.markets.find(
            (m: any) => m.symbol === rec.market,
          );
          return {
            recommendation: rec,
            currentPrice: marketData?.price || 0,
          };
        });
      } catch (contextError: any) {
        console.error(
          `\n⚠️ Failed to fetch market context: ${contextError?.message ?? "Unknown error"}`,
        );
        console.error(
          "Discord and database operations will be skipped.\n",
        );
      }
    }

    // Get position states BEFORE saving to database (for accurate Discord display)
    let positionStatesForDiscord: Map<string, any> | null = null;
    if (opts.discord && recommendationsWithPrices.length > 0) {
      try {
        positionStatesForDiscord = await tradeRecommendationAgent.getPreviousPositionState(markets);
      } catch (error: any) {
        console.warn(`⚠️ Failed to get position states for Discord: ${error?.message ?? "Unknown error"}`);
      }
    }

    // Persist to database first if --db flag is provided
    // This must happen before Discord check so we can compare with previous recommendations
    if (opts.db && recommendationsWithPrices.length > 0) {
      try {
        const tradeRecommendationService = new TradeRecommendationService();

        // Save to database
        const savedRecords =
          await tradeRecommendationService.saveRecommendations(
            recommendationsWithPrices,
          );

        console.log(
          `✅ Saved ${savedRecords.length} trade recommendation(s) to database\n`,
        );

        // Close database connection
        await tradeRecommendationService.close();
      } catch (dbError: any) {
        console.error(
          `❌ Failed to save recommendations to database: ${dbError?.message ?? "Unknown error"}\n`,
        );
        // Don't exit - database error shouldn't prevent showing recommendations
      } finally {
        // Ensure Knex connection is cleaned up
        await KnexConnector.destroy();
      }
    }

    // Send to Discord if --discord flag is provided
    // Track if Discord was initialized so we can ensure cleanup happens
    let discordInitialized = false;
    if (opts.discord) {
      try {
        // Only proceed if we have recommendations with prices
        if (recommendationsWithPrices.length > 0) {
          // Initialize Discord service
          await discordService.initialize();
          discordInitialized = true;
          
          // Filter out HOLD actions - they're not actionable and don't need notifications
          // HOLD means "maintain current state" (flat/long/short) so there's nothing to act on
          let recommendationsToSend = recommendationsWithPrices.filter(
            (recWithPrice) => recWithPrice.recommendation.action !== "hold"
          );
          
          // If both --db and --discord are active, additionally filter for changed recommendations
          if (opts.db && recommendationsToSend.length > 0) {
            const tradeRecommendationService = new TradeRecommendationService();
            const changedRecommendations = [];
            
            console.log("🔍 Checking for recommendation changes...");
            
            for (const recWithPrice of recommendationsToSend) {
              const market = recWithPrice.recommendation.market;
              const newAction = recWithPrice.recommendation.action;
              
              // Get the most recent previous recommendation for this market
              // Skip the most recent one (which we just saved) by getting 2 records
              const recentRecs = await tradeRecommendationService.getRecommendationsByMarket(market, 2);
              
              // If there's a previous recommendation (index 1), compare actions
              if (recentRecs.length > 1) {
                const previousAction = recentRecs[1].action;
                
                if (previousAction !== newAction) {
                  console.log(
                    `  • ${market}: ${previousAction.toUpperCase()} → ${newAction.toUpperCase()} (changed)`,
                  );
                  changedRecommendations.push(recWithPrice);
                } else {
                  console.log(
                    `  • ${market}: ${newAction.toUpperCase()} (unchanged, skipping Discord)`,
                  );
                }
              } else {
                // First recommendation for this market, always send
                console.log(
                  `  • ${market}: ${newAction.toUpperCase()} (first recommendation)`,
                );
                changedRecommendations.push(recWithPrice);
              }
            }
            
            await tradeRecommendationService.close();
            recommendationsToSend = changedRecommendations;
          } else if (recommendationsToSend.length < recommendationsWithPrices.length) {
            // If we filtered out HOLDs but --db is not active, log which were skipped
            console.log("🔍 Filtering recommendations for Discord...");
            for (const recWithPrice of recommendationsWithPrices) {
              if (recWithPrice.recommendation.action === "hold") {
                console.log(
                  `  • ${recWithPrice.recommendation.market}: HOLD (not actionable, skipping Discord)`,
                );
              }
            }
          }
          
          if (recommendationsToSend.length > 0) {
            console.log("📤 Sending recommendations to Discord...");

            await tradeRecommendationDiscordFormatter.sendRecommendations(
              recommendationsToSend,
              positionStatesForDiscord || undefined,
            );

            console.log(
              `✅ Sent ${recommendationsToSend.length} recommendation(s) to Discord\n`,
            );
          } else {
            console.log(
              "ℹ️ No recommendation changes detected, skipping Discord notification\n",
            );
          }
        }
      } catch (discordError: any) {
        console.error(
          `❌ Failed to send to Discord: ${discordError?.message ?? "Unknown error"}`,
        );
        if (discordError?.message?.includes("DISCORD")) {
          console.error(
            "💡 Hint: Make sure DISCORD_APP_TOKEN and DISCORD_CHANNEL_ID are set in your .env file\n",
          );
        }
        // Don't exit - Discord error shouldn't prevent other functionality
      } finally {
        // Always cleanup Discord connection if it was initialized
        if (discordInitialized) {
          await discordService.shutdown();
        }
      }
    }
  } catch (error: any) {
    console.error(
      `\n❌ Failed to generate trade recommendations: ${error?.message ?? "Unknown error"}`,
    );

    // Provide helpful hints for common errors
    if (error?.message?.includes("CLOUDFLARE")) {
      console.error(
        "\n💡 Hint: Make sure CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_AUTH_TOKEN are set in your .env file",
      );
    }
    if (error?.message?.includes("Unknown market")) {
      console.error(
        "\n💡 Hint: Use valid market symbols (BTC, ETH, SOL, etc.)",
      );
    }
    if (error?.message?.includes("Failed to fetch")) {
      console.error(
        "\n💡 Hint: Check your network connection and Base RPC endpoint",
      );
    }

    console.error("");
    process.exit(1);
  }
}

import { BalanceService } from "../api/debank/balanceService.js";
import { UserProtocolService } from "../api/debank/userProtocolService.js";
import { TokenInfo, UserPortfolioItem } from "../types/debank.js";
import {
  discordService,
  DiscordColors,
} from "../api/discord/discordService.js";
import {
  BalanceRecordService,
  BalanceRecord,
  BalanceType,
} from "../db/balanceRecordService.js";
import { KnexConnector } from "../db/knexConnector.js";
import { ChartDataService } from "../db/chartDataService.js";
import { ChartGenerator } from "../utils/chartGenerator.js";
import { fearGreedService } from "../api/feargreed/fearGreedService.js";
import type { FearGreedAnalysis } from "../types/feargreed.js";

import { JsonRpcProvider, Wallet } from "ethers";
import { flpCompoundCore, FlpCompoundResult } from "./flpCompound.js";
import { baseusdAddCore, BaseusdAddResult } from "./baseusdAdd.js";

interface DailyCommandOptions {
  address?: string;
  discord?: boolean;
  db?: boolean;
  chart?: boolean;
  claimCompound?: boolean;
}

interface ProtocolData {
  name: string;
  usdValue: number;
  details: {
    [key: string]: {
      tokenValue: number;
      usdValue: number;
      symbol: string;
    };
  };
  rewards?: {
    [key: string]: {
      amount: number;
      usdValue: number;
      symbol: string;
    };
  };
}

/**
 * Command to generate a daily report of wallet balances and protocol positions
 * @param walletAddressParam Optional wallet address to query (overrides the one from .env if provided)
 * @param options Command options
 */
export async function daily(
  walletAddressParam: string,
  options: DailyCommandOptions = {},
): Promise<void> {
  try {
    // Set up services
    const balanceService = new BalanceService();
    const userProtocolService = new UserProtocolService();

    // Determine which wallet address to use
    const walletAddress = options.address || walletAddressParam;

    // If a wallet address is provided in either param, use it
    if (walletAddress) {
      balanceService.setWalletAddress(walletAddress);
      userProtocolService.setWalletAddress(walletAddress);
    }

    // Pre-execution auto-compound sequence (must happen before Debank portfolio fetch)
    const autoCompound = await runAutoCompoundIfRequested({
      enabled: options.claimCompound === true,
      reportWallet: walletAddress || process.env.WALLET_ADDRESS || "",
      userProtocolService,
    });

    // 1. Get overall wallet balance
    const balanceData = await balanceService.getUserBalanceWithThreshold(
      walletAddress,
      0,
    );

    // 2. Get protocol data for Tokemak
    const tokemakData =
      await userProtocolService.getUserProtocolData("tokemak");

    // 3. Get protocol data for Base Flex
    const baseFlexData =
      await userProtocolService.getUserProtocolData("base_flex");

    // 4. Get protocol data for Base Tokemak
    const baseTokemakData =
      await userProtocolService.getUserProtocolData("base_tokemak");

    // 5. Get Fear & Greed Index
    let fearGreedAnalysis: FearGreedAnalysis | undefined;
    try {
      fearGreedAnalysis = await fearGreedService.analyzeFearGreedIndex(10);
    } catch (error) {
      console.warn("⚠️  Failed to fetch Fear & Greed Index:", error);
      // Continue without it - don't fail the entire report
    }

    // Process protocol data
    const processedData = {
      totalUsdValue: balanceData.total_usd_value,
      tokemak: processProtocolData(tokemakData.portfolio_item_list),
      baseFlex: processProtocolData(baseFlexData.portfolio_item_list),
      baseTokemak: processProtocolData(baseTokemakData.portfolio_item_list),
      fearGreed: fearGreedAnalysis,
    };

    // Generate a console report and optionally save to database
    await generateReport(processedData, {
      sendToDiscord: options.discord === true,
      saveToDb: options.db === true,
      walletAddress: walletAddress,
      generateChart: options.chart === true,
      autoCompoundSummary: autoCompound.summary,
    });
  } catch (error) {
    if (error instanceof Error) {
      console.error("Error generating daily report:", error.message);
      console.error(error);
    } else {
      console.error("Unexpected error:", error);
    }
    process.exit(1);
  }
}

/**
 * Process protocol portfolio items into a more usable format
 * @param portfolioItems The portfolio items from the protocol
 * @returns Processed protocol data
 */
function processProtocolData(
  portfolioItems: UserPortfolioItem[],
): Record<string, ProtocolData> {
  const result: Record<string, ProtocolData> = {};

  for (const item of portfolioItems) {
    const poolId = item.pool.id;
    const friendlyName =
      UserProtocolService.getPoolFriendlyName(item.pool.project_id, poolId) ||
      item.name;

    // Create basic structure
    result[friendlyName] = {
      name: friendlyName,
      usdValue: item.stats.asset_usd_value,
      details: {},
      rewards: {},
    };

    // Process supplied tokens
    if (
      item.detail.supply_token_list &&
      item.detail.supply_token_list.length > 0
    ) {
      for (const token of item.detail.supply_token_list) {
        result[friendlyName].details[token.symbol] = {
          tokenValue: token.amount,
          usdValue: token.usd_value || token.price * token.amount,
          symbol: token.symbol,
        };
      }
    }

    // Process reward tokens
    if (
      item.detail.reward_token_list &&
      item.detail.reward_token_list.length > 0
    ) {
      for (const token of item.detail.reward_token_list) {
        result[friendlyName].rewards![token.symbol] = {
          amount: token.amount,
          usdValue: token.usd_value || token.price * token.amount,
          symbol: token.symbol,
        };
      }
    }
  }

  return result;
}

/**
 * Generate a formatted report and optionally send to Discord and/or save to database
 * @param data The processed protocol data
 * @param options Options for report generation
 */
async function generateReport(
  data: {
    totalUsdValue: number;
    tokemak: Record<string, ProtocolData>;
    baseFlex: Record<string, ProtocolData>;
    baseTokemak: Record<string, ProtocolData>;
    fearGreed?: FearGreedAnalysis;
  },
  options: {
    sendToDiscord: boolean;
    saveToDb: boolean;
    walletAddress?: string;
    generateChart?: boolean;
    autoCompoundSummary?: AutoCompoundSummary;
  },
): Promise<void> {
  // Calculate aggregated values
  const autoUsdValue = data.tokemak["autoUSD"]?.usdValue || 0;

  const autoEthValue =
    (data.tokemak["autoETH"]?.details["ETH"]?.tokenValue || 0) +
    (data.tokemak["autoETH"]?.details["WETH"]?.tokenValue || 0);
  const dineroEthValue =
    (data.tokemak["dineroETH"]?.details["ETH"]?.tokenValue || 0) +
    (data.tokemak["dineroETH"]?.details["WETH"]?.tokenValue || 0);
  const totalEthValue = autoEthValue + dineroEthValue;

  const flpUsdValue = data.baseFlex["FLP"]?.usdValue || 0;
  const baseUsdValue = data.baseTokemak["baseUSD"]?.usdValue || 0;

  // Get and aggregate rewards by token symbol
  const aggregateRewards = (
    rewards: Array<{ amount: number; usdValue: number; symbol: string }>,
  ) => {
    const aggregated: Record<
      string,
      { amount: number; usdValue: number; symbol: string }
    > = {};

    for (const reward of rewards) {
      // Skip rewards with zero value
      if (reward.usdValue <= 0) continue;

      if (aggregated[reward.symbol]) {
        // Add to existing token entry
        aggregated[reward.symbol].amount += reward.amount;
        aggregated[reward.symbol].usdValue += reward.usdValue;
      } else {
        // Create new entry
        aggregated[reward.symbol] = { ...reward };
      }
    }

    return Object.values(aggregated);
  };

  const tokemakRewards = aggregateRewards(
    Object.values(data.tokemak)
      .filter((pool) => pool.rewards && Object.keys(pool.rewards).length > 0)
      .flatMap((pool) => Object.values(pool.rewards || {})),
  );

  const baseFlexRewards = aggregateRewards(
    Object.values(data.baseFlex)
      .filter((pool) => pool.rewards && Object.keys(pool.rewards).length > 0)
      .flatMap((pool) => Object.values(pool.rewards || {})),
  );

  const baseTokemakRewards = aggregateRewards(
    Object.values(data.baseTokemak)
      .filter((pool) => pool.rewards && Object.keys(pool.rewards).length > 0)
      .flatMap((pool) => Object.values(pool.rewards || {})),
  );

  // Helper function to get classification emoji
  const getClassificationEmoji = (classification: string): string => {
    const map: Record<string, string> = {
      "Extreme Fear": "😱",
      Fear: "😨",
      Neutral: "😐",
      Greed: "🙂",
      "Extreme Greed": "🤑",
    };
    return map[classification] ?? "";
  };

  const getTrendEmoji = (trend: string): string => {
    if (trend === "improving") return "📈";
    if (trend === "declining") return "📉";
    return "🔁";
  };

  // Format console output
  console.log("\n========== DAILY REPORT ==========");
  console.log(
    `Total Wallet Value: $${data.totalUsdValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}`,
  );

  // Add Fear & Greed Index if available
  if (data.fearGreed) {
    const emoji = getClassificationEmoji(data.fearGreed.current.classification);
    const trendEmoji = getTrendEmoji(data.fearGreed.trend);
    const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
    console.log(
      `Fear & Greed: ${Math.round(data.fearGreed.current.value)} (${data.fearGreed.current.classification}) ${emoji} - ${capitalize(data.fearGreed.trend)} ${trendEmoji}`,
    );
  }

  console.log("\n--- KEY POSITIONS ---");
  console.log(
    `ETH (autoETH + dineroETH): ${totalEthValue.toLocaleString(undefined, { maximumFractionDigits: 6 })} ETH`,
  );
  console.log(
    `FLP: $${flpUsdValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}`,
  );
  console.log(
    `autoUSD: $${autoUsdValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}`,
  );
  console.log(
    `baseUSD: $${baseUsdValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}`,
  );

  if (data.baseFlex["FLP"] && data.baseFlex["FLP"].details) {
    console.log("\n--- FLP BREAKDOWN ---");
    for (const [symbol, details] of Object.entries(
      data.baseFlex["FLP"].details,
    )) {
      console.log(
        `  ${details.tokenValue.toLocaleString(undefined, { maximumFractionDigits: 6 })} ${symbol} ($${details.usdValue.toLocaleString(undefined, { maximumFractionDigits: 2 })})`,
      );
    }
  }

  // Apply Base Flex display threshold: only show if total USD value >= 1
  const baseFlexTotalUsd = baseFlexRewards.reduce(
    (sum, r) => sum + r.usdValue,
    0,
  );
  const baseFlexAboveMin = baseFlexTotalUsd >= 1;

  if (
    tokemakRewards.length > 0 ||
    baseFlexAboveMin ||
    baseTokemakRewards.length > 0
  ) {
    console.log("\n--- PENDING REWARDS ---");

    if (tokemakRewards.length > 0) {
      console.log("Tokemak:");
      for (const reward of tokemakRewards) {
        console.log(
          `  ${reward.amount.toLocaleString(undefined, { maximumFractionDigits: 6 })} ${reward.symbol} ($${reward.usdValue.toLocaleString(undefined, { maximumFractionDigits: 2 })})`,
        );
      }
    }

    if (baseFlexAboveMin) {
      console.log("Base Flex:");
      for (const reward of baseFlexRewards) {
        console.log(
          `  ${reward.amount.toLocaleString(undefined, { maximumFractionDigits: 6 })} ${reward.symbol} ($${reward.usdValue.toLocaleString(undefined, { maximumFractionDigits: 2 })})`,
        );
      }
    }

    if (baseTokemakRewards.length > 0) {
      console.log("Base Tokemak:");
      for (const reward of baseTokemakRewards) {
        console.log(
          `  ${reward.amount.toLocaleString(undefined, { maximumFractionDigits: 6 })} ${reward.symbol} ($${reward.usdValue.toLocaleString(undefined, { maximumFractionDigits: 2 })})`,
        );
      }
    }
  }

  // Save to database if requested
  if (options.saveToDb) {
    // Check if wallet address is available
    const walletAddressToUse =
      options.walletAddress || process.env.WALLET_ADDRESS;

    if (walletAddressToUse) {
      await saveToDatabaseReport({
        walletAddress: walletAddressToUse,
        totalUsdValue: data.totalUsdValue,
        autoUsdValue,
        autoEthValue,
        dineroEthValue,
        flpUsdValue,
        baseUsdValue,
        tokemakRewards,
        baseFlexRewards,
        baseTokemakRewards,
      });
      console.log("✅ Database save completed");
    } else {
      console.log("Note: Database save skipped - no wallet address found");
    }
  }

  // Send to Discord if requested (after DB save so we have the latest data for charts)
  if (options.sendToDiscord) {
    const shouldGenerateChart = options.saveToDb === true; // Generate chart if we saved to DB

    await sendDiscordReport(
      {
        totalUsdValue: data.totalUsdValue,
        autoUsdValue,
        totalEthValue,
        flpUsdValue,
        baseUsdValue,
        flpDetails: data.baseFlex["FLP"]?.details || {},
        tokemakRewards,
        baseFlexRewards,
        baseTokemakRewards,
        fearGreed: data.fearGreed,
      },
      {
        generateChart: shouldGenerateChart || options.generateChart === true,
        walletAddress: options.walletAddress,
      },
      options.autoCompoundSummary,
    );
  }
}

/**
 * Send the report to Discord
 * @param data The processed report data
 * @param chartOptions Options for chart generation
 */
async function sendDiscordReport(
  data: {
    totalUsdValue: number;
    autoUsdValue: number;
    totalEthValue: number;
    flpUsdValue: number;
    baseUsdValue: number;
    flpDetails: Record<
      string,
      { tokenValue: number; usdValue: number; symbol: string }
    >;
    tokemakRewards: Array<{ amount: number; usdValue: number; symbol: string }>;
    baseFlexRewards: Array<{
      amount: number;
      usdValue: number;
      symbol: string;
    }>;
    baseTokemakRewards: Array<{
      amount: number;
      usdValue: number;
      symbol: string;
    }>;
    fearGreed?: FearGreedAnalysis;
  },
  chartOptions?: {
    generateChart?: boolean;
    walletAddress?: string;
  },
  autoCompoundSummary?: AutoCompoundSummary,
): Promise<void> {
  try {
    // Helper functions for emojis
    const getClassificationEmoji = (classification: string): string => {
      const map: Record<string, string> = {
        "Extreme Fear": "😱",
        Fear: "😨",
        Neutral: "😐",
        Greed: "🙂",
        "Extreme Greed": "🤑",
      };
      return map[classification] ?? "";
    };

    const getTrendEmoji = (trend: string): string => {
      if (trend === "improving") return "📈";
      if (trend === "declining") return "📉";
      return "🔁";
    };

    const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

    // Build description with optional Fear & Greed
    let description = `Total Wallet Value: $${data.totalUsdValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
    if (data.fearGreed) {
      const emoji = getClassificationEmoji(
        data.fearGreed.current.classification,
      );
      const trendEmoji = getTrendEmoji(data.fearGreed.trend);
      description += `\n\n**Market Sentiment**\nFear & Greed: ${Math.round(data.fearGreed.current.value)} (${data.fearGreed.current.classification}) ${emoji} - ${capitalize(data.fearGreed.trend)} ${trendEmoji}`;
    }

    const embedMessage = discordService
      .createEmbedMessage()
      .addTitle("📊 Daily DeFi Report")
      .setColor(DiscordColors.BLUE)
      .addDescription(description)
      .addFields([
        {
          name: "Key Positions",
          value: [
            `• ETH (autoETH + dineroETH): ${data.totalEthValue.toLocaleString(undefined, { maximumFractionDigits: 6 })} ETH`,
            `• FLP: $${data.flpUsdValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}`,
            `• autoUSD: $${data.autoUsdValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}`,
            `• baseUSD: $${data.baseUsdValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}`,
          ].join("\n"),
        },
      ]);

    // Add FLP breakdown if available
    if (Object.keys(data.flpDetails).length > 0) {
      const flpBreakdown = Object.entries(data.flpDetails)
        .map(
          ([_, details]) =>
            `• ${details.tokenValue.toLocaleString(undefined, { maximumFractionDigits: 6 })} ${details.symbol} ($${details.usdValue.toLocaleString(undefined, { maximumFractionDigits: 2 })})`,
        )
        .join("\n");

      embedMessage.addField("FLP Breakdown", flpBreakdown);
    }

    // Add auto-compound summary if provided
    if (autoCompoundSummary) {
      let value = "";
      if (autoCompoundSummary.errors.length > 0) {
        value = [
          "Status: errors during auto-compound",
          ...autoCompoundSummary.errors.map((e) => `• ${e}`),
        ].join("\n");
      } else if (autoCompoundSummary.skipped) {
        value = "No USDC rewards available; no transactions executed.";
      } else {
        value = [
          `FLP->baseUSD: ${autoCompoundSummary.depositedUsdcDisplay} USDC`,
          `Gas spent: ${autoCompoundSummary.totalGasEthDisplay} ETH`,
        ].join("\n");
      }
      embedMessage.addField("Auto-compound", value);
    }

    // Add rewards if available
    const baseFlexTotalUsd = data.baseFlexRewards.reduce(
      (sum, r) => sum + r.usdValue,
      0,
    );
    const baseFlexAboveMin = baseFlexTotalUsd >= 1;
    const hasRewards =
      data.tokemakRewards.length > 0 ||
      baseFlexAboveMin ||
      data.baseTokemakRewards.length > 0;

    if (hasRewards) {
      let rewardsText = "";

      if (data.tokemakRewards.length > 0) {
        rewardsText +=
          "**Tokemak:**\n" +
          data.tokemakRewards
            // Only show rewards with USD value > 0
            .filter((reward) => reward.usdValue > 0)
            .map(
              (reward) =>
                `• ${reward.amount.toLocaleString(undefined, { maximumFractionDigits: 6 })} ${reward.symbol} ($${reward.usdValue.toLocaleString(undefined, { maximumFractionDigits: 2 })})`,
            )
            .join("\n");

        if (baseFlexAboveMin || data.baseTokemakRewards.length > 0) {
          rewardsText += "\n\n";
        }
      }

      if (baseFlexAboveMin) {
        rewardsText +=
          "**Base Flex:**\n" +
          data.baseFlexRewards
            // Only show rewards with USD value > 0
            .filter((reward) => reward.usdValue > 0)
            .map(
              (reward) =>
                `• ${reward.amount.toLocaleString(undefined, { maximumFractionDigits: 6 })} ${reward.symbol} ($${reward.usdValue.toLocaleString(undefined, { maximumFractionDigits: 2 })})`,
            )
            .join("\n");

        if (data.baseTokemakRewards.length > 0) {
          rewardsText += "\n\n";
        }
      }

      if (data.baseTokemakRewards.length > 0) {
        rewardsText +=
          "**Base Tokemak:**\n" +
          data.baseTokemakRewards
            // Only show rewards with USD value > 0
            .filter((reward) => reward.usdValue > 0)
            .map(
              (reward) =>
                `• ${reward.amount.toLocaleString(undefined, { maximumFractionDigits: 6 })} ${reward.symbol} ($${reward.usdValue.toLocaleString(undefined, { maximumFractionDigits: 2 })})`,
            )
            .join("\n");
      }

      if (rewardsText) {
        embedMessage.addField("Pending Rewards", rewardsText);
      }
    }

    embedMessage.addTimestamp();

    let chartPath: string | undefined;

    // Generate chart if requested
    if (chartOptions?.generateChart) {
      try {
        console.log("📈 Generating 30-day portfolio chart for Discord...");
        const chartDataService = new ChartDataService();
        const chartGenerator = new ChartGenerator();

        try {
          const chartData = await chartDataService.getChartData(
            chartOptions.walletAddress,
            30,
          );

          if (chartData.datasets.length > 0) {
            chartPath = await chartGenerator.generateSimplifiedChart(
              chartData,
              "30-Day Portfolio Performance",
              "daily-report-chart-30d",
            );
            console.log(`✅ 30-day chart generated: ${chartPath}`);
            // Chart image will speak for itself - no need to mention it in text
          } else {
            console.log("⚠️  No chart data available for the past 30 days");
          }
        } finally {
          await chartDataService.close();
        }
      } catch (chartError) {
        console.warn(
          "⚠️  Failed to generate chart for Discord report:",
          chartError,
        );
        // Continue without chart - don't fail the entire report
      }
    }

    try {
      // Send the message to Discord (with chart if available)
      if (chartPath) {
        await discordService.sendMessageWithChart(embedMessage, chartPath);
        console.log("Report with chart sent to Discord successfully");
      } else {
        await discordService.sendMessage(embedMessage);
        console.log("Report sent to Discord successfully");
      }
    } finally {
      // Important: Always shutdown the Discord service to allow the process to exit
      await discordService.shutdown();
    }
  } catch (error) {
    console.error("Failed to send report to Discord:", error);
    // Make sure we disconnect even if there's an error
    try {
      await discordService.shutdown();
    } catch (shutdownError) {
      console.error("Error shutting down Discord service:", shutdownError);
    }
  }
}

/** Utility types and helpers for auto-compound summary */
interface AutoCompoundSummary {
  claimedUsdcDisplay: string;
  depositedUsdcDisplay: string;
  totalGasEthDisplay: string;
  errors: string[];
  skipped: boolean;
}

function formatFixed(num: number, frac: number): string {
  return num.toLocaleString(undefined, {
    minimumFractionDigits: frac,
    maximumFractionDigits: frac,
  });
}

function atomicUsdcToDecimalString(amount: bigint): string {
  const asNumber = Number(amount) / 1e6; // USDC 6 decimals
  return asNumber.toString();
}

function formatUsdc2(amountAtomic: bigint): string {
  const n = Number(amountAtomic) / 1e6;
  return formatFixed(n, 2);
}

function formatEth8FromWei(totalWei: bigint): string {
  const n = Number(totalWei) / 1e18;
  return formatFixed(n, 8);
}

// Extract a concise summary from an ethers error for logging/Discord
function extractEthersErrorInfo(error: any): {
  summary?: string;
  code?: any;
  message?: string;
  shortMessage?: string;
  reason?: string;
  selector?: string;
  raw?: string;
} {
  try {
    const code = error?.code;
    const shortMessage = error?.shortMessage;
    const message = error?.message;
    const reason = error?.reason ?? error?.info?.error?.message;
    const raw: string | undefined =
      error?.data?.data ??
      error?.error?.data ??
      error?.info?.error?.data ??
      error?.data;
    const selector = typeof raw === "string" ? raw.slice(0, 10) : undefined;
    const summaryParts: string[] = [];
    // Prefer to include both a concise short message and the underlying reason if present
    if (shortMessage) summaryParts.push(shortMessage);
    if (
      reason &&
      (!shortMessage ||
        !String(shortMessage)
          .toLowerCase()
          .includes(String(reason).toLowerCase()))
    ) {
      summaryParts.push(reason);
    }
    if (summaryParts.length === 0 && message) summaryParts.push(message);
    if (code) summaryParts.push(`code=${String(code)}`);
    if (selector) summaryParts.push(`selector=${selector}`);
    return {
      summary: summaryParts.join(" | "),
      code,
      message,
      shortMessage,
      reason,
      selector,
      raw,
    };
  } catch {
    return {};
  }
}

/**
 * Execute auto-compound sequence if requested and return summary
 */
async function runAutoCompoundIfRequested(args: {
  enabled: boolean;
  reportWallet: string;
  userProtocolService: UserProtocolService;
}): Promise<{ summary?: AutoCompoundSummary }> {
  if (!args.enabled) return { summary: undefined };

  console.log("🔁 Auto-compound requested");

  const errors: string[] = [];
  let skipped = false;
  let claimedAtomic = 0n;
  let depositedAtomic = 0n;
  let totalGasWei = 0n;

  // Ensure signer matches report wallet
  const pk = process.env.MAIN_PRIVATE_KEY;
  if (!pk) {
    errors.push("MAIN_PRIVATE_KEY is not set");
    console.error("Auto-compound: MAIN_PRIVATE_KEY is not set; skipping");
    return {
      summary: {
        claimedUsdcDisplay: "0.00",
        depositedUsdcDisplay: "0.00",
        totalGasEthDisplay: formatEth8FromWei(0n),
        errors,
        skipped: true,
      },
    };
  }

  const rpcUrl = process.env.ALCHEMY_API_KEY
    ? `https://base-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`
    : "https://mainnet.base.org";
  console.log(
    `Auto-compound: RPC endpoint = ${rpcUrl.includes("alchemy.com") ? "Alchemy (masked)" : "Base public"}`,
  );
  const provider = new JsonRpcProvider(rpcUrl);
  const signer = new Wallet(pk, provider);
  const signerAddr = (await signer.getAddress()).toLowerCase();
  const reportAddr = (args.reportWallet || "").toLowerCase();
  if (!reportAddr || signerAddr !== reportAddr) {
    errors.push("Signer address does not match report wallet address");
    console.error(
      `Auto-compound: signer ${signerAddr} mismatches report wallet ${reportAddr}`,
    );
    return {
      summary: {
        claimedUsdcDisplay: "0.00",
        depositedUsdcDisplay: "0.00",
        totalGasEthDisplay: formatEth8FromWei(0n),
        errors,
        skipped: true,
      },
    };
  }
  console.log(
    `Auto-compound: signer ${signerAddr} matches report wallet ${reportAddr}`,
  );

  // Fetch base_flex only to determine FLP USDC rewards
  let usdcRewardDecimal = 0;
  try {
    const baseFlex =
      await args.userProtocolService.getUserProtocolData("base_flex");
    for (const item of baseFlex.portfolio_item_list) {
      const rewards = item.detail.reward_token_list || [];
      for (const tok of rewards) {
        if (tok.symbol === "USDC") {
          usdcRewardDecimal += tok.amount;
        }
      }
    }
  } catch (e: any) {
    errors.push("Failed to fetch base_flex rewards from DeBank");
    return {
      summary: {
        claimedUsdcDisplay: "0.00",
        depositedUsdcDisplay: "0.00",
        totalGasEthDisplay: formatEth8FromWei(0n),
        errors,
        skipped: true,
      },
    };
  }

  if (usdcRewardDecimal <= 0) {
    skipped = true;
    console.log("Auto-compound: no USDC rewards detected; skipping");
    return {
      summary: {
        claimedUsdcDisplay: "0.00",
        depositedUsdcDisplay: "0.00",
        totalGasEthDisplay: formatEth8FromWei(0n),
        errors,
        skipped,
      },
    };
  }
  console.log(
    `Auto-compound: detected USDC rewards ~ ${formatFixed(usdcRewardDecimal, 2)} (decimal)`,
  );

  // Step 1: Claim via flpCompoundCore
  let flpRes: FlpCompoundResult | undefined;
  try {
    flpRes = await flpCompoundCore();
    claimedAtomic = flpRes.usdcReceivedAtomic;
    totalGasWei += flpRes.totalFeeWei;
    console.log(
      `Auto-compound: FLP compound tx=${flpRes.txHash} USDC received=${formatUsdc2(claimedAtomic)} gas(ETH)=${formatEth8FromWei(flpRes.totalFeeWei)}`,
    );
  } catch (e: any) {
    const info = extractEthersErrorInfo(e);
    console.error("Auto-compound: FLP compound failed", info);
    errors.push(
      "FLP compound failed" + (info.summary ? ` (${info.summary})` : ""),
    );
    return {
      summary: {
        claimedUsdcDisplay: "0.00",
        depositedUsdcDisplay: "0.00",
        totalGasEthDisplay: formatEth8FromWei(totalGasWei),
        errors,
        skipped: false,
      },
    };
  }

  if (claimedAtomic <= 0n) {
    // Nothing to deposit
    return {
      summary: {
        claimedUsdcDisplay: formatUsdc2(claimedAtomic),
        depositedUsdcDisplay: "0.00",
        totalGasEthDisplay: formatEth8FromWei(totalGasWei),
        errors,
        skipped: false,
      },
    };
  }

  // Step 2: Deposit claimed USDC into baseUSD
  const claimedDecimalForDeposit = atomicUsdcToDecimalString(claimedAtomic);
  // Increased delay to allow blockchain and RPC to propagate nonce updates
  // This helps prevent nonce collisions when running back-to-back transactions
  const delay = 2000 + Math.floor(Math.random() * 1000); // 2000-3000ms
  console.log(
    `Auto-compound: waiting ${delay}ms before deposit to allow nonce propagation...`,
  );
  try {
    await new Promise((resolve) => setTimeout(resolve, delay));
  } catch {}

  try {
    const addRes: BaseusdAddResult = await baseusdAddCore(
      claimedDecimalForDeposit,
    );
    depositedAtomic = addRes.depositedUsdcAtomic;
    totalGasWei +=
      addRes.deposit.totalFeeWei + (addRes.approval?.totalFeeWei ?? 0n);
    console.log(
      `Auto-compound: baseUSD deposit ok deposited=${formatUsdc2(depositedAtomic)} gas(ETH)=${formatEth8FromWei(addRes.deposit.totalFeeWei + (addRes.approval?.totalFeeWei ?? 0n))}`,
    );
  } catch (e: any) {
    const info = extractEthersErrorInfo(e);
    const isNonceError =
      e.code === "NONCE_EXPIRED" ||
      e.message?.includes("nonce") ||
      e.message?.includes("NONCE_EXPIRED");

    if (isNonceError) {
      console.error(
        "Auto-compound: baseUSD deposit failed due to nonce error. This should not happen with the new nonce management.",
        info,
      );
      errors.push(
        "baseUSD deposit failed (nonce error)" +
          (info.summary ? ` (${info.summary})` : ""),
      );
    } else {
      console.error("Auto-compound: baseUSD deposit failed", info);
      errors.push(
        "baseUSD deposit failed" +
          (info.summary
            ? ` (${info.summary})`
            : info.reason
              ? ` (${info.reason})`
              : ""),
      );
    }

    return {
      summary: {
        claimedUsdcDisplay: formatUsdc2(claimedAtomic),
        depositedUsdcDisplay: "0.00",
        totalGasEthDisplay: formatEth8FromWei(totalGasWei),
        errors,
        skipped: false,
      },
    };
  }

  return {
    summary: {
      claimedUsdcDisplay: formatUsdc2(claimedAtomic),
      depositedUsdcDisplay: formatUsdc2(depositedAtomic),
      totalGasEthDisplay: formatEth8FromWei(totalGasWei),
      errors,
      skipped: false,
    },
  };
}

/**
 * Save the report data to the database
 * @param data The processed report data
 */
async function saveToDatabaseReport(data: {
  walletAddress: string;
  totalUsdValue: number;
  autoUsdValue: number;
  autoEthValue: number;
  dineroEthValue: number;
  flpUsdValue: number;
  baseUsdValue: number;
  tokemakRewards: Array<{ amount: number; usdValue: number; symbol: string }>;
  baseFlexRewards: Array<{ amount: number; usdValue: number; symbol: string }>;
  baseTokemakRewards: Array<{
    amount: number;
    usdValue: number;
    symbol: string;
  }>;
}): Promise<void> {
  try {
    // Calculate total rewards USD value
    const totalRewardsUsdValue = [
      ...data.tokemakRewards,
      ...data.baseFlexRewards,
      ...data.baseTokemakRewards,
    ].reduce((total, reward) => total + reward.usdValue, 0);

    // Get today's date in YYYY-MM-DD format
    const today = new Date().toISOString().split("T")[0];

    // Create the balance records
    const balanceRecords: BalanceRecord[] = [
      // Total USD value
      {
        date: today,
        wallet_address: data.walletAddress,
        balance_type: BalanceType.TOTAL,
        currency: "USD",
        amount: data.totalUsdValue,
      },

      // AUTO USD value
      {
        date: today,
        wallet_address: data.walletAddress,
        balance_type: BalanceType.AUTO_USD,
        currency: "USD",
        amount: data.autoUsdValue,
      },

      // AUTO ETH value
      {
        date: today,
        wallet_address: data.walletAddress,
        balance_type: BalanceType.AUTO_ETH,
        currency: "ETH",
        amount: data.autoEthValue,
      },

      // Dinero ETH value
      {
        date: today,
        wallet_address: data.walletAddress,
        balance_type: BalanceType.DINERO_ETH,
        currency: "ETH",
        amount: data.dineroEthValue,
      },

      // FLP USD value
      {
        date: today,
        wallet_address: data.walletAddress,
        balance_type: BalanceType.FLP,
        currency: "USD",
        amount: data.flpUsdValue,
      },

      // Base USD value
      {
        date: today,
        wallet_address: data.walletAddress,
        balance_type: BalanceType.BASE_USD,
        currency: "USD",
        amount: data.baseUsdValue,
      },
    ];

    // Add rewards records
    // Add Tokemak rewards
    data.tokemakRewards.forEach((reward) => {
      balanceRecords.push({
        date: today,
        wallet_address: data.walletAddress,
        balance_type: BalanceType.TOKEMAK_REWARDS,
        currency: reward.symbol,
        amount: reward.amount,
        metadata: {
          usdValue: reward.usdValue,
        },
      });
    });

    // Add Base Flex rewards
    data.baseFlexRewards.forEach((reward) => {
      balanceRecords.push({
        date: today,
        wallet_address: data.walletAddress,
        balance_type: BalanceType.FLEX_REWARDS,
        currency: reward.symbol,
        amount: reward.amount,
        metadata: {
          usdValue: reward.usdValue,
        },
      });
    });

    // Add Base Tokemak rewards
    data.baseTokemakRewards.forEach((reward) => {
      balanceRecords.push({
        date: today,
        wallet_address: data.walletAddress,
        balance_type: BalanceType.BASE_TOKEMAK_REWARDS,
        currency: reward.symbol,
        amount: reward.amount,
        metadata: {
          usdValue: reward.usdValue,
        },
      });
    });

    try {
      // Save to database
      const balanceRecordService = new BalanceRecordService();

      // Make sure the database is initialized correctly
      await balanceRecordService.initDatabase("development");

      try {
        // Save the records to the database
        const savedRecords =
          await balanceRecordService.saveBalanceRecords(balanceRecords);

        console.log(`Saved ${savedRecords.length} balance records to database`);
      } finally {
        // Always close connections
        await KnexConnector.destroy();
      }
    } catch (dbError) {
      console.error("Database operation failed:", dbError);
      // Ensure connections are closed even on error
      await KnexConnector.destroy();
    }
  } catch (error) {
    console.error("Error saving balance records to database:", error);
  }
}

import { BalanceService } from '../api/debank/balanceService.js';
import { UserProtocolService } from '../api/debank/userProtocolService.js';
import { TokenInfo, UserPortfolioItem } from '../types/debank.js';
import { discordService, DiscordColors } from '../api/discord/discordService.js';

interface DailyCommandOptions {
  address?: string;
  discord?: boolean;
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
  options: DailyCommandOptions = {}
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

    // 1. Get overall wallet balance
    const balanceData = await balanceService.getUserBalanceWithThreshold(walletAddress, 0);
    
    // 2. Get protocol data for Tokemak
    const tokemakData = await userProtocolService.getUserProtocolData('tokemak');
    
    // 3. Get protocol data for Base Flex
    const baseFlexData = await userProtocolService.getUserProtocolData('base_flex');

    // Process protocol data
    const processedData = {
      totalUsdValue: balanceData.total_usd_value,
      tokemak: processProtocolData(tokemakData.portfolio_item_list),
      baseFlex: processProtocolData(baseFlexData.portfolio_item_list)
    };

    // Generate a console report
    await generateReport(processedData, options.discord === true);
    
  } catch (error) {
    if (error instanceof Error) {
      console.error('Error generating daily report:', error.message);
      console.error(error);
    } else {
      console.error('Unexpected error:', error);
    }
    process.exit(1);
  }
}

/**
 * Process protocol portfolio items into a more usable format
 * @param portfolioItems The portfolio items from the protocol
 * @returns Processed protocol data
 */
function processProtocolData(portfolioItems: UserPortfolioItem[]): Record<string, ProtocolData> {
  const result: Record<string, ProtocolData> = {};
  
  for (const item of portfolioItems) {
    const poolId = item.pool.id;
    const friendlyName = UserProtocolService.getPoolFriendlyName(item.pool.project_id, poolId) || item.name;
    
    // Create basic structure
    result[friendlyName] = {
      name: friendlyName,
      usdValue: item.stats.asset_usd_value,
      details: {},
      rewards: {}
    };
    
    // Process supplied tokens
    if (item.detail.supply_token_list && item.detail.supply_token_list.length > 0) {
      for (const token of item.detail.supply_token_list) {
        result[friendlyName].details[token.symbol] = {
          tokenValue: token.amount,
          usdValue: token.usd_value || token.price * token.amount,
          symbol: token.symbol
        };
      }
    }
    
    // Process reward tokens
    if (item.detail.reward_token_list && item.detail.reward_token_list.length > 0) {
      for (const token of item.detail.reward_token_list) {
        result[friendlyName].rewards![token.symbol] = {
          amount: token.amount,
          usdValue: token.usd_value || token.price * token.amount,
          symbol: token.symbol
        };
      }
    }
  }
  
  return result;
}

/**
 * Generate a formatted report and optionally send to Discord
 * @param data The processed protocol data
 * @param sendToDiscord Whether to send the report to Discord
 */
async function generateReport(
  data: {
    totalUsdValue: number;
    tokemak: Record<string, ProtocolData>;
    baseFlex: Record<string, ProtocolData>;
  },
  sendToDiscord: boolean
): Promise<void> {
  // Calculate aggregated values
  const autoUsdValue = data.tokemak['autoUSD']?.usdValue || 0;
  
  const autoEthValue = data.tokemak['autoETH']?.details['ETH']?.tokenValue || 0;
  const dineroEthValue = data.tokemak['dineroETH']?.details['ETH']?.tokenValue || 0;
  const totalEthValue = autoEthValue + dineroEthValue;
  
  const flpUsdValue = data.baseFlex['FLP']?.usdValue || 0;
  
  // Get and aggregate rewards by token symbol
  const aggregateRewards = (rewards: Array<{ amount: number; usdValue: number; symbol: string }>) => {
    const aggregated: Record<string, { amount: number; usdValue: number; symbol: string }> = {};
    
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
      .filter(pool => pool.rewards && Object.keys(pool.rewards).length > 0)
      .flatMap(pool => Object.values(pool.rewards || {}))
  );
  
  const baseFlexRewards = aggregateRewards(
    Object.values(data.baseFlex)
      .filter(pool => pool.rewards && Object.keys(pool.rewards).length > 0)
      .flatMap(pool => Object.values(pool.rewards || {}))
  );
  
  // Format console output
  console.log('\n========== DAILY REPORT ==========');
  console.log(`Total Wallet Value: $${data.totalUsdValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}`);
  
  console.log('\n--- KEY POSITIONS ---');
  console.log(`autoUSD: $${autoUsdValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}`);
  console.log(`ETH (autoETH + dineroETH): ${totalEthValue.toLocaleString(undefined, { maximumFractionDigits: 6 })} ETH`);
  console.log(`FLP: $${flpUsdValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}`);
  
  if (data.baseFlex['FLP'] && data.baseFlex['FLP'].details) {
    console.log('\n--- FLP BREAKDOWN ---');
    for (const [symbol, details] of Object.entries(data.baseFlex['FLP'].details)) {
      console.log(`  ${details.tokenValue.toLocaleString(undefined, { maximumFractionDigits: 6 })} ${symbol} ($${details.usdValue.toLocaleString(undefined, { maximumFractionDigits: 2 })})`);
    }
  }
  
  if (tokemakRewards.length > 0 || baseFlexRewards.length > 0) {
    console.log('\n--- PENDING REWARDS ---');
    
    if (tokemakRewards.length > 0) {
      console.log('Tokemak:');
      for (const reward of tokemakRewards) {
        console.log(`  ${reward.amount.toLocaleString(undefined, { maximumFractionDigits: 6 })} ${reward.symbol} ($${reward.usdValue.toLocaleString(undefined, { maximumFractionDigits: 2 })})`);
      }
    }
    
    if (baseFlexRewards.length > 0) {
      console.log('Base Flex:');
      for (const reward of baseFlexRewards) {
        console.log(`  ${reward.amount.toLocaleString(undefined, { maximumFractionDigits: 6 })} ${reward.symbol} ($${reward.usdValue.toLocaleString(undefined, { maximumFractionDigits: 2 })})`);
      }
    }
  }
  
  // Send to Discord if requested
  if (sendToDiscord) {
    await sendDiscordReport({
      totalUsdValue: data.totalUsdValue,
      autoUsdValue,
      totalEthValue,
      flpUsdValue,
      flpDetails: data.baseFlex['FLP']?.details || {},
      tokemakRewards,
      baseFlexRewards
    });
  }
}

/**
 * Send the report to Discord
 * @param data The processed report data
 */
async function sendDiscordReport(data: {
  totalUsdValue: number;
  autoUsdValue: number;
  totalEthValue: number;
  flpUsdValue: number;
  flpDetails: Record<string, { tokenValue: number; usdValue: number; symbol: string }>;
  tokemakRewards: Array<{ amount: number; usdValue: number; symbol: string }>;
  baseFlexRewards: Array<{ amount: number; usdValue: number; symbol: string }>;
}): Promise<void> {
  try {
    const embedMessage = discordService.createEmbedMessage()
      .addTitle('📊 Daily DeFi Report')
      .setColor(DiscordColors.BLUE)
      .addDescription(`Total Wallet Value: $${data.totalUsdValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}`)
      .addFields([
        { 
          name: 'Key Positions', 
          value: [
            `• autoUSD: $${data.autoUsdValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}`,
            `• ETH (autoETH + dineroETH): ${data.totalEthValue.toLocaleString(undefined, { maximumFractionDigits: 6 })} ETH`,
            `• FLP: $${data.flpUsdValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
          ].join('\n')
        }
      ]);
    
    // Add FLP breakdown if available
    if (Object.keys(data.flpDetails).length > 0) {
      const flpBreakdown = Object.entries(data.flpDetails)
        .map(([_, details]) => 
          `• ${details.tokenValue.toLocaleString(undefined, { maximumFractionDigits: 6 })} ${details.symbol} ($${details.usdValue.toLocaleString(undefined, { maximumFractionDigits: 2 })})`
        )
        .join('\n');
      
      embedMessage.addField('FLP Breakdown', flpBreakdown);
    }
    
    // Add rewards if available
    const hasRewards = data.tokemakRewards.length > 0 || data.baseFlexRewards.length > 0;
    
    if (hasRewards) {
      let rewardsText = '';
      
      if (data.tokemakRewards.length > 0) {
        rewardsText += '**Tokemak:**\n' + data.tokemakRewards
          // Only show rewards with USD value > 0
          .filter(reward => reward.usdValue > 0)
          .map(reward => 
            `• ${reward.amount.toLocaleString(undefined, { maximumFractionDigits: 6 })} ${reward.symbol} ($${reward.usdValue.toLocaleString(undefined, { maximumFractionDigits: 2 })})`
          )
          .join('\n');
        
        if (data.baseFlexRewards.length > 0) {
          rewardsText += '\n\n';
        }
      }
      
      if (data.baseFlexRewards.length > 0) {
        rewardsText += '**Base Flex:**\n' + data.baseFlexRewards
          // Only show rewards with USD value > 0
          .filter(reward => reward.usdValue > 0)
          .map(reward => 
            `• ${reward.amount.toLocaleString(undefined, { maximumFractionDigits: 6 })} ${reward.symbol} ($${reward.usdValue.toLocaleString(undefined, { maximumFractionDigits: 2 })})`
          )
          .join('\n');
      }
      
      if (rewardsText) {
        embedMessage.addField('Pending Rewards', rewardsText);
      }
    }
    
    embedMessage.addTimestamp();
    
    try {
      // Send the message to Discord
      await discordService.sendMessage(embedMessage);
      console.log('Report sent to Discord successfully');
    } finally {
      // Important: Always shutdown the Discord service to allow the process to exit
      await discordService.shutdown();
    }
    
  } catch (error) {
    console.error('Failed to send report to Discord:', error);
    // Make sure we disconnect even if there's an error
    try {
      await discordService.shutdown();
    } catch (shutdownError) {
      console.error('Error shutting down Discord service:', shutdownError);
    }
  }
}
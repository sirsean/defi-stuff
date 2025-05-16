import { BalanceRecordService, BalanceRecord, BalanceType } from '../db/balanceRecordService.js';
import { KnexConnector } from '../db/knexConnector.js';

type HistoryOptions = {
  address?: string;
  days?: number;
  range?: string;
  table?: boolean;  // Option to show data in the old table format
};

/**
 * Format a date as YYYY-MM-DD
 */
const formatDate = (date: string | Date): string => {
  if (typeof date === 'string') {
    return date;
  }
  return date.toISOString().split('T')[0];
};

/**
 * Format a number with thousand separators and 2 decimal places
 */
const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value);
};

/**
 * Format an ETH amount with 6 decimal places
 */
const formatEth = (value: number): string => {
  return value.toFixed(6);
};

/**
 * Format a token amount with appropriate decimal places
 */
const formatTokenAmount = (value: number, symbol: string): string => {
  // Different tokens may need different precision levels
  switch (symbol) {
    case 'ETH':
      return value.toFixed(6);
    case 'USDC':
    case 'USDT':
    case 'DAI':
      return value.toFixed(2);
    default:
      // Default to 4 decimal places for other tokens
      return value.toFixed(4);
  }
};

/**
 * Process raw balance records into a daily summary format
 */
interface DailySummary {
  date: string;
  totalUsd: number;
  autoUsd: number;
  autoEth: number;
  autoEthUsd?: number;  // Calculate USD value based on current market price when displaying
  dineroEth: number;
  dineroEthUsd?: number; // Calculate USD value based on current market price when displaying
  flpUsd: number;
  rewards: {
    [symbol: string]: {
      amount: number;
      usdValue: number;
    };
  };
}

/**
 * Process records into daily summaries
 */
const processRecords = (records: BalanceRecord[]): DailySummary[] => {
  // Group records by date
  const recordsByDate: Record<string, BalanceRecord[]> = {};
  
  records.forEach(record => {
    if (!recordsByDate[record.date]) {
      recordsByDate[record.date] = [];
    }
    recordsByDate[record.date].push(record);
  });
  
  // Process each date's records into a summary
  const summaries: DailySummary[] = [];
  
  for (const [date, dateRecords] of Object.entries(recordsByDate)) {
    const summary: DailySummary = {
      date,
      totalUsd: 0,
      autoUsd: 0,
      autoEth: 0,
      dineroEth: 0,
      flpUsd: 0,
      rewards: {}
    };
    
    // Process each record
    dateRecords.forEach(record => {
      switch (record.balance_type) {
        case BalanceType.TOTAL:
          if (record.currency === 'USD') {
            summary.totalUsd = record.amount;
          }
          break;
          
        case BalanceType.AUTO_USD:
          if (record.currency === 'USD') {
            summary.autoUsd = record.amount;
          }
          break;
          
        case BalanceType.AUTO_ETH:
          if (record.currency === 'ETH') {
            summary.autoEth = record.amount;
          }
          break;
          
        case BalanceType.DINERO_ETH:
          if (record.currency === 'ETH') {
            summary.dineroEth = record.amount;
          }
          break;
          
        case BalanceType.FLP:
          if (record.currency === 'USD') {
            summary.flpUsd = record.amount;
          }
          break;
          
        case BalanceType.FLEX_REWARDS:
        case BalanceType.TOKEMAK_REWARDS:
          // Track individual reward tokens
          const symbol = record.currency;
          const amount = record.amount;
          
          // Handle both string and object metadata formats
          let usdValue = 0;
          if (record.metadata) {
            // If metadata is a string (from database), parse it
            const metadata = typeof record.metadata === 'string' 
              ? JSON.parse(record.metadata) 
              : record.metadata;
            
            usdValue = metadata.usdValue || 0;
          }
          
          if (!summary.rewards[symbol]) {
            summary.rewards[symbol] = {
              amount: 0,
              usdValue: 0
            };
          }
          
          summary.rewards[symbol].amount += amount;
          summary.rewards[symbol].usdValue += usdValue;
          break;
      }
    });
    
    summaries.push(summary);
  }
  
  // Sort by date descending
  return summaries.sort((a, b) => b.date.localeCompare(a.date));
};

/**
 * Display the historical balance data in a detailed format
 */
const displayBalanceHistory = (summaries: DailySummary[]): void => {
  if (summaries.length === 0) {
    console.log('No historical data found for the specified criteria.');
    return;
  }
  
  console.log(`Found ${summaries.length} historical daily records:`);
  console.log();
  
  // For each date, display a detailed breakdown
  for (const summary of summaries) {
    console.log(`=== ${summary.date} ===`);
    console.log(`Total Portfolio Value: ${formatCurrency(summary.totalUsd)}`);
    console.log();
    
    // Calculate the total ETH amount for easier reading
    const totalEthAmount = summary.autoEth + summary.dineroEth;
    
    // Core positions section
    console.log('Core Positions:');
    console.log(`  autoUSD: ${formatCurrency(summary.autoUsd)}`);
    console.log(`  autoETH: ${formatEth(summary.autoEth)} ETH`);
    console.log(`  dineroETH: ${formatEth(summary.dineroEth)} ETH`);
    console.log(`  Total ETH: ${formatEth(totalEthAmount)} ETH`); 
    console.log(`  FLP: ${formatCurrency(summary.flpUsd)}`);
    console.log();
    
    // Rewards section (only show if there are rewards)
    const rewardTokens = Object.keys(summary.rewards).sort(); // Sort alphabetically
    if (rewardTokens.length > 0) {
      let totalRewardsUsd = 0;
      
      console.log('Pending Rewards:');
      for (const symbol of rewardTokens) {
        const { amount, usdValue } = summary.rewards[symbol];
        
        // Calculate approximate token price if possible
        let tokenPriceInfo = '';
        if (amount > 0) {
          const tokenPrice = usdValue / amount;
          if (tokenPrice > 0) {
            tokenPriceInfo = ` @ ${formatCurrency(tokenPrice)} per token`;
          }
        }
        
        console.log(`  ${formatTokenAmount(amount, symbol)} ${symbol} (${formatCurrency(usdValue)})${tokenPriceInfo}`);
        totalRewardsUsd += usdValue;
      }
      
      console.log(`  Total Rewards Value: ${formatCurrency(totalRewardsUsd)}`);
      console.log();
    }
  }
};

/**
 * Display the historical balance data in a table format with separate reward columns
 */
const displayBalanceHistoryTable = (summaries: DailySummary[]): void => {
  if (summaries.length === 0) {
    console.log('No historical data found for the specified criteria.');
    return;
  }
  
  console.log(`Found ${summaries.length} historical daily records (table view):`);
  console.log();
  
  // Collect all unique reward token symbols across all summaries
  const allRewardTokens = new Set<string>();
  summaries.forEach(summary => {
    Object.keys(summary.rewards).forEach(token => allRewardTokens.add(token));
  });
  
  // Sort reward tokens alphabetically for consistent display
  const sortedRewardTokens = Array.from(allRewardTokens).sort();
  
  // Build the header
  let header = '| Date       | Total USD    | autoUSD     | autoETH       | dineroETH     | FLP          |';
  let separator = '|------------|--------------|-------------|---------------|---------------|--------------|';
  
  // Add columns for each reward token
  sortedRewardTokens.forEach(token => {
    // Use lowercase 'pending' with a colon to match the pattern
    const columnName = `pending:${token}`;
    header += ` ${columnName.padEnd(13)} |`;
    separator += '---------------|';
  });
  
  // Print header
  console.log(header);
  console.log(separator);
  
  // Print data rows
  summaries.forEach(summary => {
    let row = `| ${summary.date} | ` +
             `${formatCurrency(summary.totalUsd).padEnd(12)} | ` +
             `${formatCurrency(summary.autoUsd).padEnd(11)} | ` +
             `${formatEth(summary.autoEth).padEnd(13)} | ` +
             `${formatEth(summary.dineroEth).padEnd(13)} | ` +
             `${formatCurrency(summary.flpUsd).padEnd(12)} |`;
    
    // Add each reward token value
    sortedRewardTokens.forEach(token => {
      const reward = summary.rewards[token];
      if (reward) {
        // Show token amount only (since the column header already shows the token name)
        const formattedAmount = formatTokenAmount(reward.amount, token);
        row += ` ${formattedAmount.padEnd(13)} |`;
      } else {
        // No value for this token on this date
        row += ` ${'0'.padEnd(13)} |`;
      }
    });
    
    console.log(row);
  });
  
  console.log();
};

/**
 * Query historical balance data from the database
 */
export const history = async (address?: string, options: HistoryOptions = {}): Promise<void> => {
  try {
    // Get wallet address from options or environment variable
    const walletAddress = options.address || address || process.env.WALLET_ADDRESS;
    
    if (!walletAddress) {
      console.error('Error: Wallet address not provided. Please specify an address or set the WALLET_ADDRESS environment variable.');
      return;
    }
    
    const balanceRecordService = new BalanceRecordService();
    
    // Different query methods based on options
    let records: BalanceRecord[] = [];
    
    if (options.range) {
      // Parse date range (format: YYYY-MM-DD,YYYY-MM-DD)
      const [startDateStr, endDateStr] = options.range.split(',');
      
      // Validate date format
      if (!startDateStr.match(/^\d{4}-\d{2}-\d{2}$/) || !endDateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
        console.error('Error: Invalid date range format. Please use YYYY-MM-DD,YYYY-MM-DD format.');
        return;
      }
      
      records = await balanceRecordService.getBalanceRecordsByDateRange(
        walletAddress,
        startDateStr,
        endDateStr
      );
    } else if (options.days) {
      // Calculate date range based on days
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(endDate.getDate() - options.days);
      
      // Format dates for query
      const startDateStr = formatDate(startDate);
      const endDateStr = formatDate(endDate);
      
      records = await balanceRecordService.getBalanceRecordsByDateRange(
        walletAddress,
        startDateStr,
        endDateStr
      );
    } else {
      // If no range specified, get all dates
      const dates = await balanceRecordService.getBalanceRecordsByType(walletAddress, BalanceType.TOTAL);
      
      // For each date, get all records
      for (const record of dates) {
        const dateRecords = await balanceRecordService.getBalanceRecordsByDate(
          walletAddress,
          record.date
        );
        records = [...records, ...dateRecords];
      }
    }
    
    // Process the records into summaries
    const summaries = processRecords(records);
    
    // Display the results based on format option
    if (options.table) {
      displayBalanceHistoryTable(summaries);
    } else {
      displayBalanceHistory(summaries);
    }
    
  } catch (error) {
    console.error('Error retrieving historical balance data:', error);
  } finally {
    // Always close database connections when done
    try {
      await KnexConnector.destroy();
    } catch (closeError) {
      console.error('Error closing database connection:', closeError);
    }
  }
};
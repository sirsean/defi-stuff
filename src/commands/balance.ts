import { BalanceService } from '../api/debank/balanceService.js';

interface BalanceCommandOptions {
  threshold?: number;
  address?: string;
}

/**
 * Command to get a wallet's USD balance across all chains supported by Debank
 * @param walletAddressParam Optional wallet address to query (overrides the one from .env if provided)
 * @param options Command options with optional threshold and address
 */
export async function balance(walletAddressParam: string, options: BalanceCommandOptions = {}): Promise<void> {
  try {
    const balanceService = new BalanceService();
    const threshold = options.threshold ?? 1000; // Default to 1000 if not specified

    // Determine which wallet address to use
    const walletAddress = options.address || walletAddressParam;

    // If a wallet address is provided in either param, use it
    if (walletAddress) {
      balanceService.setWalletAddress(walletAddress);
    }

    // Display which wallet is being checked
    if (walletAddress) {
      console.log(`Fetching balance for wallet ${walletAddress}...`);
    } else {
      console.log(`Fetching balance for default wallet...`);
    }

    const balanceData = await balanceService.getUserBalanceWithThreshold(walletAddress, threshold);

    // Display total balance
    console.log(`\nTotal Balance: $${balanceData.total_usd_value.toLocaleString()}`);

    if (balanceData.chain_list.length === 0) {
      console.log(`\nNo chains with balances above $${threshold.toLocaleString()} threshold.`);
      return;
    }

    // Display chain balances
    console.log(`\nChain Balances (above $${threshold.toLocaleString()} threshold):`);

    balanceData.chain_list.forEach(chain => {
      console.log(`${chain.name} (${chain.id}): $${chain.usd_value.toLocaleString()}`);
    });

  } catch (error) {
    if (error instanceof Error && error.message.includes('No balance data found')) {
      console.error('No balance data found for this wallet address. This could be because:');
      console.error('- The wallet has no balances on chains that Debank supports');
      console.error('- The wallet address is not valid or has not been indexed by Debank yet');
      console.error('- There might be temporary issues with the Debank API');
      console.error('\nTry using a different wallet address with the -a option.');
    } else {
      console.error('Error fetching balance:', error);
    }
    process.exit(1);
  }
}
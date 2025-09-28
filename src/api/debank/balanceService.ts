import { DebankClient } from "./debankClient.js";
import { ChainBalance, UserTotalBalanceResponse } from "../../types/debank.js";

/**
 * Service for fetching and processing user balance data from Debank
 */
export class BalanceService {
  private debankClient: DebankClient;
  private walletAddress: string;

  /**
   * Creates a new BalanceService
   */
  constructor() {
    this.debankClient = new DebankClient();

    // Get the wallet address from environment variables
    const walletAddress = process.env.WALLET_ADDRESS;

    if (!walletAddress) {
      throw new Error("WALLET_ADDRESS environment variable is not set");
    }

    this.walletAddress = walletAddress;
  }

  /**
   * Get a user's total balance across all chains
   * @param userAddress The wallet address to query (optional, uses default if not provided)
   * @returns The user's total balance data
   */
  async getUserTotalBalance(
    userAddress?: string,
  ): Promise<UserTotalBalanceResponse> {
    const address = userAddress || this.walletAddress;
    return this.debankClient.getUserTotalBalance(address);
  }

  /**
   * Gets a user's balance data with chains filtered by a minimum USD threshold
   * @param userAddress The wallet address to query (optional, uses default if not provided)
   * @param threshold Minimum USD value to include a chain in the results (default: 1000)
   * @returns Filtered balance data
   */
  async getUserBalanceWithThreshold(
    userAddress?: string,
    threshold = 1000,
  ): Promise<{
    total_usd_value: number;
    chain_list: ChainBalance[];
  }> {
    const address = userAddress || this.walletAddress;
    const balanceData = await this.getUserTotalBalance(address);

    // Filter chains by the threshold
    const filteredChains = balanceData.chain_list.filter(
      (chain) => chain.usd_value >= threshold,
    );

    // Sort chains by USD value in descending order
    filteredChains.sort((a, b) => b.usd_value - a.usd_value);

    return {
      total_usd_value: balanceData.total_usd_value,
      chain_list: filteredChains,
    };
  }

  /**
   * Set a custom wallet address instead of using the environment variable
   * @param address The wallet address to use
   */
  setWalletAddress(address: string): void {
    this.walletAddress = address;
  }
}

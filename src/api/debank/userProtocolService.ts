import { DebankClient } from './debankClient.js';
import { UserProtocolResponse } from '../../types/debank.js';

/**
 * Service for working with user's protocol data from Debank
 */
export class UserProtocolService {
  private debankClient: DebankClient;
  private walletAddress: string;

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
   * Get user protocol data for a specific protocol
   * @param protocolId The protocol ID to query
   * @returns User's protocol data
   */
  async getUserProtocolData(protocolId: string): Promise<UserProtocolResponse> {
    return this.debankClient.getUserProtocol(this.walletAddress, protocolId);
  }
  
  /**
   * Set a custom wallet address instead of using the environment variable
   * @param address The wallet address to use
   */
  setWalletAddress(address: string): void {
    this.walletAddress = address;
  }
}
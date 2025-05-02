import { DebankClient } from './debankClient.js';
import { UserProtocolResponse } from '../../types/debank.js';

/**
 * Map of known pool IDs to friendly names
 */
export const PROTOCOL_POOL_NAMES: Record<string, Record<string, string>> = {
  // Tokemak pools
  tokemak: {
    '0x726104cfbd7ece2d1f5b3654a19109a9e2b6c27b': 'autoUSD',
    '0x9abe58bc98ae95296434ab8f57915c1068354404': 'dineroETH',
    '0x60882d6f70857606cdd37729ccce882015d1755e': 'autoETH',
    '0xa374a62ddbd21e3d5716cb04821cb710897c0972': 'sTOKE'
  },
  // Base Flex pools
  base_flex: {
    '0x053fa05d34c51afc5cb9f162fab3fd675ac06119': 'FLP'
  },
  // Dinero pools
  dinero: {
    '0x55769490c825ccb09b2a6ae955203fabf04857fd': 'sDINERO'
  },
  // Global pool mappings (protocol-agnostic)
  global: {}
  // Add other protocols here as needed
};

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
  
  /**
   * Get a friendly name for a pool if it exists in our mappings
   * @param protocolId The protocol ID
   * @param poolId The pool ID to look up
   * @returns Friendly name if available, undefined otherwise
   */
  static getPoolFriendlyName(protocolId: string, poolId: string): string | undefined {
    // Check protocol-specific mapping first
    const protocolSpecific = PROTOCOL_POOL_NAMES[protocolId]?.[poolId];
    if (protocolSpecific) return protocolSpecific;
    
    // Fall back to global mapping if no protocol-specific name found
    return PROTOCOL_POOL_NAMES.global?.[poolId];
  }
}
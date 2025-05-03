/**
 * Supported blockchain explorers
 */
export type BlockchainExplorer = 'ethereum' | 'base';

/**
 * Configuration for blockchain explorer API
 */
export interface ExplorerConfig {
  apiUrl: string;
  apiKeyEnv: string;
  name: string;
}

/**
 * Map of explorer configurations by blockchain
 */
export const EXPLORER_CONFIGS: Record<BlockchainExplorer, ExplorerConfig> = {
  ethereum: {
    apiUrl: 'https://api.etherscan.io/api',
    apiKeyEnv: 'ETHERSCAN_API_KEY',
    name: 'Etherscan'
  },
  base: {
    apiUrl: 'https://api.basescan.org/api',
    apiKeyEnv: 'BASESCAN_API_KEY',
    name: 'Basescan'
  }
};

/**
 * Base response structure for blockchain explorer API requests
 */
export interface ExplorerApiResponse<T> {
  status: string;
  message: string;
  result: T;
}

/**
 * Response for the getContractABI endpoint
 */
export interface ContractAbiResponse extends ExplorerApiResponse<string> {
  // The result is a string containing the ABI JSON
}

/**
 * Interface for proxy implementation information
 */
export interface ProxyImplementation {
  isProxy: boolean;
  implementationAddress?: string;
  implementationAbi?: any;
}

/**
 * Options for ABI retrieval from blockchain explorers
 */
export interface AbiOptions {
  address: string;
  checkForProxy?: boolean;
  chain?: BlockchainExplorer;
}
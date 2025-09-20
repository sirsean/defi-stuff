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
  chainId: string;
}

/**
 * Map of explorer configurations by blockchain
 */
export const EXPLORER_CONFIGS: Record<BlockchainExplorer, ExplorerConfig> = {
  ethereum: {
    apiUrl: 'https://api.etherscan.io/v2/api',
    apiKeyEnv: 'ETHERSCAN_API_KEY',
    name: 'Etherscan',
    chainId: '1'
  },
  base: {
    apiUrl: 'https://api.etherscan.io/v2/api',
    apiKeyEnv: 'ETHERSCAN_API_KEY',
    name: 'Etherscan',
    chainId: '8453'
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
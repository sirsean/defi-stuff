/**
 * Base response structure for Etherscan API requests
 */
export interface EtherscanApiResponse<T> {
  status: string;
  message: string;
  result: T;
}

/**
 * Response for the getContractABI endpoint
 */
export interface ContractAbiResponse extends EtherscanApiResponse<string> {
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
 * Options for ABI retrieval from Etherscan
 */
export interface AbiOptions {
  address: string;
  checkForProxy?: boolean;
}
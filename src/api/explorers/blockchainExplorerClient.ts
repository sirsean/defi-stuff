import axios, { AxiosInstance } from "axios";
import { 
  BlockchainExplorer, 
  ContractAbiResponse, 
  EXPLORER_CONFIGS 
} from "../../types/etherscan.js";

/**
 * Client for interacting with blockchain explorer APIs like Etherscan, Basescan, etc.
 */
export class BlockchainExplorerClient {
  private client: AxiosInstance;
  private apiKey: string;
  private chain: BlockchainExplorer;
  private explorerName: string;
  private chainId: string;

  /**
   * Creates a new blockchain explorer API client
   * @param chain The blockchain to use (ethereum, base, etc.)
   */
  constructor(chain: BlockchainExplorer = 'ethereum') {
    this.chain = chain;
    
    // Get configuration for the specified chain
    const config = EXPLORER_CONFIGS[chain];
    if (!config) {
      throw new Error(`Unsupported blockchain: ${chain}`);
    }
    
    this.explorerName = config.name;
    this.chainId = config.chainId;
    
    // Get the API key from environment variables
    const apiKey = process.env[config.apiKeyEnv];
    if (!apiKey) {
      throw new Error(`${config.apiKeyEnv} environment variable is not set`);
    }

    this.apiKey = apiKey;

    // Create an axios instance with default configuration
    this.client = axios.create({
      baseURL: config.apiUrl,
    });
  }

  /**
   * Get the ABI for a verified contract
   * @param address The contract address
   * @returns Contract ABI as a string (JSON)
   */
  async getContractABI(address: string): Promise<string> {
    try {
      const response = await this.client.get<ContractAbiResponse>("", {
        params: {
          module: "contract",
          action: "getabi",
          address,
          apikey: this.apiKey,
          chainid: this.chainId,
        },
      });

      if (response.data.status !== "1") {
        throw new Error(`${this.explorerName} API error: ${response.data.message} - ${response.data.result}`);
      }

      return response.data.result;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error(
          `Error fetching contract ABI from ${this.explorerName}:`,
          error.response?.data || error.message,
        );
      } else {
        console.error("Unexpected error:", error);
      }
      throw error;
    }
  }

  /**
   * Get the source code for a verified contract
   * This can be used to determine if a contract is a proxy
   * @param address The contract address
   * @returns Contract source code information
   */
  async getContractSourceCode(address: string): Promise<any> {
    try {
      const response = await this.client.get("", {
        params: {
          module: "contract",
          action: "getsourcecode",
          address,
          apikey: this.apiKey,
          chainid: this.chainId,
        },
      });

      if (response.data.status !== "1") {
        throw new Error(`${this.explorerName} API error: ${response.data.message} - ${response.data.result}`);
      }

      return response.data.result[0];
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error(
          `Error fetching contract source code from ${this.explorerName}:`,
          error.response?.data || error.message,
        );
      } else {
        console.error("Unexpected error:", error);
      }
      throw error;
    }
  }
  
  /**
   * Get the name of the explorer being used
   * @returns The name of the explorer (e.g., "Etherscan", "Basescan")
   */
  getExplorerName(): string {
    return this.explorerName;
  }
  
  /**
   * Get the blockchain this client is configured for
   * @returns The blockchain identifier
   */
  getChain(): BlockchainExplorer {
    return this.chain;
  }
}
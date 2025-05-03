import axios, { AxiosInstance } from "axios";
import { ContractAbiResponse } from "../../types/etherscan.js";

/**
 * Client for interacting with the Etherscan API
 */
export class EtherscanClient {
  private client: AxiosInstance;
  private apiKey: string;
  private baseUrl = "https://api.etherscan.io/api";

  /**
   * Creates a new Etherscan API client
   */
  constructor() {
    // Get the API key from environment variables
    const apiKey = process.env.ETHERSCAN_API_KEY;

    if (!apiKey) {
      throw new Error("ETHERSCAN_API_KEY environment variable is not set");
    }

    this.apiKey = apiKey;

    // Create an axios instance with default configuration
    this.client = axios.create({
      baseURL: this.baseUrl,
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
        },
      });

      if (response.data.status !== "1") {
        throw new Error(`Etherscan API error: ${response.data.message} - ${response.data.result}`);
      }

      return response.data.result;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error(
          "Error fetching contract ABI:",
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
        },
      });

      if (response.data.status !== "1") {
        throw new Error(`Etherscan API error: ${response.data.message} - ${response.data.result}`);
      }

      return response.data.result[0];
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error(
          "Error fetching contract source code:",
          error.response?.data || error.message,
        );
      } else {
        console.error("Unexpected error:", error);
      }
      throw error;
    }
  }
}
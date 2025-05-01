import axios, { AxiosInstance, AxiosRequestConfig } from "axios";
import { DebankProtocol } from "../../types/debank.js";

/**
 * Client for interacting with the Debank API
 */
export class DebankClient {
  private client: AxiosInstance;
  private accessKey: string;
  private baseUrl = "https://pro-openapi.debank.com";

  /**
   * Creates a new Debank API client
   */
  constructor() {
    // Get the API key from environment variables
    const accessKey = process.env.DEBANK_API_KEY;

    if (!accessKey) {
      throw new Error("DEBANK_API_KEY environment variable is not set");
    }

    this.accessKey = accessKey;

    // Create an axios instance with default configuration
    this.client = axios.create({
      baseURL: this.baseUrl,
      headers: {
        Accept: "application/json",
        AccessKey: this.accessKey,
      },
    });
  }

  /**
   * Get a list of protocols for a specific chain
   * @param chain The blockchain to query (e.g., 'eth', 'bsc', 'arbitrum')
   * @returns List of protocols on the specified chain
   */
  async getProtocolList(chain: string): Promise<DebankProtocol[]> {
    try {
      const response = await this.client.get<DebankProtocol[]>(
        "/v1/protocol/list",
        {
          params: { chain_id: chain },
        },
      );

      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error(
          "Error fetching protocol list:",
          error.response?.data || error.message,
        );
      } else {
        console.error("Unexpected error:", error);
      }
      throw error;
    }
  }
}

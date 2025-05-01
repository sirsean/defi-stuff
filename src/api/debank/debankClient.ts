import axios, { AxiosInstance, AxiosRequestConfig } from "axios";
import { DebankProtocol, UserProtocolResponse } from "../../types/debank.js";

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

  /**
   * Get a user's data for a specific protocol
   * @param userAddress The wallet address to query
   * @param protocolId The protocol ID to query
   * @returns User's protocol data
   */
  async getUserProtocol(userAddress: string, protocolId: string): Promise<UserProtocolResponse> {
    try {
      const response = await this.client.get<UserProtocolResponse>(
        "/v1/user/protocol",
        {
          params: {
            id: userAddress,
            protocol_id: protocolId
          },
        },
      );

      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 404) {
          throw new Error(`No data found for protocol ${protocolId} and user ${userAddress}`);
        }
        console.error(
          "Error fetching user protocol data:",
          error.response?.data || error.message,
        );
      } else {
        console.error("Unexpected error:", error);
      }
      throw error;
    }
  }
}

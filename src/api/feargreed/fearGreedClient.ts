import axios, { AxiosInstance } from "axios";
import type { FearGreedIndexResponse } from "../../types/feargreed.js";

/**
 * Axios instance for Fear & Greed Index API
 * Exported separately for testing with axios-mock-adapter
 */
export const fearGreedAxios: AxiosInstance = axios.create({
  baseURL: "https://api.alternative.me",
  timeout: 10000,
  headers: {
    Accept: "application/json",
  },
});

/**
 * Client for interacting with the Fear and Greed Index API
 */
export class FearGreedClient {
  private http: AxiosInstance;

  constructor(http: AxiosInstance = fearGreedAxios) {
    this.http = http;
  }

  /**
   * Get the Fear and Greed Index data
   * @param limit Number of days to retrieve (default: 10)
   * @returns Fear and Greed Index response
   */
  async getFearGreedIndex(limit = 10): Promise<FearGreedIndexResponse> {
    try {
      const { data } = await this.http.get<FearGreedIndexResponse>("/fng/", {
        params: { limit },
      });
      return data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const status = error.response?.status;
        const msg =
          (error.response?.data as any)?.message ??
          error.message ??
          "Unknown error";
        throw new Error(
          `Fear & Greed API request failed${status ? ` (${status})` : ""}: ${msg}`,
        );
      }
      throw new Error(`Fear & Greed API request failed: ${String(error)}`);
    }
  }
}

/**
 * Singleton instance of FearGreedClient
 */
export const fearGreedClient = new FearGreedClient();

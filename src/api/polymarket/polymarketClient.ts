import axios, { AxiosInstance } from "axios";
import type {
  PolymarketMarket,
  PolymarketEvent,
} from "../../types/polymarket.js";

/**
 * Axios instance for Polymarket API
 * Exported separately for testing with axios-mock-adapter
 */
export const polymarketAxios: AxiosInstance = axios.create({
  baseURL: "https://gamma-api.polymarket.com",
  timeout: 15000,
  headers: {
    Accept: "application/json",
  },
});

export interface GetMarketsParams {
  limit?: number;
  offset?: number;
  closed?: boolean;
  order?: string;
  ascending?: boolean;
  tag_id?: string;
  id?: string; // Single market ID
}

/**
 * Client for interacting with the Polymarket Gamma API
 */
export class PolymarketClient {
  private http: AxiosInstance;

  constructor(http: AxiosInstance = polymarketAxios) {
    this.http = http;
  }

  /**
   * Get markets from Polymarket
   * @param params Query parameters for filtering markets
   * @returns Array of markets
   */
  async getMarkets(params: GetMarketsParams = {}): Promise<PolymarketMarket[]> {
    try {
      const { data } = await this.http.get<PolymarketMarket[]>("/markets", {
        params: {
          limit: params.limit ?? 500,
          offset: params.offset ?? 0,
          closed: params.closed ?? false,
          order: params.order,
          ascending: params.ascending,
          id: params.id,
        },
      });
      return data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const status = error.response?.status;
        const msg =
          (error.response?.data as any)?.error ??
          error.message ??
          "Unknown error";
        throw new Error(
          `Polymarket API request failed${status ? ` (${status})` : ""}: ${msg}`,
        );
      }
      throw new Error(`Polymarket API request failed: ${String(error)}`);
    }
  }

  /**
   * Get a single market by ID
   * @param id Market ID
   * @returns Market or null if not found
   */
  async getMarketById(id: string): Promise<PolymarketMarket | null> {
    const markets = await this.getMarkets({ id, limit: 1 });
    return markets.length > 0 ? markets[0] : null;
  }

  /**
   * Get events from Polymarket (events group multiple markets)
   * @param params Query parameters for filtering events
   * @returns Array of events with their markets
   */
  async getEvents(params: GetMarketsParams = {}): Promise<PolymarketEvent[]> {
    try {
      const { data } = await this.http.get<PolymarketEvent[]>("/events", {
        params: {
          limit: params.limit ?? 500,
          offset: params.offset ?? 0,
          closed: params.closed,
          order: params.order,
          ascending: params.ascending,
          tag_id: params.tag_id,
        },
      });
      return data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const status = error.response?.status;
        const msg =
          (error.response?.data as any)?.error ??
          error.message ??
          "Unknown error";
        throw new Error(
          `Polymarket API request failed${status ? ` (${status})` : ""}: ${msg}`,
        );
      }
      throw new Error(`Polymarket API request failed: ${String(error)}`);
    }
  }
}

/**
 * Singleton instance of PolymarketClient
 */
export const polymarketClient = new PolymarketClient();

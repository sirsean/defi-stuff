import axios, { AxiosInstance } from "axios";
import type {
  CloudflareRequestOptions,
  CloudflareResponse,
} from "../../types/cloudflare.js";

/**
 * Axios instance for Cloudflare Workers AI API
 * Exported separately for testing with axios-mock-adapter
 */
export const cloudflareAxios: AxiosInstance = axios.create({
  baseURL: "https://api.cloudflare.com/client/v4",
  timeout: 30000,
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${process.env.CLOUDFLARE_AUTH_TOKEN || ""}`,
  },
});

/**
 * Client for interacting with Cloudflare Workers AI API
 *
 * Requires the following environment variables:
 * - CLOUDFLARE_ACCOUNT_ID: Your Cloudflare account ID
 * - CLOUDFLARE_AUTH_TOKEN: Your Cloudflare API token (with Workers AI permissions)
 *
 * @example
 * // Use singleton with default model
 * import { cloudflareClient } from './api/cloudflare/index.js';
 *
 * const response = await cloudflareClient.generateResponse({
 *   input: [
 *     { role: 'developer', content: 'You are a helpful trading assistant.' },
 *     { role: 'user', content: 'What is the market sentiment?' }
 *   ]
 * });
 *
 * @example
 * // Use custom model
 * const client = new CloudflareClient('@cf/meta/llama-3-8b-instruct');
 */
export class CloudflareClient {
  private readonly model: string;
  private readonly accountId: string;
  private readonly http: AxiosInstance;

  /**
   * Creates a new Cloudflare AI client
   *
   * @param model - The Cloudflare model identifier (e.g., "@cf/openai/gpt-oss-120b")
   * @param accountId - Cloudflare account ID (defaults to CLOUDFLARE_ACCOUNT_ID env var)
   * @param http - Axios instance for dependency injection (defaults to cloudflareAxios)
   */
  constructor(
    model: string,
    accountId: string = process.env.CLOUDFLARE_ACCOUNT_ID || "",
    http: AxiosInstance = cloudflareAxios,
  ) {
    this.model = model;
    this.accountId = accountId;
    this.http = http;
  }

  /**
   * Returns the API endpoint for this account
   */
  private endpoint(): string {
    return `/accounts/${this.accountId}/ai/v1/responses`;
  }

  /**
   * Extracts response text from Cloudflare AI result
   * Handles nested response structures and stringifies objects
   */
  private static extractResponseText(
    result: CloudflareResponse["result"],
  ): string {
    const candidate = (result as any)?.response ?? result;
    if (typeof candidate === "string") return candidate;
    if (candidate && typeof candidate === "object")
      return JSON.stringify(candidate);
    throw new Error("Cloudflare AI API response missing result content");
  }

  /**
   * Generate a plain-text response from the AI model
   *
   * @param options - Request options including messages, temperature, etc.
   * @returns Plain text response from the model
   * @throws Error if the request fails or response is invalid
   *
   * @example
   * // Basic usage
   * const text = await cloudflareClient.generateResponse({
   *   input: [
   *     { role: 'developer', content: 'You are a trading assistant.' },
   *     { role: 'user', content: 'Given sentiment=60, what is the trend?' }
   *   ],
   *   temperature: 0.2
   * });
   *
   * @example
   * // With reasoning effort
   * const analysis = await cloudflareClient.generateResponse({
   *   input: [
   *     { role: 'developer', content: 'Analyze market conditions carefully.' },
   *     { role: 'user', content: 'BTC $95k, funding +0.02%, sentiment 75' }
   *   ],
   *   reasoning: { effort: 'high' },
   *   temperature: 0.1
   * });
   */
  async generateResponse(options: CloudflareRequestOptions): Promise<string> {
    try {
      const payload = { model: this.model, ...options };
      const { data } = await this.http.post<CloudflareResponse>(
        this.endpoint(),
        payload,
      );

      if (!data?.success) {
        const msg = data?.errors?.[0]?.message || "Unknown error";
        throw new Error(msg);
      }

      return CloudflareClient.extractResponseText(data.result);
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const status = error.response?.status ?? "unknown";
        const msg =
          (error.response?.data as any)?.errors?.[0]?.message ||
          (error.response?.data as any)?.message ||
          error.message;
        throw new Error(`Cloudflare AI API request failed (${status}): ${msg}`);
      }
      throw new Error(`Cloudflare AI API request failed: ${String(error)}`);
    }
  }

  /**
   * Generate a structured JSON response from the AI model
   *
   * Automatically forces response_format: { type: "json_object" } to ensure
   * the model returns valid JSON that can be parsed.
   *
   * @param options - Request options (response_format will be overridden)
   * @returns Parsed JSON object of type T
   * @throws Error if the request fails, response is not JSON, or JSON parsing fails
   *
   * @example
   * // Trading recommendation
   * type TradeRec = {
   *   action: 'long' | 'short' | 'close' | 'hold';
   *   confidence: number;
   *   reason: string;
   * };
   *
   * const rec = await cloudflareClient.generateStructuredResponse<TradeRec>({
   *   input: [
   *     {
   *       role: 'developer',
   *       content: 'Return JSON with action, confidence (0-1), and reason.'
   *     },
   *     {
   *       role: 'user',
   *       content: 'Sentiment=75; Polymarket bullish; BTC funding +0.01%/h'
   *     }
   *   ],
   *   temperature: 0.1
   * });
   *
   * console.log(rec.action, rec.confidence, rec.reason);
   *
   * @example
   * // Multi-market recommendations
   * type TradeRecommendation = {
   *   market: string;
   *   action: 'long' | 'short' | 'close' | 'hold';
   *   size_usd?: number;
   *   confidence: number;
   *   reason: string;
   *   risk_notes?: string[];
   * };
   *
   * const recommendations = await cloudflareClient.generateStructuredResponse<TradeRecommendation[]>({
   *   input: [
   *     {
   *       role: 'developer',
   *       content: `You are a trading AI. Analyze market data and return JSON array of recommendations.
   *         Each recommendation should have: market, action, size_usd (optional), confidence (0-1), reason, risk_notes (optional array).
   *         Consider: fear/greed index, Polymarket predictions, Flex prices/funding, current positions.`
   *     },
   *     {
   *       role: 'user',
   *       content: `Market Data:
   *         - Fear/Greed: 72 (Greed), trending up from 65
   *         - Polymarket BTC: 65% chance above $100k by EOY
   *         - BTC: $95,234, funding +0.015%/h
   *         - ETH: $3,521, funding +0.008%/h
   *         - Open positions: Long BTC $1,000 @ $92,500 (+2.95% PnL)`
   *     }
   *   ],
   *   reasoning: { effort: 'medium' },
   *   temperature: 0.2
   * });
   *
   * recommendations.forEach(rec => {
   *   console.log(`${rec.market}: ${rec.action} (confidence: ${rec.confidence})`);
   *   console.log(`  Reason: ${rec.reason}`);
   * });
   */
  async generateStructuredResponse<T>(
    options: CloudflareRequestOptions,
  ): Promise<T> {
    try {
      const payload = {
        model: this.model,
        ...options,
        response_format: { type: "json_object" as const },
      };

      const { data } = await this.http.post<CloudflareResponse>(
        this.endpoint(),
        payload,
      );

      if (!data?.success) {
        const msg = data?.errors?.[0]?.message || "Unknown error";
        throw new Error(msg);
      }

      const raw = (data.result as any)?.response ?? data.result;

      if (raw && typeof raw === "object") {
        return raw as T;
      }

      if (typeof raw === "string") {
        try {
          return JSON.parse(raw) as T;
        } catch (e: any) {
          throw new Error(
            `Cloudflare AI JSON parse failed: ${e?.message || "invalid JSON"}`,
          );
        }
      }

      throw new Error("Cloudflare AI API response missing JSON content");
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const status = error.response?.status ?? "unknown";
        const msg =
          (error.response?.data as any)?.errors?.[0]?.message ||
          (error.response?.data as any)?.message ||
          error.message;
        throw new Error(`Cloudflare AI API request failed (${status}): ${msg}`);
      }
      throw new Error(`Cloudflare AI API request failed: ${String(error)}`);
    }
  }
}

/**
 * Singleton instance of CloudflareClient using the default gpt-oss-120b model
 *
 * @example
 * import { cloudflareClient } from './api/cloudflare/index.js';
 *
 * const response = await cloudflareClient.generateResponse({
 *   input: [{ role: 'user', content: 'Hello!' }]
 * });
 */
export const cloudflareClient = new CloudflareClient("@cf/openai/gpt-oss-120b");

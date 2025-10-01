/**
 * Types for Cloudflare Workers AI API responses and requests
 */

/**
 * Supported message roles in Cloudflare AI conversations
 */
export type CloudflareMessageRole = "developer" | "user" | "assistant";

/**
 * A single message in a conversation with the AI model
 */
export interface CloudflareMessage {
  role: CloudflareMessageRole;
  content: string;
}

/**
 * Reasoning effort level for model responses
 * - low: Faster responses with less reasoning
 * - medium: Balanced reasoning and speed
 * - high: More thorough reasoning, slower responses
 */
export type CloudflareReasoningEffort = "low" | "medium" | "high";

/**
 * Request options for Cloudflare AI API calls
 */
export interface CloudflareRequestOptions {
  /** Array of messages forming the conversation */
  input: CloudflareMessage[];
  /** Optional reasoning configuration */
  reasoning?: {
    effort?: CloudflareReasoningEffort;
  };
  /** Sampling temperature (0-2). Lower is more deterministic. */
  temperature?: number;
  /** Maximum tokens to generate */
  max_tokens?: number;
  /** Force JSON object response format */
  response_format?: {
    type: "json_object";
  };
}

/**
 * Error object from Cloudflare AI API
 */
export interface CloudflareError {
  code?: number;
  message: string;
}

/**
 * Result payload from Cloudflare AI API
 * Can be a string, object, or nested response structure
 */
export type CloudflareResult =
  | string
  | Record<string, unknown>
  | {
      response?: string | Record<string, unknown>;
    };

/**
 * Complete response from Cloudflare Workers AI API
 */
export interface CloudflareResponse {
  result: CloudflareResult;
  success: boolean;
  errors?: CloudflareError[];
  messages?: string[];
}

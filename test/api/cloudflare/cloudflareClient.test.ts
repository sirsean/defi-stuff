import { describe, it, expect, beforeEach, afterEach } from "vitest";
import MockAdapter from "axios-mock-adapter";
import {
  CloudflareClient,
  cloudflareAxios,
} from "../../../src/api/cloudflare/cloudflareClient.js";

describe("CloudflareClient", () => {
  let mock: MockAdapter;
  const testAccountId = "test-account-123";
  const testModel = "@cf/openai/gpt-oss-120b";

  beforeEach(() => {
    // Setup environment variables for testing
    process.env.CLOUDFLARE_ACCOUNT_ID = testAccountId;
    process.env.CLOUDFLARE_AUTH_TOKEN = "test-token-456";

    // Create a fresh mock for each test
    mock = new MockAdapter(cloudflareAxios);
  });

  afterEach(() => {
    // Clean up after each test
    mock.restore();
    delete process.env.CLOUDFLARE_ACCOUNT_ID;
    delete process.env.CLOUDFLARE_AUTH_TOKEN;
  });

  describe("constructor", () => {
    it("should create client with provided model and account ID", () => {
      const client = new CloudflareClient(testModel, testAccountId);
      expect(client).toBeInstanceOf(CloudflareClient);
    });

    it("should use environment variable for account ID if not provided", () => {
      const client = new CloudflareClient(testModel);
      expect(client).toBeInstanceOf(CloudflareClient);
    });
  });

  describe("generateResponse", () => {
    it("should POST to correct endpoint with model and input", async () => {
      const client = new CloudflareClient(testModel, testAccountId);
      const expectedEndpoint = `/accounts/${testAccountId}/ai/v1/responses`;

      mock.onPost(expectedEndpoint).reply(200, {
        success: true,
        result: "Hello from AI!",
      });

      await client.generateResponse({
        input: [{ role: "user", content: "Hello" }],
      });

      expect(mock.history.post).toHaveLength(1);
      expect(mock.history.post[0].url).toBe(expectedEndpoint);
      const postData = JSON.parse(mock.history.post[0].data);
      expect(postData.model).toBe(testModel);
      expect(postData.input).toEqual([{ role: "user", content: "Hello" }]);
    });

    it("should return string when result is a string", async () => {
      const client = new CloudflareClient(testModel, testAccountId);

      mock.onPost().reply(200, {
        success: true,
        result: "This is a plain text response",
      });

      const result = await client.generateResponse({
        input: [{ role: "user", content: "Hello" }],
      });

      expect(result).toBe("This is a plain text response");
    });

    it("should return string when result.response is a string", async () => {
      const client = new CloudflareClient(testModel, testAccountId);

      mock.onPost().reply(200, {
        success: true,
        result: {
          response: "Nested string response",
        },
      });

      const result = await client.generateResponse({
        input: [{ role: "user", content: "Hello" }],
      });

      expect(result).toBe("Nested string response");
    });

    it("should stringify object when result.response is an object", async () => {
      const client = new CloudflareClient(testModel, testAccountId);

      mock.onPost().reply(200, {
        success: true,
        result: {
          response: { data: "value", number: 42 },
        },
      });

      const result = await client.generateResponse({
        input: [{ role: "user", content: "Hello" }],
      });

      expect(result).toBe(JSON.stringify({ data: "value", number: 42 }));
    });

    it("should stringify object when result is an object (no response field)", async () => {
      const client = new CloudflareClient(testModel, testAccountId);

      mock.onPost().reply(200, {
        success: true,
        result: { data: "value", number: 42 },
      });

      const result = await client.generateResponse({
        input: [{ role: "user", content: "Hello" }],
      });

      expect(result).toBe(JSON.stringify({ data: "value", number: 42 }));
    });

    it("should include reasoning.effort in payload when provided", async () => {
      const client = new CloudflareClient(testModel, testAccountId);

      mock.onPost().reply(200, {
        success: true,
        result: "Response with reasoning",
      });

      await client.generateResponse({
        input: [{ role: "user", content: "Analyze this" }],
        reasoning: { effort: "high" },
      });

      const postData = JSON.parse(mock.history.post[0].data);
      expect(postData.reasoning).toEqual({ effort: "high" });
    });

    it("should include temperature in payload when provided", async () => {
      const client = new CloudflareClient(testModel, testAccountId);

      mock.onPost().reply(200, {
        success: true,
        result: "Response",
      });

      await client.generateResponse({
        input: [{ role: "user", content: "Hello" }],
        temperature: 0.7,
      });

      const postData = JSON.parse(mock.history.post[0].data);
      expect(postData.temperature).toBe(0.7);
    });

    it("should throw descriptive error for 401 responses", async () => {
      const client = new CloudflareClient(testModel, testAccountId);

      mock.onPost().reply(401, {
        success: false,
        errors: [{ message: "Unauthorized: Invalid API token" }],
      });

      await expect(
        client.generateResponse({
          input: [{ role: "user", content: "Hello" }],
        }),
      ).rejects.toThrow(
        "Cloudflare AI API request failed (401): Unauthorized: Invalid API token",
      );
    });

    it("should throw descriptive error for 500 responses", async () => {
      const client = new CloudflareClient(testModel, testAccountId);

      mock.onPost().reply(500, {
        success: false,
        errors: [{ message: "Internal server error" }],
      });

      await expect(
        client.generateResponse({
          input: [{ role: "user", content: "Hello" }],
        }),
      ).rejects.toThrow(
        "Cloudflare AI API request failed (500): Internal server error",
      );
    });

    it("should handle error responses without errors array", async () => {
      const client = new CloudflareClient(testModel, testAccountId);

      mock.onPost().reply(500, {
        success: false,
        message: "Generic error message",
      });

      await expect(
        client.generateResponse({
          input: [{ role: "user", content: "Hello" }],
        }),
      ).rejects.toThrow("Cloudflare AI API request failed (500)");
    });

    it("should throw error when success is false", async () => {
      const client = new CloudflareClient(testModel, testAccountId);

      mock.onPost().reply(200, {
        success: false,
        errors: [{ message: "Model not found" }],
      });

      await expect(
        client.generateResponse({
          input: [{ role: "user", content: "Hello" }],
        }),
      ).rejects.toThrow("Model not found");
    });

    it("should throw error when result is missing", async () => {
      const client = new CloudflareClient(testModel, testAccountId);

      mock.onPost().reply(200, {
        success: true,
        result: null,
      });

      await expect(
        client.generateResponse({
          input: [{ role: "user", content: "Hello" }],
        }),
      ).rejects.toThrow("Cloudflare AI API response missing result content");
    });
  });

  describe("generateStructuredResponse", () => {
    interface TestResponse {
      action: string;
      confidence: number;
      reason: string;
    }

    it("should force response_format to json_object", async () => {
      const client = new CloudflareClient(testModel, testAccountId);

      mock.onPost().reply(200, {
        success: true,
        result: {
          response: { action: "long", confidence: 0.85, reason: "Bullish" },
        },
      });

      await client.generateStructuredResponse<TestResponse>({
        input: [{ role: "user", content: "Recommend trade" }],
      });

      const postData = JSON.parse(mock.history.post[0].data);
      expect(postData.response_format).toEqual({ type: "json_object" });
    });

    it("should parse object when result.response is an object", async () => {
      const client = new CloudflareClient(testModel, testAccountId);
      const expectedResponse: TestResponse = {
        action: "long",
        confidence: 0.85,
        reason: "Strong bullish sentiment",
      };

      mock.onPost().reply(200, {
        success: true,
        result: {
          response: expectedResponse,
        },
      });

      const result = await client.generateStructuredResponse<TestResponse>({
        input: [{ role: "user", content: "Recommend trade" }],
      });

      expect(result).toEqual(expectedResponse);
    });

    it("should parse object when result is an object (no response field)", async () => {
      const client = new CloudflareClient(testModel, testAccountId);
      const expectedResponse: TestResponse = {
        action: "short",
        confidence: 0.72,
        reason: "Bearish indicators",
      };

      mock.onPost().reply(200, {
        success: true,
        result: expectedResponse,
      });

      const result = await client.generateStructuredResponse<TestResponse>({
        input: [{ role: "user", content: "Recommend trade" }],
      });

      expect(result).toEqual(expectedResponse);
    });

    it("should parse JSON string when result.response is a string", async () => {
      const client = new CloudflareClient(testModel, testAccountId);
      const expectedResponse: TestResponse = {
        action: "hold",
        confidence: 0.5,
        reason: "Uncertain market",
      };

      mock.onPost().reply(200, {
        success: true,
        result: {
          response: JSON.stringify(expectedResponse),
        },
      });

      const result = await client.generateStructuredResponse<TestResponse>({
        input: [{ role: "user", content: "Recommend trade" }],
      });

      expect(result).toEqual(expectedResponse);
    });

    it("should parse JSON string when result is a string", async () => {
      const client = new CloudflareClient(testModel, testAccountId);
      const expectedResponse: TestResponse = {
        action: "close",
        confidence: 0.9,
        reason: "Take profits",
      };

      mock.onPost().reply(200, {
        success: true,
        result: JSON.stringify(expectedResponse),
      });

      const result = await client.generateStructuredResponse<TestResponse>({
        input: [{ role: "user", content: "Recommend trade" }],
      });

      expect(result).toEqual(expectedResponse);
    });

    it("should throw error for invalid JSON string", async () => {
      const client = new CloudflareClient(testModel, testAccountId);

      mock.onPost().reply(200, {
        success: true,
        result: "This is not valid JSON",
      });

      await expect(
        client.generateStructuredResponse<TestResponse>({
          input: [{ role: "user", content: "Recommend trade" }],
        }),
      ).rejects.toThrow("Cloudflare AI JSON parse failed");
    });

    it("should support complex nested structures", async () => {
      interface ComplexResponse {
        recommendations: Array<{
          market: string;
          action: string;
          confidence: number;
        }>;
        summary: {
          total: number;
          avgConfidence: number;
        };
      }

      const client = new CloudflareClient(testModel, testAccountId);
      const expectedResponse: ComplexResponse = {
        recommendations: [
          { market: "BTC", action: "long", confidence: 0.8 },
          { market: "ETH", action: "short", confidence: 0.65 },
        ],
        summary: {
          total: 2,
          avgConfidence: 0.725,
        },
      };

      mock.onPost().reply(200, {
        success: true,
        result: expectedResponse,
      });

      const result = await client.generateStructuredResponse<ComplexResponse>({
        input: [{ role: "user", content: "Multiple recommendations" }],
      });

      expect(result).toEqual(expectedResponse);
    });

    it("should throw error when result is missing JSON content", async () => {
      const client = new CloudflareClient(testModel, testAccountId);

      mock.onPost().reply(200, {
        success: true,
        result: null,
      });

      await expect(
        client.generateStructuredResponse<TestResponse>({
          input: [{ role: "user", content: "Recommend trade" }],
        }),
      ).rejects.toThrow("Cloudflare AI API response missing JSON content");
    });

    it("should handle HTTP errors like generateResponse", async () => {
      const client = new CloudflareClient(testModel, testAccountId);

      mock.onPost().reply(403, {
        success: false,
        errors: [{ message: "Forbidden: Insufficient permissions" }],
      });

      await expect(
        client.generateStructuredResponse<TestResponse>({
          input: [{ role: "user", content: "Recommend trade" }],
        }),
      ).rejects.toThrow(
        "Cloudflare AI API request failed (403): Forbidden: Insufficient permissions",
      );
    });
  });

  describe("multiple message roles", () => {
    it("should support developer, user, and assistant roles", async () => {
      const client = new CloudflareClient(testModel, testAccountId);

      mock.onPost().reply(200, {
        success: true,
        result: "Understood",
      });

      await client.generateResponse({
        input: [
          { role: "developer", content: "You are a trading assistant" },
          { role: "user", content: "What is BTC price?" },
          { role: "assistant", content: "BTC is at $95k" },
          { role: "user", content: "Should I buy?" },
        ],
      });

      const postData = JSON.parse(mock.history.post[0].data);
      expect(postData.input).toHaveLength(4);
      expect(postData.input[0].role).toBe("developer");
      expect(postData.input[1].role).toBe("user");
      expect(postData.input[2].role).toBe("assistant");
      expect(postData.input[3].role).toBe("user");
    });
  });
});

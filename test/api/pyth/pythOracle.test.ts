/**
 * Tests for Pyth Oracle Service
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import {
  getPriceForAsset,
  getMultiplePrices,
  pythOracle,
} from "../../../src/api/pyth/pythOracle.js";
import {
  PYTH_HERMES_ENDPOINT,
  PYTH_PRICE_FEED_IDS,
} from "../../../src/api/flex/constants.js";

// Mock global fetch
global.fetch = vi.fn();

describe("Pyth Oracle Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("getPriceForAsset", () => {
    it("should fetch BTC price from Pyth Network", async () => {
      const mockResponse = [
        {
          id: PYTH_PRICE_FEED_IDS.BTC,
          price: {
            price: "6400000000000", // BTC price as string
            conf: "100000000",
            expo: -8, // 10^-8
            publish_time: 1698000000,
          },
          ema_price: {
            price: "6400000000000",
            conf: "100000000",
            expo: -8,
            publish_time: 1698000000,
          },
        },
      ];

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const price = await getPriceForAsset("BTC");

      // Expected: 6400000000000 * 10^-8 = 64000
      expect(price).toBe(64000);
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining(PYTH_HERMES_ENDPOINT),
      );
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("api/latest_price_feeds"),
      );
    });

    it("should fetch ETH price with correct exponent calculation", async () => {
      const mockResponse = [
        {
          id: PYTH_PRICE_FEED_IDS.ETH,
          price: {
            price: "320000000000", // ETH price as string
            conf: "50000000",
            expo: -8, // 10^-8
            publish_time: 1698000000,
          },
          ema_price: {
            price: "320000000000",
            conf: "50000000",
            expo: -8,
            publish_time: 1698000000,
          },
        },
      ];

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const price = await getPriceForAsset("ETH");

      // Expected: 320000000000 * 10^-8 = 3200
      expect(price).toBe(3200);
    });

    it("should handle case-insensitive asset IDs", async () => {
      const mockResponse = [
        {
          id: PYTH_PRICE_FEED_IDS.SOL,
          price: {
            price: "18500000000", // SOL price
            conf: "10000000",
            expo: -8,
            publish_time: 1698000000,
          },
          ema_price: {
            price: "18500000000",
            conf: "10000000",
            expo: -8,
            publish_time: 1698000000,
          },
        },
      ];

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const price = await getPriceForAsset("sol"); // lowercase

      expect(price).toBe(185);
      expect(fetch).toHaveBeenCalled();
    });

    it("should handle decimal prices correctly", async () => {
      const mockResponse = [
        {
          id: PYTH_PRICE_FEED_IDS.BTC,
          price: {
            price: "6412345000000", // 64123.45 BTC
            conf: "100000000",
            expo: -8,
            publish_time: 1698000000,
          },
          ema_price: {
            price: "6412345000000",
            conf: "100000000",
            expo: -8,
            publish_time: 1698000000,
          },
        },
      ];

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const price = await getPriceForAsset("BTC");

      expect(price).toBeCloseTo(64123.45, 2);
    });

    it("should throw error for unsupported asset", async () => {
      await expect(getPriceForAsset("UNSUPPORTED")).rejects.toThrow(
        "No Pyth price feed ID found for asset: UNSUPPORTED",
      );
      expect(fetch).not.toHaveBeenCalled();
    });

    it("should throw error when API returns non-ok response", async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
      } as Response);

      await expect(getPriceForAsset("BTC")).rejects.toThrow(
        "Pyth API request failed: 500 Internal Server Error",
      );
    });

    it("should throw error when API returns empty array", async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      } as Response);

      await expect(getPriceForAsset("BTC")).rejects.toThrow(
        "No price data returned from Pyth for asset: BTC",
      );
    });

    it("should throw error when price feed structure is invalid", async () => {
      const mockResponse = [
        {
          id: PYTH_PRICE_FEED_IDS.BTC,
          // Missing price field
          ema_price: {
            price: "6400000000000",
            conf: "100000000",
            expo: -8,
            publish_time: 1698000000,
          },
        },
      ];

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      await expect(getPriceForAsset("BTC")).rejects.toThrow(
        "Invalid price feed structure for asset: BTC",
      );
    });

    it("should throw error for invalid price values", async () => {
      const mockResponse = [
        {
          id: PYTH_PRICE_FEED_IDS.BTC,
          price: {
            price: "0", // Invalid: zero price
            conf: "100000000",
            expo: -8,
            publish_time: 1698000000,
          },
          ema_price: {
            price: "0",
            conf: "100000000",
            expo: -8,
            publish_time: 1698000000,
          },
        },
      ];

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      await expect(getPriceForAsset("BTC")).rejects.toThrow(
        "Invalid Pyth price: 0 with exponent -8",
      );
    });

    it("should throw error for negative price values", async () => {
      const mockResponse = [
        {
          id: PYTH_PRICE_FEED_IDS.BTC,
          price: {
            price: "-6400000000000", // Negative price
            conf: "100000000",
            expo: -8,
            publish_time: 1698000000,
          },
          ema_price: {
            price: "-6400000000000",
            conf: "100000000",
            expo: -8,
            publish_time: 1698000000,
          },
        },
      ];

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      await expect(getPriceForAsset("BTC")).rejects.toThrow(
        "Invalid Pyth price",
      );
    });

    it("should handle network errors", async () => {
      vi.mocked(fetch).mockRejectedValueOnce(
        new Error("Network connection failed"),
      );

      await expect(getPriceForAsset("BTC")).rejects.toThrow(
        "Failed to fetch Pyth price for BTC: Network connection failed",
      );
    });

    it("should construct correct API URL with feed ID", async () => {
      const mockResponse = [
        {
          id: PYTH_PRICE_FEED_IDS.BTC,
          price: {
            price: "6400000000000",
            conf: "100000000",
            expo: -8,
            publish_time: 1698000000,
          },
          ema_price: {
            price: "6400000000000",
            conf: "100000000",
            expo: -8,
            publish_time: 1698000000,
          },
        },
      ];

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      await getPriceForAsset("BTC");

      expect(fetch).toHaveBeenCalledWith(
        expect.stringMatching(
          new RegExp(
            `${PYTH_HERMES_ENDPOINT}/api/latest_price_feeds\\?ids.*=${PYTH_PRICE_FEED_IDS.BTC}`,
          ),
        ),
      );
    });
  });

  describe("getMultiplePrices", () => {
    it("should fetch prices for multiple assets", async () => {
      const mockResponse = [
        {
          id: PYTH_PRICE_FEED_IDS.BTC,
          price: {
            price: "6400000000000",
            conf: "100000000",
            expo: -8,
            publish_time: 1698000000,
          },
          ema_price: {
            price: "6400000000000",
            conf: "100000000",
            expo: -8,
            publish_time: 1698000000,
          },
        },
        {
          id: PYTH_PRICE_FEED_IDS.ETH,
          price: {
            price: "320000000000",
            conf: "50000000",
            expo: -8,
            publish_time: 1698000000,
          },
          ema_price: {
            price: "320000000000",
            conf: "50000000",
            expo: -8,
            publish_time: 1698000000,
          },
        },
        {
          id: PYTH_PRICE_FEED_IDS.SOL,
          price: {
            price: "18500000000",
            conf: "10000000",
            expo: -8,
            publish_time: 1698000000,
          },
          ema_price: {
            price: "18500000000",
            conf: "10000000",
            expo: -8,
            publish_time: 1698000000,
          },
        },
      ];

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const prices = await getMultiplePrices(["BTC", "ETH", "SOL"]);

      expect(prices).toEqual({
        BTC: 64000,
        ETH: 3200,
        SOL: 185,
      });
      expect(fetch).toHaveBeenCalledTimes(1);
    });

    it("should return empty object for empty asset list", async () => {
      const prices = await getMultiplePrices([]);

      expect(prices).toEqual({});
      expect(fetch).not.toHaveBeenCalled();
    });

    it("should handle partial responses", async () => {
      // API returns only BTC and ETH, not SOL
      const mockResponse = [
        {
          id: PYTH_PRICE_FEED_IDS.BTC,
          price: {
            price: "6400000000000",
            conf: "100000000",
            expo: -8,
            publish_time: 1698000000,
          },
          ema_price: {
            price: "6400000000000",
            conf: "100000000",
            expo: -8,
            publish_time: 1698000000,
          },
        },
        {
          id: PYTH_PRICE_FEED_IDS.ETH,
          price: {
            price: "320000000000",
            conf: "50000000",
            expo: -8,
            publish_time: 1698000000,
          },
          ema_price: {
            price: "320000000000",
            conf: "50000000",
            expo: -8,
            publish_time: 1698000000,
          },
        },
      ];

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const prices = await getMultiplePrices(["BTC", "ETH", "SOL"]);

      // Should only include prices that were returned
      expect(prices).toEqual({
        BTC: 64000,
        ETH: 3200,
      });
      expect(prices.SOL).toBeUndefined();
    });

    it("should throw error when API returns non-ok response", async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 503,
        statusText: "Service Unavailable",
      } as Response);

      await expect(getMultiplePrices(["BTC", "ETH"])).rejects.toThrow(
        "Pyth API request failed: 503 Service Unavailable",
      );
    });

    it("should throw error when response is not an array", async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ error: "Invalid request" }),
      } as Response);

      await expect(getMultiplePrices(["BTC", "ETH"])).rejects.toThrow(
        "Invalid response format from Pyth API",
      );
    });

    it("should skip price feeds with missing price data", async () => {
      const mockResponse = [
        {
          id: PYTH_PRICE_FEED_IDS.BTC,
          price: {
            price: "6400000000000",
            conf: "100000000",
            expo: -8,
            publish_time: 1698000000,
          },
          ema_price: {
            price: "6400000000000",
            conf: "100000000",
            expo: -8,
            publish_time: 1698000000,
          },
        },
        {
          id: PYTH_PRICE_FEED_IDS.ETH,
          // Missing price field
          ema_price: {
            price: "320000000000",
            conf: "50000000",
            expo: -8,
            publish_time: 1698000000,
          },
        },
      ];

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const prices = await getMultiplePrices(["BTC", "ETH"]);

      // Should only include BTC, skip ETH with missing price
      expect(prices).toEqual({
        BTC: 64000,
      });
      expect(prices.ETH).toBeUndefined();
    });

    it("should handle network errors", async () => {
      vi.mocked(fetch).mockRejectedValueOnce(new Error("Connection timeout"));

      await expect(getMultiplePrices(["BTC", "ETH"])).rejects.toThrow(
        "Failed to fetch Pyth prices for multiple assets: Connection timeout",
      );
    });

    it("should construct URL with multiple feed IDs", async () => {
      const mockResponse = [
        {
          id: PYTH_PRICE_FEED_IDS.BTC,
          price: {
            price: "6400000000000",
            conf: "100000000",
            expo: -8,
            publish_time: 1698000000,
          },
          ema_price: {
            price: "6400000000000",
            conf: "100000000",
            expo: -8,
            publish_time: 1698000000,
          },
        },
        {
          id: PYTH_PRICE_FEED_IDS.ETH,
          price: {
            price: "320000000000",
            conf: "50000000",
            expo: -8,
            publish_time: 1698000000,
          },
          ema_price: {
            price: "320000000000",
            conf: "50000000",
            expo: -8,
            publish_time: 1698000000,
          },
        },
      ];

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      await getMultiplePrices(["BTC", "ETH"]);

      const callUrl = vi.mocked(fetch).mock.calls[0][0] as string;
      expect(callUrl).toContain(PYTH_HERMES_ENDPOINT);
      expect(callUrl).toContain("api/latest_price_feeds");
      expect(callUrl).toContain(`ids%5B%5D=${PYTH_PRICE_FEED_IDS.BTC}`);
      expect(callUrl).toContain(`ids%5B%5D=${PYTH_PRICE_FEED_IDS.ETH}`);
    });
  });

  describe("pythOracle singleton", () => {
    it("should expose getPriceForAsset method", () => {
      expect(pythOracle.getPriceForAsset).toBeDefined();
      expect(typeof pythOracle.getPriceForAsset).toBe("function");
    });

    it("should expose getMultiplePrices method", () => {
      expect(pythOracle.getMultiplePrices).toBeDefined();
      expect(typeof pythOracle.getMultiplePrices).toBe("function");
    });

    it("should work through singleton interface", async () => {
      const mockResponse = [
        {
          id: PYTH_PRICE_FEED_IDS.BTC,
          price: {
            price: "6400000000000",
            conf: "100000000",
            expo: -8,
            publish_time: 1698000000,
          },
          ema_price: {
            price: "6400000000000",
            conf: "100000000",
            expo: -8,
            publish_time: 1698000000,
          },
        },
      ];

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const price = await pythOracle.getPriceForAsset("BTC");
      expect(price).toBe(64000);
    });
  });
});

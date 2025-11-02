/**
 * Pyth Network Oracle Service
 * Fetches price data from Pyth Network's Hermes API
 * Source: https://hermes.pyth.network
 */

import {
  PYTH_HERMES_ENDPOINT,
  PYTH_PRICE_FEED_IDS,
} from "../flex/constants.js";

/**
 * Pyth price feed response structure
 */
interface PythPriceFeed {
  id: string;
  price: {
    price: string;
    conf: string;
    expo: number;
    publish_time: number;
  };
  ema_price: {
    price: string;
    conf: string;
    expo: number;
    publish_time: number;
  };
}

/**
 * Get the Pyth price feed ID for a given asset
 * @param assetId Asset identifier (e.g., "BTC", "ETH")
 * @returns Pyth price feed ID hex string
 */
function getPythFeedId(assetId: string): string {
  const feedId = PYTH_PRICE_FEED_IDS[assetId.toUpperCase()];
  if (!feedId) {
    throw new Error(
      `No Pyth price feed ID found for asset: ${assetId}. Available assets: ${Object.keys(PYTH_PRICE_FEED_IDS).join(", ")}`,
    );
  }
  return feedId;
}

/**
 * Convert Pyth price data to a number
 * @param priceStr Price as string
 * @param expo Exponent (negative for decimals)
 * @returns Price as a number
 */
function convertPythPrice(priceStr: string, expo: number): number {
  const price = parseFloat(priceStr) * Math.pow(10, expo);

  if (!Number.isFinite(price) || price <= 0) {
    throw new Error(`Invalid Pyth price: ${priceStr} with exponent ${expo}`);
  }

  return price;
}

/**
 * Fetch price for a single asset from Pyth Network
 * @param assetId Asset identifier (e.g., "BTC", "ETH")
 * @returns Current USD price
 */
export async function getPriceForAsset(assetId: string): Promise<number> {
  const feedId = getPythFeedId(assetId);

  const url = new URL(`${PYTH_HERMES_ENDPOINT}/api/latest_price_feeds`);
  url.searchParams.append("ids[]", feedId);

  try {
    const response = await fetch(url.toString());

    if (!response.ok) {
      throw new Error(
        `Pyth API request failed: ${response.status} ${response.statusText}`,
      );
    }

    const data = await response.json();

    if (!Array.isArray(data) || data.length === 0) {
      throw new Error(`No price data returned from Pyth for asset: ${assetId}`);
    }

    const priceFeed = data[0] as PythPriceFeed;

    if (!priceFeed.price) {
      throw new Error(`Invalid price feed structure for asset: ${assetId}`);
    }

    return convertPythPrice(priceFeed.price.price, priceFeed.price.expo);
  } catch (error: any) {
    if (error.message.includes("Pyth")) {
      throw error; // Re-throw our custom errors
    }
    throw new Error(
      `Failed to fetch Pyth price for ${assetId}: ${error.message}`,
    );
  }
}

/**
 * Fetch prices for multiple assets from Pyth Network
 * @param assetIds Array of asset identifiers
 * @returns Map of asset IDs to their USD prices
 */
export async function getMultiplePrices(
  assetIds: string[],
): Promise<Record<string, number>> {
  if (assetIds.length === 0) {
    return {};
  }

  // Get feed IDs for all assets
  const feedIds = assetIds.map((assetId) => getPythFeedId(assetId));

  const url = new URL(`${PYTH_HERMES_ENDPOINT}/api/latest_price_feeds`);
  feedIds.forEach((feedId) => {
    url.searchParams.append("ids[]", feedId);
  });

  try {
    const response = await fetch(url.toString());

    if (!response.ok) {
      throw new Error(
        `Pyth API request failed: ${response.status} ${response.statusText}`,
      );
    }

    const data = await response.json();

    if (!Array.isArray(data)) {
      throw new Error("Invalid response format from Pyth API");
    }

    // Build a map from feed ID back to asset ID
    const feedIdToAsset: Record<string, string> = {};
    assetIds.forEach((assetId) => {
      const feedId = getPythFeedId(assetId);
      feedIdToAsset[feedId] = assetId;
    });

    // Convert price feeds to prices
    const prices: Record<string, number> = {};

    for (const priceFeed of data as PythPriceFeed[]) {
      const assetId = feedIdToAsset[priceFeed.id];
      if (assetId && priceFeed.price) {
        prices[assetId] = convertPythPrice(
          priceFeed.price.price,
          priceFeed.price.expo,
        );
      }
    }

    return prices;
  } catch (error: any) {
    if (error.message.includes("Pyth")) {
      throw error; // Re-throw our custom errors
    }
    throw new Error(
      `Failed to fetch Pyth prices for multiple assets: ${error.message}`,
    );
  }
}

/**
 * Pyth Oracle singleton for convenient access
 */
export const pythOracle = {
  getPriceForAsset,
  getMultiplePrices,
};

/**
 * Chainlink Oracle Service
 * Fetches BTC and ETH prices from Chainlink price feeds on Base mainnet
 */

import { ethers } from "ethers";
import { CHAINLINK_ORACLE_ADDRESSES, DEFAULT_RPC_URL } from "../flex/constants.js";
import ChainlinkPriceFeedABI from "../flex/contracts/ChainlinkPriceFeed.json" with { type: "json" };

type ChainlinkSymbol = "BTC" | "ETH";

/**
 * Get RPC provider for Base mainnet
 */
function getProvider(): ethers.Provider {
  const rpcUrl = process.env.ALCHEMY_API_KEY
    ? `https://base-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`
    : DEFAULT_RPC_URL;

  return new ethers.JsonRpcProvider(rpcUrl);
}

/**
 * Read price from a Chainlink aggregator
 * @param address Chainlink price feed contract address
 * @returns Price in USD as a number
 */
async function readAggregatorUsd(address: string): Promise<number> {
  const provider = getProvider();
  const contract = new ethers.Contract(address, ChainlinkPriceFeedABI, provider);

  // Read both price and decimals in parallel
  const [rawPrice, decimals] = await Promise.all([
    contract.latestAnswer() as Promise<bigint>,
    contract.decimals() as Promise<bigint>,
  ]);

  // Convert to number using the decimals
  const divisor = Math.pow(10, Number(decimals));
  const price = Number(rawPrice) / divisor;

  if (!Number.isFinite(price) || price <= 0) {
    throw new Error(`Invalid Chainlink price from ${address}: ${price}`);
  }

  return price;
}

/**
 * Get Chainlink aggregator address for a given symbol
 * @param symbol BTC or ETH
 * @returns Contract address
 */
function getAggregatorAddress(symbol: ChainlinkSymbol): string {
  if (symbol === "BTC") {
    return CHAINLINK_ORACLE_ADDRESSES.BTC_USD;
  }
  if (symbol === "ETH") {
    return CHAINLINK_ORACLE_ADDRESSES.ETH_USD;
  }
  throw new Error(`Unsupported symbol for Chainlink oracle: ${symbol}`);
}

/**
 * Chainlink Oracle Service
 * Provides methods to fetch USD prices for BTC and ETH from Chainlink on Base
 */
export const chainlinkOracle = {
  /**
   * Get USD price for a given symbol
   * @param symbol BTC or ETH
   * @returns Price in USD
   */
  async getUsdPrice(symbol: ChainlinkSymbol): Promise<number> {
    const address = getAggregatorAddress(symbol);
    return readAggregatorUsd(address);
  },

  /**
   * Get BTC/USD price
   * @returns BTC price in USD
   */
  async getBtcUsd(): Promise<number> {
    return this.getUsdPrice("BTC");
  },

  /**
   * Get ETH/USD price
   * @returns ETH price in USD
   */
  async getEthUsd(): Promise<number> {
    return this.getUsdPrice("ETH");
  },
};

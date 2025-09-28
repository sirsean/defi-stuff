/**
 * Mock data for testing Debank API responses
 */

import {
  DebankProtocol,
  UserProtocolResponse,
  UserTotalBalanceResponse,
} from "../../src/types/debank.js";

/**
 * Mock protocol list for testing
 */
export const mockProtocolList: DebankProtocol[] = [
  {
    id: "ethereum_aave",
    chain: "eth",
    name: "Aave",
    site_url: "https://aave.com",
    logo_url:
      "https://static.debank.com/image/project/logo_url/aave/d5fd5d2.png",
    has_supported_portfolio: true,
    tvl: 6000000000,
  },
  {
    id: "ethereum_uniswap",
    chain: "eth",
    name: "Uniswap",
    site_url: "https://uniswap.org",
    logo_url:
      "https://static.debank.com/image/project/logo_url/uniswap/0d8837d.png",
    has_supported_portfolio: true,
    tvl: 5500000000,
  },
];

/**
 * Mock user protocol data for testing - structure matches real Flex Perpetuals data
 */
export const mockUserProtocolResponse: UserProtocolResponse = {
  id: "base_flex",
  chain: "base",
  name: "Flex Perpetuals",
  site_url: "https://app.flex.trade/",
  logo_url:
    "https://static.debank.com/image/project/logo_url/base_flex/9ef61b80f6beb8f322f5a3a0f7e85d02.png",
  has_supported_portfolio: true,
  tvl: 2384245.203646323,
  portfolio_item_list: [
    {
      stats: {
        asset_usd_value: 85483.85736084307,
        debt_usd_value: 0,
        net_usd_value: 85483.85736084307,
      },
      update_at: 1746241922.1059349,
      name: "Farming",
      detail_types: ["supply_token_list", "reward_token_list"],
      detail: {
        supply_token_list: [
          {
            id: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
            chain: "base",
            name: "USD Coin",
            symbol: "USDC",
            display_symbol: null,
            optimized_symbol: "USDC",
            decimals: 6,
            logo_url:
              "https://static.debank.com/image/eth_token/logo_url/0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48/fffcd27b9efff5a86ab942084c05924d.png",
            protocol_id: "",
            price: 0.9997000899730081,
            is_verified: true,
            is_core: true,
            is_wallet: true,
            time_at: 1692383789,
            amount: 27883.27098149257,
          },
          {
            id: "base",
            chain: "base",
            name: "ETH",
            symbol: "ETH",
            display_symbol: null,
            optimized_symbol: "ETH",
            decimals: 18,
            logo_url:
              "https://static.debank.com/image/coin/logo_url/eth/6443cdccced33e204d90cb723c632917.png",
            protocol_id: "",
            price: 1835.66,
            is_verified: true,
            is_core: true,
            is_wallet: true,
            time_at: null,
            amount: 11.047712332274477,
          },
          {
            id: "0xcbb7c0000ab88b473b1f5afd9ef808440eed33bf",
            chain: "base",
            name: "Coinbase Wrapped BTC",
            symbol: "cbBTC",
            display_symbol: null,
            optimized_symbol: "cbBTC",
            decimals: 8,
            logo_url:
              "https://static.debank.com/image/base_token/logo_url/0xcbb7c0000ab88b473b1f5afd9ef808440eed33bf/a4ae837a6ca2fc45f07a74898cc4ba45.png",
            protocol_id: "",
            price: 96558.54896654907,
            is_verified: true,
            is_core: true,
            is_wallet: true,
            time_at: 1724165535,
            amount: 0.3849120365527313,
          },
        ],
        reward_token_list: [
          {
            id: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
            chain: "base",
            name: "USD Coin",
            symbol: "USDC",
            display_symbol: null,
            optimized_symbol: "USDC",
            decimals: 6,
            logo_url:
              "https://static.debank.com/image/eth_token/logo_url/0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48/fffcd27b9efff5a86ab942084c05924d.png",
            protocol_id: "",
            price: 0.9997000899730081,
            is_verified: true,
            is_core: true,
            is_wallet: true,
            time_at: 1692383789,
            amount: 162.60627,
          },
          {
            id: "0x915595336dad62fd1c3600193a16b3f44b44d27e",
            chain: "base",
            name: "Escrowed FDX",
            symbol: "EsFDX",
            display_symbol: null,
            optimized_symbol: "EsFDX",
            decimals: 18,
            logo_url: null,
            protocol_id: "base_flex",
            price: 0,
            is_verified: true,
            is_core: null,
            is_wallet: false,
            time_at: 1735918887,
            amount: 55.00949774739202,
          },
        ],
      },
      proxy_detail: {},
      pool: {
        id: "0x053fa05d34c51afc5cb9f162fab3fd675ac06119",
        chain: "base",
        project_id: "base_flex",
        adapter_id: "hmx_farming",
        controller: "0x053fa05d34c51afc5cb9f162fab3fd675ac06119",
        index: null,
        time_at: 1735920411,
      },
    },
  ],
};

/**
 * Mock user total balance data for testing
 */
export const mockUserTotalBalanceResponse: UserTotalBalanceResponse = {
  total_usd_value: 323456.78,
  chain_list: [
    {
      id: "eth",
      community_id: 1,
      name: "Ethereum",
      native_token_id: "eth",
      logo_url:
        "https://static.debank.com/image/chain/logo_url/eth/42ba589cd077e7bdd97db6480b0ff61d.png",
      wrapped_token_id: "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",
      usd_value: 156789.45,
    },
    {
      id: "base",
      community_id: 8453,
      name: "Base",
      native_token_id: "base",
      logo_url:
        "https://static.debank.com/image/chain/logo_url/base/7429172c5b921cbe91f177c53d202199.png",
      wrapped_token_id: "0x4200000000000000000000000000000000000006",
      usd_value: 87654.32,
    },
    {
      id: "arbitrum",
      community_id: 42161,
      name: "Arbitrum",
      native_token_id: "arbitrum",
      logo_url:
        "https://static.debank.com/image/chain/logo_url/arb/f6d1b236259654d531a1459b2bccaf64.png",
      wrapped_token_id: "0x82af49447d8a07e3bd95bd0d56f35241523fbab1",
      usd_value: 45678.91,
    },
    {
      id: "polygon",
      community_id: 137,
      name: "Polygon",
      native_token_id: "polygon",
      logo_url:
        "https://static.debank.com/image/chain/logo_url/matic/5d9c125d36785e7b645a9c399d274f17.png",
      wrapped_token_id: "0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270",
      usd_value: 32456.78,
    },
    {
      id: "bsc",
      community_id: 56,
      name: "BNB Chain",
      native_token_id: "bsc",
      logo_url:
        "https://static.debank.com/image/chain/logo_url/bsc/7c87af7b52853145f3486cc22c52ee6e.png",
      wrapped_token_id: "0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c",
      usd_value: 877.32,
    },
  ],
};

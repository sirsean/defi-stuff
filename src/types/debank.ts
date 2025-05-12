/**
 * Types for Debank API responses
 */

export interface DebankProtocol {
  id: string;
  chain: string;
  name: string;
  site_url: string;
  logo_url: string;
  has_supported_portfolio: boolean;
  tvl: number;
  portfolio_item_list: PortfolioItem[];
}

/**
 * Types for User Total Balance API responses
 */
export interface UserTotalBalanceResponse {
  total_usd_value: number;
  chain_list: ChainBalance[];
}

export interface ChainBalance {
  id: string;
  community_id: number;
  name: string;
  native_token_id: string;
  logo_url: string;
  wrapped_token_id: string;
  usd_value: number;
}

export interface PortfolioItem {
  stats: PortfolioStats;
  id: string;
  name: string;
  description: string;
  portfolio_item_list?: PortfolioItem[];
}

export interface PortfolioStats {
  asset_usd_value?: number;
  debt_usd_value?: number;
  net_usd_value?: number;
}

export interface ProtocolSearchOptions {
  chain: string;
  searchTerm?: string;
}

/**
 * Types for User Protocol API responses
 */
export interface UserProtocolResponse {
  id: string;
  chain: string;
  name: string;
  logo_url: string;
  site_url: string;
  has_supported_portfolio: boolean;
  tvl: number;
  portfolio_item_list: UserPortfolioItem[];
}

export interface UserPortfolioItem {
  stats: UserPortfolioStats;
  update_at: number;
  name: string;
  detail_types: string[];
  detail: UserPortfolioDetail;
  proxy_detail?: Record<string, unknown>;
  pool: PoolInfo;
}

export interface PoolInfo {
  id: string;
  chain: string;
  project_id: string;
  adapter_id: string;
  controller: string;
  index: number | null;
  time_at: number;
}

export interface UserPortfolioStats {
  asset_usd_value: number;
  debt_usd_value: number;
  net_usd_value: number;
}

export interface UserPortfolioDetail {
  supply_token_list?: TokenInfo[];
  reward_token_list?: TokenInfo[];
  borrow_token_list?: TokenInfo[];
  common?: {
    position_index: string;
    pool_adapter_type: string;
    pool_id: string;
    pool_name: string;
    asset_token_list: TokenInfo[];
  };
}

export interface TokenInfo {
  id: string;
  chain: string;
  name: string;
  symbol: string;
  display_symbol?: string | null;
  optimized_symbol?: string | null;
  decimals: number;
  logo_url: string | null;
  protocol_id: string;
  price: number;
  price_24h_change?: number | null;
  credit_score?: number;
  is_verified?: boolean;
  is_scam?: boolean;
  is_suspicious?: boolean;
  is_core?: boolean | null;
  is_wallet?: boolean;
  time_at?: number | null;
  low_credit_score?: boolean;
  amount: number;
  usd_value?: number;
}
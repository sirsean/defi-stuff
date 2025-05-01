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
  pool_id: string;
  detail_types: string[];
  detail: UserPortfolioDetail;
  proxy_detail?: Record<string, unknown>;
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
}

export interface TokenInfo {
  id: string;
  chain: string;
  name: string;
  symbol: string;
  display_symbol?: string;
  optimized_symbol?: string;
  decimals: number;
  logo_url: string;
  protocol_id: string;
  price: number;
  is_verified?: boolean;
  is_core?: boolean;
  is_wallet?: boolean;
  time_at?: number;
  amount: number;
  usd_value?: number;
}
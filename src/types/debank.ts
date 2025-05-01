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
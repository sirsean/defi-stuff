import {
  fearGreedService,
  FearGreedService,
} from "../feargreed/fearGreedService.js";
import {
  polymarketService,
  PolymarketService,
} from "../polymarket/polymarketService.js";
import { FlexPublicService } from "../flex/flexPublicService.js";
import {
  cloudflareClient,
  CloudflareClient,
} from "../cloudflare/cloudflareClient.js";
import { MARKETS } from "../flex/constants.js";
import type {
  MarketContext,
  MarketData,
  PositionSummary,
  AgentAnalysis,
} from "../../types/tradeRecommendation.js";

/**
 * AI-powered trade recommendation agent
 *
 * Gathers market data from multiple sources and uses Cloudflare AI to generate
 * trading recommendations for perpetual futures on Flex (Base mainnet).
 */
export class TradeRecommendationAgent {
  constructor(
    private fearGreed: FearGreedService = fearGreedService,
    private polymarket: PolymarketService = polymarketService,
    private flex: FlexPublicService = new FlexPublicService(),
    private cloudflare: CloudflareClient = cloudflareClient,
  ) {}

  /**
   * Gather comprehensive market context data
   *
   * @param markets Market symbols to analyze (e.g., ['BTC', 'ETH'])
   * @param walletAddress Wallet address to check positions
   * @param subAccountIds Subaccount IDs to query
   * @returns Complete market context for AI analysis
   */
  async gatherMarketContext(
    markets: string[],
    walletAddress?: string,
    subAccountIds: number[] = [0],
  ): Promise<MarketContext> {
    // Fetch Fear & Greed Index (last 10 days for trend analysis)
    const fearGreedAnalysis = await this.fearGreed.analyzeFearGreedIndex(10);

    // Fetch Polymarket BTC prediction (optional - don't fail if unavailable)
    let polymarketPrediction = null;
    try {
      polymarketPrediction = await this.polymarket.analyzeBTCPrice();
    } catch (error) {
      console.warn("Polymarket data unavailable:", error);
    }

    // Fetch market-specific data (price, funding, OI)
    const marketDataPromises = markets.map(async (symbol) => {
      const market = MARKETS[symbol];
      if (!market) {
        throw new Error(`Unknown market: ${symbol}`);
      }

      try {
        const [priceData, fundingData] = await Promise.all([
          this.flex.getMarketPrice(market.index),
          this.flex.getFundingRate(market.index),
        ]);

        const marketData: MarketData = {
          symbol: market.symbol,
          price: priceData.price,
          funding_rate: fundingData.currentFundingRate,
          long_oi: fundingData.longPositionSize,
          short_oi: fundingData.shortPositionSize,
        };

        return marketData;
      } catch (error: any) {
        throw new Error(`Failed to fetch data for ${symbol}: ${error.message}`);
      }
    });

    const marketsData = await Promise.all(marketDataPromises);

    // Note: Position fetching is disabled due to ABI compatibility issues
    // Recommendations will be generated without existing position context
    const openPositions: PositionSummary[] = [];
    const portfolioValue = 0;

    return {
      fear_greed: fearGreedAnalysis,
      polymarket_prediction: polymarketPrediction,
      markets: marketsData,
      open_positions: openPositions,
      portfolio_value_usd: portfolioValue,
    };
  }

  /**
   * Build comprehensive system prompt for the AI agent
   *
   * Defines the agent's role, trading philosophy, and analysis framework
   */
  private buildSystemPrompt(): string {
    return `You are an expert cryptocurrency derivatives trader specializing in mid-frequency perpetual futures trading on decentralized protocols. Your analysis focuses on positions held 3-10 days, targeting clear directional moves in BTC and ETH perpetuals.

TRADING PHILOSOPHY:
- Time Horizon: Mid-frequency (3-10 day holds), not day-trading or long-term investing
- Strategy: Trend following with contrarian timing - enter when others are fearful, exit when others are greedy
- Risk-First: Always consider what could go wrong before what could go right
- Selective: Quality over quantity - only take high-conviction trades with clear invalidation levels

MARKET DATA INTERPRETATION:

Fear & Greed Index (Contrarian Indicator):
- Extreme Fear (0-25): Often marks local bottoms, consider longs if other signals align
- Fear (25-45): Slightly bearish sentiment, wait for confirmation
- Neutral (45-55): No clear sentiment signal
- Greed (55-75): Slightly bullish sentiment, be cautious on longs
- Extreme Greed (75-100): Often marks local tops, consider shorts or take profits
- Trend: "improving" = sentiment getting more bullish, "declining" = getting more bearish
- Key: Don't fade extreme sentiment unless you have strong confirming signals

Polymarket Predictions (Retail Sentiment Proxy):
- Polymarket reflects crowd expectations, often lagging actual price action
- Very bullish predictions (>70% for high targets) can signal overheated market
- Divergence between Polymarket optimism and price action can be meaningful
- Expected price vs current price gap shows crowd's forward expectations

Funding Rates (Cost & Sentiment):
- Rates are quoted per 24 hours (daily), paid once per day
- Positive funding (longs pay shorts): Bullish crowd, costs to hold longs
- Negative funding (shorts pay longs): Bearish crowd, costs to hold shorts
- Magnitude matters: >0.01%/day (3.65%/year) is meaningful cost
- Reference: 0.03%/day ≈ 10.95%/year; 0.10%/day ≈ 36.5%/year
- High positive + consolidation = potential long squeeze
- High negative + consolidation = potential short squeeze
- Trend: Rising funding = increasing bullish positioning

Open Interest Skew:
- Long OI > Short OI: Net bullish positioning, potential for long squeeze
- Short OI > Long OI: Net bearish positioning, potential for short squeeze
- Extreme imbalance (>2:1) increases squeeze risk

Open Positions (Risk Management):
- Don't overconcentrate in single market
- Consider correlation (BTC/ETH move together)
- Existing profitable positions = can take more risk
- Existing losing positions = be more conservative
- Never exceed comfortable portfolio leverage

ANALYSIS FRAMEWORK:

1. Market Structure: Is the market trending or ranging? Clear trends are tradeable, chop is not.

2. Sentiment Alignment: 
   - All indicators bullish = be cautious (crowded trade)
   - All indicators bearish = look for longs (contrarian opportunity)
   - Mixed signals = wait for clarity unless you have edge

3. Cost of Carry: High funding rates eat into profits. Factor this into hold time and size.

4. Risk/Reward: Define clear invalidation level. If stop is far, size down. If RR < 2:1, pass.

5. Confluence: Best trades have 3+ supporting factors. Single-factor trades are risky.

OUTPUT REQUIREMENTS:

Respond with valid JSON matching this structure:
{
  "recommendations": [
    {
      "market": "BTC",
      "action": "long" | "short" | "close" | "hold",
      "size_usd": <number or null>,
      "confidence": <0.0 to 1.0>,
      "reasoning": "<detailed explanation of trade thesis>",
      "risk_factors": ["<factor 1>", "<factor 2>"],
      "timeframe": "short" | "medium" | "long"
    }
  ],
  "market_summary": "<overall market assessment in 2-3 sentences>",
  "timestamp": "<current ISO timestamp>"
}

Confidence Scoring:
- 0.8-1.0: Very high conviction, multiple confirming signals, clear setup
- 0.7-0.8: High conviction, good setup with some confirming signals
- 0.5-0.7: Moderate conviction, some signals but also conflicting data
- 0.3-0.5: Low conviction, unclear or weak signals
- 0.0-0.3: Very low conviction, mostly noise or conflicting signals

For "hold" actions on markets without existing positions, explain why not trading is the best move.
For "close" actions, explain why exiting is better than holding.
For "long"/"short" actions, provide specific reasoning and clear risk factors.

Suggest position sizes as a reasonable percentage of available capital (typically 10-30% per trade, never >50%).
Be conservative - it's better to miss a trade than to force a bad one.`;
  }

  /**
   * Build user prompt from gathered market context
   *
   * Formats all market data into a clear, structured prompt for AI analysis
   */
  private buildUserPrompt(context: MarketContext): string {
    const lines: string[] = [];

    // Header
    lines.push("CURRENT MARKET CONTEXT:");
    lines.push("");

    // Fear & Greed Index
    lines.push("Fear & Greed Index:");
    lines.push(
      `  Current: ${context.fear_greed.current.value} (${context.fear_greed.current.classification})`,
    );
    lines.push(
      `  Range (10d): ${context.fear_greed.min.value} - ${context.fear_greed.max.value}`,
    );
    lines.push(`  Trend: ${context.fear_greed.trend}`);
    lines.push("");

    // Polymarket Prediction (if available)
    if (context.polymarket_prediction) {
      const pm = context.polymarket_prediction;
      lines.push("Polymarket BTC Prediction:");
      lines.push(`  Target Date: ${pm.targetDate}`);
      lines.push(
        `  Expected Price: $${pm.analysis.expectedPrice.toLocaleString()}`,
      );
      lines.push(
        `  Likely Range: $${pm.analysis.likelyRange.min.toLocaleString()} - $${pm.analysis.likelyRange.max.toLocaleString()}`,
      );
      lines.push(`  Sentiment: ${pm.analysis.sentiment}`);
      lines.push(`  Confidence: ${(pm.analysis.confidence * 100).toFixed(0)}%`);
      lines.push("");
    }

    // Market Data
    lines.push("Markets:");
    for (const market of context.markets) {
      const fundingAnnualized = market.funding_rate * 365 * 100; // Convert to annualized %
      const oiSkew =
        market.long_oi > 0
          ? market.long_oi / (market.long_oi + market.short_oi)
          : 0.5;

      lines.push(`  ${market.symbol}:`);
      lines.push(`    Price: $${market.price.toLocaleString()}`);
      lines.push(
        `    Funding Rate: ${(market.funding_rate * 100).toFixed(4)}% per 24h (${fundingAnnualized.toFixed(2)}% annualized)`,
      );
      lines.push(
        `    Open Interest: $${(market.long_oi + market.short_oi).toLocaleString()} (${(oiSkew * 100).toFixed(1)}% long / ${((1 - oiSkew) * 100).toFixed(1)}% short)`,
      );
      lines.push("");
    }

    // Open Positions
    if (context.open_positions.length > 0) {
      lines.push("Open Positions:");
      for (const pos of context.open_positions) {
        const pnlSign = pos.pnl_usd >= 0 ? "+" : "";
        lines.push(`  ${pos.market} ${pos.direction.toUpperCase()}:`);
        lines.push(`    Size: $${pos.size_usd.toLocaleString()}`);
        lines.push(
          `    Entry: $${pos.entry_price.toLocaleString()} | Current: $${pos.current_price.toLocaleString()}`,
        );
        lines.push(
          `    PnL: ${pnlSign}$${pos.pnl_usd.toLocaleString()} (${pnlSign}${pos.pnl_percent.toFixed(2)}%)`,
        );
        lines.push(`    Leverage: ${pos.leverage.toFixed(2)}x`);
        lines.push("");
      }
      lines.push(
        `Total Portfolio Value: $${context.portfolio_value_usd.toLocaleString()}`,
      );
      lines.push("");
    } else {
      lines.push("Open Positions: None");
      lines.push("");
    }

    // Request
    lines.push(
      "Based on this market context, provide trade recommendations for each market.",
    );
    lines.push(
      "Consider the current setup, sentiment indicators, funding costs, and open positions.",
    );
    lines.push(
      "Be selective - only recommend trades with clear edge and reasonable risk/reward.",
    );

    return lines.join("\n");
  }

  /**
   * Generate trade recommendations using AI analysis
   *
   * @param markets Market symbols to analyze (e.g., ['BTC', 'ETH'])
   * @param walletAddress Optional wallet address to check existing positions
   * @param subAccountIds Optional subaccount IDs (default: [0])
   * @returns Complete AI analysis with recommendations
   */
  async generateRecommendation(
    markets: string[],
    walletAddress?: string,
    subAccountIds: number[] = [0],
  ): Promise<AgentAnalysis> {
    // Validate markets
    for (const symbol of markets) {
      if (!MARKETS[symbol]) {
        throw new Error(
          `Unknown market: ${symbol}. Available: ${Object.keys(MARKETS).join(", ")}`,
        );
      }
    }

    // Gather market context
    const context = await this.gatherMarketContext(
      markets,
      walletAddress,
      subAccountIds,
    );

    // Build prompts
    const systemPrompt = this.buildSystemPrompt();
    const userPrompt = this.buildUserPrompt(context);

    // Call Cloudflare AI
    try {
      const analysis =
        await this.cloudflare.generateStructuredResponse<AgentAnalysis>({
          input: [
            { role: "developer", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          temperature: 0.2, // Deterministic but not rigid
          reasoning: { effort: "medium" }, // Balanced analysis
        });

      // Add timestamp if not present
      if (!analysis.timestamp) {
        analysis.timestamp = new Date().toISOString();
      }

      return analysis;
    } catch (error: any) {
      throw new Error(`Failed to generate recommendations: ${error.message}`);
    }
  }
}

/**
 * Singleton instance of TradeRecommendationAgent
 */
export const tradeRecommendationAgent = new TradeRecommendationAgent();

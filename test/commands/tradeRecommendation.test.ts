import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { AgentAnalysis } from "../../src/types/tradeRecommendation.js";

// Store originals
const originalConsoleLog = console.log;
const originalConsoleError = console.error;
const originalProcessExit = process.exit;

// Mock data for market context
const mockFearGreedAnalysis = {
  current: { value: 35, classification: "Fear" },
  min: { value: 28, classification: "Fear" },
  max: { value: 52, classification: "Neutral" },
  trend: "improving",
};

const mockPolymarketPrediction = {
  targetDate: "2025-11-01",
  analysis: {
    expectedPrice: 72500,
    likelyRange: { min: 68000, max: 77000 },
    sentiment: "bullish",
    confidence: 0.68,
  },
};

const mockEconomicIndicators = {
  indicators: [
    {
      category: "FED_POLICY" as const,
      question: "Will 3 Fed rate cuts happen in 2025?",
      probability: 0.65,
      volume24hr: 8569,
      expiresAt: "2025-12-10",
    },
    {
      category: "RECESSION" as const,
      question: "US recession in 2025?",
      probability: 0.28,
      volume24hr: 8239,
      expiresAt: "2026-02-28",
    },
    {
      category: "INFLATION" as const,
      question: "Will inflation reach more than 5% in 2025?",
      probability: 0.22,
      volume24hr: 401,
      expiresAt: "2025-12-31",
    },
    {
      category: "SAFE_HAVEN" as const,
      question: "Will Gold close at $3,200 or more at the end of 2025?",
      probability: 0.45,
      volume24hr: 2600,
      expiresAt: "2025-12-31",
    },
  ],
  sentiment: "bullish",
  confidence: 0.72,
  analysis:
    "Fed rate cuts expected with low recession risk. Inflation under control.",
};

const mockBTCMarketData = {
  symbol: "BTC",
  price: 67850,
  funding_rate: 0.0015, // 0.15% per day
  long_oi: 125000000,
  short_oi: 98000000,
};

const mockETHMarketData = {
  symbol: "ETH",
  price: 3420,
  funding_rate: 0.0012, // 0.12% per day
  long_oi: 58000000,
  short_oi: 52000000,
};

const mockAnalysisBullish: AgentAnalysis = {
  recommendations: [
    {
      market: "BTC",
      action: "long",
      size_usd: 5000,
      confidence: 0.75,
      reasoning:
        "Fear & Greed at 35 (Fear) with improving trend suggests sentiment bottoming. Economic indicators show Fed rate cut expectations (65%) with low recession risk (28%), creating supportive macro backdrop. Funding rate at 0.15%/day is manageable for 1-day hold. Long/short OI ratio of 56/44 shows moderate bullish positioning but not extreme. Polymarket prediction of $72.5K suggests upside potential. Clear risk/reward setup with stop below recent lows.",
      risk_factors: [
        "Funding rate costs 0.15% per day, eroding profits if price stagnates",
        "Long OI slightly elevated could trigger squeeze on bad news",
        "Economic indicators can shift rapidly with new data releases",
      ],
      timeframe: "short",
    },
    {
      market: "ETH",
      action: "hold",
      size_usd: null,
      confidence: 0.45,
      reasoning:
        "ETH showing similar technical setup to BTC but with weaker relative strength. Funding at 0.12%/day is lower but OI skew less pronounced. Better to focus capital on BTC where conviction is higher. Wait for ETH to show independent strength or better entry.",
      risk_factors: [
        "ETH/BTC ratio near support, could break down",
        "Less liquid than BTC, higher slippage risk",
      ],
      timeframe: "short",
    },
  ],
  market_summary:
    "Market sentiment showing signs of bottoming with Fear & Greed at 35 (Fear) and improving trend. Economic indicators support risk-on positioning with Fed rate cut expectations and low recession probability. BTC presents better risk/reward than ETH currently.",
  timestamp: "2025-10-05T14:00:00.000Z",
};

const mockAnalysisBearish: AgentAnalysis = {
  recommendations: [
    {
      market: "BTC",
      action: "short",
      size_usd: 4000,
      confidence: 0.72,
      reasoning:
        "Fear & Greed moved to 78 (Extreme Greed) indicating overheated market. Economic indicators deteriorating with rising recession probability (58%) and emergency cut odds (35%) suggesting economic stress ahead. Funding rate elevated at 0.25%/day shows crowded longs. Long/short OI ratio at 68/32 creates squeeze risk. Polymarket prediction appears disconnected from worsening macro backdrop.",
      risk_factors: [
        "Negative funding costs 0.25% per day to hold shorts",
        "Market can stay irrational longer than shorts can stay solvent",
        "Fed pivot could quickly reverse bearish thesis",
      ],
      timeframe: "intraday",
    },
    {
      market: "ETH",
      action: "short",
      size_usd: 3000,
      confidence: 0.68,
      reasoning:
        "ETH typically follows BTC but with higher beta. Same bearish macro setup applies. Slightly lower confidence due to ETH's tendency for false moves. Smaller position size reflects higher volatility risk.",
      risk_factors: [
        "Higher volatility than BTC increases stop risk",
        "Can diverge from BTC on short timeframes",
        "Funding costs for shorts",
      ],
      timeframe: "intraday",
    },
  ],
  market_summary:
    "Market showing classic topping signals with Extreme Greed and deteriorating economic indicators. Rising recession probability and emergency cut expectations point to macro stress. High funding rates and lopsided positioning favor shorts on any weakness.",
  timestamp: "2025-10-05T14:00:00.000Z",
};

const mockAnalysisNeutral: AgentAnalysis = {
  recommendations: [
    {
      market: "BTC",
      action: "hold",
      size_usd: null,
      confidence: 0.35,
      reasoning:
        "Mixed signals across all indicators. Fear & Greed at 52 (Neutral) with no clear trend. Economic indicators conflicting - rate cut expectations offset by elevated recession risk. Funding near 0% suggests no strong directional bias. OI relatively balanced. No clear edge to justify taking risk. Better to wait for clearer setup.",
      risk_factors: [
        "Choppy price action likely in neutral sentiment environment",
        "Economic data releases could trigger sudden volatility",
        "Low conviction trades often stopped out in ranging markets",
      ],
      timeframe: "short",
    },
    {
      market: "ETH",
      action: "hold",
      size_usd: null,
      confidence: 0.32,
      reasoning:
        "Same neutral setup as BTC. No independent catalysts to favor ETH over cash. Preserve capital for better opportunities.",
      risk_factors: [
        "Could miss move if BTC breaks out strongly",
        "Opportunity cost of waiting",
      ],
      timeframe: "short",
    },
  ],
  market_summary:
    "Neutral market environment with conflicting signals. Fear & Greed neutral, economic indicators mixed, and positioning not extreme. No clear directional edge. Best action is to wait for better setup with higher conviction.",
  timestamp: "2025-10-05T14:00:00.000Z",
};

// Create mock for tradeRecommendationAgent
const mockGenerateRecommendation = vi.fn();
const mockGatherMarketContext = vi.fn();
const mockGetPreviousPositionState = vi.fn();

vi.mock(
  "../../src/api/trading/tradeRecommendationAgent.js",
  async (importOriginal) => {
    return {
      tradeRecommendationAgent: {
        generateRecommendation: mockGenerateRecommendation,
        gatherMarketContext: mockGatherMarketContext,
        getPreviousPositionState: mockGetPreviousPositionState,
      },
    };
  },
);

// Mock Discord service
const mockSendRecommendations = vi.fn();
const mockShutdown = vi.fn();

vi.mock("../../src/api/discord/tradeRecommendationFormatter.js", () => ({
  tradeRecommendationDiscordFormatter: {
    sendRecommendations: mockSendRecommendations,
  },
}));

vi.mock("../../src/api/discord/discordService.js", () => ({
  discordService: {
    shutdown: mockShutdown,
  },
}));

// Mock DB services
const mockSaveRecommendations = vi.fn();
const mockGetRecommendationsByMarket = vi.fn();
const mockCloseDb = vi.fn();

vi.mock("../../src/db/tradeRecommendationService.js", () => ({
  TradeRecommendationService: vi.fn().mockImplementation(() => ({
    saveRecommendations: mockSaveRecommendations,
    getRecommendationsByMarket: mockGetRecommendationsByMarket,
    close: mockCloseDb,
  })),
}));

vi.mock("../../src/db/knexConnector.js", () => ({
  KnexConnector: {
    destroy: vi.fn(),
  },
}));

describe("tradeRecommendation command", () => {
  // Test console output capture
  let consoleOutput: string[] = [];
  let consoleErrors: string[] = [];

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();
    consoleOutput = [];
    consoleErrors = [];

    // Mock console methods
    console.log = vi.fn((...args: any[]) => {
      consoleOutput.push(args.join(" "));
    });
    console.error = vi.fn((...args: any[]) => {
      consoleErrors.push(args.join(" "));
    });

    // Mock process.exit to throw instead of exiting
    process.exit = vi.fn((code?: number) => {
      throw new Error(`Process exited with code ${code}`);
    }) as any;

    // Reset mock implementations
    mockGatherMarketContext.mockResolvedValue({
      markets: [
        { symbol: "BTC", price: 67850 },
        { symbol: "ETH", price: 3420 },
        { symbol: "SOL", price: 155 },
      ],
    });
    mockGetPreviousPositionState.mockResolvedValue(new Map());
    mockSaveRecommendations.mockResolvedValue([]);
    mockGetRecommendationsByMarket.mockResolvedValue([]);
    mockCloseDb.mockResolvedValue(undefined);
    mockSendRecommendations.mockResolvedValue(undefined);
    mockShutdown.mockResolvedValue(undefined);
  });

  afterEach(() => {
    // Restore originals
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
    process.exit = originalProcessExit;
  });

  describe("Basic functionality", () => {
    it("should generate and display bullish recommendations", async () => {
      mockGenerateRecommendation.mockResolvedValue(mockAnalysisBullish);

      const { tradeRecommendation } = await import(
        "../../src/commands/tradeRecommendation.js"
      );

      await tradeRecommendation({ markets: "BTC,ETH" });

      // Verify agent was called correctly
      expect(mockGenerateRecommendation).toHaveBeenCalledWith(
        ["BTC", "ETH"],
        undefined,
        [0],
      );

      // Verify console output contains key elements
      const output = consoleOutput.join("\n");

      // Check header
      expect(output).toContain("AI TRADE RECOMMENDATIONS");
      expect(output).toContain("Generating trade recommendations");

      // Check market summary
      expect(output).toContain("MARKET SUMMARY");
      expect(output).toContain(
        "Market sentiment showing signs of bottoming with Fear & Greed at 35",
      );

      // Check BTC recommendation
      expect(output).toContain("₿ BTC 📈 LONG");
      expect(output).toContain("Confidence: High");
      expect(output).toContain("Suggested Size: $5,000");
      expect(output).toContain("Timeframe: Short-term (1 day)");
      expect(output).toContain("Fed rate cut expectations");
      expect(output).toContain("low recession"); // Match "low recession risk" or "low recession probability"

      // Check ETH recommendation
      expect(output).toContain("Ξ ETH ⏸️ HOLD");
      expect(output).toContain("Confidence: Low");
      expect(output).toContain("focus capital on BTC"); // Match wrapped text

      // Check risk factors
      expect(output).toContain("Risk Factors:");
      expect(output).toContain("Funding rate costs");
      expect(output).toContain("Economic indicators can shift rapidly");
    });

    it("should generate and display bearish recommendations", async () => {
      mockGenerateRecommendation.mockResolvedValue(mockAnalysisBearish);

      const { tradeRecommendation } = await import(
        "../../src/commands/tradeRecommendation.js"
      );

      await tradeRecommendation({ markets: "BTC,ETH" });

      const output = consoleOutput.join("\n");

      // Check BTC short recommendation
      expect(output).toContain("₿ BTC 📉 SHORT");
      expect(output).toContain("Confidence: High");
      expect(output).toContain("Suggested Size: $4,000");
      expect(output).toContain("Timeframe: Intraday (today)");
      expect(output).toContain("Extreme Greed");
      expect(output).toContain("rising recession probability");
      expect(output).toContain("emergency cut odds");

      // Check ETH short recommendation
      expect(output).toContain("Ξ ETH 📉 SHORT");
      expect(output).toContain("Suggested Size: $3,000");
      expect(output).toContain("higher beta");

      // Check market summary reflects bearish view
      expect(output).toContain("classic topping signals");
      expect(output).toContain("deteriorating"); // Match "deteriorating economic indicators" in summary
    });

    it("should handle neutral/hold recommendations", async () => {
      mockGenerateRecommendation.mockResolvedValue(mockAnalysisNeutral);

      const { tradeRecommendation } = await import(
        "../../src/commands/tradeRecommendation.js"
      );

      await tradeRecommendation({ markets: "BTC,ETH" });

      const output = consoleOutput.join("\n");

      // Check both hold recommendations
      expect(output).toContain("₿ BTC ⏸️ HOLD");
      expect(output).toContain("Ξ ETH ⏸️ HOLD");

      // Check low confidence
      expect(output).toContain("Confidence: Low");

      // Check neutral reasoning
      expect(output).toContain("Mixed signals");
      expect(output).toContain("No clear edge");
      expect(output).toContain("wait for better setup");

      // Check market summary
      expect(output).toContain("Neutral market environment");
      expect(output).toContain("conflicting signals");
    });
  });

  describe("JSON output mode", () => {
    it("should output raw JSON when --json flag is provided", async () => {
      mockGenerateRecommendation.mockResolvedValue(mockAnalysisBullish);

      const { tradeRecommendation } = await import(
        "../../src/commands/tradeRecommendation.js"
      );

      await tradeRecommendation({ markets: "BTC", json: true });

      const output = consoleOutput.join("\n");

      // Should contain JSON structure
      expect(output).toContain('"recommendations"');
      expect(output).toContain('"market_summary"');
      expect(output).toContain('"timestamp"');

      // Should NOT contain formatted output
      expect(output).not.toContain("AI TRADE RECOMMENDATIONS");
      expect(output).not.toContain("═══");

      // Verify it's valid JSON - need to filter out the "Generating..." line
      const jsonOutput = consoleOutput
        .filter((line) => !line.includes("Generating"))
        .join("\n");
      const parsed = JSON.parse(jsonOutput);
      expect(parsed.recommendations).toHaveLength(2);
      expect(parsed.recommendations[0].market).toBe("BTC");
    });
  });

  describe("Options handling", () => {
    it("should use default markets when none specified", async () => {
      mockGenerateRecommendation.mockResolvedValue(mockAnalysisBullish);

      const { tradeRecommendation } = await import(
        "../../src/commands/tradeRecommendation.js"
      );

      await tradeRecommendation({});

      // Should default to BTC,ETH
      expect(mockGenerateRecommendation).toHaveBeenCalledWith(
        ["BTC", "ETH"],
        undefined,
        [0],
      );
    });

    it("should parse custom markets correctly", async () => {
      mockGenerateRecommendation.mockResolvedValue(mockAnalysisBullish);

      const { tradeRecommendation } = await import(
        "../../src/commands/tradeRecommendation.js"
      );

      await tradeRecommendation({ markets: "BTC,SOL,XRP" });

      expect(mockGenerateRecommendation).toHaveBeenCalledWith(
        ["BTC", "SOL", "XRP"],
        undefined,
        [0],
      );
    });

    it("should handle wallet address option", async () => {
      mockGenerateRecommendation.mockResolvedValue(mockAnalysisBullish);

      const { tradeRecommendation } = await import(
        "../../src/commands/tradeRecommendation.js"
      );

      const testAddress = "0x1234567890abcdef1234567890abcdef12345678";
      await tradeRecommendation({ address: testAddress });

      expect(mockGenerateRecommendation).toHaveBeenCalledWith(
        ["BTC", "ETH"],
        testAddress,
        [0],
      );
    });

    it("should use WALLET_ADDRESS from environment", async () => {
      const envAddress = "0xENVADDRESS1234567890abcdef1234567890ab";
      process.env.WALLET_ADDRESS = envAddress;

      mockGenerateRecommendation.mockResolvedValue(mockAnalysisBullish);

      const { tradeRecommendation } = await import(
        "../../src/commands/tradeRecommendation.js"
      );

      await tradeRecommendation({});

      expect(mockGenerateRecommendation).toHaveBeenCalledWith(
        ["BTC", "ETH"],
        envAddress,
        [0],
      );

      delete process.env.WALLET_ADDRESS;
    });

    it("should parse multiple subaccount IDs", async () => {
      mockGenerateRecommendation.mockResolvedValue(mockAnalysisBullish);

      const { tradeRecommendation } = await import(
        "../../src/commands/tradeRecommendation.js"
      );

      await tradeRecommendation({ subs: "0,1,2" });

      expect(mockGenerateRecommendation).toHaveBeenCalledWith(
        ["BTC", "ETH"],
        undefined,
        [0, 1, 2],
      );
    });

    it("should reject invalid subaccount IDs", async () => {
      const { tradeRecommendation } = await import(
        "../../src/commands/tradeRecommendation.js"
      );

      await expect(async () => {
        await tradeRecommendation({ subs: "0,300" });
      }).rejects.toThrow("Process exited with code 1");

      const errors = consoleErrors.join("\n");
      expect(errors).toContain("Invalid subaccount ID: 300");
      expect(errors).toContain("Must be 0-255");
    });

    it("should reject negative subaccount IDs", async () => {
      const { tradeRecommendation } = await import(
        "../../src/commands/tradeRecommendation.js"
      );

      await expect(async () => {
        await tradeRecommendation({ subs: "-1,0" });
      }).rejects.toThrow("Process exited with code 1");

      const errors = consoleErrors.join("\n");
      expect(errors).toContain("Invalid subaccount ID: -1");
    });
  });

  describe("Error handling", () => {
    it("should handle agent errors gracefully", async () => {
      mockGenerateRecommendation.mockRejectedValue(
        new Error("Failed to fetch market data"),
      );

      const { tradeRecommendation } = await import(
        "../../src/commands/tradeRecommendation.js"
      );

      await expect(async () => {
        await tradeRecommendation({});
      }).rejects.toThrow("Process exited with code 1");

      const errors = consoleErrors.join("\n");
      expect(errors).toContain("Failed to generate trade recommendations");
      expect(errors).toContain("Failed to fetch market data");
    });

    it("should provide helpful hint for Cloudflare errors", async () => {
      mockGenerateRecommendation.mockRejectedValue(
        new Error("CLOUDFLARE authentication failed"),
      );

      const { tradeRecommendation } = await import(
        "../../src/commands/tradeRecommendation.js"
      );

      await expect(async () => {
        await tradeRecommendation({});
      }).rejects.toThrow("Process exited with code 1");

      const errors = consoleErrors.join("\n");
      expect(errors).toContain("CLOUDFLARE");
      expect(errors).toContain(
        "Make sure CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_AUTH_TOKEN are set",
      );
    });

    it("should provide helpful hint for unknown market errors", async () => {
      mockGenerateRecommendation.mockRejectedValue(
        new Error("Unknown market: DOGE"),
      );

      const { tradeRecommendation } = await import(
        "../../src/commands/tradeRecommendation.js"
      );

      await expect(async () => {
        await tradeRecommendation({});
      }).rejects.toThrow("Process exited with code 1");

      const errors = consoleErrors.join("\n");
      expect(errors).toContain("Unknown market");
      expect(errors).toContain("Use valid market symbols");
    });

    it("should provide helpful hint for network errors", async () => {
      mockGenerateRecommendation.mockRejectedValue(
        new Error("Failed to fetch RPC data"),
      );

      const { tradeRecommendation } = await import(
        "../../src/commands/tradeRecommendation.js"
      );

      await expect(async () => {
        await tradeRecommendation({});
      }).rejects.toThrow("Process exited with code 1");

      const errors = consoleErrors.join("\n");
      expect(errors).toContain("Failed to fetch");
      expect(errors).toContain("Check your network connection");
    });
  });

  describe("Discord notifications", () => {
    it("should skip HOLD actions when sending to Discord", async () => {
      // Mock analysis with mix of HOLD and actionable recommendations
      const mixedAnalysis: AgentAnalysis = {
        recommendations: [
          {
            market: "BTC",
            action: "long",
            size_usd: 5000,
            confidence: 0.75,
            reasoning: "Strong bullish setup",
            risk_factors: ["Risk 1"],
            timeframe: "short",
          },
          {
            market: "ETH",
            action: "hold",
            size_usd: null,
            confidence: 0.45,
            reasoning: "No clear edge, wait for better setup",
            risk_factors: ["Risk 1"],
            timeframe: "short",
          },
          {
            market: "SOL",
            action: "short",
            size_usd: 3000,
            confidence: 0.68,
            reasoning: "Bearish divergence",
            risk_factors: ["Risk 1"],
            timeframe: "short",
          },
        ],
        market_summary: "Mixed market conditions",
        timestamp: "2025-10-05T14:00:00.000Z",
      };

      mockGenerateRecommendation.mockResolvedValue(mixedAnalysis);

      const { tradeRecommendation } = await import(
        "../../src/commands/tradeRecommendation.js"
      );

      // Run with --discord flag (but not --db to keep test simple)
      await tradeRecommendation({ markets: "BTC,ETH,SOL", discord: true });

      const output = consoleOutput.join("\n");

      // Should log that ETH HOLD is being skipped
      expect(output).toContain("ETH: HOLD (not actionable, skipping Discord)");

      // Should indicate filtering is happening
      expect(output).toContain("Filtering recommendations for Discord");
    });

    it("should still display all recommendations in console including HOLDs", async () => {
      const mixedAnalysis: AgentAnalysis = {
        recommendations: [
          {
            market: "BTC",
            action: "long",
            size_usd: 5000,
            confidence: 0.75,
            reasoning: "Strong bullish setup",
            risk_factors: [],
            timeframe: "short",
          },
          {
            market: "ETH",
            action: "hold",
            size_usd: null,
            confidence: 0.45,
            reasoning: "No clear edge, wait for better setup",
            risk_factors: [],
            timeframe: "short",
          },
        ],
        market_summary: "Mixed market conditions",
        timestamp: "2025-10-05T14:00:00.000Z",
      };

      mockGenerateRecommendation.mockResolvedValue(mixedAnalysis);

      const { tradeRecommendation } = await import(
        "../../src/commands/tradeRecommendation.js"
      );

      // Run without Discord flag - should show all recommendations
      await tradeRecommendation({ markets: "BTC,ETH" });

      const output = consoleOutput.join("\n");

      // Both recommendations should be in console output
      expect(output).toContain("₿ BTC 📈 LONG");
      expect(output).toContain("Ξ ETH ⏸️ HOLD");

      // Should show reasoning for both
      expect(output).toContain("Strong bullish setup");
      expect(output).toContain("No clear edge, wait for better setup");
    });
  });

  describe("Output formatting", () => {
    it("should format confidence levels correctly", async () => {
      const customAnalysis: AgentAnalysis = {
        ...mockAnalysisBullish,
        recommendations: [
          {
            market: "BTC",
            action: "long",
            size_usd: 1000,
            confidence: 0.95, // Very High
            reasoning: "Test",
            risk_factors: [],
            timeframe: "short",
          },
          {
            market: "ETH",
            action: "short",
            size_usd: 1000,
            confidence: 0.55, // Moderate
            reasoning: "Test",
            risk_factors: [],
            timeframe: "short",
          },
        ],
      };

      mockGenerateRecommendation.mockResolvedValue(customAnalysis);

      const { tradeRecommendation } = await import(
        "../../src/commands/tradeRecommendation.js"
      );

      await tradeRecommendation({});

      const output = consoleOutput.join("\n");

      expect(output).toContain("Confidence: Very High");
      expect(output).toContain("Confidence: Moderate");
    });

    it("should display confidence meters", async () => {
      mockGenerateRecommendation.mockResolvedValue(mockAnalysisBullish);

      const { tradeRecommendation } = await import(
        "../../src/commands/tradeRecommendation.js"
      );

      await tradeRecommendation({});

      const output = consoleOutput.join("\n");

      // Check for confidence meter (█ = filled, ░ = empty)
      expect(output).toMatch(/[█░]{10}\s+\d+%/);
    });

    it("should format timeframes with updated labels", async () => {
      const customAnalysis: AgentAnalysis = {
        ...mockAnalysisBullish,
        recommendations: [
          {
            market: "BTC",
            action: "long",
            size_usd: 1000,
            confidence: 0.7,
            reasoning: "Test",
            risk_factors: [],
            timeframe: "intraday",
          },
          {
            market: "ETH",
            action: "long",
            size_usd: 1000,
            confidence: 0.7,
            reasoning: "Test",
            risk_factors: [],
            timeframe: "short",
          },
        ],
      };

      mockGenerateRecommendation.mockResolvedValue(customAnalysis);

      const { tradeRecommendation } = await import(
        "../../src/commands/tradeRecommendation.js"
      );

      await tradeRecommendation({});

      const output = consoleOutput.join("\n");

      expect(output).toContain("Timeframe: Intraday (today)");
      expect(output).toContain("Timeframe: Short-term (1 day)");
    });

    it("should wrap long text properly", async () => {
      const longReasoning =
        "This is a very long reasoning text that should be wrapped to avoid exceeding the 80 character limit per line and ensure readability in terminal output for users running the command".repeat(
          2,
        );

      const customAnalysis: AgentAnalysis = {
        ...mockAnalysisBullish,
        recommendations: [
          {
            market: "BTC",
            action: "long",
            size_usd: 1000,
            confidence: 0.7,
            reasoning: longReasoning,
            risk_factors: ["Long risk factor that should also wrap properly"],
            timeframe: "short",
          },
        ],
      };

      mockGenerateRecommendation.mockResolvedValue(customAnalysis);

      const { tradeRecommendation } = await import(
        "../../src/commands/tradeRecommendation.js"
      );

      await tradeRecommendation({});

      const output = consoleOutput.join("\n");

      // Check that no line exceeds reasonable length
      const lines = output.split("\n");
      for (const line of lines) {
        expect(line.length).toBeLessThan(85); // Allow some margin for indentation
      }
    });

    it("should display timestamp in readable format", async () => {
      mockGenerateRecommendation.mockResolvedValue(mockAnalysisBullish);

      const { tradeRecommendation } = await import(
        "../../src/commands/tradeRecommendation.js"
      );

      await tradeRecommendation({});

      const output = consoleOutput.join("\n");

      // Should contain "Generated:" followed by a date
      expect(output).toMatch(/Generated:\s+\w+\s+\d+,\s+\d{4}/);
    });

    it("should handle recommendations without size", async () => {
      const customAnalysis: AgentAnalysis = {
        ...mockAnalysisNeutral,
        recommendations: [
          {
            market: "BTC",
            action: "hold",
            size_usd: null,
            confidence: 0.5,
            reasoning: "No clear edge",
            risk_factors: [],
            timeframe: "short",
          },
        ],
      };

      mockGenerateRecommendation.mockResolvedValue(customAnalysis);

      const { tradeRecommendation } = await import(
        "../../src/commands/tradeRecommendation.js"
      );

      await tradeRecommendation({});

      const output = consoleOutput.join("\n");

      // Should not show "Suggested Size" for hold/null size
      expect(output).not.toContain("Suggested Size");
    });

    it("should display all market emojis correctly", async () => {
      const customAnalysis: AgentAnalysis = {
        ...mockAnalysisBullish,
        recommendations: [
          {
            market: "BTC",
            action: "long",
            size_usd: 1000,
            confidence: 0.7,
            reasoning: "Test",
            risk_factors: [],
            timeframe: "short",
          },
          {
            market: "ETH",
            action: "short",
            size_usd: 1000,
            confidence: 0.7,
            reasoning: "Test",
            risk_factors: [],
            timeframe: "short",
          },
          {
            market: "SOL",
            action: "hold",
            size_usd: null,
            confidence: 0.5,
            reasoning: "Test",
            risk_factors: [],
            timeframe: "short",
          },
          {
            market: "XRP",
            action: "close",
            size_usd: null,
            confidence: 0.6,
            reasoning: "Test",
            risk_factors: [],
            timeframe: "short",
          },
        ],
      };

      mockGenerateRecommendation.mockResolvedValue(customAnalysis);

      const { tradeRecommendation } = await import(
        "../../src/commands/tradeRecommendation.js"
      );

      await tradeRecommendation({});

      const output = consoleOutput.join("\n");

      // Check for market-specific emojis
      expect(output).toContain("₿ BTC");
      expect(output).toContain("Ξ ETH");
      expect(output).toContain("◎ SOL");
      expect(output).toContain("✕ XRP");

      // Check for action emojis
      expect(output).toContain("📈 LONG");
      expect(output).toContain("📉 SHORT");
      expect(output).toContain("⏸️ HOLD");
      expect(output).toContain("❌ CLOSE");
    });
  });

  describe("Integration with economic indicators", () => {
    it("should reflect economic indicators in bullish recommendations", async () => {
      mockGenerateRecommendation.mockResolvedValue(mockAnalysisBullish);

      const { tradeRecommendation } = await import(
        "../../src/commands/tradeRecommendation.js"
      );

      await tradeRecommendation({});

      const output = consoleOutput.join("\n");

      // Should mention economic indicators in reasoning
      expect(output).toContain("Fed rate cut expectations");
      expect(output).toContain("low recession"); // Match "low recession risk" or "low recession probability"
      expect(output).toContain("Economic indicators");
    });

    it("should reflect economic indicators in bearish recommendations", async () => {
      mockGenerateRecommendation.mockResolvedValue(mockAnalysisBearish);

      const { tradeRecommendation } = await import(
        "../../src/commands/tradeRecommendation.js"
      );

      await tradeRecommendation({});

      const output = consoleOutput.join("\n");

      // Should mention deteriorating economic conditions
      expect(output).toContain("rising recession probability");
      expect(output).toContain("emergency cut");
      expect(output).toContain("economic stress");
      expect(output).toContain("deteriorating"); // Match "deteriorating" in context
    });

    it("should handle missing economic indicators gracefully", async () => {
      const analysisWithoutEcon: AgentAnalysis = {
        ...mockAnalysisBullish,
        recommendations: [
          {
            market: "BTC",
            action: "long",
            size_usd: 5000,
            confidence: 0.65,
            reasoning:
              "Fear & Greed improving. Funding reasonable. Technical setup favorable. Economic indicators unavailable but other signals support long position.",
            risk_factors: ["Limited macro context without economic indicators"],
            timeframe: "short",
          },
        ],
      };

      mockGenerateRecommendation.mockResolvedValue(analysisWithoutEcon);

      const { tradeRecommendation } = await import(
        "../../src/commands/tradeRecommendation.js"
      );

      await tradeRecommendation({});

      const output = consoleOutput.join("\n");

      // Should still generate recommendation
      expect(output).toContain("BTC 📈 LONG");
      expect(output).toContain("Confidence:");
    });
  });
});

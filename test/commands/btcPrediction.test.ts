import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import MockAdapter from "axios-mock-adapter";
import { polymarketAxios } from "../../src/api/polymarket/polymarketClient.js";
import { btcPrediction } from "../../src/commands/btcPrediction.js";
import { setupConsoleMocks, ConsoleMock } from "../utils/consoleMock.js";

describe("btcPrediction command", () => {
  let mock: MockAdapter;

  // Set up console mocks for each test
  setupConsoleMocks();

  beforeEach(() => {
    // Create mock adapter for axios
    mock = new MockAdapter(polymarketAxios);
  });

  afterEach(() => {
    // Reset and restore mock adapter
    mock.reset();
    mock.restore();
  });

  it("should display BTC price prediction", async () => {
    const mockMarkets = [
      {
        id: "1",
        question: "Will Bitcoin reach $150,000 by December 31, 2025?",
        slug: "btc-150k",
        endDate: "2025-12-31T12:00:00Z",
        lastTradePrice: 0.22,
        bestBid: 0.21,
        bestAsk: 0.24,
        closed: false,
      },
      {
        id: "2",
        question: "Will Bitcoin reach $130,000 by December 31, 2025?",
        slug: "btc-130k",
        endDate: "2025-12-31T12:00:00Z",
        lastTradePrice: 0.54,
        bestBid: 0.55,
        bestAsk: 0.58,
        closed: false,
      },
      {
        id: "3",
        question: "Will Bitcoin reach $200,000 by December 31, 2025?",
        slug: "btc-200k",
        endDate: "2025-12-31T12:00:00Z",
        lastTradePrice: 0.07,
        bestBid: 0.06,
        bestAsk: 0.07,
        closed: false,
      },
    ];

    const mockEvents = [
      {
        id: "event1",
        title: "Bitcoin Price Predictions",
        slug: "btc-predictions",
        endDate: "2025-12-31T12:00:00Z",
        closed: false,
        markets: mockMarkets,
      },
    ];

    mock.onGet("/events").reply(200, mockEvents);

    await btcPrediction({});

    const logged = (ConsoleMock.log as any).mock.calls.flat().join("\n");
    expect(logged).toContain("BTC Price Prediction from Polymarket");
    expect(logged).toContain("Target Date: December 31, 2025");
    expect(logged).toContain("Median Price:");
    expect(logged).toContain("Likely Range:");
    expect(logged).toContain("Confidence Score:");
    expect(logged).toContain("Probability Distribution:");
    expect(logged).toContain("Market Sentiment:");
  });

  it("should output JSON when json option is true", async () => {
    const mockMarkets = [
      {
        id: "1",
        question: "Will Bitcoin reach $150,000 by December 31, 2025?",
        slug: "btc-150k",
        endDate: "2025-12-31T12:00:00Z",
        lastTradePrice: 0.22,
        bestBid: 0.21,
        bestAsk: 0.24,
        closed: false,
      },
    ];

    const mockEvents = [
      {
        id: "event1",
        title: "Bitcoin Price Predictions",
        slug: "btc-predictions",
        endDate: "2025-12-31T12:00:00Z",
        closed: false,
        markets: mockMarkets,
      },
    ];

    mock.onGet("/events").reply(200, mockEvents);

    await btcPrediction({ json: true });

    const logged = (ConsoleMock.log as any).mock.calls.flat().join("\n");

    // Should contain JSON structure
    expect(logged).toContain("targetDate");
    expect(logged).toContain("priceThresholds");
    expect(logged).toContain("expectedPrice");
  });

  it("should handle API errors gracefully", async () => {
    mock.onGet("/events").reply(500, { error: "Internal Server Error" });

    await btcPrediction({});

    const errLogged = (ConsoleMock.error as any).mock.calls.flat().join("\n");
    expect(errLogged).toMatch(/Failed to generate BTC prediction/i);
    expect(ConsoleMock.exit).toHaveBeenCalledWith(1);
  });

  it("should handle no BTC markets found", async () => {
    // Return empty events array (no Bitcoin events)
    mock.onGet("/events").reply(200, []);

    await btcPrediction({});

    const errLogged = (ConsoleMock.error as any).mock.calls.flat().join("\n");
    // With no BTC markets, should get an error about no markets
    expect(errLogged).toMatch(
      /No BTC price markets found|Available dates: none/i,
    );
    expect(ConsoleMock.exit).toHaveBeenCalledWith(1);
  });
});

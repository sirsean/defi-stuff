import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import MockAdapter from "axios-mock-adapter";
import { fearGreedAxios } from "../../src/api/feargreed/fearGreedClient.js";
import { fearGreedIndex } from "../../src/commands/fearGreedIndex.js";
import { setupConsoleMocks, ConsoleMock } from "../utils/consoleMock.js";

/**
 * Helper to build Fear & Greed data points
 */
const buildPoint = (value: number, classification: string, ts: number) => ({
  value: String(value),
  value_classification: classification,
  timestamp: String(ts),
  time_until_update: "0",
});

describe("fearGreedIndex command", () => {
  let mock: MockAdapter;

  // Set up console mocks for each test
  setupConsoleMocks();

  beforeEach(() => {
    // Create mock adapter for axios
    mock = new MockAdapter(fearGreedAxios);
  });

  afterEach(() => {
    // Reset and restore mock adapter
    mock.reset();
    mock.restore();
  });

  it("should display current index value and classification", async () => {
    const now = Math.floor(Date.now() / 1000);
    const resp = {
      name: "Fear and Greed Index",
      data: [
        buildPoint(50, "Neutral", now),
        buildPoint(28, "Fear", now - 86400),
        buildPoint(60, "Greed", now - 2 * 86400),
      ],
      metadata: { error: null },
    };
    mock.onGet("/fng/").reply(200, resp);

    await fearGreedIndex({ limit: 3 });

    const logged = (ConsoleMock.log as any).mock.calls.flat().join("\n");
    expect(logged).toContain("Fear & Greed Index");
    expect(logged).toContain("Current: 50 (Neutral)");
    expect(logged).toContain("Based on last 3 days");
  });

  it("should calculate min and max correctly", async () => {
    const now = Math.floor(Date.now() / 1000);
    const resp = {
      name: "Fear and Greed Index",
      data: [
        buildPoint(40, "Fear", now),
        buildPoint(28, "Fear", now - 86400),
        buildPoint(75, "Greed", now - 2 * 86400),
        buildPoint(90, "Extreme Greed", now - 3 * 86400),
      ],
      metadata: { error: null },
    };
    mock.onGet("/fng/").reply(200, resp);

    await fearGreedIndex({ limit: 4 });

    const logged = (ConsoleMock.log as any).mock.calls.flat().join("\n");
    expect(logged).toContain("Min: 28 (Fear)");
    expect(logged).toContain("Max: 90 (Extreme Greed)");
  });

  it("should determine trend correctly (improving)", async () => {
    const now = Math.floor(Date.now() / 1000);
    // Recent trend: strong upward momentum
    // Last 4 days: 35 -> 40 -> 48 -> 58 (slope ~7.6 pts/day)
    const resp = {
      name: "Fear and Greed Index",
      data: [
        buildPoint(58, "Greed", now),
        buildPoint(48, "Neutral", now - 86400),
        buildPoint(40, "Fear", now - 2 * 86400),
        buildPoint(35, "Fear", now - 3 * 86400),
        buildPoint(33, "Fear", now - 4 * 86400),
        buildPoint(32, "Fear", now - 5 * 86400),
      ],
      metadata: { error: null },
    };
    mock.onGet("/fng/").reply(200, resp);

    await fearGreedIndex({ limit: 6 });

    const logged = (ConsoleMock.log as any).mock.calls.flat().join("\n");
    expect(logged).toMatch(/Trend: Improving.*📈/);
  });

  it("should determine trend correctly (declining)", async () => {
    const now = Math.floor(Date.now() / 1000);
    // Recent trend: strong downward momentum
    // Last 4 days: 65 -> 55 -> 42 -> 30 (slope ~-11.7 pts/day)
    const resp = {
      name: "Fear and Greed Index",
      data: [
        buildPoint(30, "Fear", now),
        buildPoint(42, "Fear", now - 86400),
        buildPoint(55, "Greed", now - 2 * 86400),
        buildPoint(65, "Greed", now - 3 * 86400),
        buildPoint(68, "Greed", now - 4 * 86400),
        buildPoint(70, "Greed", now - 5 * 86400),
      ],
      metadata: { error: null },
    };
    mock.onGet("/fng/").reply(200, resp);

    await fearGreedIndex({ limit: 6 });

    const logged = (ConsoleMock.log as any).mock.calls.flat().join("\n");
    expect(logged).toMatch(/Trend: Declining.*📉/);
  });

  it("should determine trend correctly (stable)", async () => {
    const now = Math.floor(Date.now() / 1000);
    // First 3 (recent): 50, 48, 52 -> avg ~50
    // Last 3 (older): 51, 49, 50 -> avg ~50 => stable
    const resp = {
      name: "Fear and Greed Index",
      data: [
        buildPoint(50, "Neutral", now),
        buildPoint(48, "Neutral", now - 86400),
        buildPoint(52, "Neutral", now - 2 * 86400),
        buildPoint(51, "Neutral", now - 3 * 86400),
        buildPoint(49, "Neutral", now - 4 * 86400),
        buildPoint(50, "Neutral", now - 5 * 86400),
      ],
      metadata: { error: null },
    };
    mock.onGet("/fng/").reply(200, resp);

    await fearGreedIndex({ limit: 6 });

    const logged = (ConsoleMock.log as any).mock.calls.flat().join("\n");
    expect(logged).toMatch(/Trend: Stable.*🔁/);
  });

  it("should use default limit of 10 when not specified", async () => {
    const now = Math.floor(Date.now() / 1000);
    const resp = {
      name: "Fear and Greed Index",
      data: Array.from({ length: 10 }, (_, i) =>
        buildPoint(50 + i, "Neutral", now - i * 86400),
      ),
      metadata: { error: null },
    };
    mock.onGet("/fng/").reply(200, resp);

    await fearGreedIndex({});

    const logged = (ConsoleMock.log as any).mock.calls.flat().join("\n");
    expect(logged).toContain("Based on last 10 days");
  });

  it("should handle API errors gracefully", async () => {
    mock.onGet("/fng/").reply(500, { error: "Internal Server Error" });

    await fearGreedIndex({ limit: 3 });

    const errLogged = (ConsoleMock.error as any).mock.calls.flat().join("\n");
    expect(errLogged).toMatch(/Failed to fetch Fear & Greed Index/i);
    expect(ConsoleMock.exit).toHaveBeenCalledWith(1);
  });

  it("should handle metadata error from API", async () => {
    const resp = {
      name: "Fear and Greed Index",
      data: [],
      metadata: { error: "service unavailable" },
    };
    mock.onGet("/fng/").reply(200, resp);

    await fearGreedIndex({ limit: 3 });

    const errLogged = (ConsoleMock.error as any).mock.calls.flat().join("\n");
    expect(errLogged).toContain("Fear & Greed API error: service unavailable");
    expect(ConsoleMock.exit).toHaveBeenCalledWith(1);
  });

  it("should handle empty data from API", async () => {
    const resp = {
      name: "Fear and Greed Index",
      data: [],
      metadata: { error: null },
    };
    mock.onGet("/fng/").reply(200, resp);

    await fearGreedIndex({ limit: 3 });

    const errLogged = (ConsoleMock.error as any).mock.calls.flat().join("\n");
    expect(errLogged).toContain("Fear & Greed API returned no data");
    expect(ConsoleMock.exit).toHaveBeenCalledWith(1);
  });

  it("should parse string limit option", async () => {
    const now = Math.floor(Date.now() / 1000);
    const resp = {
      name: "Fear and Greed Index",
      data: Array.from({ length: 14 }, (_, i) =>
        buildPoint(45 + i, "Fear", now - i * 86400),
      ),
      metadata: { error: null },
    };
    mock.onGet("/fng/").reply(200, resp);

    await fearGreedIndex({ limit: "14" });

    const logged = (ConsoleMock.log as any).mock.calls.flat().join("\n");
    expect(logged).toContain("Based on last 14 days");
  });
});

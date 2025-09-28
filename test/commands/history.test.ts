import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { BalanceType } from "../../src/db/balanceRecordService.js";

// Mock the BalanceRecordService
const mockGetByDate = vi.fn();
const mockGetByDateRange = vi.fn();
const mockGetByType = vi.fn();
vi.mock("../../src/db/balanceRecordService.js", () => {
  return {
    BalanceType: {
      TOTAL: "total",
      AUTO_USD: "autoUSD",
      AUTO_ETH: "autoETH",
      DINERO_ETH: "dineroETH",
      FLP: "FLP",
      FLEX_REWARDS: "flex_rewards",
      TOKEMAK_REWARDS: "tokemak_rewards",
    },
    BalanceRecordService: vi.fn().mockImplementation(() => {
      return {
        initDatabase: vi.fn().mockResolvedValue(undefined),
        getBalanceRecordsByDate: mockGetByDate,
        getBalanceRecordsByDateRange: mockGetByDateRange,
        getBalanceRecordsByType: mockGetByType,
      };
    }),
  };
});

// Import the module after mocking
import { history } from "../../src/commands/history.js";

// Console mocks
const consoleLog = vi.spyOn(console, "log").mockImplementation(() => {});
const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

// Sample records for tests
const sampleRecords = [
  // Total
  {
    id: 1,
    timestamp: new Date("2023-05-15"),
    date: "2023-05-15",
    wallet_address: "0x1234567890abcdef",
    balance_type: BalanceType.TOTAL,
    currency: "USD",
    amount: 10000.5,
  },
  // AUTO USD
  {
    id: 2,
    timestamp: new Date("2023-05-15"),
    date: "2023-05-15",
    wallet_address: "0x1234567890abcdef",
    balance_type: BalanceType.AUTO_USD,
    currency: "USD",
    amount: 5000.25,
  },
  // AUTO ETH
  {
    id: 3,
    timestamp: new Date("2023-05-15"),
    date: "2023-05-15",
    wallet_address: "0x1234567890abcdef",
    balance_type: BalanceType.AUTO_ETH,
    currency: "ETH",
    amount: 2.5,
  },
  // Dinero ETH
  {
    id: 4,
    timestamp: new Date("2023-05-15"),
    date: "2023-05-15",
    wallet_address: "0x1234567890abcdef",
    balance_type: BalanceType.DINERO_ETH,
    currency: "ETH",
    amount: 1.25,
  },
  // FLP
  {
    id: 5,
    timestamp: new Date("2023-05-15"),
    date: "2023-05-15",
    wallet_address: "0x1234567890abcdef",
    balance_type: BalanceType.FLP,
    currency: "USD",
    amount: 3000.75,
  },
  // Tokemak rewards
  {
    id: 6,
    timestamp: new Date("2023-05-15"),
    date: "2023-05-15",
    wallet_address: "0x1234567890abcdef",
    balance_type: BalanceType.TOKEMAK_REWARDS,
    currency: "TOKE",
    amount: 10,
    metadata: {
      usdValue: 500,
    },
  },
  // Flex rewards
  {
    id: 7,
    timestamp: new Date("2023-05-15"),
    date: "2023-05-15",
    wallet_address: "0x1234567890abcdef",
    balance_type: BalanceType.FLEX_REWARDS,
    currency: "USDC",
    amount: 500,
    metadata: {
      usdValue: 500,
    },
  },
];

describe("history command", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();

    // Set default mock return values
    mockGetByType.mockResolvedValue([sampleRecords[0]]); // Return just the TOTAL record
    mockGetByDate.mockResolvedValue(sampleRecords);
    mockGetByDateRange.mockResolvedValue(sampleRecords);

    // Reset environment
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("should display an error when no wallet address is provided", async () => {
    // Clear environment variable
    process.env.WALLET_ADDRESS = undefined;

    await history();

    expect(consoleError).toHaveBeenCalledWith(
      "Error: Wallet address not provided. Please specify an address or set the WALLET_ADDRESS environment variable.",
    );
  });

  it("should get all records when no options are specified", async () => {
    await history("0x1234567890abcdef");

    expect(mockGetByType).toHaveBeenCalledWith(
      "0x1234567890abcdef",
      BalanceType.TOTAL,
    );
    expect(mockGetByDate).toHaveBeenCalledWith(
      "0x1234567890abcdef",
      "2023-05-15",
    );
    expect(consoleLog).toHaveBeenCalledWith(
      "Found 1 historical daily records:",
    );
  });

  it("should use date range when range option is provided", async () => {
    await history("0x1234567890abcdef", { range: "2023-01-01,2023-12-31" });

    expect(mockGetByDateRange).toHaveBeenCalled();
    const callArgs = mockGetByDateRange.mock.calls[0];
    expect(callArgs[0]).toBe("0x1234567890abcdef");
    expect(callArgs[1]).toBe("2023-01-01");
    expect(callArgs[2]).toBe("2023-12-31");

    expect(consoleLog).toHaveBeenCalledWith(
      "Found 1 historical daily records:",
    );
  });

  it("should handle invalid date range format", async () => {
    await history("0x1234567890abcdef", { range: "invalid-date" });

    expect(consoleError).toHaveBeenCalledWith(
      "Error: Invalid date range format. Please use YYYY-MM-DD,YYYY-MM-DD format.",
    );
  });

  it("should use days option to calculate date range", async () => {
    const today = new Date();
    const todayStr = today.toISOString().split("T")[0];

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(today.getDate() - 7);
    const sevenDaysAgoStr = sevenDaysAgo.toISOString().split("T")[0];

    await history("0x1234567890abcdef", { days: 7 });

    expect(mockGetByDateRange).toHaveBeenCalled();
    const callArgs = mockGetByDateRange.mock.calls[0];
    expect(callArgs[0]).toBe("0x1234567890abcdef");
    expect(callArgs[1]).toBe(sevenDaysAgoStr); // Should be ~7 days ago
    expect(callArgs[2]).toBe(todayStr); // Should be today

    expect(consoleLog).toHaveBeenCalledWith(
      "Found 1 historical daily records:",
    );
  });

  it("should display a message when no records are found", async () => {
    mockGetByType.mockResolvedValueOnce([]);

    await history("0x1234567890abcdef");

    expect(mockGetByType).toHaveBeenCalledWith(
      "0x1234567890abcdef",
      BalanceType.TOTAL,
    );
    expect(consoleLog).toHaveBeenCalledWith(
      "No historical data found for the specified criteria.",
    );
  });

  it("should handle errors during database operations", async () => {
    const error = new Error("Database error");
    mockGetByType.mockRejectedValueOnce(error);

    await history("0x1234567890abcdef");

    expect(consoleError).toHaveBeenCalledWith(
      "Error retrieving historical balance data:",
      error,
    );
  });
});

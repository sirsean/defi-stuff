import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { ChartDataService } from "../../src/db/chartDataService.js";
import {
  BalanceRecordService,
  BalanceType,
} from "../../src/db/balanceRecordService.js";
import "../utils/setupTests.js";

// Mock the BalanceRecordService
vi.mock("../../src/db/balanceRecordService.js", () => ({
  BalanceRecordService: vi.fn(),
  BalanceType: {
    TOTAL: "total",
    AUTO_USD: "autoUSD",
    AUTO_ETH: "autoETH",
    DINERO_ETH: "dineroETH",
    FLP: "FLP",
    BASE_USD: "baseUSD",
    FLEX_REWARDS: "flex_rewards",
    TOKEMAK_REWARDS: "tokemak_rewards",
    BASE_TOKEMAK_REWARDS: "base_tokemak_rewards",
  },
}));

describe("ChartDataService", () => {
  let chartDataService: ChartDataService;
  let mockBalanceRecordService: any;

  beforeEach(() => {
    // Create mock methods for BalanceRecordService
    mockBalanceRecordService = {
      getBalanceRecordsByDateRange: vi.fn(),
      close: vi.fn(),
    };

    // Mock the BalanceRecordService constructor
    (BalanceRecordService as any).mockImplementation(
      () => mockBalanceRecordService,
    );

    chartDataService = new ChartDataService();

    // Set up environment variable
    process.env.WALLET_ADDRESS = "0x1234567890abcdef1234567890abcdef12345678";
  });

  afterEach(() => {
    vi.clearAllMocks();
    delete process.env.WALLET_ADDRESS;
  });

  describe("getChartData", () => {
    it("should return empty datasets when no records found", async () => {
      // Mock empty response
      mockBalanceRecordService.getBalanceRecordsByDateRange.mockResolvedValue(
        [],
      );

      const result = await chartDataService.getChartData("0xtest", 7);

      expect(result.labels).toHaveLength(7);
      expect(result.datasets).toHaveLength(0); // No datasets since filtered out zeros
    });

    it("should format chart data correctly with valid records", async () => {
      // Mock sample data
      const mockRecords = [
        {
          date: "2023-10-01",
          balance_type: BalanceType.TOTAL,
          currency: "USD",
          amount: 100000,
        },
        {
          date: "2023-10-01",
          balance_type: BalanceType.AUTO_USD,
          currency: "USD",
          amount: 25000,
        },
        {
          date: "2023-10-02",
          balance_type: BalanceType.TOTAL,
          currency: "USD",
          amount: 105000,
        },
      ];

      mockBalanceRecordService.getBalanceRecordsByDateRange.mockResolvedValue(
        mockRecords,
      );

      const result = await chartDataService.getChartData("0xtest", 2);

      expect(result.labels).toHaveLength(2);
      expect(result.datasets.length).toBeGreaterThan(0);

      // Should have Total USD dataset
      const totalUsdDataset = result.datasets.find(
        (d) => d.label === "Total USD",
      );
      expect(totalUsdDataset).toBeDefined();
      expect(totalUsdDataset?.data).toEqual([100000, 105000]);

      // Should have Auto USD dataset
      const autoUsdDataset = result.datasets.find(
        (d) => d.label === "Auto USD",
      );
      expect(autoUsdDataset).toBeDefined();
      expect(autoUsdDataset?.data).toEqual([25000, 0]); // Only has data for first day
    });

    it("should use environment variable when no address provided", async () => {
      mockBalanceRecordService.getBalanceRecordsByDateRange.mockResolvedValue(
        [],
      );

      await chartDataService.getChartData(undefined, 7);

      expect(
        mockBalanceRecordService.getBalanceRecordsByDateRange,
      ).toHaveBeenCalledWith(
        "0x1234567890abcdef1234567890abcdef12345678",
        expect.any(String),
        expect.any(String),
      );
    });

    it("should throw error when no address provided and no environment variable", async () => {
      delete process.env.WALLET_ADDRESS;

      await expect(chartDataService.getChartData(undefined, 7)).rejects.toThrow(
        "No wallet address provided and WALLET_ADDRESS environment variable is not set",
      );
    });

    it("should calculate date ranges correctly", async () => {
      const mockDate = new Date("2023-10-05T12:00:00Z");
      vi.setSystemTime(mockDate);

      mockBalanceRecordService.getBalanceRecordsByDateRange.mockResolvedValue(
        [],
      );

      await chartDataService.getChartData("0xtest", 3);

      expect(
        mockBalanceRecordService.getBalanceRecordsByDateRange,
      ).toHaveBeenCalledWith(
        "0xtest",
        "2023-10-03", // 3 days back from Oct 5
        "2023-10-05", // Today
      );

      vi.useRealTimers();
    });

    it("should filter out datasets with all zero values", async () => {
      const mockRecords = [
        {
          date: "2023-10-01",
          balance_type: BalanceType.TOTAL,
          currency: "USD",
          amount: 100000,
        },
        {
          date: "2023-10-01",
          balance_type: BalanceType.AUTO_USD,
          currency: "USD",
          amount: 0, // This should be filtered out
        },
      ];

      mockBalanceRecordService.getBalanceRecordsByDateRange.mockResolvedValue(
        mockRecords,
      );

      const result = await chartDataService.getChartData("0xtest", 1);

      // Should only have Total USD dataset, not Auto USD
      expect(result.datasets).toHaveLength(1);
      expect(result.datasets[0].label).toBe("Total USD");
    });

    it("should aggregate ETH values correctly", async () => {
      const mockRecords = [
        {
          date: "2023-10-01",
          balance_type: BalanceType.AUTO_ETH,
          currency: "ETH",
          amount: 10.5,
        },
        {
          date: "2023-10-01",
          balance_type: BalanceType.DINERO_ETH,
          currency: "ETH",
          amount: 5.25,
        },
      ];

      mockBalanceRecordService.getBalanceRecordsByDateRange.mockResolvedValue(
        mockRecords,
      );

      const result = await chartDataService.getChartData("0xtest", 1);

      const autoEthDataset = result.datasets.find(
        (d) => d.label === "Auto ETH",
      );
      const dineroEthDataset = result.datasets.find(
        (d) => d.label === "Dinero ETH",
      );

      expect(autoEthDataset?.data[0]).toBe(10.5);
      expect(dineroEthDataset?.data[0]).toBe(5.25);
    });

    it("should aggregate rewards correctly", async () => {
      const mockRecords = [
        {
          date: "2023-10-01",
          balance_type: BalanceType.FLEX_REWARDS,
          currency: "USD",
          amount: 100,
        },
        {
          date: "2023-10-01",
          balance_type: BalanceType.TOKEMAK_REWARDS,
          currency: "USD",
          amount: 200,
        },
        {
          date: "2023-10-01",
          balance_type: BalanceType.BASE_TOKEMAK_REWARDS,
          currency: "USD",
          amount: 150,
        },
      ];

      mockBalanceRecordService.getBalanceRecordsByDateRange.mockResolvedValue(
        mockRecords,
      );

      const result = await chartDataService.getChartData("0xtest", 1);

      const rewardsDataset = result.datasets.find(
        (d) => d.label === "Total Rewards",
      );
      expect(rewardsDataset).toBeDefined();
      expect(rewardsDataset?.data[0]).toBe(450); // 100 + 200 + 150
    });
  });

  describe("close", () => {
    it("should close the balance record service", async () => {
      await chartDataService.close();

      expect(mockBalanceRecordService.close).toHaveBeenCalled();
    });
  });
});

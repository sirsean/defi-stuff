import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { BalanceService } from "../../../src/api/debank/balanceService.js";
import { DebankClient } from "../../../src/api/debank/debankClient.js";
import { mockUserTotalBalanceResponse } from "../../utils/testData.js";

// Mock the DebankClient class
vi.mock("../../../src/api/debank/debankClient.js", () => {
  return {
    DebankClient: vi.fn().mockImplementation(() => {
      return {
        getUserTotalBalance: vi.fn(),
      };
    }),
  };
});

describe("BalanceService", () => {
  let balanceService: BalanceService;
  let mockClient: DebankClient;
  const userAddress = "0x1234567890abcdef1234567890abcdef12345678";
  const defaultWalletAddress = "0xdefault1234567890abcdef1234567890abcdef";

  beforeEach(() => {
    // Mock environment variables
    process.env.WALLET_ADDRESS = defaultWalletAddress;

    vi.clearAllMocks();
    mockClient = new DebankClient();
    balanceService = new BalanceService();
  });

  afterEach(() => {
    // Clean up environment variables
    delete process.env.WALLET_ADDRESS;
  });

  describe("getUserTotalBalance", () => {
    it("should return user balance data from the client", async () => {
      // Arrange: Set up the mock to return the test data
      (mockClient.getUserTotalBalance as any).mockResolvedValue(
        mockUserTotalBalanceResponse,
      );
      (balanceService as any).debankClient = mockClient;

      // Act: Call the method being tested
      const result = await balanceService.getUserTotalBalance(userAddress);

      // Assert: Verify the result matches the mock data
      expect(result).toEqual(mockUserTotalBalanceResponse);
      expect(mockClient.getUserTotalBalance).toHaveBeenCalledWith(userAddress);
    });
  });

  describe("getUserBalanceWithThreshold", () => {
    it("should filter chains by the default threshold (1000)", async () => {
      // Arrange: Set up the mock to return the test data
      (mockClient.getUserTotalBalance as any).mockResolvedValue(
        mockUserTotalBalanceResponse,
      );
      (balanceService as any).debankClient = mockClient;

      // Act: Call the method with default threshold
      const result =
        await balanceService.getUserBalanceWithThreshold(userAddress);

      // Assert: Verify only chains with at least 1000 USD are included
      expect(result.total_usd_value).toEqual(
        mockUserTotalBalanceResponse.total_usd_value,
      );
      expect(result.chain_list.length).toBe(4); // BNB Chain should be filtered out (877.32 < 1000)
      expect(result.chain_list.map((chain) => chain.id)).not.toContain("bsc");
    });

    it("should filter chains by a custom threshold", async () => {
      // Arrange: Set up the mock to return the test data
      (mockClient.getUserTotalBalance as any).mockResolvedValue(
        mockUserTotalBalanceResponse,
      );
      (balanceService as any).debankClient = mockClient;

      // Act: Call the method with custom threshold (40000)
      const result = await balanceService.getUserBalanceWithThreshold(
        userAddress,
        40000,
      );

      // Assert: Verify only chains with at least 40000 USD are included
      expect(result.total_usd_value).toEqual(
        mockUserTotalBalanceResponse.total_usd_value,
      );
      expect(result.chain_list.length).toBe(3); // ETH, Base, and Arbitrum
      expect(result.chain_list.map((chain) => chain.id)).toEqual([
        "eth",
        "base",
        "arbitrum",
      ]);
    });

    it("should sort chains by USD value in descending order", async () => {
      // Arrange: Set up the mock to return the test data
      (mockClient.getUserTotalBalance as any).mockResolvedValue(
        mockUserTotalBalanceResponse,
      );
      (balanceService as any).debankClient = mockClient;

      // Act: Call the method
      const result =
        await balanceService.getUserBalanceWithThreshold(userAddress);

      // Assert: Verify chains are sorted by USD value in descending order
      expect(result.chain_list.map((chain) => chain.id)).toEqual([
        "eth",
        "base",
        "arbitrum",
        "polygon",
      ]);
      expect(result.chain_list[0].usd_value).toBeGreaterThan(
        result.chain_list[1].usd_value,
      );
      expect(result.chain_list[1].usd_value).toBeGreaterThan(
        result.chain_list[2].usd_value,
      );
      expect(result.chain_list[2].usd_value).toBeGreaterThan(
        result.chain_list[3].usd_value,
      );
    });
  });
});

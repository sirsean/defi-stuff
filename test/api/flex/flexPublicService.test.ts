/**
 * Tests for FlexPublicService
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { ethers } from "ethers";
import { FlexPublicService } from "../../../src/api/flex/flexPublicService.js";
import { MARKETS } from "../../../src/api/flex/constants.js";
import * as chainlink from "../../../src/api/chainlink/chainlinkOracle.js";

// Mock chainlink oracle
vi.mock("../../../src/api/chainlink/chainlinkOracle.js", () => ({
  chainlinkOracle: {
    getBtcUsd: vi.fn(),
    getEthUsd: vi.fn(),
  },
}));

describe("FlexPublicService", () => {
  let service: FlexPublicService;
  let mockProvider: any;

  beforeEach(() => {
    // Create mock provider
    mockProvider = {
      send: vi.fn().mockResolvedValue("0x2105"), // 0x2105 = 8453 in hex
    };

    // Create service with mock provider
    service = new FlexPublicService(mockProvider);
  });

  describe("Construction", () => {
    it("should create service with provided provider", () => {
      expect(service).toBeInstanceOf(FlexPublicService);
    });

    it("should create service with default provider if none provided", () => {
      const defaultService = new FlexPublicService();
      expect(defaultService).toBeInstanceOf(FlexPublicService);
    });
  });

  describe("Network Validation", () => {
    it("should validate Base network (8453)", async () => {
      await expect(service.validateNetwork()).resolves.not.toThrow();
      expect(mockProvider.send).toHaveBeenCalled();
    });

    it("should reject wrong network", async () => {
      mockProvider.send = vi.fn().mockResolvedValue("0x1"); // Ethereum chainId 1
      await expect(service.validateNetwork()).rejects.toThrow("Wrong network");
    });
  });

  describe("Market Data Queries", () => {
    describe("getMarketPrice", () => {
      it("should fetch BTC market price", async () => {
        const btcMarketIndex = 1;
        const mockPrice = 64000;

        // Mock chainlink oracle
        vi.mocked(chainlink.chainlinkOracle.getBtcUsd).mockResolvedValue(
          mockPrice,
        );

        const result = await service.getMarketPrice(btcMarketIndex);

        expect(result.marketIndex).toBe(btcMarketIndex);
        expect(result.symbol).toBe("BTC");
        expect(result.price).toBe(mockPrice);
        expect(result.oracleType).toBe("chainlink");
        expect(chainlink.chainlinkOracle.getBtcUsd).toHaveBeenCalled();
      });

      it("should fetch ETH market price", async () => {
        const ethMarketIndex = 0;
        const mockPrice = 3200;

        // Mock chainlink oracle
        vi.mocked(chainlink.chainlinkOracle.getEthUsd).mockResolvedValue(
          mockPrice,
        );

        const result = await service.getMarketPrice(ethMarketIndex);

        expect(result.marketIndex).toBe(ethMarketIndex);
        expect(result.symbol).toBe("ETH");
        expect(result.price).toBe(mockPrice);
        expect(chainlink.chainlinkOracle.getEthUsd).toHaveBeenCalled();
      });

      it("should throw error for invalid market index", async () => {
        await expect(service.getMarketPrice(999)).rejects.toThrow(
          "Market index 999 not found",
        );
      });

      it("should handle price with decimals", async () => {
        const btcMarketIndex = 1;
        const mockPrice = 64123.45;

        // Mock chainlink oracle
        vi.mocked(chainlink.chainlinkOracle.getBtcUsd).mockResolvedValue(
          mockPrice,
        );

        const result = await service.getMarketPrice(btcMarketIndex);

        expect(result.price).toBeCloseTo(mockPrice, 2);
      });
    });

    describe("getMarketInfo", () => {
      it("should fetch market configuration", async () => {
        const btcMarketIndex = 1;
        const mockConfig = {
          initialMarginFractionBPS: 200, // 200 BPS = 2% = 50x leverage
          fundingRate: {
            maxSkewScaleUSD: 3000000000n * 10n ** 30n,
            maxFundingRate: 8n * 10n ** 18n, // 8 in e18 = 8%
          },
        };

        const mockConfigStorage = (service as any).configStorage;
        mockConfigStorage.getMarketConfigByIndex = vi
          .fn()
          .mockResolvedValue(mockConfig);

        const result = await service.getMarketInfo(btcMarketIndex);

        expect(result.marketIndex).toBe(btcMarketIndex);
        expect(result.symbol).toBe("BTC");
        expect(result.maxLeverage).toBe(50); // 10000 / 200
        expect(result.maxFundingRate).toBe(8); // Already in percentage form
      });

      it("should throw error for invalid market", async () => {
        await expect(service.getMarketInfo(999)).rejects.toThrow(
          "Market index 999 not found",
        );
      });
    });

    describe("getFundingRate", () => {
      it("should fetch current funding rate", async () => {
        const btcMarketIndex = 1;
        const mockMarketState = {
          currentFundingRate: 1n * 10n ** 15n, // e18 format: 0.001 in decimal = 1e15
          fundingAccrued: 5n * 10n ** 15n, // e18 format
          lastFundingTime: BigInt(Math.floor(Date.now() / 1000)),
          longPositionSize: 1000000n * 10n ** 30n, // e30 format
          shortPositionSize: 950000n * 10n ** 30n, // e30 format
        };

        const mockPerpStorage = (service as any).perpStorage;
        mockPerpStorage.getGlobalState = vi.fn().mockResolvedValue({});
        mockPerpStorage.getMarketByIndex = vi
          .fn()
          .mockResolvedValue(mockMarketState);

        const result = await service.getFundingRate(btcMarketIndex);

        expect(result.marketIndex).toBe(btcMarketIndex);
        expect(result.symbol).toBe("BTC");
        expect(result.currentFundingRate).toBeCloseTo(0.001, 6);
        expect(result.longPositionSize).toBe(1000000);
        expect(result.shortPositionSize).toBe(950000);
      });

      it("should handle negative funding rate", async () => {
        const mockMarketState = {
          currentFundingRate: -2n * 10n ** 15n, // e18 format: -0.002 in decimal
          fundingAccrued: 3n * 10n ** 15n, // e18 format
          lastFundingTime: BigInt(Math.floor(Date.now() / 1000)),
          longPositionSize: 800000n * 10n ** 30n, // e30 format
          shortPositionSize: 900000n * 10n ** 30n, // e30 format
        };

        const mockPerpStorage = (service as any).perpStorage;
        mockPerpStorage.getGlobalState = vi.fn().mockResolvedValue({});
        mockPerpStorage.getMarketByIndex = vi
          .fn()
          .mockResolvedValue(mockMarketState);

        const result = await service.getFundingRate(1);

        expect(result.currentFundingRate).toBeCloseTo(-0.002, 6);
      });
    });
  });

  describe("Position Queries", () => {
    const testAccount = "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045";
    const testSubAccountId = 0;

    describe("getPosition", () => {
      it("should return null for non-existent position", async () => {
        // Mock returns array with zero-size position
        const mockPositionData = [
          {
            marketIndex: 1,
            positionSizeE30: 0n,
            avgEntryPriceE30: 0n,
            reserveValueE30: 0n,
            lastFundingAccrued: 0n,
            entryBorrowingRate: 0n,
          },
        ];

        const mockPerpStorage = (service as any).perpStorage;
        mockPerpStorage.getPositionBySubAccount = vi
          .fn()
          .mockResolvedValue(mockPositionData);

        const result = await service.getPosition(testAccount, 1);

        expect(result).toBeNull();
      });

      it("should fetch long BTC position with PnL", async () => {
        // Mock returns array of positions
        const mockPositionData = [
          {
            marketIndex: 1,
            positionSizeE30: 1000n * 10n ** 30n, // $1,000 long
            avgEntryPriceE30: 60000n * 10n ** 30n, // Entry at $60,000
            reserveValueE30: 100n * 10n ** 30n,
            lastFundingAccrued: 1000n * 10n ** 30n,
            entryBorrowingRate: 5n * 10n ** 27n,
          },
        ];

        const mockMarketState = {
          fundingAccrued: 1100n * 10n ** 30n,
          borrowingAccrued: 7n * 10n ** 27n,
          6: 7n * 10n ** 27n,
        };

        const mockPerpStorage = (service as any).perpStorage;
        mockPerpStorage.getPositionBySubAccount = vi
          .fn()
          .mockResolvedValue(mockPositionData);
        mockPerpStorage.getMarketByIndex = vi
          .fn()
          .mockResolvedValue(mockMarketState);

        // Mock chainlink oracle for price fetch
        vi.mocked(chainlink.chainlinkOracle.getBtcUsd).mockResolvedValue(64000);

        const result = await service.getPosition(testAccount, 1);

        expect(result).not.toBeNull();
        expect(result!.isLong).toBe(true);
        expect(result!.size).toBe(1000);
        expect(result!.avgEntryPrice).toBe(60000);
        expect(result!.currentPrice).toBe(64000);
        // Price went up $4000, so PnL should be positive
        // PnL = size * (currentPrice - entryPrice) / entryPrice
        // For $1000 position: (64000 - 60000) / 60000 * 1000 = ~$66.67
        expect(result!.unrealizedPnl).toBeGreaterThan(0);
      });

      it("should fetch short BTC position with negative PnL", async () => {
        const mockPositionData = [
          {
            marketIndex: 1,
            positionSizeE30: -1000n * 10n ** 30n, // $1,000 short
            avgEntryPriceE30: 60000n * 10n ** 30n,
            reserveValueE30: 100n * 10n ** 30n,
            lastFundingAccrued: 1000n * 10n ** 30n,
            entryBorrowingRate: 5n * 10n ** 27n,
          },
        ];

        const mockMarketState = {
          fundingAccrued: 1100n * 10n ** 30n,
          borrowingAccrued: 7n * 10n ** 27n, // Changed from borrowingRate
          6: 7n * 10n ** 27n, // Array index fallback
        };

        const mockPerpStorage = (service as any).perpStorage;
        mockPerpStorage.getPositionBySubAccount = vi
          .fn()
          .mockResolvedValue(mockPositionData);
        mockPerpStorage.getMarketByIndex = vi
          .fn()
          .mockResolvedValue(mockMarketState);

        // Mock chainlink oracle for price fetch
        vi.mocked(chainlink.chainlinkOracle.getBtcUsd).mockResolvedValue(64000);

        const result = await service.getPosition(testAccount, 1);

        expect(result).not.toBeNull();
        expect(result!.isLong).toBe(false);
        expect(result!.size).toBe(1000);
        // Short position lost money as price went up
        expect(result!.unrealizedPnl).toBeLessThan(0);
      });

      it("should calculate funding and borrowing fees", async () => {
        const mockPositionData = [
          {
            marketIndex: 1,
            positionSizeE30: 1000n * 10n ** 30n,
            avgEntryPriceE30: 60000n * 10n ** 30n,
            reserveValueE30: 100n * 10n ** 30n,
            lastFundingAccrued: 1000n * 10n ** 30n,
            entryBorrowingRate: 5n * 10n ** 27n,
          },
        ];

        const mockMarketState = {
          fundingAccrued: 1100n * 10n ** 30n, // Increased by 100
          borrowingAccrued: 7n * 10n ** 27n, // Increased by 0.002 (changed from borrowingRate)
          6: 7n * 10n ** 27n, // Array index fallback
        };

        const mockPerpStorage = (service as any).perpStorage;
        mockPerpStorage.getPositionBySubAccount = vi
          .fn()
          .mockResolvedValue(mockPositionData);
        mockPerpStorage.getMarketByIndex = vi
          .fn()
          .mockResolvedValue(mockMarketState);

        // Mock chainlink oracle for price fetch
        vi.mocked(chainlink.chainlinkOracle.getBtcUsd).mockResolvedValue(64000);

        const result = await service.getPosition(testAccount, 1);

        expect(result).not.toBeNull();
        expect(result!.fundingFee).toBeGreaterThan(0);
        expect(result!.borrowingFee).toBeGreaterThan(0);
      });
    });

    describe("getAllPositions", () => {
      it("should fetch all positions for an account", async () => {
        // Mock returns array with one BTC position
        const mockPositions = [
          {
            marketIndex: 1,
            positionSizeE30: 1000n * 10n ** 30n,
            avgEntryPriceE30: 60000n * 10n ** 30n,
            reserveValueE30: 100n * 10n ** 30n,
            lastFundingAccrued: 1000n * 10n ** 30n,
            entryBorrowingRate: 5n * 10n ** 27n,
          },
        ];

        const mockPerpStorage = (service as any).perpStorage;
        mockPerpStorage.getPositionBySubAccount = vi
          .fn()
          .mockResolvedValue(mockPositions);

        mockPerpStorage.getMarketByIndex = vi.fn().mockResolvedValue({
          fundingAccrued: 1100n * 10n ** 30n,
          borrowingAccrued: 7n * 10n ** 27n,
          6: 7n * 10n ** 27n,
        });

        // Mock chainlink oracle for price fetch
        vi.mocked(chainlink.chainlinkOracle.getBtcUsd).mockResolvedValue(64000);

        const result = await service.getAllPositions(testAccount);

        // Should only return the one BTC position
        expect(result).toHaveLength(1);
        expect(result[0].marketIndex).toBe(1);
        expect(result[0].symbol).toBe("BTC");
      });

      it("should return empty array when no positions exist", async () => {
        const mockPerpStorage = (service as any).perpStorage;
        mockPerpStorage.getPositionBySubAccount = vi
          .fn()
          .mockResolvedValue([]);

        const result = await service.getAllPositions(testAccount);

        expect(result).toHaveLength(0);
      });
    });
  });

  describe("Collateral & Equity Queries", () => {
    const testAccount = "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045";
    const testSubAccountId = 0;

    describe("getCollateral", () => {
      it("should fetch USDC collateral balance", async () => {
        // USDC has 6 decimals, not E30
        const mockBalance = 10000n * 10n ** 6n; // $10,000 in USDC's 6 decimals

        const mockVaultStorage = (service as any).vaultStorage;
        mockVaultStorage.traderBalances = vi
          .fn()
          .mockResolvedValue(mockBalance);

        const result = await service.getCollateral(testAccount);

        expect(result.token).toBe("USDC");
        expect(result.balance).toBe(10000);
        expect(result.balanceRaw).toBe(mockBalance);
        expect(mockVaultStorage.traderBalances).toHaveBeenCalledWith(
          testAccount,
          expect.any(String), // USDC token address
        );
      });

      it("should handle zero balance", async () => {
        const mockVaultStorage = (service as any).vaultStorage;
        mockVaultStorage.traderBalances = vi.fn().mockResolvedValue(0n);

        const result = await service.getCollateral(testAccount);

        expect(result.balance).toBe(0);
        expect(result.balanceRaw).toBe(0n);
      });
    });

    describe("getEquity", () => {
      it("should calculate equity with no positions", async () => {
        // USDC has 6 decimals
        const mockBalance = 10000n * 10n ** 6n; // $10,000 in USDC's 6 decimals

        const mockVaultStorage = (service as any).vaultStorage;
        mockVaultStorage.traderBalances = vi
          .fn()
          .mockResolvedValue(mockBalance);

        const mockPerpStorage = (service as any).perpStorage;
        mockPerpStorage.getPositionBySubAccount = vi.fn().mockResolvedValue([]);

        const result = await service.getEquity(testAccount);

        expect(result.collateral).toBe(10000);
        expect(result.unrealizedPnl).toBe(0);
        expect(result.fees).toBe(0);
        expect(result.equity).toBe(10000);
        expect(result.positions).toHaveLength(0);
      });

      it("should calculate equity with profitable position", async () => {
        // USDC has 6 decimals
        const mockBalance = 10000n * 10n ** 6n; // $10,000 in USDC's 6 decimals

        const mockVaultStorage = (service as any).vaultStorage;
        mockVaultStorage.traderBalances = vi
          .fn()
          .mockResolvedValue(mockBalance);

        // Mock one profitable BTC position
        const mockPositions = [
          {
            marketIndex: 1,
            positionSizeE30: 1000n * 10n ** 30n,
            avgEntryPriceE30: 60000n * 10n ** 30n,
            reserveValueE30: 100n * 10n ** 30n,
            lastFundingAccrued: 1000n, // Tiny value for negligible fee  
            entryBorrowingRate: 5n, // Tiny value for negligible fee
          },
        ];

        const mockPerpStorage = (service as any).perpStorage;
        mockPerpStorage.getPositionBySubAccount = vi
          .fn()
          .mockResolvedValue(mockPositions);

        mockPerpStorage.getMarketByIndex = vi.fn().mockResolvedValue({
          fundingAccrued: 1050n, // Tiny value for negligible fee
          borrowingAccrued: 6n, // Tiny value for negligible fee
          6: 6n,
        });

        // Mock chainlink oracle for price fetch
        vi.mocked(chainlink.chainlinkOracle.getBtcUsd).mockResolvedValue(65000);

        const result = await service.getEquity(testAccount);

        expect(result.collateral).toBe(10000);
        expect(result.unrealizedPnl).toBeGreaterThan(0); // Profitable
        // With new PnL formula: size * (priceDiff / entryPrice)
        // $1000 * ($65000-$60000)/$60000 = $1000 * 0.0833 = ~$83
        expect(result.unrealizedPnl).toBeCloseTo(83, 0);
        expect(result.equity).toBeGreaterThan(10000); // Collateral + profit - fees
        expect(result.positions).toHaveLength(1);
      });
    });

    describe("getLeverage", () => {
      it("should calculate 1x leverage with equal position and equity", async () => {
        // USDC has 6 decimals
        const mockBalance = 10000n * 10n ** 6n; // $10,000 in USDC's 6 decimals

        const mockVaultStorage = (service as any).vaultStorage;
        mockVaultStorage.traderBalances = vi
          .fn()
          .mockResolvedValue(mockBalance);

        // $10,000 position at $60,000 BTC
        const mockPositions = [
          {
            marketIndex: 1,
            positionSizeE30: 10000n * 10n ** 30n,
            avgEntryPriceE30: 60000n * 10n ** 30n,
            reserveValueE30: 100n * 10n ** 30n,
            lastFundingAccrued: 1000n * 10n ** 30n,
            entryBorrowingRate: 5n * 10n ** 27n,
          },
        ];

        const mockPerpStorage = (service as any).perpStorage;
        mockPerpStorage.getPositionBySubAccount = vi
          .fn()
          .mockResolvedValue(mockPositions);

        mockPerpStorage.getMarketByIndex = vi.fn().mockResolvedValue({
          fundingAccrued: 1000n * 10n ** 30n,
          borrowingAccrued: 5n * 10n ** 27n,
          6: 5n * 10n ** 27n,
        });

        // Mock chainlink oracle for price fetch
        vi.mocked(chainlink.chainlinkOracle.getBtcUsd).mockResolvedValue(60000);

        const result = await service.getLeverage(testAccount);

        expect(result.equity).toBeCloseTo(10000, 0);
        expect(result.totalPositionSize).toBeCloseTo(10000, 0);
        expect(result.leverage).toBeCloseTo(1, 1);
      });

      it("should calculate 3x leverage", async () => {
        // USDC has 6 decimals
        const mockBalance = 10000n * 10n ** 6n; // $10,000 in USDC's 6 decimals

        const mockVaultStorage = (service as any).vaultStorage;
        mockVaultStorage.traderBalances = vi
          .fn()
          .mockResolvedValue(mockBalance);

        // $30,000 position with $10,000 collateral = 3x leverage
        const mockPositions = [
          {
            marketIndex: 1,
            positionSizeE30: 30000n * 10n ** 30n,
            avgEntryPriceE30: 60000n * 10n ** 30n,
            reserveValueE30: 100n * 10n ** 30n,
            lastFundingAccrued: 1000n * 10n ** 30n,
            entryBorrowingRate: 5n * 10n ** 27n,
          },
        ];

        const mockPerpStorage = (service as any).perpStorage;
        mockPerpStorage.getPositionBySubAccount = vi
          .fn()
          .mockResolvedValue(mockPositions);

        mockPerpStorage.getMarketByIndex = vi.fn().mockResolvedValue({
          fundingAccrued: 1000n * 10n ** 30n,
          borrowingAccrued: 5n * 10n ** 27n,
          6: 5n * 10n ** 27n,
        });

        // Mock chainlink oracle for price fetch
        vi.mocked(chainlink.chainlinkOracle.getBtcUsd).mockResolvedValue(60000);

        const result = await service.getLeverage(testAccount);

        expect(result.leverage).toBeCloseTo(3, 1);
      });
    });

    describe("getAvailableMargin", () => {
      it("should calculate available margin for 1x leverage", async () => {
        // USDC has 6 decimals
        const mockBalance = 10000n * 10n ** 6n; // $10,000 in USDC's 6 decimals

        const mockVaultStorage = (service as any).vaultStorage;
        mockVaultStorage.traderBalances = vi
          .fn()
          .mockResolvedValue(mockBalance);

        const mockPerpStorage = (service as any).perpStorage;
        mockPerpStorage.getPositionBySubAccount = vi.fn().mockResolvedValue([]);

        const result = await service.getAvailableMargin(testAccount, 1);

        // With $10,000 equity and no positions, available = $10,000 at 1x
        expect(result).toBe(10000);
      });

      it("should calculate available margin for 5x leverage", async () => {
        // USDC has 6 decimals
        const mockBalance = 10000n * 10n ** 6n; // $10,000 in USDC's 6 decimals

        const mockVaultStorage = (service as any).vaultStorage;
        mockVaultStorage.traderBalances = vi
          .fn()
          .mockResolvedValue(mockBalance);

        // Already using $10,000 at current price
        const mockPositions = [
          {
            marketIndex: 1,
            positionSizeE30: 10000n * 10n ** 30n,
            avgEntryPriceE30: 60000n * 10n ** 30n,
            reserveValueE30: 100n * 10n ** 30n,
            lastFundingAccrued: 1000n * 10n ** 30n,
            entryBorrowingRate: 5n * 10n ** 27n,
          },
        ];

        const mockPerpStorage = (service as any).perpStorage;
        mockPerpStorage.getPositionBySubAccount = vi
          .fn()
          .mockResolvedValue(mockPositions);

        mockPerpStorage.getMarketByIndex = vi.fn().mockResolvedValue({
          fundingAccrued: 1000n * 10n ** 30n,
          borrowingAccrued: 5n * 10n ** 27n,
          6: 5n * 10n ** 27n,
        });

        // Mock chainlink oracle for price fetch
        vi.mocked(chainlink.chainlinkOracle.getBtcUsd).mockResolvedValue(60000);

        const result = await service.getAvailableMargin(testAccount, 5);

        // $10,000 equity * 5x = $50,000 capacity
        // Already using $10,000, so $40,000 available
        expect(result).toBeCloseTo(40000, 0);
      });

      it("should return 0 when over-leveraged", async () => {
        // USDC has 6 decimals
        const mockBalance = 10000n * 10n ** 6n; // $10,000 in USDC's 6 decimals

        const mockVaultStorage = (service as any).vaultStorage;
        mockVaultStorage.traderBalances = vi
          .fn()
          .mockResolvedValue(mockBalance);

        // Using $40,000 position with $10,000 equity = 4x leverage
        const mockPositions = [
          {
            marketIndex: 1,
            positionSizeE30: 40000n * 10n ** 30n,
            avgEntryPriceE30: 60000n * 10n ** 30n,
            reserveValueE30: 100n * 10n ** 30n,
            lastFundingAccrued: 1000n * 10n ** 30n,
            entryBorrowingRate: 5n * 10n ** 27n,
          },
        ];

        const mockPerpStorage = (service as any).perpStorage;
        mockPerpStorage.getPositionBySubAccount = vi
          .fn()
          .mockResolvedValue(mockPositions);

        mockPerpStorage.getMarketByIndex = vi.fn().mockResolvedValue({
          fundingAccrued: 1000n * 10n ** 30n,
          borrowingAccrued: 5n * 10n ** 27n,
          6: 5n * 10n ** 27n,
        });

        // Mock chainlink oracle for price fetch
        vi.mocked(chainlink.chainlinkOracle.getBtcUsd).mockResolvedValue(60000);

        const result = await service.getAvailableMargin(
          testAccount,
          3, // Target 3x but already at 4x
        );

        // Already over target leverage, so no available margin
        expect(result).toBe(0);
      });
    });
  });

  describe("Pending Orders", () => {
    const testAccount = "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045";
    const testSubAccountId = 0;

    it("should fetch pending orders", async () => {
      const mockOrders = [
        { orderId: 1n, marketIndex: 1, size: 1000n },
        { orderId: 2n, marketIndex: 0, size: 500n },
      ];

      const mockLimitTradeHandler = (service as any).limitTradeHandler;
      mockLimitTradeHandler.getLimitOrders = vi
        .fn()
        .mockResolvedValue(mockOrders);

      const result = await service.getPendingOrders(testAccount);

      expect(result).toHaveLength(2);
      expect(result[0].orderId).toBe(1n);
    });

    it("should return empty array if method not available", async () => {
      const mockLimitTradeHandler = (service as any).limitTradeHandler;
      mockLimitTradeHandler.getLimitOrders = vi
        .fn()
        .mockRejectedValue(new Error("Method not found"));

      const result = await service.getPendingOrders(testAccount);

      expect(result).toHaveLength(0);
    });
  });
});

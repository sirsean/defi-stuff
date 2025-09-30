import { describe, it, expect, beforeEach, vi } from "vitest";
import { ethers } from "ethers";
import {
  getProvider,
  getSigner,
  assertBaseNetwork,
  toE30,
  fromE30,
  toToken,
  fromToken,
  computeSubAccount,
  validateSubAccountId,
  parseRevertError,
  isUserRejection,
  calculatePnL,
  calculateFundingFee,
  calculateBorrowingFee,
  calculatePriceImpact,
  calculateLeverage,
  calculateLiquidationPrice,
  formatUsd,
  formatPercent,
  bpsToPercent,
  shortenAddress,
  chunk,
} from "../../../src/api/flex/utils.js";
import { BASE_CHAIN_ID } from "../../../src/api/flex/constants.js";

describe("Flex Utils - Provider & Signer", () => {
  beforeEach(() => {
    // Clear environment variables
    delete process.env.FLEX_RPC_URL;
    delete process.env.MAIN_PRIVATE_KEY;
  });

  describe("getProvider", () => {
    it("should create provider with default RPC URL", () => {
      const provider = getProvider();
      expect(provider).toBeInstanceOf(ethers.JsonRpcProvider);
    });

    it("should use FLEX_RPC_URL from environment", () => {
      const customRpc = "https://custom.rpc.url";
      process.env.FLEX_RPC_URL = customRpc;
      
      const provider = getProvider();
      expect(provider).toBeInstanceOf(ethers.JsonRpcProvider);
    });
  });

  describe("getSigner", () => {
    it("should throw error if MAIN_PRIVATE_KEY is not set", () => {
      expect(() => getSigner()).toThrow(
        "MAIN_PRIVATE_KEY environment variable is required"
      );
    });

    it("should create wallet from MAIN_PRIVATE_KEY", () => {
      // Generate a random private key for testing
      const wallet = ethers.Wallet.createRandom();
      process.env.MAIN_PRIVATE_KEY = wallet.privateKey;

      const signer = getSigner();
      expect(signer).toBeInstanceOf(ethers.Wallet);
      expect(signer.address).toBe(wallet.address);
    });

    it("should connect wallet to provider when provided", () => {
      const wallet = ethers.Wallet.createRandom();
      process.env.MAIN_PRIVATE_KEY = wallet.privateKey;
      const provider = getProvider();

      const signer = getSigner(provider);
      expect(signer).toBeInstanceOf(ethers.Wallet);
      expect(signer.provider).toBe(provider);
    });
  });

  describe("assertBaseNetwork", () => {
    it("should not throw for Base mainnet (8453)", async () => {
      const mockProvider = {
        send: vi.fn().mockResolvedValue("0x2105"), // 0x2105 = 8453 in hex
      } as any;

      await expect(assertBaseNetwork(mockProvider)).resolves.not.toThrow();
    });

    it("should throw for wrong network", async () => {
      const mockProvider = {
        send: vi.fn().mockResolvedValue("0x1"), // 0x1 = Ethereum mainnet
      } as any;

      await expect(assertBaseNetwork(mockProvider)).rejects.toThrow(
        "Wrong network: expected Base (8453), got 1"
      );
    });
  });
});

describe("Flex Utils - Unit Conversions", () => {
  describe("toE30 / fromE30", () => {
    it("should convert integer to e30", () => {
      expect(toE30(100)).toBe(100n * 10n ** 30n);
      expect(toE30(1)).toBe(10n ** 30n);
      expect(toE30(0)).toBe(0n);
    });

    it("should convert decimal to e30", () => {
      expect(toE30(1.5)).toBe(1500000000000000000000000000000n);
      expect(toE30(0.1)).toBe(100000000000000000000000000000n);
    });

    it("should convert string to e30", () => {
      expect(toE30("100")).toBe(100n * 10n ** 30n);
      expect(toE30("1.5")).toBe(1500000000000000000000000000000n);
    });

    it("should handle small decimals", () => {
      const value = 0.000001;
      const e30Value = toE30(value);
      expect(e30Value).toBe(1000000000000000000000000n);
    });

    it("should round-trip correctly", () => {
      const testValues = [100, 1.5, 0.1, 0.000001, 12345.6789];
      
      for (const value of testValues) {
        const e30 = toE30(value);
        const back = fromE30(e30);
        expect(back).toBeCloseTo(value, 10);
      }
    });

    it("should throw on invalid input", () => {
      expect(() => toE30(NaN)).toThrow("Invalid number");
      expect(() => toE30(Infinity)).toThrow("Invalid number");
      expect(() => toE30("invalid")).toThrow("Invalid number");
    });

    it("should handle zero", () => {
      expect(toE30(0)).toBe(0n);
      expect(fromE30(0n)).toBe(0);
    });

    it("should handle negative numbers", () => {
      expect(toE30(-100)).toBe(-100n * 10n ** 30n);
      expect(fromE30(-100n * 10n ** 30n)).toBe(-100);
    });
  });

  describe("toToken / fromToken", () => {
    it("should convert to USDC units (6 decimals)", () => {
      expect(toToken(100, 6)).toBe(100_000000n);
      expect(toToken(1.5, 6)).toBe(1_500000n);
      expect(toToken(0.000001, 6)).toBe(1n);
    });

    it("should convert to ETH units (18 decimals)", () => {
      expect(toToken(1, 18)).toBe(10n ** 18n);
      expect(toToken(0.1, 18)).toBe(10n ** 17n);
    });

    it("should round-trip correctly", () => {
      const decimalsToTest = [6, 8, 18];
      const values = [100, 1.5, 0.1, 0.000001];

      for (const decimals of decimalsToTest) {
        for (const value of values) {
          const tokenValue = toToken(value, decimals);
          const back = fromToken(tokenValue, decimals);
          expect(back).toBeCloseTo(value, decimals);
        }
      }
    });

    it("should throw on invalid decimals", () => {
      expect(() => toToken(100, -1)).toThrow("Invalid decimals");
      expect(() => toToken(100, 78)).toThrow("Invalid decimals");
      expect(() => fromToken(100n, -1)).toThrow("Invalid decimals");
    });

    it("should throw on invalid amount", () => {
      expect(() => toToken(NaN, 6)).toThrow("Invalid amount");
      expect(() => toToken(Infinity, 6)).toThrow("Invalid amount");
    });

    it("should handle zero", () => {
      expect(toToken(0, 6)).toBe(0n);
      expect(fromToken(0n, 6)).toBe(0);
    });
  });
});

describe("Flex Utils - Subaccount", () => {
  describe("computeSubAccount", () => {
    // Using Vitalik's address as a known valid checksummed address
    const testAddress = "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045";

    it("should compute subaccount address", () => {
      const subAccount = computeSubAccount(testAddress, 0);
      expect(subAccount).toMatch(/^0x[a-fA-F0-9]{64}$/);
    });

    it("should produce different addresses for different subaccount IDs", () => {
      const sub0 = computeSubAccount(testAddress, 0);
      const sub1 = computeSubAccount(testAddress, 1);
      const sub255 = computeSubAccount(testAddress, 255);

      expect(sub0).not.toBe(sub1);
      expect(sub1).not.toBe(sub255);
      expect(sub0).not.toBe(sub255);
    });

    it("should be deterministic", () => {
      const result1 = computeSubAccount(testAddress, 5);
      const result2 = computeSubAccount(testAddress, 5);
      expect(result1).toBe(result2);
    });

    it("should throw on invalid address", () => {
      expect(() => computeSubAccount("invalid", 0)).toThrow("Invalid account address");
      expect(() => computeSubAccount("0x123", 0)).toThrow("Invalid account address");
    });

    it("should throw on invalid subaccount ID", () => {
      expect(() => computeSubAccount(testAddress, -1)).toThrow("Invalid subAccountId");
      expect(() => computeSubAccount(testAddress, 256)).toThrow("Invalid subAccountId");
      expect(() => computeSubAccount(testAddress, 1.5)).toThrow("Invalid subAccountId");
    });

    it("should accept all valid subaccount IDs (0-255)", () => {
      expect(() => computeSubAccount(testAddress, 0)).not.toThrow();
      expect(() => computeSubAccount(testAddress, 128)).not.toThrow();
      expect(() => computeSubAccount(testAddress, 255)).not.toThrow();
    });
  });

  describe("validateSubAccountId", () => {
    it("should not throw for valid IDs", () => {
      expect(() => validateSubAccountId(0)).not.toThrow();
      expect(() => validateSubAccountId(128)).not.toThrow();
      expect(() => validateSubAccountId(255)).not.toThrow();
    });

    it("should throw for invalid IDs", () => {
      expect(() => validateSubAccountId(-1)).toThrow();
      expect(() => validateSubAccountId(256)).toThrow();
      expect(() => validateSubAccountId(1.5)).toThrow();
    });
  });
});

describe("Flex Utils - Error Handling", () => {
  describe("parseRevertError", () => {
    it("should extract reason from error.reason", () => {
      const error = { reason: "Insufficient balance" };
      expect(parseRevertError(error)).toBe("Insufficient balance");
    });

    it("should extract message from error.data.message", () => {
      const error = { data: { message: "Transaction failed" } };
      expect(parseRevertError(error)).toBe("Transaction failed");
    });

    it("should extract from error.error.message", () => {
      const error = { error: { message: "Revert occurred" } };
      expect(parseRevertError(error)).toBe("Revert occurred");
    });

    it("should parse revert reason from message string", () => {
      const error = {
        message: "execution reverted with reason string 'Custom revert'",
      };
      expect(parseRevertError(error)).toBe("Custom revert");
    });

    it("should detect common error patterns", () => {
      expect(parseRevertError({ message: "insufficient funds for transfer" }))
        .toContain("Insufficient funds");
      
      expect(parseRevertError({ message: "nonce too low" }))
        .toContain("nonce too low");
      
      expect(parseRevertError({ message: "gas required exceeds allowance" }))
        .toContain("Gas required exceeds");
    });

    it("should return generic message for unknown errors", () => {
      expect(parseRevertError({})).toBe("Unknown error occurred");
      expect(parseRevertError(null)).toBe("Unknown error occurred");
    });
  });

  describe("isUserRejection", () => {
    it("should detect user rejection", () => {
      expect(isUserRejection({ message: "User rejected transaction" })).toBe(true);
      expect(isUserRejection({ message: "User denied signature" })).toBe(true);
      expect(isUserRejection({ message: "Transaction cancelled" })).toBe(true);
    });

    it("should return false for other errors", () => {
      expect(isUserRejection({ message: "Insufficient balance" })).toBe(false);
      expect(isUserRejection({})).toBe(false);
    });

    it("should be case insensitive", () => {
      expect(isUserRejection({ message: "USER REJECTED" })).toBe(true);
    });
  });
});

describe("Flex Utils - Math Helpers", () => {
  describe("calculatePnL", () => {
    const size = 1000n * 10n ** 30n; // $1000
    const entryPrice = 50000n * 10n ** 30n; // $50,000
    const currentPrice = 55000n * 10n ** 30n; // $55,000

    it("should calculate profit for long position", () => {
      const pnl = calculatePnL(true, size, entryPrice, currentPrice);
      expect(pnl).toBeGreaterThan(0n);
    });

    it("should calculate loss for long position with price decrease", () => {
      const lowerPrice = 45000n * 10n ** 30n;
      const pnl = calculatePnL(true, size, entryPrice, lowerPrice);
      expect(pnl).toBeLessThan(0n);
    });

    it("should calculate profit for short position with price decrease", () => {
      const lowerPrice = 45000n * 10n ** 30n;
      const pnl = calculatePnL(false, size, entryPrice, lowerPrice);
      expect(pnl).toBeGreaterThan(0n);
    });

    it("should calculate loss for short position with price increase", () => {
      const pnl = calculatePnL(false, size, entryPrice, currentPrice);
      expect(pnl).toBeLessThan(0n);
    });

    it("should return zero for zero size", () => {
      expect(calculatePnL(true, 0n, entryPrice, currentPrice)).toBe(0n);
    });

    it("should return zero when prices are equal", () => {
      expect(calculatePnL(true, size, entryPrice, entryPrice)).toBe(0n);
      expect(calculatePnL(false, size, entryPrice, entryPrice)).toBe(0n);
    });
  });

  describe("calculateFundingFee", () => {
    it("should calculate positive funding fee", () => {
      const size = 1000n * 10n ** 30n;
      const current = 100n * 10n ** 18n;
      const last = 80n * 10n ** 18n;
      
      const fee = calculateFundingFee(size, current, last);
      expect(fee).toBeGreaterThan(0n);
    });

    it("should calculate negative funding fee", () => {
      const size = 1000n * 10n ** 30n;
      const current = 80n * 10n ** 18n;
      const last = 100n * 10n ** 18n;
      
      const fee = calculateFundingFee(size, current, last);
      expect(fee).toBeLessThan(0n);
    });

    it("should return zero for zero size", () => {
      expect(calculateFundingFee(0n, 100n, 80n)).toBe(0n);
    });

    it("should return zero when rates are equal", () => {
      const size = 1000n * 10n ** 30n;
      expect(calculateFundingFee(size, 100n, 100n)).toBe(0n);
    });
  });

  describe("calculateBorrowingFee", () => {
    it("should calculate borrowing fee", () => {
      const reserve = 1000n * 10n ** 30n;
      const current = 200n * 10n ** 18n;
      const entry = 150n * 10n ** 18n;
      
      const fee = calculateBorrowingFee(reserve, current, entry);
      expect(fee).toBeGreaterThan(0n);
    });

    it("should return zero for zero reserve", () => {
      expect(calculateBorrowingFee(0n, 200n, 150n)).toBe(0n);
    });

    it("should return zero when rates are equal", () => {
      const reserve = 1000n * 10n ** 30n;
      expect(calculateBorrowingFee(reserve, 100n, 100n)).toBe(0n);
    });
  });

  describe("calculatePriceImpact", () => {
    it("should calculate price impact", () => {
      const longSize = 1000000n * 10n ** 30n;
      const shortSize = 800000n * 10n ** 30n;
      const maxSkew = 500000n * 10n ** 30n;
      const delta = 100000n * 10n ** 30n;
      
      const impact = calculatePriceImpact(longSize, shortSize, maxSkew, delta);
      expect(impact).not.toBe(0n);
    });

    it("should return zero for zero max skew", () => {
      const impact = calculatePriceImpact(1000n, 800n, 0n, 100n);
      expect(impact).toBe(0n);
    });
  });

  describe("calculateLeverage", () => {
    it("should calculate leverage correctly", () => {
      expect(calculateLeverage(10000, 1000)).toBe(10);
      expect(calculateLeverage(5000, 2500)).toBe(2);
      expect(calculateLeverage(1000, 1000)).toBe(1);
    });

    it("should return zero for zero equity", () => {
      expect(calculateLeverage(10000, 0)).toBe(0);
    });

    it("should handle decimal results", () => {
      expect(calculateLeverage(3333, 1000)).toBeCloseTo(3.333, 2);
    });
  });

  describe("calculateLiquidationPrice", () => {
    const entryPrice = 50000;
    const leverage = 10;
    const maintenanceMargin = 0.05; // 5%

    it("should calculate liquidation price for long position", () => {
      const liqPrice = calculateLiquidationPrice(
        true,
        entryPrice,
        leverage,
        maintenanceMargin
      );
      expect(liqPrice).toBeLessThan(entryPrice);
      expect(liqPrice).toBeGreaterThan(0);
    });

    it("should calculate liquidation price for short position", () => {
      const liqPrice = calculateLiquidationPrice(
        false,
        entryPrice,
        leverage,
        maintenanceMargin
      );
      expect(liqPrice).toBeGreaterThan(entryPrice);
    });

    it("should give closer liquidation price for higher leverage", () => {
      const lowLevLiq = calculateLiquidationPrice(true, entryPrice, 5, maintenanceMargin);
      const highLevLiq = calculateLiquidationPrice(true, entryPrice, 20, maintenanceMargin);
      
      const lowLevDistance = entryPrice - lowLevLiq;
      const highLevDistance = entryPrice - highLevLiq;
      
      expect(highLevDistance).toBeLessThan(lowLevDistance);
    });
  });
});

describe("Flex Utils - Formatting", () => {
  describe("formatUsd", () => {
    it("should format USD amounts", () => {
      expect(formatUsd(1234.56)).toBe("$1,234.56");
      expect(formatUsd(1000000)).toBe("$1,000,000.00");
      expect(formatUsd(0.99)).toBe("$0.99");
    });

    it("should handle custom decimals", () => {
      expect(formatUsd(1234.5678, 4)).toBe("$1,234.5678");
      expect(formatUsd(100, 0)).toBe("$100");
    });

    it("should handle negative values", () => {
      expect(formatUsd(-1234.56)).toBe("-$1,234.56");
    });
  });

  describe("formatPercent", () => {
    it("should format percentages (already in percent form)", () => {
      expect(formatPercent(12.34, 2, true)).toBe("12.34%");
      expect(formatPercent(0, 2, true)).toBe("0.00%");
      expect(formatPercent(100, 2, true)).toBe("100.00%");
    });

    it("should format decimal values (convert to percent)", () => {
      expect(formatPercent(0.1234)).toBe("12.34%");
      expect(formatPercent(0.05)).toBe("5.00%");
      expect(formatPercent(1.0)).toBe("100.00%");
    });

    it("should handle custom decimals", () => {
      expect(formatPercent(12.345, 3, true)).toBe("12.345%");
      expect(formatPercent(0.00123, 4)).toBe("0.1230%");
    });

    it("should handle negative values", () => {
      expect(formatPercent(-5.25, 2, true)).toBe("-5.25%");
      expect(formatPercent(-0.005, 3)).toBe("-0.500%");
    });
  });
  describe("bpsToPercent", () => {
    it("should convert basis points to percent", () => {
      expect(bpsToPercent(100)).toBe(1);
      expect(bpsToPercent(50)).toBe(0.5);
      expect(bpsToPercent(10000)).toBe(100);
      expect(bpsToPercent(1)).toBe(0.01);
    });
  });

  describe("shortenAddress", () => {
    const address = "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb";

    it("should shorten address with default chars", () => {
      const shortened = shortenAddress(address);
      expect(shortened).toBe("0x742d...bEb");
      expect(shortened.length).toBeLessThan(address.length);
    });

    it("should handle custom char count", () => {
      expect(shortenAddress(address, 6)).toBe("0x742d35...5f0bEb");
      expect(shortenAddress(address, 2)).toBe("0x74...Eb");
    });

    it("should handle empty address", () => {
      expect(shortenAddress("")).toBe("");
    });
  });
});

describe("Flex Utils - Array Utilities", () => {
  describe("chunk", () => {
    it("should chunk array into specified sizes", () => {
      const arr = [1, 2, 3, 4, 5, 6, 7, 8, 9];
      expect(chunk(arr, 3)).toEqual([[1, 2, 3], [4, 5, 6], [7, 8, 9]]);
      expect(chunk(arr, 4)).toEqual([[1, 2, 3, 4], [5, 6, 7, 8], [9]]);
    });

    it("should handle array smaller than chunk size", () => {
      expect(chunk([1, 2], 5)).toEqual([[1, 2]]);
    });

    it("should handle empty array", () => {
      expect(chunk([], 3)).toEqual([]);
    });

    it("should handle chunk size of 1", () => {
      expect(chunk([1, 2, 3], 1)).toEqual([[1], [2], [3]]);
    });
  });
});
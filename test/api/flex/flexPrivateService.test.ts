/**
 * Tests for FlexPrivateService
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { ethers } from "ethers";
import { FlexPrivateService } from "../../../src/api/flex/flexPrivateService.js";
import { TOKENS, FLEX_CONSTANTS } from "../../../src/api/flex/constants.js";

describe("FlexPrivateService", () => {
  let service: FlexPrivateService;
  let mockProvider: any;
  let mockSigner: any;
  let mockContracts: any;

  beforeEach(() => {
    // Create mock provider
    mockProvider = {
      send: vi.fn().mockResolvedValue("0x2105"), // 8453 in hex (Base network)
      getFeeData: vi.fn().mockResolvedValue({
        gasPrice: 1000000000n, // 1 gwei
      }),
      waitForTransaction: vi.fn().mockResolvedValue({
        hash: "0x123",
        blockNumber: 12345,
        status: 1,
      }),
    };

    // Create mock signer
    mockSigner = {
      getAddress: vi.fn().mockResolvedValue("0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045"),
      provider: mockProvider,
    };

    // Mock contract instances with common methods
    const createMockContract = () => ({
      allowance: vi.fn().mockResolvedValue(0n),
      approve: vi.fn().mockResolvedValue({
        hash: "0xapprove",
        wait: vi.fn().mockResolvedValue({
          hash: "0xapprove",
          blockNumber: 12345,
          gasUsed: 50000n,
          effectiveGasPrice: 1000000000n,
          status: 1,
        }),
      }),
      depositCollateral: vi.fn().mockResolvedValue({
        hash: "0xdeposit",
        wait: vi.fn().mockResolvedValue({
          hash: "0xdeposit",
          blockNumber: 12346,
          gasUsed: 100000n,
          effectiveGasPrice: 1000000000n,
          status: 1,
        }),
      }),
      withdrawCollateral: vi.fn().mockResolvedValue({
        hash: "0xwithdraw",
        wait: vi.fn().mockResolvedValue({
          hash: "0xwithdraw",
          blockNumber: 12347,
          gasUsed: 90000n,
          effectiveGasPrice: 1000000000n,
          status: 1,
        }),
      }),
      createOrder: vi.fn().mockResolvedValue({
        hash: "0xorder",
        wait: vi.fn().mockResolvedValue({
          hash: "0xorder",
          blockNumber: 12348,
          gasUsed: 150000n,
          effectiveGasPrice: 1000000000n,
          status: 1,
        }),
      }),
      cancelOrder: vi.fn().mockResolvedValue({
        hash: "0xcancel",
        wait: vi.fn().mockResolvedValue({
          hash: "0xcancel",
          blockNumber: 12349,
          gasUsed: 50000n,
          effectiveGasPrice: 1000000000n,
          status: 1,
        }),
      }),
      estimateGas: vi.fn().mockResolvedValue(100000n),
    });

    mockContracts = {
      usdc: createMockContract(),
      crossMarginHandler: createMockContract(),
      limitTradeHandler: createMockContract(),
    };

    // Create service with mocked dependencies
    service = new FlexPrivateService(mockSigner, mockProvider);
    
    // Override contract instances with mocks
    (service as any).usdcToken = mockContracts.usdc;
    (service as any).crossMarginHandler = mockContracts.crossMarginHandler;
    (service as any).limitTradeHandler = mockContracts.limitTradeHandler;
  });

  describe("Construction", () => {
    it("should create service with provided signer and provider", () => {
      expect(service).toBeInstanceOf(FlexPrivateService);
    });

    it("should have access to public service methods", () => {
      const publicService = (service as any).publicService;
      expect(publicService).toBeDefined();
    });
  });

  describe("Network Validation", () => {
    it("should validate Base network (8453)", async () => {
      await expect(service.validateNetwork()).resolves.not.toThrow();
      expect(mockProvider.send).toHaveBeenCalledWith("eth_chainId", []);
    });

    it("should reject wrong network", async () => {
      mockProvider.send.mockResolvedValue("0x1"); // Ethereum (chain ID 1)
      await expect(service.validateNetwork()).rejects.toThrow("Wrong network");
    });
  });

  describe("Collateral Management", () => {
    describe("depositCollateral", () => {
      it("should deposit USDC with approval", async () => {
        // Mock allowance check to require approval
        mockContracts.usdc.allowance.mockResolvedValue(0n);

        const result = await service.depositCollateral(0, 1000);

        expect(result.success).toBe(true);
        expect(result.transactionHash).toBe("0xdeposit");
        expect(mockContracts.usdc.approve).toHaveBeenCalled();
        expect(mockContracts.crossMarginHandler.depositCollateral).toHaveBeenCalled();
      });

      it("should skip approval if already approved", async () => {
        // Mock sufficient allowance
        mockContracts.usdc.allowance.mockResolvedValue(10000000000n); // Large amount

        const result = await service.depositCollateral(0, 1000);

        expect(result.success).toBe(true);
        expect(mockContracts.usdc.approve).not.toHaveBeenCalled();
        expect(mockContracts.crossMarginHandler.depositCollateral).toHaveBeenCalled();
      });

      it("should convert USD amount to USDC tokens correctly", async () => {
        mockContracts.usdc.allowance.mockResolvedValue(10000000000n);

        await service.depositCollateral(0, 100);

        // 100 USD = 100,000,000 tokens (6 decimals)
        const call = mockContracts.crossMarginHandler.depositCollateral.mock.calls[0];
        expect(call[2]).toBe(100000000n);
      });

      it("should throw for negative amount", async () => {
        await expect(service.depositCollateral(0, -100)).rejects.toThrow(
          "Deposit amount must be positive"
        );
      });

      it("should throw for zero amount", async () => {
        await expect(service.depositCollateral(0, 0)).rejects.toThrow(
          "Deposit amount must be positive"
        );
      });

      it("should throw for invalid subaccount ID", async () => {
        await expect(service.depositCollateral(256, 100)).rejects.toThrow(
          "Invalid subAccountId"
        );
      });
    });

    describe("withdrawCollateral", () => {
      it("should withdraw USDC", async () => {
        const result = await service.withdrawCollateral(0, 500);

        expect(result.success).toBe(true);
        expect(result.transactionHash).toBe("0xwithdraw");
        expect(mockContracts.crossMarginHandler.withdrawCollateral).toHaveBeenCalled();
      });

      it("should convert USD amount to USDC tokens correctly", async () => {
        await service.withdrawCollateral(0, 50);

        // 50 USD = 50,000,000 tokens (6 decimals)
        const call = mockContracts.crossMarginHandler.withdrawCollateral.mock.calls[0];
        expect(call[2]).toBe(50000000n);
      });

      it("should throw for negative amount", async () => {
        await expect(service.withdrawCollateral(0, -50)).rejects.toThrow(
          "Withdrawal amount must be positive"
        );
      });

      it("should throw for zero amount", async () => {
        await expect(service.withdrawCollateral(0, 0)).rejects.toThrow(
          "Withdrawal amount must be positive"
        );
      });
    });
  });

  describe("Market Orders", () => {
    describe("executeMarketOrder", () => {
      beforeEach(() => {
        // Mock getMarketPrice from public service
        const mockPublicService = (service as any).publicService;
        mockPublicService.getMarketPrice = vi.fn().mockResolvedValue({
          price: 64000,
          priceE30: 64000n * 10n ** 30n,
        });
      });

      it("should execute long market order", async () => {
        const result = await service.executeMarketOrder({
          marketIndex: 1,
          subAccountId: 0,
          sizeDelta: 1000, // $1000 long
        });

        expect(result.success).toBe(true);
        expect(result.transactionHash).toBe("0xorder");
        expect(mockContracts.crossMarginHandler.createOrder).toHaveBeenCalled();

        // Verify order parameters
        const call = mockContracts.crossMarginHandler.createOrder.mock.calls[0];
        const [subAccount, marketIndex, sizeDelta, acceptablePrice, options] = call;
        
        expect(marketIndex).toBe(1);
        expect(sizeDelta).toBe(1000n * 10n ** 30n); // Absolute value
        expect(options.value).toBe(FLEX_CONSTANTS.EXECUTION_FEE);
      });

      it("should execute short market order", async () => {
        const result = await service.executeMarketOrder({
          marketIndex: 1,
          subAccountId: 0,
          sizeDelta: -1000, // $1000 short
        });

        expect(result.success).toBe(true);
        
        // Verify size is still positive (direction handled elsewhere)
        const call = mockContracts.crossMarginHandler.createOrder.mock.calls[0];
        const sizeDelta = call[2];
        expect(sizeDelta).toBe(1000n * 10n ** 30n);
      });

      it("should apply 1% slippage protection by default", async () => {
        await service.executeMarketOrder({
          marketIndex: 1,
          subAccountId: 0,
          sizeDelta: 1000,
        });

        const call = mockContracts.crossMarginHandler.createOrder.mock.calls[0];
        const acceptablePrice = call[3];
        
        // For long: price * 1.01 = 64000 * 1.01 = 64640
        expect(acceptablePrice).toBe(64640n * 10n ** 30n);
      });

      it("should use custom acceptable price if provided", async () => {
        await service.executeMarketOrder({
          marketIndex: 1,
          subAccountId: 0,
          sizeDelta: 1000,
          acceptablePrice: 65000,
        });

        const call = mockContracts.crossMarginHandler.createOrder.mock.calls[0];
        const acceptablePrice = call[3];
        
        expect(acceptablePrice).toBe(65000n * 10n ** 30n);
      });

      it("should throw for zero size", async () => {
        await expect(
          service.executeMarketOrder({
            marketIndex: 1,
            subAccountId: 0,
            sizeDelta: 0,
          })
        ).rejects.toThrow("Order size cannot be zero");
      });

      it("should throw for invalid subaccount ID", async () => {
        await expect(
          service.executeMarketOrder({
            marketIndex: 1,
            subAccountId: -1,
            sizeDelta: 1000,
          })
        ).rejects.toThrow("Invalid subAccountId");
      });
    });
  });

  describe("Limit/Trigger Orders", () => {
    describe("createLimitOrder", () => {
      it("should create limit buy order", async () => {
        const result = await service.createLimitOrder({
          marketIndex: 1,
          subAccountId: 0,
          sizeDelta: 1000,
          triggerPrice: 63000,
          triggerAboveThreshold: false, // Buy when price goes below
        });

        expect(result.success).toBe(true);
        expect(result.transactionHash).toBe("0xorder");
        expect(mockContracts.limitTradeHandler.createOrder).toHaveBeenCalled();
      });

      it("should create limit sell order", async () => {
        const result = await service.createLimitOrder({
          marketIndex: 1,
          subAccountId: 0,
          sizeDelta: -1000,
          triggerPrice: 65000,
          triggerAboveThreshold: true, // Sell when price goes above
        });

        expect(result.success).toBe(true);
        
        const call = mockContracts.limitTradeHandler.createOrder.mock.calls[0];
        const [subAccount, marketIndex, sizeDelta, triggerPrice, acceptablePrice, triggerAbove, reduceOnly] = call;
        
        expect(triggerPrice).toBe(65000n * 10n ** 30n);
        expect(triggerAbove).toBe(true);
      });

      it("should apply 1% slippage to acceptable price by default", async () => {
        await service.createLimitOrder({
          marketIndex: 1,
          subAccountId: 0,
          sizeDelta: 1000,
          triggerPrice: 64000,
          triggerAboveThreshold: false,
        });

        const call = mockContracts.limitTradeHandler.createOrder.mock.calls[0];
        const acceptablePrice = call[4];
        
        // For long: trigger * 1.01 = 64000 * 1.01 = 64640
        expect(acceptablePrice).toBe(64640n * 10n ** 30n);
      });

      it("should use custom acceptable price if provided", async () => {
        await service.createLimitOrder({
          marketIndex: 1,
          subAccountId: 0,
          sizeDelta: 1000,
          triggerPrice: 64000,
          triggerAboveThreshold: false,
          acceptablePrice: 64500,
        });

        const call = mockContracts.limitTradeHandler.createOrder.mock.calls[0];
        const acceptablePrice = call[4];
        
        expect(acceptablePrice).toBe(64500n * 10n ** 30n);
      });

      it("should support reduceOnly flag", async () => {
        await service.createLimitOrder({
          marketIndex: 1,
          subAccountId: 0,
          sizeDelta: -500,
          triggerPrice: 65000,
          triggerAboveThreshold: true,
          reduceOnly: true,
        });

        const call = mockContracts.limitTradeHandler.createOrder.mock.calls[0];
        const reduceOnly = call[6];
        
        expect(reduceOnly).toBe(true);
      });

      it("should include execution fee", async () => {
        await service.createLimitOrder({
          marketIndex: 1,
          subAccountId: 0,
          sizeDelta: 1000,
          triggerPrice: 64000,
          triggerAboveThreshold: false,
        });

        const call = mockContracts.limitTradeHandler.createOrder.mock.calls[0];
        const options = call[7];
        
        expect(options.value).toBe(FLEX_CONSTANTS.EXECUTION_FEE);
      });

      it("should throw for zero size", async () => {
        await expect(
          service.createLimitOrder({
            marketIndex: 1,
            subAccountId: 0,
            sizeDelta: 0,
            triggerPrice: 64000,
            triggerAboveThreshold: false,
          })
        ).rejects.toThrow("Order size cannot be zero");
      });
    });
  });

  describe("Order Management", () => {
    describe("cancelOrder", () => {
      it("should cancel an order", async () => {
        const result = await service.cancelOrder(0, 123);

        expect(result.success).toBe(true);
        expect(result.transactionHash).toBe("0xcancel");
        expect(mockContracts.limitTradeHandler.cancelOrder).toHaveBeenCalled();
      });

      it("should pass correct parameters", async () => {
        await service.cancelOrder(0, 456);

        const call = mockContracts.limitTradeHandler.cancelOrder.mock.calls[0];
        const [subAccount, orderIndex] = call;
        
        expect(orderIndex).toBe(456);
      });

      it("should throw for invalid subaccount ID", async () => {
        await expect(service.cancelOrder(300, 123)).rejects.toThrow(
          "Invalid subAccountId"
        );
      });
    });
  });

  describe("Position Management", () => {
    describe("closePosition", () => {
      beforeEach(() => {
        // Mock getPosition from public service
        const mockPublicService = (service as any).publicService;
        mockPublicService.getPosition = vi.fn().mockResolvedValue({
          marketIndex: 1,
          symbol: "BTC",
          isLong: true,
          size: 1000, // $1000 long position
        });
        mockPublicService.getMarketPrice = vi.fn().mockResolvedValue({
          price: 64000,
          priceE30: 64000n * 10n ** 30n,
        });
      });

      it("should close 100% of long position", async () => {
        const result = await service.closePosition(1, 0, 100);

        expect(result.success).toBe(true);
        
        // Should create opposite order (short)
        const call = mockContracts.crossMarginHandler.createOrder.mock.calls[0];
        const sizeDelta = call[2];
        
        expect(sizeDelta).toBe(1000n * 10n ** 30n); // Full size
      });

      it("should close 50% of position", async () => {
        const result = await service.closePosition(1, 0, 50);

        expect(result.success).toBe(true);
        
        const call = mockContracts.crossMarginHandler.createOrder.mock.calls[0];
        const sizeDelta = call[2];
        
        expect(sizeDelta).toBe(500n * 10n ** 30n); // Half size
      });

      it("should close short position correctly", async () => {
        // Mock short position
        const mockPublicService = (service as any).publicService;
        mockPublicService.getPosition = vi.fn().mockResolvedValue({
          marketIndex: 1,
          symbol: "BTC",
          isLong: false,
          size: 1000, // $1000 short position
        });

        const result = await service.closePosition(1, 0, 100);

        expect(result.success).toBe(true);
        
        // Closing short should be a long order
        const call = mockContracts.crossMarginHandler.createOrder.mock.calls[0];
        const sizeDelta = call[2];
        
        expect(sizeDelta).toBe(1000n * 10n ** 30n);
      });

      it("should throw if no position exists", async () => {
        const mockPublicService = (service as any).publicService;
        mockPublicService.getPosition = vi.fn().mockResolvedValue(null);

        await expect(service.closePosition(1, 0, 100)).rejects.toThrow(
          "No position found to close"
        );
      });

      it("should throw for invalid percent", async () => {
        await expect(service.closePosition(1, 0, 0)).rejects.toThrow(
          "Percent to close must be between 0 and 100"
        );
        
        await expect(service.closePosition(1, 0, 101)).rejects.toThrow(
          "Percent to close must be between 0 and 100"
        );
      });
    });
  });

  describe("Transaction Utilities", () => {
    describe("getGasPrice", () => {
      it("should fetch current gas price", async () => {
        const gasPrice = await service.getGasPrice();
        
        expect(gasPrice).toBe(1000000000n);
        expect(mockProvider.getFeeData).toHaveBeenCalled();
      });
    });

    describe("waitForTransaction", () => {
      it("should wait for transaction confirmation", async () => {
        const receipt = await service.waitForTransaction("0x123", 1);
        
        expect(receipt).toBeDefined();
        expect(receipt?.status).toBe(1);
        expect(mockProvider.waitForTransaction).toHaveBeenCalledWith("0x123", 1, 120000);
      });

      it("should use default timeout", async () => {
        await service.waitForTransaction("0x123");
        
        expect(mockProvider.waitForTransaction).toHaveBeenCalledWith("0x123", 1, 120000);
      });
    });
  });

  describe("Error Handling", () => {
    it("should handle user rejection", async () => {
      mockContracts.crossMarginHandler.depositCollateral.mockRejectedValue({
        message: "User rejected transaction",
      });

      await expect(service.depositCollateral(0, 1000)).rejects.toThrow(
        "Transaction rejected by user"
      );
    });

    it("should handle contract revert", async () => {
      // Mock getMarketPrice first so it doesn't fail
      const mockPublicService = (service as any).publicService;
      mockPublicService.getMarketPrice = vi.fn().mockResolvedValue({
        price: 64000,
        priceE30: 64000n * 10n ** 30n,
      });

      mockContracts.crossMarginHandler.createOrder.mockRejectedValue({
        reason: "Insufficient margin",
      });

      await expect(
        service.executeMarketOrder({
          marketIndex: 1,
          subAccountId: 0,
          sizeDelta: 10000,
        })
      ).rejects.toThrow("Market order failed: Insufficient margin");
    });
  });
});
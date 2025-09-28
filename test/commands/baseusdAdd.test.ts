import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { setupConsoleMocks, ConsoleMock } from "../utils/consoleMock.js";

// Mock ethers provider and wallet similar to flpCompound tests
const mockState = {
  networkChainId: 8453n as bigint,
  estGas: 123456n as bigint,
  fee: {
    maxFeePerGas: 1_000_000_000n as bigint,
    gasPrice: undefined as bigint | undefined,
  },
  signerAddress: "0x1111111111111111111111111111111111111111",
};

vi.mock("ethers", () => {
  class JsonRpcProvider {
    url: string;
    constructor(url: string) {
      this.url = url;
    }
    async getNetwork() {
      return { chainId: mockState.networkChainId };
    }
    async estimateGas(_tx: any) {
      return mockState.estGas;
    }
    async getFeeData() {
      return mockState.fee;
    }
    async getTransaction(hash: string) {
      // Provide minimal fields used by the command
      const gasPrice =
        mockState.fee.gasPrice ?? mockState.fee.maxFeePerGas ?? 0n;
      return {
        hash,
        data: "0x",
        gasPrice,
        maxFeePerGas: mockState.fee.maxFeePerGas,
      } as any;
    }
  }
  class Wallet {
    pk: string;
    provider: any;
    constructor(pk: string, provider: any) {
      this.pk = pk;
      this.provider = provider;
    }
    async getAddress() {
      return mockState.signerAddress;
    }
    async estimateGas(_tx: any) {
      return mockState.estGas;
    }
    async sendTransaction(_tx: any) {
      return {
        hash: "0xhash",
        wait: async () => ({
          gasUsed: 21_000n,
          effectiveGasPrice: 1_500_000_000n,
          blockNumber: 1,
          hash: "0xhash",
        }),
      };
    }
  }
  class Contract {
    addr: string;
    abi: any;
    provider: any;
    signer: any;
    constructor(addr: string, abi: any, provider: any) {
      this.addr = addr;
      this.abi = abi;
      this.provider = provider;
    }
    connect(signer: any) {
      this.signer = signer;
      return this;
    }
    async asset() {
      return "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
    }
    async convertToShares(assets: bigint) {
      // Simple 1:1e12 exchange rate for testing: 1 USDC (1e6) -> 1e18 shares
      // shares = assets * 1e12
      return assets * 1_000_000_000_000n;
    }
    async allowance(_owner: string, _spender: string) {
      return 2n ** 255n;
    }
    async approve(_spender: string, _amount: bigint) {
      return { hash: "0xapprove", wait: async () => ({ blockNumber: 1 }) };
    }
  }
  function formatUnits(value: bigint, decimals: number) {
    if (decimals === 9) return (Number(value) / 1e9).toString();
    if (decimals === 18) return (Number(value) / 1e18).toString();
    if (decimals === 6) return (Number(value) / 1e6).toString();
    return value.toString();
  }
  function parseUnits(value: string, decimals: number) {
    const v = Number(value);
    const factor =
      decimals === 6 ? 1e6 : decimals === 18 ? 1e18 : Math.pow(10, decimals);
    return BigInt(Math.floor(v * factor));
  }
  return { JsonRpcProvider, Wallet, Contract, formatUnits, parseUnits };
});

// Mock the builder to isolate CLI behavior
const mockBuild = vi.fn();
vi.mock("../../src/api/baseusd/routerMulticallBuilder.js", () => {
  return {
    buildDepositStakeMulticall: mockBuild,
  };
});

describe("baseusd:add command", () => {
  setupConsoleMocks();

  beforeEach(() => {
    process.env.MAIN_PRIVATE_KEY = "0x123";
    process.env.ALCHEMY_API_KEY = "";
    mockState.networkChainId = 8453n;
    mockBuild.mockReset();
    mockBuild.mockReturnValue({
      to: "0x4D2b87339b1f9e480aA84c770fa3604D7D40f8DF",
      data: "0x1234",
      value: 0n,
      chainId: 8453n,
      inner: [{ name: "setDeadline", args: [0n], data: "0x" as any }],
    });
  });

  afterEach(() => {
    delete process.env.MAIN_PRIVATE_KEY;
    delete process.env.ALCHEMY_API_KEY;
  });

  it("performs dry-run and prints estimates without sending tx", async () => {
    const { baseusdAdd } = await import("../../src/commands/baseusdAdd.js");

    await baseusdAdd("100", { dryRun: true } as any);

    expect(ConsoleMock.error).not.toHaveBeenCalled();
    expect(ConsoleMock.log).toHaveBeenCalledWith(
      expect.stringContaining("--- baseUSD Add (dry-run) ---"),
    );
    expect(ConsoleMock.log).toHaveBeenCalledWith(
      expect.stringContaining("Expected shares (baseUSD):"),
    );
    expect(ConsoleMock.exit).not.toHaveBeenCalled();
  });

  it("submits live tx when not dry-run", async () => {
    const { baseusdAdd } = await import("../../src/commands/baseusdAdd.js");

    await baseusdAdd("100", {} as any);

    expect(ConsoleMock.log).toHaveBeenCalledWith(
      expect.stringContaining("Submitted tx:"),
    );
    expect(ConsoleMock.log).toHaveBeenCalledWith(
      expect.stringContaining("baseUSD Add (result)"),
    );
  });
});

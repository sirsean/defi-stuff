import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { setupConsoleMocks, ConsoleMock } from '../utils/consoleMock.js';

// We'll mock 'ethers' with a mutable state so tests can control behavior
const mockState = {
  networkChainId: 8453n as bigint,
  populatedData: '0xcafe' as `0x${string}`,
  estGas: 100000n as bigint,
  fee: { maxFeePerGas: 1_000_000_000n as bigint, gasPrice: undefined as bigint | undefined },
  signerAddress: '0x1111111111111111111111111111111111111111',
  usdcDecimals: 6 as number,
  preBalance: 1_000_000n as bigint,
  postBalance: 1_200_000n as bigint,
  transferTopic: '0xtransfer',
  usdcAddress: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  logsToMe: 200_000n as bigint,
  makeLogsToMe: true,
  txStatus: 'success' as 'success' | 'reverted',
};

vi.mock('ethers', () => {
  class JsonRpcProvider {
    url: string;
    constructor(url: string) { this.url = url; }
    async getNetwork() { return { chainId: mockState.networkChainId }; }
    async estimateGas(_tx: any) { return mockState.estGas; }
    async getFeeData() { return mockState.fee; }
  }
  class Wallet {
    pk: string; provider: any;
    constructor(pk: string, provider: any) { this.pk = pk; this.provider = provider; }
    async getAddress() { return mockState.signerAddress; }
  }
  class Contract {
    address: string; abi: any; provider: any;
    constructor(address: string, abi: any, provider: any) { this.address = address; this.abi = abi; this.provider = provider; }
    getFunction(name: string) {
      const fn: any = (..._args: any[]) => ({
        hash: '0xhash',
        // Include data so fee computation does not need to call provider.getTransaction
        data: mockState.populatedData,
        wait: async () => ({
          gasUsed: 21000n,
          effectiveGasPrice: 2_000_000_000n,
          logs: mockState.makeLogsToMe ? [
            { address: mockState.usdcAddress, topics: [mockState.transferTopic, '0x', '0x' + '0'.repeat(24) + mockState.signerAddress.slice(2)], data: '0x' + mockState.logsToMe.toString(16) }
          ] : []
        })
      });
      fn.populateTransaction = (..._args: any[]) => ({ data: mockState.populatedData });
      return fn;
    }
    async decimals() { return mockState.usdcDecimals; }
    async balanceOf(_addr: string) { return mockState.preBalance; }
    connect(_signer: any) { return this; }
  }
  function formatUnits(value: bigint, decimals: number) {
    if (decimals === 9) return (Number(value) / 1e9).toString();
    if (decimals === 18) return (Number(value) / 1e18).toString();
    // basic for 6
    if (decimals === 6) return (Number(value) / 1e6).toString();
    return value.toString();
  }
  function getAddress(addr: string) { return addr; }
  function keccak256(_bytes: any) { return mockState.transferTopic; }
  function toUtf8Bytes(_s: string) { return _s; }
  return { JsonRpcProvider, Wallet, Contract, formatUnits, getAddress, keccak256, toUtf8Bytes };
});

// We must import after the mock is defined

describe('flpCompound command', () => {
  setupConsoleMocks();

  beforeEach(() => {
    process.env.MAIN_PRIVATE_KEY = '0x123';
    process.env.ALCHEMY_API_KEY = '';
    mockState.networkChainId = 8453n;
    mockState.makeLogsToMe = true;
    mockState.txStatus = 'success';
  });

  afterEach(() => {
    delete process.env.MAIN_PRIVATE_KEY;
    delete process.env.ALCHEMY_API_KEY;
  });

  it('performs dry-run and prints estimates without sending tx', async () => {
    const { flpCompound } = await import('../../src/commands/flpCompound.js');

    await flpCompound({ dryRun: true } as any);

    expect(ConsoleMock.error).not.toHaveBeenCalled();
    expect(ConsoleMock.log).toHaveBeenCalledWith(expect.stringContaining('--- Flex FLP Compound (dry-run) ---'));
    expect(ConsoleMock.exit).not.toHaveBeenCalled();
  });

  it('exits with error if wrong network', async () => {
    mockState.networkChainId = 1n; // not Base
    const { flpCompound } = await import('../../src/commands/flpCompound.js');

    await flpCompound({} as any);

    expect(ConsoleMock.error).toHaveBeenCalled();
    expect(ConsoleMock.exit).toHaveBeenCalledWith(1);
  });

  it('submits live tx and reports gas and USDC received', async () => {
    const { flpCompound } = await import('../../src/commands/flpCompound.js');

    await flpCompound({} as any);

    expect(ConsoleMock.error).not.toHaveBeenCalled();
    expect(ConsoleMock.log).toHaveBeenCalledWith(expect.stringContaining('Submitted tx:'));
    expect(ConsoleMock.log).toHaveBeenCalledWith(expect.stringContaining('USDC received:'));
  });
});

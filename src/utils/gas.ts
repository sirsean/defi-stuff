import { Contract, JsonRpcProvider } from 'ethers';
import { withRetry } from './retry.js';

const GAS_ORACLE_ADDRESS = '0x420000000000000000000000000000000000000F';
const gasOracleAbi = ['function getL1Fee(bytes _data) view returns (uint256)'];

export interface GasBreakdownWei {
  l2GasUsed: bigint;
  effectiveGasPriceWei: bigint;
  l1FeeWei: bigint;
  l2FeeWei: bigint;
  totalFeeWei: bigint;
}

// Resolve an effective per-gas price from receipt first, else from full tx
export async function getEffectiveGasPriceWei(
  provider: JsonRpcProvider,
  txHash: string,
  receipt: any
): Promise<bigint> {
  const fromReceipt = (receipt as any)?.effectiveGasPrice as bigint | undefined;
  if (typeof fromReceipt === 'bigint' && fromReceipt > 0n) return fromReceipt;
  const fullTx = await withRetry(() => provider.getTransaction(txHash));
  const price = (fullTx?.gasPrice ?? fullTx?.maxFeePerGas ?? 0n) as bigint;
  return price ?? 0n;
}

export async function getBaseL1FeeWei(
  provider: JsonRpcProvider,
  txData: `0x${string}` | string | undefined
): Promise<bigint> {
  try {
    if (!txData) return 0n;
    const oracle = new Contract(GAS_ORACLE_ADDRESS, gasOracleAbi, provider);
    const fee: bigint = await oracle.getL1Fee(txData);
    return fee ?? 0n;
  } catch {
    return 0n;
  }
}

export async function computeTxFeesWei(
  provider: JsonRpcProvider,
  txResponse: { hash: string; data?: `0x${string}` | string },
  receipt: { gasUsed?: bigint }
): Promise<GasBreakdownWei> {
  const l2GasUsed = (receipt.gasUsed ?? 0n) as bigint;
  const effectiveGasPriceWei = await getEffectiveGasPriceWei(provider, txResponse.hash, receipt);
  const l2FeeWei = l2GasUsed * effectiveGasPriceWei;

  // Prefer txResponse.data if present; otherwise, fetch full tx
  let txData: `0x${string}` | string | undefined = txResponse.data;
  if (!txData) {
    const fullTx = await withRetry(() => provider.getTransaction(txResponse.hash));
    txData = (fullTx?.data ?? '0x') as any;
  }
  const l1FeeWei = await getBaseL1FeeWei(provider, txData);

  return {
    l2GasUsed,
    effectiveGasPriceWei,
    l1FeeWei,
    l2FeeWei,
    totalFeeWei: l1FeeWei + l2FeeWei,
  };
}

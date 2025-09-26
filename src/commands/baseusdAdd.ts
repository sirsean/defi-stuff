import { JsonRpcProvider, Wallet, formatUnits, parseUnits, Contract } from 'ethers';
import { buildDepositStakeMulticall } from '../api/baseusd/routerMulticallBuilder.js';
import baseUsdAbi from '../abi/baseusd/baseUSD.json' with { type: 'json' };

// Minimal ERC-20 ABI for allowance/approve
const erc20Abi = [
  'function allowance(address owner, address spender) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)'
];

interface BaseusdAddOptions {
  dryRun?: boolean;
}

const BASE_CHAIN_ID = 8453n;
const DEFAULT_BASE_RPC = process.env.ALCHEMY_API_KEY
  ? `https://base-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`
  : 'https://mainnet.base.org';

export async function baseusdAdd(amount: string, options: BaseusdAddOptions = {}): Promise<void> {
  try {
    if (!amount || isNaN(Number(amount))) {
      console.error('Amount (USDC decimal string) is required, e.g., 250.5');
      process.exit(1);
      return;
    }

    const provider = new JsonRpcProvider(DEFAULT_BASE_RPC);
    const network = await provider.getNetwork();
    if (network.chainId !== BASE_CHAIN_ID) {
      console.error(`Connected to wrong network (chainId ${network.chainId}). Expected Base (8453).`);
      process.exit(1);
      return;
    }

    // Determine expected shares and minSharesOut via ERC-4626 quote
    const assets = parseUnits(amount, 6); // USDC has 6 decimals

    // baseUSD vault address (ERC-4626) used in the router builder
    const BASEUSD_ADDRESS = '0x9c6864105AEC23388C89600046213a44C384c831';
    const USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';

    const vault = new Contract(BASEUSD_ADDRESS, baseUsdAbi as any, provider);

    // Sanity check: vault.asset() matches Base USDC
    let vaultAsset: string;
    try {
      vaultAsset = await vault.asset();
    } catch {
      console.error('Failed to read baseUSD.asset() for ERC-4626 validation');
      process.exit(1);
      return;
    }
    if (vaultAsset?.toLowerCase() !== USDC_ADDRESS.toLowerCase()) {
      console.error(`Vault asset mismatch: expected USDC ${USDC_ADDRESS}, got ${vaultAsset}`);
      process.exit(1);
      return;
    }

    // Quote expected shares for the given assets
    let expectedShares: bigint;
    try {
      expectedShares = await vault.convertToShares(assets);
    } catch (e) {
      console.error('Failed to quote convertToShares for baseUSD');
      process.exit(1);
      return;
    }
    if (expectedShares <= 0n) {
      console.error('Vault returned zero shares for non-zero assets; aborting');
      process.exit(1);
      return;
    }

    const slippageBps = 10; // default 0.10%
    const minSharesOut = (expectedShares * BigInt(10000 - slippageBps)) / 10000n;

    // Build multicall from template with shares-based minOut override
    const built = buildDepositStakeMulticall(amount, { minSharesOutOverride: minSharesOut, slippageBps });

    if (options.dryRun === true) {
      let fromAddr: string | undefined;
      let estGas: bigint | undefined;
      let needsApprove: boolean | undefined;
      const maybePk = process.env.MAIN_PRIVATE_KEY;
      if (maybePk) {
        const signer = new Wallet(maybePk, provider);
        fromAddr = await signer.getAddress();
      } else if (process.env.WALLET_ADDRESS) {
        fromAddr = process.env.WALLET_ADDRESS;
      }

      try {
        estGas = await provider.estimateGas({ to: built.to, data: built.data, from: fromAddr });
      } catch (e) {
        console.error('Gas estimation failed (no signer or node rejected estimation). You may set MAIN_PRIVATE_KEY for better accuracy.');
      }

      // Check allowance if we have a from address
      if (fromAddr) {
        try {
          const usdc = new Contract(USDC_ADDRESS, erc20Abi, provider);
          const allowance: bigint = await usdc.allowance(fromAddr, built.to);
          needsApprove = allowance < assets;
        } catch {
          // ignore allowance errors in dry-run
        }
      }

      const feeData = await provider.getFeeData();
      const gasPrice = feeData.maxFeePerGas ?? feeData.gasPrice ?? 0n;
      const estCost = estGas ? estGas * gasPrice : 0n;

      // Compute human-readable exchange metrics
      const assetsHuman = amount;
      const sharesHuman = formatUnits(expectedShares, 18); // baseUSD shares likely 18 decimals
      let sharesPerUsdc: string | undefined;
      let usdcPerShare: string | undefined;
      const assetsBN = assets;
      if (assetsBN > 0n && expectedShares > 0n) {
        // Convert to decimal strings approximately; avoid bigint division loss by formatting separately
        sharesPerUsdc = (Number(sharesHuman) / Number(assetsHuman)).toString();
        usdcPerShare = (Number(assetsHuman) / Number(sharesHuman)).toString();
      }

      console.log('--- baseUSD Add (dry-run) ---');
      console.log(`Router: ${built.to}`);
      console.log(`Vault: ${BASEUSD_ADDRESS}`);
      console.log(`Assets (USDC): ${assetsHuman} (atomic ${assets.toString()})`);
      console.log(`Expected shares (baseUSD): ${sharesHuman} (atomic ${expectedShares.toString()})`);
      console.log(`Slippage: ${slippageBps} bps; minSharesOut: ${formatUnits((expectedShares * BigInt(10000 - slippageBps)) / 10000n, 18)} (atomic ${minSharesOut.toString()})`);
      if (sharesPerUsdc && usdcPerShare) {
        console.log(`Exchange rate ~ shares/USDC: ${sharesPerUsdc}, USDC/share: ${usdcPerShare}`);
      }
      if (needsApprove !== undefined) {
        console.log(`USDC allowance for router is ${needsApprove ? 'insufficient (approval required)' : 'sufficient'}`);
      }
      if (estGas) console.log(`Estimated gas: ${estGas.toString()} units`);
      if (gasPrice) console.log(`Assumed max fee per gas: ${formatUnits(gasPrice, 9)} gwei`);
      if (estGas && gasPrice) console.log(`Estimated upper-bound cost: ${formatUnits(estCost, 18)} ETH`);
      console.log(`Inner calls: ${built.inner.map((c) => c.name).join(' -> ')}`);
      return;
    }

    const pk = process.env.MAIN_PRIVATE_KEY;
    if (!pk) {
      console.error('MAIN_PRIVATE_KEY is required for live execution. Set it in your environment.');
      process.exit(1);
      return;
    }

    const signer = new Wallet(pk, provider);

    // Ensure USDC allowance for router is sufficient; if not, approve exact amount
    const usdc = new Contract(USDC_ADDRESS, erc20Abi, provider);
    const owner = await signer.getAddress();
    const currentAllowance: bigint = await usdc.allowance(owner, built.to);
    if (currentAllowance < assets) {
      console.log(`Approving USDC for router (amount: ${assets.toString()})...`);
      const usdcWithSigner: any = usdc.connect(signer);
      const approveTx = await usdcWithSigner.approve(built.to, assets);
      console.log(`Submitted approve tx: ${approveTx.hash}`);
      const approveRcpt = await approveTx.wait();
      if (approveRcpt) {
        console.log(`Approve confirmed in block ${approveRcpt.blockNumber}`);
      }
    }

    const tx = await signer.sendTransaction({ to: built.to, data: built.data, value: built.value });
    console.log(`Submitted tx: ${tx.hash}`);
    const receipt = await tx.wait();

    if (!receipt) {
      console.log('Transaction submitted but no receipt was returned (possibly dropped and replaced).');
      return;
    }

    const gasUsed = receipt.gasUsed ?? 0n;
    const effectiveGasPrice = (receipt as any).effectiveGasPrice ?? 0n;
    const gasPaid = gasUsed * effectiveGasPrice;

    console.log('--- baseUSD Add (result) ---');
    console.log(`Network: Base (8453), Block: ${receipt.blockNumber}`);
    console.log(`Gas used: ${gasUsed.toString()} units`);
    console.log(`Effective gas price: ${formatUnits(effectiveGasPrice, 9)} gwei`);
    console.log(`Gas paid: ${formatUnits(gasPaid, 18)} ETH`);
    console.log(`Tx hash: ${receipt.hash}`);
  } catch (error) {
    console.error('Error executing baseusd:add:', error);
    process.exit(1);
  }
}
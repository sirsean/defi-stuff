import {
  JsonRpcProvider,
  Wallet,
  formatUnits,
  parseUnits,
  Contract,
  Interface,
} from "ethers";
import { buildDepositStakeMulticall } from "../api/baseusd/routerMulticallBuilder.js";
import baseUsdAbi from "../abi/baseusd/baseUSD.json" with { type: "json" };
import routerAbi from "../abi/baseusd/AutopilotRouter.json" with { type: "json" };
import fs from "node:fs/promises";
import path from "node:path";
import { computeTxFeesWei } from "../utils/gas.js";
import { withRetry, maskRpcUrl } from "../utils/retry.js";
import { getBaseRpcUrl } from "../utils/rpc.js";

// Minimal ERC-20 ABI for allowance/approve
const erc20Abi = [
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function balanceOf(address owner) view returns (uint256)",
];

// Best-effort revert decoder for the router using its ABI
function decodeRouterRevert(error: any): {
  name?: string;
  signature?: string;
  raw?: string;
  reason?: string;
  selector?: string;
  words?: string[];
} {
  try {
    const iface = new Interface(routerAbi as any);
    const raw: string | undefined =
      error?.data?.data ??
      error?.error?.data ??
      error?.info?.error?.data ??
      error?.data ??
      undefined;
    if (typeof raw === "string") {
      const selector = raw.slice(0, 10);
      const words: string[] = [];
      for (let i = 10; i + 64 <= raw.length; i += 64) {
        words.push("0x" + raw.slice(i, i + 64));
      }
      try {
        const parsed = iface.parseError(raw);
        if (parsed) {
          return {
            name: parsed.name,
            signature: parsed.signature,
            raw,
            selector,
            words,
          };
        }
        // Not a custom error in the router ABI; return raw if available
        return {
          raw,
          reason: error?.shortMessage ?? error?.message,
          selector,
          words,
        };
      } catch {
        // Not a custom error in the router ABI; return raw if available
        return {
          raw,
          reason: error?.shortMessage ?? error?.message,
          selector,
          words,
        };
      }
    }
    return { reason: error?.shortMessage ?? error?.message };
  } catch {
    return { reason: error?.shortMessage ?? error?.message };
  }
}

interface BaseusdAddOptions {
  dryRun?: boolean;
  slippageBps?: number;
  debug?: boolean;
  probeSlippage?: string; // comma-separated list of bps to try in dry-run
}
const BASE_CHAIN_ID = 8453n;

// Known addresses (Base mainnet)
const REWARDER_ADDRESS = "0x4103A467166bbbDA3694AB739b391db6c6630595";

// Rewarder ABI path (no cache directories; single canonical file)
const REWARDER_ABI_PATH = path.resolve(
  process.cwd(),
  "src/abi/baseusd/Rewarder.json",
);

async function readRewarderAbi(): Promise<any | null> {
  try {
    const data = await fs.readFile(REWARDER_ABI_PATH, "utf8");
    return JSON.parse(data);
  } catch {
    return null;
  }
}

// Note: Do NOT fetch the ABI from within this command. The ABI should be fetched
// and saved using the `abi` command to src/abi/baseusd/Rewarder.json.

function tryDecodeWithAbi(
  error: any,
  abi: any,
): {
  name?: string;
  signature?: string;
  raw?: string;
  reason?: string;
  selector?: string;
  words?: string[];
} | null {
  try {
    const raw: string | undefined =
      error?.data?.data ??
      error?.error?.data ??
      error?.info?.error?.data ??
      error?.data ??
      undefined;
    if (!raw || typeof raw !== "string") return null;
    const selector = raw.slice(0, 10);
    const words: string[] = [];
    for (let i = 10; i + 64 <= raw.length; i += 64) {
      words.push("0x" + raw.slice(i, i + 64));
    }
    const iface = new Interface(abi as any);
    const parsed = iface.parseError(raw);
    if (parsed) {
      return {
        name: parsed.name,
        signature: parsed.signature,
        raw,
        selector,
        words,
      };
    }
    return {
      raw,
      reason: (error?.shortMessage ?? error?.message) as string,
      selector,
      words,
    };
  } catch {
    return null;
  }
}

export interface BaseusdAddResult {
  approval?: { executed: boolean; totalFeeWei: bigint };
  deposit: { totalFeeWei: bigint };
  depositedUsdcAtomic: bigint;
  usdcDecimals: number;
}

export async function baseusdAdd(
  amount: string,
  options: BaseusdAddOptions = {},
): Promise<void> {
  try {
    if (!amount || isNaN(Number(amount))) {
      console.error("Amount (USDC decimal string) is required, e.g., 250.5");
      process.exit(1);
      return;
    }

    const rpcUrl = getBaseRpcUrl();
    console.log(`baseusd:add RPC endpoint = ${maskRpcUrl(rpcUrl)}`);
    const provider = new JsonRpcProvider(rpcUrl);
    const network = await provider.getNetwork();
    if (network.chainId !== BASE_CHAIN_ID) {
      console.error(
        `Connected to wrong network (chainId ${network.chainId}). Expected Base (8453).`,
      );
      process.exit(1);
      return;
    }

    // Determine expected shares and minSharesOut via ERC-4626 quote
    const assets = parseUnits(amount, 6); // USDC has 6 decimals

    // baseUSD vault address (ERC-4626) used in the router builder
    const BASEUSD_ADDRESS = "0x9c6864105AEC23388C89600046213a44C384c831";
    const USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

    const vault = new Contract(BASEUSD_ADDRESS, baseUsdAbi as any, provider);

    // Sanity check: vault.asset() matches Base USDC
    let vaultAsset: string;
    try {
      vaultAsset = await withRetry(() => vault.asset());
    } catch {
      console.error("Failed to read baseUSD.asset() for ERC-4626 validation");
      process.exit(1);
      return;
    }
    if (vaultAsset?.toLowerCase() !== USDC_ADDRESS.toLowerCase()) {
      console.error(
        `Vault asset mismatch: expected USDC ${USDC_ADDRESS}, got ${vaultAsset}`,
      );
      process.exit(1);
      return;
    }

    // Quote expected shares for the given assets
    let expectedShares: bigint;
    try {
      expectedShares = await withRetry(() => vault.convertToShares(assets));
    } catch (e) {
      console.error("Failed to quote convertToShares for baseUSD");
      process.exit(1);
      return;
    }
    if (expectedShares <= 0n) {
      console.error("Vault returned zero shares for non-zero assets; aborting");
      process.exit(1);
      return;
    }

    const slippageBps = 10; // default 0.10%
    const minSharesOut =
      (expectedShares * BigInt(10000 - slippageBps)) / 10000n;

    // Build multicall from template with shares-based minOut and approve(baseUSD) using shares
    const built = buildDepositStakeMulticall(amount, {
      minSharesOutOverride: minSharesOut,
      slippageBps,
      approveBaseUsdAmountOverride: expectedShares,
    });

    if (options.dryRun === true) {
      let fromAddr: string | undefined;
      let estGas: bigint | undefined;
      let needsApprove: boolean | undefined;
      const maybePk = process.env.MAIN_PRIVATE_KEY;
      let signer: Wallet | undefined;
      if (maybePk) {
        signer = new Wallet(maybePk, provider);
        fromAddr = await signer.getAddress();
      } else if (process.env.WALLET_ADDRESS) {
        fromAddr = process.env.WALLET_ADDRESS;
      }

      // Preview the exact tx we would send
      const txPreview: any = {
        to: built.to,
        from: fromAddr,
        data: built.data,
        value: built.value === 0n ? undefined : built.value,
      };

      // Attempt gas estimation (prefer signer path if available)
      try {
        if (signer) {
          estGas = await signer.estimateGas({
            to: built.to,
            data: built.data,
            value: built.value,
          });
        } else {
          estGas = await provider.estimateGas({
            to: built.to,
            data: built.data,
            from: fromAddr,
            value: built.value,
          });
        }
      } catch (e: any) {
        const decoded = decodeRouterRevert(e);
        console.error(
          "Gas estimation failed. This indicates the tx would revert.",
        );
        if (decoded.name || decoded.signature) {
          console.error(
            `- Revert (router): ${decoded.name ?? ""}${decoded.signature ? ` (${decoded.signature})` : ""}`.trim(),
          );
        }
        if (decoded.selector) console.error(`- Selector: ${decoded.selector}`);
        if (decoded.words && decoded.words.length > 0 && options.debug) {
          console.error(`- Data words (${decoded.words.length}):`);
          for (const [i, w] of decoded.words.entries()) {
            console.error(`  [${i}] ${w}`);
          }
        }

        // Try decoding with Rewarder ABI from src/abi/baseusd/Rewarder.json (if present)
        try {
          const rewarderAbi = await readRewarderAbi();
          if (rewarderAbi) {
            const alt = tryDecodeWithAbi(e, rewarderAbi);
            if (alt?.name || alt?.signature) {
              console.error(
                `- Revert (rewarder): ${alt.name ?? ""}${alt.signature ? ` (${alt.signature})` : ""}`.trim(),
              );
            }
          } else {
            console.error(
              "- Rewarder ABI not found at src/abi/baseusd/Rewarder.json",
            );
            console.error("  Fetch and save it with:");
            console.error(
              "  npm run dev -- abi 0x4103A467166bbbDA3694AB739b391db6c6630595 --chain base > src/abi/baseusd/Rewarder.json",
            );
          }
        } catch {}

        if (decoded.reason) console.error(`- Reason: ${decoded.reason}`);
        if (decoded.raw) console.error(`- Raw: ${decoded.raw}`);
      }

      // Check allowance and USDC balance if we have a from address
      if (fromAddr) {
        try {
          const usdc = new Contract(USDC_ADDRESS, erc20Abi, provider);
          const [allowance, balance]: [bigint, bigint] = await Promise.all([
            withRetry(() => usdc.allowance(fromAddr, built.to)),
            withRetry(() => usdc.balanceOf(fromAddr)),
          ]);
          needsApprove = allowance < assets;
          if (options.debug) {
            console.log(
              `USDC balance: ${formatUnits(balance, 6)} (atomic ${balance})`,
            );
            console.log(
              `USDC allowance: ${formatUnits(allowance, 6)} (atomic ${allowance})`,
            );
          }
          if (balance < assets) {
            console.warn(
              "Warning: USDC balance is less than requested deposit amount. This would cause a revert.",
            );
          }
        } catch {
          // ignore allowance/balance errors in dry-run
        }
      }

      const feeData = await withRetry(() => provider.getFeeData());
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

      console.log("--- baseUSD Add (dry-run) ---");
      console.log(`Router: ${built.to}`);
      console.log(`Vault: ${BASEUSD_ADDRESS}`);
      console.log(
        `Assets (USDC): ${assetsHuman} (atomic ${assets.toString()})`,
      );
      console.log(
        `Expected shares (baseUSD): ${sharesHuman} (atomic ${expectedShares.toString()})`,
      );
      console.log(
        `Slippage: ${slippageBps} bps; minSharesOut: ${formatUnits((expectedShares * BigInt(10000 - slippageBps)) / 10000n, 18)} (atomic ${minSharesOut.toString()})`,
      );
      if (sharesPerUsdc && usdcPerShare) {
        console.log(
          `Exchange rate ~ shares/USDC: ${sharesPerUsdc}, USDC/share: ${usdcPerShare}`,
        );
      }
      console.log("Tx preview:");
      console.log(`  to: ${txPreview.to}`);
      console.log(`  from: ${txPreview.from ?? "(not set)"}`);
      console.log(
        `  value: ${formatUnits((txPreview.value ?? 0n) as bigint, 18)} ETH`,
      );
      console.log(`  data: ${((txPreview.data?.length ?? 2) - 2) / 2} bytes`);
      if (needsApprove !== undefined) {
        console.log(
          `USDC allowance for router is ${needsApprove ? "insufficient (approval required)" : "sufficient"}`,
        );
      }
      if (estGas) console.log(`Estimated gas: ${estGas.toString()} units`);
      if (gasPrice)
        console.log(
          `Assumed max fee per gas: ${formatUnits(gasPrice, 9)} gwei`,
        );
      if (estGas && gasPrice)
        console.log(
          `Estimated upper-bound cost: ${formatUnits(estCost, 18)} ETH`,
        );
      console.log(
        `Inner calls: ${built.inner.map((c) => c.name).join(" -> ")}`,
      );
      if (options.debug) {
        try {
          const deadlineCall = built.inner.find((c) => c.name === "expiration");
          if (deadlineCall && typeof deadlineCall.args?.[0] === "bigint") {
            const ts = Number(deadlineCall.args[0]);
            const iso = new Date(ts * 1000).toISOString();
            console.log(`Deadline: ${ts} (${iso})`);
          }
          console.log("Inner call args (debug):");
          for (const c of built.inner) {
            console.log(
              `  ${c.name}(${c.args.map((a: any) => (typeof a === "bigint" ? a.toString() : String(a))).join(", ")})`,
            );
          }
        } catch {}
      }
      // Optional probe for slippage values to see which would pass (dry-run only)
      if (options.probeSlippage) {
        const list = options.probeSlippage
          .split(",")
          .map((s) => parseInt(s.trim(), 10))
          .filter((n) => !isNaN(n));
        if (list.length > 0) {
          console.log("Slippage probe (bps => result):");
          for (const bps of list) {
            const minOutProbe = (expectedShares * BigInt(10000 - bps)) / 10000n;
            const probeBuilt = buildDepositStakeMulticall(amount, {
              minSharesOutOverride: minOutProbe,
              slippageBps: bps,
            });
            let ok = false;
            try {
              if (signer) {
                await signer.estimateGas({
                  to: probeBuilt.to,
                  data: probeBuilt.data,
                  value: probeBuilt.value,
                });
              } else {
                await provider.estimateGas({
                  to: probeBuilt.to,
                  data: probeBuilt.data,
                  from: fromAddr,
                  value: probeBuilt.value,
                });
              }
              ok = true;
            } catch (e: any) {
              const d = decodeRouterRevert(e);
              const tag = d.name ?? d.selector ?? "revert";
              console.log(`  ${bps} -> FAIL (${tag})`);
            }
            if (ok) {
              console.log(`  ${bps} -> OK`);
            }
          }
        }
      }

      // Exit with non-zero if estimation failed so callers can detect reverts programmatically
      if (!estGas) process.exit(1);
      return;
    }

    const pk = process.env.MAIN_PRIVATE_KEY;
    if (!pk) {
      console.error(
        "MAIN_PRIVATE_KEY is required for live execution. Set it in your environment.",
      );
      process.exit(1);
      return;
    }

    const signer = new Wallet(pk, provider);

    // Execute via core then print summary
    const result = await baseusdAddCore(amount);

    console.log("--- baseUSD Add (result) ---");
    // If approval executed, we would have printed its tx already below when sending
    console.log(
      `Total gas paid: ${formatUnits(result.deposit.totalFeeWei + (result.approval?.totalFeeWei ?? 0n), 18)} ETH`,
    );
  } catch (error) {
    console.error("Error executing baseusd:add:", error);
    process.exit(1);
  }
}

/**
 * Utility function to execute a transaction with automatic nonce management and retry logic.
 * This prevents nonce-related errors by always fetching the latest nonce from the blockchain
 * and retrying if a nonce error occurs.
 */
async function executeWithNonceRetry(
  provider: JsonRpcProvider,
  owner: string,
  txFn: (nonce: number) => Promise<any>,
  maxRetries: number = 2,
): Promise<any> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // Always fetch the latest nonce from the blockchain (not from cache)
      const nonce = await provider.getTransactionCount(owner, "latest");
      console.log(
        `[Attempt ${attempt + 1}/${maxRetries + 1}] Using nonce ${nonce}`,
      );
      return await txFn(nonce);
    } catch (error: any) {
      const isNonceError =
        error.code === "NONCE_EXPIRED" ||
        error.message?.includes("nonce") ||
        error.message?.includes("NONCE_EXPIRED");

      if (isNonceError && attempt < maxRetries) {
        console.log(
          `Nonce error detected on attempt ${attempt + 1}, retrying with fresh nonce...`,
        );
        // Wait 1 second before retrying to allow blockchain state to propagate
        await new Promise((resolve) => setTimeout(resolve, 1000));
        continue;
      }
      throw error;
    }
  }
}

export async function baseusdAddCore(
  amount: string,
): Promise<BaseusdAddResult> {
  if (!amount || isNaN(Number(amount))) {
    throw new Error("Amount (USDC decimal string) is required, e.g., 250.5");
  }

  const rpcUrlCore = getBaseRpcUrl();
  const provider = new JsonRpcProvider(rpcUrlCore);
  const network = await provider.getNetwork();
  if (network.chainId !== BASE_CHAIN_ID) {
    throw new Error(
      `Connected to wrong network (chainId ${network.chainId}). Expected Base (8453).`,
    );
  }

  const USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
  const assets = parseUnits(amount, 6);

  const BASEUSD_ADDRESS = "0x9c6864105AEC23388C89600046213a44C384c831";
  const vault = new Contract(BASEUSD_ADDRESS, baseUsdAbi as any, provider);
  let vaultAsset: string;
  try {
    vaultAsset = await withRetry(() => vault.asset());
  } catch {
    throw new Error("Failed to read baseUSD.asset() for ERC-4626 validation");
  }
  if (vaultAsset?.toLowerCase() !== USDC_ADDRESS.toLowerCase()) {
    throw new Error(
      `Vault asset mismatch: expected USDC ${USDC_ADDRESS}, got ${vaultAsset}`,
    );
  }

  let expectedShares: bigint;
  try {
    expectedShares = await withRetry(() => vault.convertToShares(assets));
  } catch (e) {
    throw new Error("Failed to quote convertToShares for baseUSD");
  }
  if (expectedShares <= 0n) {
    throw new Error("Vault returned zero shares for non-zero assets; aborting");
  }

  const slippageBps = 10; // default 0.10%
  const minSharesOut = (expectedShares * BigInt(10000 - slippageBps)) / 10000n;

  const built = buildDepositStakeMulticall(amount, {
    minSharesOutOverride: minSharesOut,
    slippageBps,
    approveBaseUsdAmountOverride: expectedShares,
  });

  const pk = process.env.MAIN_PRIVATE_KEY;
  if (!pk) {
    throw new Error(
      "MAIN_PRIVATE_KEY is required for live execution. Set it in your environment.",
    );
  }

  const signer = new Wallet(pk, provider);

  // Ensure USDC allowance for router is sufficient; if not, approve exact amount
  const usdc = new Contract(USDC_ADDRESS, erc20Abi, provider);
  const owner = await signer.getAddress();
  const currentAllowance: bigint = await withRetry(() =>
    usdc.allowance(owner, built.to),
  );

  let approvalTotal: bigint | undefined;
  if (currentAllowance < assets) {
    console.log(
      `Approving ${formatUnits(assets, 6)} USDC for router ${built.to}...`,
    );
    const usdcWithSigner: any = usdc.connect(signer);

    // Execute approval with explicit nonce management and retry logic
    const approveTx = await executeWithNonceRetry(
      provider,
      owner,
      async (nonce) => {
        console.log(
          `Submitting approval transaction with nonce ${nonce}...`,
        );
        return await usdcWithSigner.approve(built.to, assets, { nonce });
      },
    );

    console.log(`Submitted approve tx: ${approveTx.hash}`);
    const approveRcpt = await approveTx.wait();
    if (!approveRcpt)
      throw new Error("Approve transaction did not return a receipt");
    const approvalFees = await computeTxFeesWei(
      provider,
      approveTx as any,
      approveRcpt as any,
    );
    approvalTotal = approvalFees.totalFeeWei;
    console.log(
      `Approval completed. Gas paid: ${formatUnits(approvalTotal, 18)} ETH`,
    );
  } else {
    console.log(
      `USDC allowance already sufficient (${formatUnits(currentAllowance, 6)} >= ${formatUnits(assets, 6)})`,
    );
  }

  // Execute deposit with explicit nonce management and retry logic
  console.log("Submitting deposit transaction...");
  const tx = await executeWithNonceRetry(
    provider,
    owner,
    async (nonce) => {
      console.log(`Submitting deposit transaction with nonce ${nonce}...`);
      return await signer.sendTransaction({
        to: built.to,
        data: built.data,
        value: built.value,
        nonce,
      });
    },
  );

  console.log(`Submitted tx: ${tx.hash}`);
  const receipt = await tx.wait();
  if (!receipt)
    throw new Error("Transaction submitted but no receipt was returned");
  const depositFees = await computeTxFeesWei(
    provider,
    tx as any,
    receipt as any,
  );
  console.log(
    `Deposit completed. Gas paid: ${formatUnits(depositFees.totalFeeWei, 18)} ETH`,
  );

  return {
    approval:
      approvalTotal !== undefined
        ? { executed: true, totalFeeWei: approvalTotal }
        : undefined,
    deposit: { totalFeeWei: depositFees.totalFeeWei },
    depositedUsdcAtomic: assets,
    usdcDecimals: 6,
  };
}

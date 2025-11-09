import { Interface, ParamType, parseUnits } from "ethers";
import routerAbi from "../../abi/baseusd/AutopilotRouter.json" with { type: "json" };
import templateBytes from "../../abi/baseusd/baseusd_multicall_template.json" with { type: "json" };

export interface BuildOptions {
  slippageBps?: number; // default 10 = 0.10%
  deadlineMinutes?: number; // default 20 minutes
  // When provided, use this shares-based minOut instead of inferring from amountIn heuristics
  minSharesOutOverride?: bigint;
  // When provided, use this amount for approve() when the token is baseUSD (shares),
  // instead of defaulting to amountIn (assets)
  approveBaseUsdAmountOverride?: bigint;
}

export interface BuildResult {
  to: string;
  data: `0x${string}`;
  value: bigint;
  chainId: bigint;
  inner: { name: string; args: any[]; data: `0x${string}` }[];
}

const ROUTER_ADDRESS = "0x4D2b87339b1f9e480aA84c770fa3604D7D40f8DF";
const USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const BASEUSD_ADDRESS = "0x9c6864105AEC23388C89600046213a44C384c831";
const REWARDER_ADDRESS = "0x4103A467166bbbDA3694AB739b391db6c6630595";

const MAX_UINT256 = (1n << 256n) - 1n;

// Helper: detect if a bigint is the all-ones max (uint256 max)
function isMaxUint(value: bigint): boolean {
  return value === MAX_UINT256;
}

// Parse the known template to discover which argument represents the variable amount
function analyzeTemplate(): {
  decoded: { name: string; args: any[] }[];
  templateAmount?: bigint;
} {
  const iface = new Interface(routerAbi as any);
  const decoded = (templateBytes as string[]).map((d) => {
    const parsed = iface.parseTransaction({ data: d as `0x${string}` });
    if (!parsed) throw new Error("Failed to parse template transaction");
    return { name: parsed.name, args: parsed.args as any[] };
  });

  // Find the most common small-ish uint among args; use it as the template amount (likely 440 USDC => 440e6)
  const counts = new Map<string, number>();
  for (const item of decoded) {
    for (const arg of item.args) {
      if (typeof arg === "bigint" && arg !== 0n && !isMaxUint(arg)) {
        const k = arg.toString();
        counts.set(k, (counts.get(k) ?? 0) + 1);
      }
    }
  }
  let candidate: bigint | undefined;
  let maxCount = 0;
  for (const [k, c] of counts.entries()) {
    if (c > maxCount) {
      maxCount = c;
      candidate = BigInt(k);
    }
  }
  return { decoded, templateAmount: candidate };
}

export function buildDepositStakeMulticall(
  amountUsdcDecimal: string,
  opts: BuildOptions = {},
): BuildResult {
  const slippageBps = opts.slippageBps ?? 10; // 0.10%
  const deadlineMinutes = opts.deadlineMinutes ?? 20;
  const amountIn = parseUnits(amountUsdcDecimal, 6); // USDC has 6 decimals (assets)
  // Fallback minOut computed from assets if no shares override provided. In ERC-4626 flow we expect override.
  const fallbackMinOut = (amountIn * BigInt(10000 - slippageBps)) / 10000n;
  const minOutShares = opts.minSharesOutOverride ?? fallbackMinOut;
  const deadline = BigInt(Math.floor(Date.now() / 1000) + deadlineMinutes * 60);

  const iface = new Interface(routerAbi as any);
  // Ensure router has multicall(bytes[])
  const multi = iface.getFunction("multicall");
  if (!multi) {
    throw new Error("Router ABI missing multicall(bytes[])");
  }

  const { decoded, templateAmount } = analyzeTemplate();
  if (!templateAmount) {
    throw new Error(
      "Unable to determine template amount from provided template",
    );
  }

  // Build new inner calls by substituting:
  // - Explicitly set amount/minSharesOut by parameter name for deposit-related functions
  // - Replace deadline-like single-uint calls with new deadline
  // - Fallback: replace any bigint equal to templateAmount with amountIn (first occurrence) and minOutShares (second occurrence)
  // - Safety: if a parameter name includes 'min' and value is MAX_UINT256, replace with minOutShares
  const innerDatas: `0x${string}`[] = [];
  const innerVerbose: { name: string; args: any[]; data: `0x${string}` }[] = [];

  for (const t of decoded) {
    const frag = iface.getFunction(t.name);
    if (!frag)
      throw new Error(`Function fragment not found in ABI for ${t.name}`);
    const newArgs = [...t.args];

    // Parameter meta
    const paramMeta = frag.inputs.map((p) => ParamType.from(p));
    const paramTypes = paramMeta.map((p) => p.type);
    const hasOnlyOneUint =
      paramTypes.length === 1 && paramTypes[0].startsWith("uint");
    const hasAddressInput = paramTypes.some(
      (ty) => ty === "address" || ty.startsWith("address"),
    );

    // 1) Deadline-like setter (e.g., expiration(uint256))
    if (hasOnlyOneUint && !hasAddressInput) {
      newArgs[0] = deadline;
    } else {
      // 2) Named handling for deposit variants
      const name = frag.name;

      // Helper to find index by parameter name
      const findIndexByName = (n: string) =>
        paramMeta.findIndex(
          (pm) => (pm.name || "").toLowerCase() === n.toLowerCase(),
        );

      if (name === "deposit") {
        const amountIdx = findIndexByName("amount");
        const minIdx = findIndexByName("minSharesOut");
        if (amountIdx >= 0) newArgs[amountIdx] = amountIn;
        if (minIdx >= 0) newArgs[minIdx] = minOutShares;
      } else if (name === "depositBalance" || name === "depositMax") {
        const minIdx = findIndexByName("minSharesOut");
        if (minIdx >= 0) newArgs[minIdx] = minOutShares;
      } else if (name === "approve") {
        // approve(IERC20 token, address to, uint256 amount)
        const amountIdx = findIndexByName("amount");
        const tokenIdx = findIndexByName("token");
        if (
          tokenIdx >= 0 &&
          typeof newArgs[tokenIdx] === "string" &&
          (newArgs[tokenIdx] as string).toLowerCase() ===
            BASEUSD_ADDRESS.toLowerCase()
        ) {
          // For baseUSD approvals to rewarder, preserve MAX_UINT256 from template
          // This allows staking all router-held shares, including residuals
          if (opts.approveBaseUsdAmountOverride !== undefined) {
            newArgs[amountIdx] = opts.approveBaseUsdAmountOverride;
          }
          // else: keep the template value (MAX_UINT256)
        } else if (amountIdx >= 0) {
          newArgs[amountIdx] = amountIn;
        }
      } else {
        // 3) Fallback heuristic: replace templateAmount occurrences
        for (let i = 0; i < newArgs.length; i++) {
          const v = newArgs[i];
          if (typeof v === "bigint" && v === templateAmount) {
            const priorHits = newArgs
              .slice(0, i)
              .filter(
                (x) => typeof x === "bigint" && x === templateAmount,
              ).length;
            newArgs[i] = priorHits === 0 ? amountIn : minOutShares;
          }
        }
      }

      // 4) Safety pass: replace any MAX_UINT256 for parameters with 'min' in their name
      for (let i = 0; i < newArgs.length; i++) {
        const pm = paramMeta[i];
        if (!pm) continue;
        const isUint = pm.type.startsWith("uint");
        const hasMinInName = (pm.name || "").toLowerCase().includes("min");
        if (
          isUint &&
          hasMinInName &&
          typeof newArgs[i] === "bigint" &&
          (newArgs[i] as bigint) === MAX_UINT256
        ) {
          newArgs[i] = minOutShares;
        }
      }
    }

    const data = iface.encodeFunctionData(frag, newArgs) as `0x${string}`;
    innerDatas.push(data);
    innerVerbose.push({ name: t.name, args: newArgs, data });
  }

  const outerData = iface.encodeFunctionData("multicall", [
    innerDatas,
  ]) as `0x${string}`;
  return {
    to: ROUTER_ADDRESS,
    data: outerData,
    value: 0n,
    chainId: 8453n,
    inner: innerVerbose,
  };
}

# baseUSD Deposit Allowance Error - Troubleshooting & Fix

**Date:** November 9, 2025  
**Error:** `ERC20InsufficientAllowance` during daily auto-compound  
**Status:** ✅ Fixed

---

## Executive Summary

The daily auto-compound process failed when attempting to deposit USDC rewards into baseUSD and stake the resulting shares. The root cause was a mismatch between the amount of baseUSD shares approved to the rewarder contract and the total amount the router attempted to stake, due to residual shares from a previous operation.

**Fix:** Modified the multicall builder to preserve `MAX_UINT256` approval for baseUSD shares, allowing the router to stake all shares it holds, including residuals.

---

## Error Details

### Initial Error Message

```
[2025-11-09 05:00:05]
Auto-compound: baseUSD deposit failed {
  summary: 'execution reverted (unknown custom error) | code=CALL_EXCEPTION | selector=0xfb8f41b2',
  code: 'CALL_EXCEPTION',
  reason: 'execution reverted',
  selector: '0xfb8f41b2',
}
```

### Transaction Context

From `logs/daily-output.log`:
- **FLP compound succeeded**: 15.87 USDC received
- **Approval transaction succeeded**: 15.871783 USDC approved for router
- **Deposit transaction failed**: During gas estimation phase

---

## Troubleshooting Process

### Step 1: Decode Error Selector

**Error Selector:** `0xfb8f41b2`

Using the baseUSD vault ABI (`src/abi/baseusd/baseUSD.json`), we decoded this as:
```
ERC20InsufficientAllowance(address spender, uint256 allowance, uint256 needed)
```

**Decoded Parameters:**
```
spender:   0x4103A467166bbbDA3694AB739b391db6c6630595 (Rewarder)
allowance: 15262694261569703120 wei (15.26 baseUSD shares)
needed:    16261164397367792132 wei (16.26 baseUSD shares)
shortage:  998470135798089012 wei (0.998 baseUSD shares)
```

### Step 2: Analyze the Multicall Template

The baseUSD deposit uses a 6-step multicall (`src/abi/baseusd/baseusd_multicall_template.json`):

1. **expiration()** - Set deadline
2. **pullToken(USDC)** - Pull USDC from wallet to router
3. **approve(USDC → vault)** - Approve vault to spend USDC
4. **deposit()** - Deposit USDC, receive baseUSD shares
5. **approve(baseUSD → rewarder)** - Approve rewarder to spend baseUSD shares
6. **stakeVaultToken(MAX_UINT256)** - Stake all baseUSD shares

**Problem Identified:** Step 5 vs Step 6 mismatch
- Step 5: Approved only expected shares from current deposit (~15.26)
- Step 6: Attempted to stake ALL shares in router (~16.26)

### Step 3: Check for Residual Shares

**Wallet Balance Check:**
```
Unstaked baseUSD (in wallet): 0.0 shares
Staked baseUSD (in rewarder):  9953.124384665631928998 shares
```

The wallet had no unstaked shares, confirming the issue was **residual shares in the router**, not the wallet.

### Step 4: Trace the Code Path

**In `src/commands/baseusdAdd.ts`:**
```typescript
const built = buildDepositStakeMulticall(amount, {
  minSharesOutOverride: minSharesOut,
  slippageBps,
  approveBaseUsdAmountOverride: expectedShares,  // ❌ This was the problem
});
```

**In `src/api/baseusd/routerMulticallBuilder.ts`:**
```typescript
} else if (name === 'approve') {
  const amountIdx = findIndexByName('amount');
  const tokenIdx = findIndexByName('token');
  if (
    tokenIdx >= 0 &&
    typeof newArgs[tokenIdx] === 'string' &&
    (newArgs[tokenIdx] as string).toLowerCase() === BASEUSD_ADDRESS.toLowerCase() &&
    opts.approveBaseUsdAmountOverride !== undefined
  ) {
    newArgs[amountIdx] = opts.approveBaseUsdAmountOverride;  // ❌ Overrides MAX_UINT256
  }
}
```

### Step 5: Root Cause Identified

The multicall builder was overriding the template's `MAX_UINT256` approval with a calculated `expectedShares` value. This meant:

1. **Previous operation** left ~1.00 baseUSD shares in the router
2. **Current deposit** would add ~15.26 shares
3. **Total in router**: ~16.26 shares
4. **Approval given**: ~15.26 shares (only for current deposit)
5. **Attempted to stake**: ~16.26 shares (all shares via MAX_UINT256)
6. **Result**: Insufficient allowance error

---

## The Fix

### Changes Made

#### 1. `src/commands/baseusdAdd.ts` (lines 576-581)

**Before:**
```typescript
const built = buildDepositStakeMulticall(amount, {
  minSharesOutOverride: minSharesOut,
  slippageBps,
  approveBaseUsdAmountOverride: expectedShares,
});
```

**After:**
```typescript
const built = buildDepositStakeMulticall(amount, {
  minSharesOutOverride: minSharesOut,
  slippageBps,
  // Don't override approve amount - let template use MAX_UINT256 to stake all router shares
  // This handles residual baseUSD shares from previous operations
});
```

#### 2. `src/api/baseusd/routerMulticallBuilder.ts` (lines 138-157)

**Before:**
```typescript
} else if (name === 'approve') {
  const amountIdx = findIndexByName('amount');
  const tokenIdx = findIndexByName('token');
  if (
    tokenIdx >= 0 &&
    typeof newArgs[tokenIdx] === 'string' &&
    (newArgs[tokenIdx] as string).toLowerCase() === BASEUSD_ADDRESS.toLowerCase() &&
    opts.approveBaseUsdAmountOverride !== undefined
  ) {
    newArgs[amountIdx] = opts.approveBaseUsdAmountOverride;
  } else if (amountIdx >= 0) {
    newArgs[amountIdx] = amountIn;
  }
}
```

**After:**
```typescript
} else if (name === 'approve') {
  const amountIdx = findIndexByName('amount');
  const tokenIdx = findIndexByName('token');
  if (
    tokenIdx >= 0 &&
    typeof newArgs[tokenIdx] === 'string' &&
    (newArgs[tokenIdx] as string).toLowerCase() === BASEUSD_ADDRESS.toLowerCase()
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
}
```

### How It Works Now

1. Router approves rewarder for `MAX_UINT256` baseUSD shares (unlimited)
2. `stakeVaultToken()` can stake all shares the router holds
3. Any residual shares from previous operations are automatically included
4. No more allowance errors

---

## Verification

### Build & Test Results
```bash
$ npm run build
✅ No compilation errors

$ npm run lint
✅ Type checking passed

$ npm test
✅ Test Files: 39 passed (39)
✅ Tests: 630 passed (630)
```

### Expected Behavior

The next daily auto-compound (scheduled for 5:00 AM CT) will:
1. Claim USDC rewards from FLP
2. Approve exact USDC amount to router
3. Deposit USDC into baseUSD vault
4. **Approve unlimited baseUSD shares to rewarder** (new behavior)
5. **Stake all baseUSD shares in router** (including any residuals)
6. Complete successfully without allowance errors

---

## Lessons Learned

### Why This Error Occurred

1. **Incomplete transactions**: A previous deposit/stake operation may have been interrupted, leaving residual shares in the router
2. **Overly precise approvals**: Approving only the expected amount didn't account for edge cases
3. **Template override**: The code was overriding a sensible default (MAX_UINT256) with calculated values

### Design Principles Applied

1. **Simplicity**: Use unlimited approvals for internal router operations
2. **Robustness**: Handle residual balances gracefully
3. **Preserve defaults**: Don't override template values unless necessary
4. **Clear intent**: Document why we're using MAX_UINT256

### Future Considerations

- Monitor router balances to detect if residual shares accumulate over time
- Consider adding cleanup logic to periodically sweep residual shares
- Add logging to show when residual shares are being staked

---

## Related Files

- **Error logs:** `logs/daily-error.log`
- **Output logs:** `logs/daily-output.log`
- **Fixed files:**
  - `src/commands/baseusdAdd.ts`
  - `src/api/baseusd/routerMulticallBuilder.ts`
- **Template:** `src/abi/baseusd/baseusd_multicall_template.json`
- **ABI:** `src/abi/baseusd/baseUSD.json`

---

## Appendix: Technical Details

### Contract Addresses (Base Mainnet)

| Contract | Address |
|----------|---------|
| USDC | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |
| baseUSD Vault | `0x9c6864105AEC23388C89600046213a44C384c831` |
| Autopilot Router | `0x4D2b87339b1f9e480aA84c770fa3604D7D40f8DF` |
| Rewarder | `0x4103A467166bbbDA3694AB739b391db6c6630595` |

### Error Selector Reference

```solidity
// ERC20InsufficientAllowance selector: 0xfb8f41b2
error ERC20InsufficientAllowance(
    address spender,    // Who tried to spend
    uint256 allowance,  // Current allowance
    uint256 needed      // Amount they tried to spend
);
```

### Multicall Flow Diagram

```
User Wallet
    │
    │ 1. pullToken(USDC, amount)
    ▼
Router (holds USDC)
    │
    │ 2. approve(vault, USDC)
    │ 3. deposit(vault, USDC) → receives baseUSD shares
    ▼
Router (holds baseUSD shares + residuals)
    │
    │ 4. approve(rewarder, MAX_UINT256)  ← Fixed to use MAX_UINT256
    │ 5. stakeVaultToken(MAX_UINT256)    ← Stakes ALL shares
    ▼
Rewarder (staked baseUSD shares)
    │
    ▼
Earning rewards
```

---

**Document Version:** 1.0  
**Last Updated:** November 9, 2025  
**Author:** AI Assistant (troubleshooting session with sirsean)

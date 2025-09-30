# Flex Perpetuals TypeScript SDK Implementation

## Overview

This document outlines the implementation plan for integrating Flex Perpetuals trading on Base mainnet into the defi-stuff project. The implementation is based on analysis of the [Flex Perpetuals Python SDK](https://github.com/Flex-Community/fp-sdk-python).

## Executive Summary

**Objective**: Enable BTC perpetual trading on Flex (Base mainnet) with comprehensive risk management.

**Key Decisions**:
- Network: Base mainnet (chain ID 8453)
- Orders: On-chain orders (with future intent-based option)
- Initial market: BTC (architecture supports all markets)
- Private key: MAIN_PRIVATE_KEY (already configured)
- Risk management: Built-in position sizing, leverage checks, liquidation monitoring

**Scope**: ~15-20 TypeScript files + comprehensive tests

## Architecture

### SDK Structure
```
src/api/flex/
├── contracts/              # Smart contract ABIs
│   ├── ERC20.json
│   ├── CrossMarginHandler.json
│   ├── LimitTradeHandler.json
│   ├── VaultStorage.json
│   ├── PerpStorage.json
│   ├── ConfigStorage.json
│   ├── Calculator.json
│   └── ... (12 total ABIs)
├── constants.ts            # Addresses, markets, tokens
├── utils.ts                # Conversions, multicall, helpers
├── flexPublicService.ts    # Read-only operations
├── flexPrivateService.ts   # Transaction operations
└── riskManagement.ts       # Position sizing, validation

src/commands/flex/
├── flexBalance.ts          # Check margin position
├── flexPositions.ts        # View open positions
├── flexPrice.ts            # Get market prices
├── flexOrder.ts            # Place orders
├── flexClose.ts            # Close positions
└── flexOrders.ts           # Manage orders

src/types/flex.ts           # TypeScript types
```

### Base Mainnet Contract Addresses

```typescript
CROSS_MARGIN_HANDLER: 0x8eBcF0b886188467B6ad9199535F2666E4e9d48F
LIMIT_TRADE_HANDLER:  0x0d8294F7fa786dF50A15c94C93C28d85fb2A2116
VAULT_STORAGE:        0x1375653D8a328154327e48A203F46Aa70B6C0b92
PERP_STORAGE:         0x734a1FB1fd54233f7Cad4345C8fc0135340c4b53
CONFIG_STORAGE:       0x1b92F5C0787bde0d2Aa21110f8f2a77595523598
CALCULATOR:           0x651e03A1A9D1657C870Ee22165C331bebAeAEd97
TRADE_HELPER:         0x92E4a331F76042f3e449002cF6960111C2f04815
MULTICALL:            0xcA11bde05977b3631167028862bE2a173976CA11
```

### Markets

```typescript
BASE_MARKET_ETH_USD = 0
BASE_MARKET_BTC_USD = 1
BASE_MARKET_SOL_USD = 2
BASE_MARKET_XRP_USD = 3
// ... 22 markets total
```

## Key Features

### Public Service (Read-Only)
- ✅ Get market prices (oracle + adaptive pricing)
- ✅ View market info (funding rates, borrowing rates, fees)
- ✅ Check open positions (PnL, fees, liquidation price)
- ✅ View collateral balances (margin, equity)
- ✅ Check leverage and liquidation risk
- ✅ View pending orders

### Private Service (Transactions)
- ✅ Deposit/withdraw USDC margin
- ✅ Place market orders
- ✅ Place limit/stop orders
- ✅ Update existing orders
- ✅ Cancel orders
- ✅ Close positions

### Risk Management
- ✅ Position sizing (fixed-fraction risk)
- ✅ Leverage validation
- ✅ Liquidation risk monitoring
- ✅ Pre-trade validation
- ✅ Stop-loss/take-profit calculation

## Technical Details

### On-Chain Precision
- All contract values use e30 (10^30) precision
- USD amounts: multiply by 1e30
- Conversions:
  ```typescript
  toE30(n: number): bigint     // 100 → 100000000000000000000000000000000n
  fromE30(b: bigint): number   // 100000000000000000000000000000000n → 100
  ```

### Subaccounts
- Flex supports 256 subaccounts per wallet (0-255)
- Subaccount key = keccak256(abi.encodePacked(account, subAccountId))
- Isolates positions and margin across strategies

### Network Validation
- All operations must validate `chainId === 8453` (Base mainnet)
- Reject transactions on wrong network

### Gas & Fees
- Base uses EIP-1559: maxFeePerGas, maxPriorityFeePerGas
- Execution fee: ~0.0001 ETH per order (verify from protocol)
- Approval required for ERC20 deposits

## Implementation Phases

### Phase 1: Foundation (COMPLETED)
- ✅ Directory structure created
- ✅ Scaffold files with placeholders
- ✅ TypeScript compilation verified
- ⏳ Need to acquire ABIs
- ⏳ Need to populate constants
- ⏳ Need to implement utilities
- ⏳ Need to define types

### Phase 2: Public Service (Read-Only)
- Market data queries
- Position queries
- Account queries
- Multicall batching

### Phase 3: Private Service (Transactions)
- Collateral management
- Order execution
- Order management
- Transaction utilities

### Phase 4: Risk Management
- Position sizing algorithms
- Leverage validation
- Liquidation monitoring
- Order validation

### Phase 5: CLI Commands
- `flex:balance` - Check margin
- `flex:positions` - View positions
- `flex:price` - Get prices
- `flex:order` - Place orders
- `flex:close` - Close positions
- `flex:orders` - Manage orders

### Phase 6: Testing
- Unit tests (mocked contracts)
- Integration tests (Base mainnet read-only)
- Command tests (CLI output validation)

### Phase 7: Documentation
- Update WARP.md with usage
- Add env variables
- Document risk parameters

## Usage Examples

### Check Balance
```bash
npm run dev -- flex:balance --sub 0 --address 0xYourAddress
```

### View Positions
```bash
npm run dev -- flex:positions --subs 0,1
```

### Get BTC Price
```bash
npm run dev -- flex:price --market BTC
```

### Place Market Order
```bash
# Buy $1,000 BTC
npm run dev -- flex:order market --sub 0 --market BTC --side buy --size 1000
```

### Place Limit Order
```bash
# Sell $500 BTC at $64,000
npm run dev -- flex:order trigger --sub 0 --market BTC --side sell --size 500 --price 64000 --above false
```

### Close Position
```bash
# Close 50% of BTC position
npm run dev -- flex:close --sub 0 --market BTC --percent 50
```

## Environment Variables

Add to `.env`:
```bash
# Optional: Custom RPC (defaults to https://mainnet.base.org)
FLEX_RPC_URL=https://base-mainnet.g.alchemy.com/v2/YOUR_KEY

# Already configured
MAIN_PRIVATE_KEY=0x...
WALLET_ADDRESS=0x...
```

## Risk Management Parameters

### Default Risk Settings
- Max leverage: Per market (typically 10-30x)
- Position sizing: 1-2% account risk per trade
- Stop-loss: Market-dependent (volatility-adjusted)
- Liquidation buffer: 20% above maintenance margin

### Pre-Trade Validation
1. Check available margin
2. Verify leverage limits
3. Ensure liquidation buffer
4. Validate order size constraints

## Next Steps

1. **Acquire ABIs** - Download from Flex SDK or BaseScan
2. **Populate Constants** - Verify USDC address on Base
3. **Implement Utils** - Core conversion and helper functions
4. **Build Public Service** - Read-only operations
5. **Build Private Service** - Transaction operations
6. **Implement Risk Module** - Position sizing & validation
7. **Create CLI Commands** - User-facing interfaces
8. **Write Tests** - Comprehensive test coverage
9. **Documentation** - Update WARP.md

## Security Considerations

- ✅ Private key never exposed in logs
- ✅ Network validation before transactions
- ✅ Pre-trade risk validation
- ✅ Gas estimation before execution
- ✅ Approval management for ERC20 deposits
- ✅ Liquidation monitoring
- ⚠️ Test thoroughly on testnet first
- ⚠️ Start with small position sizes
- ⚠️ Monitor gas costs on Base

## Future Enhancements

- Intent-based orders (off-chain, cheaper gas)
- Additional markets (ETH, SOL, etc.)
- Pyth price attestation
- Database persistence for trade history
- Discord alerts for fills/liquidations
- Automated position management
- Portfolio rebalancing
- Multi-strategy support

## Resources

- [Flex Python SDK](https://github.com/Flex-Community/fp-sdk-python)
- [Flex Documentation](https://docs.flexperp.com/)
- [Base Network](https://base.org/)
- [BaseScan](https://basescan.org/)

---

**Status**: Phase 1.1 Complete (Directory structure and scaffolds created)
**Next**: Phase 1.2 (Acquire and add ABIs)
**Updated**: 2025-09-30
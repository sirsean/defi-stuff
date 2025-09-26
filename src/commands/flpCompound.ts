import { Contract, JsonRpcProvider, Wallet, formatUnits, getAddress, keccak256, toUtf8Bytes } from 'ethers';
import { ERC20_ABI } from '../abi/erc20.js';
import { COMPOUNDER2_ABI } from '../abi/compounder2.js';

interface FlpCompoundOptions {
  dryRun?: boolean;
}

// Constants
const BASE_CHAIN_ID = 8453n;
const DEFAULT_BASE_RPC = process.env.ALCHEMY_API_KEY
  ? `https://base-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`
  : 'https://mainnet.base.org';

// Addresses (checksummed below when used)
const COMPOUNDER2_ADDRESS = '0xEC883DB48859aC55F1eAC325dEB52e9939F641F6';
const USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';

// Hardcoded call parameters
const POOLS: string[] = [
  '0x053fa05d34c51afC5cb9f162Fab3fD675Ac06119',
  '0xF00e53B7F3112834625f5AD5d47dA0e6E427E660',
  '0xbD5E6070E1dd19Bd3af24A46caE2634dA9f22e5B'
];

const REWARDERS: string[][] = [
  [
    '0xE793ED0aec57E676A01e4b705E83d7CCa6F66e8E',
    '0x112DA1BBDF4114E733A0B515C0D1121E24C0C037',
    '0xAb4363a900df71636957Ca1ca0a063eC16428197'
  ],
  [
    '0x600C42Af51ad64EB07Ef87F1bc86276D671869C3',
    '0x6aEec6f833889A2f8d956F6Caf1CBc6375Bf5a32',
    '0x92221FdcC3F5f0BFbD1ba0d795065948Fb5f516C'
  ],
  [
    '0x1F18B94eD07b51b5e5B30f9fd5C23C7Aa50F7be5',
    '0x9E1FdF4513061143486512670E991AcB738f3Bb3',
    '0xbe89b96E31E4749A0EcEC15eEdF13fd5F4132360'
  ]
];

const START_EPOCH_TIMESTAMP = 1709769600n;
const NO_OF_EPOCHS = 57896044618658097711785492504343953926634992332820282019728792003956564819967n;
const IS_CROSS_CHAIN = false;
const OPTION = 0;

import { hexToAddressFromTopic, parseUsdcTransfersToRecipient } from './helpers/flpCompound.helpers.js';

export async function flpCompound(options: FlpCompoundOptions = {}): Promise<void> {
  try {
    const provider = new JsonRpcProvider(DEFAULT_BASE_RPC);
    const network = await provider.getNetwork();
    if (network.chainId !== BASE_CHAIN_ID) {
      console.error(`Connected to wrong network (chainId ${network.chainId}). Expected Base (8453).`);
      process.exit(1);
      return;
    }

    // Validate and checksum addresses
    const compounderAddr = getAddress(COMPOUNDER2_ADDRESS);
    const usdcAddr = getAddress(USDC_ADDRESS);

    // Build contract interfaces
    const compounderRead = new Contract(compounderAddr, COMPOUNDER2_ABI, provider);
    const usdcRead = new Contract(usdcAddr, ERC20_ABI, provider);

    // Prepare populated transaction data (use getFunction to avoid TS issues with dynamic ABI)
    const populated = await compounderRead
      .getFunction('compound')
      .populateTransaction(POOLS, REWARDERS, START_EPOCH_TIMESTAMP, NO_OF_EPOCHS, IS_CROSS_CHAIN, OPTION);

    const transferTopic = keccak256(toUtf8Bytes('Transfer(address,address,uint256)'));

    if (options.dryRun === true) {
      // Try to estimate gas without broadcasting
      let fromAddr: string | undefined;
      // Prefer MAIN_PRIVATE_KEY if available for accurate estimation
      const maybePk = process.env.MAIN_PRIVATE_KEY;
      if (maybePk) {
        const signer = new Wallet(maybePk, provider);
        fromAddr = await signer.getAddress();
      } else if (process.env.WALLET_ADDRESS) {
        fromAddr = getAddress(process.env.WALLET_ADDRESS);
      }

      let estGas: bigint | undefined;
      try {
        estGas = await provider.estimateGas({
          to: compounderAddr,
          data: populated.data!,
          from: fromAddr
        });
      } catch (e) {
        console.error('Gas estimation failed (no signer or node rejected estimation). You may set MAIN_PRIVATE_KEY for better accuracy.');
      }

      const feeData = await provider.getFeeData();
      const gasPrice = feeData.maxFeePerGas ?? feeData.gasPrice ?? 0n;
      const estCost = estGas ? estGas * gasPrice : 0n;

      console.log('--- Flex FLP Compound (dry-run) ---');
      console.log(`Compounder: ${compounderAddr}`);
      console.log(`Pools: ${POOLS.length}, Rewarders groups: ${REWARDERS.length}`);
      if (estGas) console.log(`Estimated gas: ${estGas.toString()} units`);
      if (gasPrice) console.log(`Assumed max fee per gas: ${formatUnits(gasPrice, 9)} gwei`);
      if (estGas && gasPrice) console.log(`Estimated upper-bound cost: ${formatUnits(estCost, 18)} ETH`);
      console.log('USDC received: N/A (depends on on-chain state at execution)');
      return;
    }

    // Live execution
    const pk = process.env.MAIN_PRIVATE_KEY;
    if (!pk) {
      console.error('MAIN_PRIVATE_KEY is required for live execution. Set it in your environment.');
      process.exit(1);
      return;
    }

    const signer = new Wallet(pk, provider);
    const from = await signer.getAddress();

    // Pre-balance
    const decimals: number = await usdcRead.decimals();
    const preBal: bigint = (await usdcRead.balanceOf(from)) as unknown as bigint;

    // Send transaction
    const compounderWrite = compounderRead.connect(signer);
    const tx = await compounderWrite
      .getFunction('compound')(
        POOLS, REWARDERS, START_EPOCH_TIMESTAMP, NO_OF_EPOCHS, IS_CROSS_CHAIN, OPTION
      );
    console.log(`Submitted tx: ${tx.hash}`);

    const receipt = await tx.wait();

    const gasUsed = receipt.gasUsed ?? 0n;
    const effectiveGasPrice = (receipt as any).effectiveGasPrice ?? 0n;
    const gasPaid = gasUsed * effectiveGasPrice;

    // Parse USDC received from logs (primary)
    let usdcReceived = parseUsdcTransfersToRecipient(
      (receipt as any).logs,
      transferTopic,
      usdcAddr,
      from
    );

    // Fallback to balance delta if logs produced zero
    if (usdcReceived === 0n) {
      const postBal: bigint = (await usdcRead.balanceOf(from)) as unknown as bigint;
      if (postBal > preBal) {
        usdcReceived = postBal - preBal;
      }
    }

    console.log('--- Flex FLP Compound (result) ---');
    console.log(`Network: Base (8453), Block: ${receipt.blockNumber}`);
    console.log(`Gas used: ${gasUsed.toString()} units`);
    console.log(`Effective gas price: ${formatUnits(effectiveGasPrice, 9)} gwei`);
    console.log(`Gas paid: ${formatUnits(gasPaid, 18)} ETH`);
    console.log(`USDC received: ${formatUnits(usdcReceived, decimals)} (raw ${usdcReceived.toString()})`);
    console.log(`Tx hash: ${receipt.hash}`);
  } catch (error) {
    console.error('Error executing FLP compound:', error);
    process.exit(1);
  }
}
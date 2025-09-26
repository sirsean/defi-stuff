import { AbiService } from '../api/explorers/abiService.js';
import { AbiOptions, BlockchainExplorer, EXPLORER_CONFIGS } from '../types/etherscan.js';

interface AbiCommandOptions {
  ignoreProxy?: boolean;
  chain?: string;
}

/**
 * Command to fetch and print a contract's ABI
 * @param address The contract address
 * @param options Command options
 */
export async function abi(address: string, options: AbiCommandOptions = {}): Promise<void> {
  try {
    if (!address) {
      console.error('Contract address parameter is required');
      process.exit(1);
      return;
    }

    // Validate Ethereum address format
    if (!address.match(/^0x[a-fA-F0-9]{40}$/)) {
      console.error('Invalid Ethereum address format');
      process.exit(1);
      return;
    }
    
    // Check if the specified chain is supported
    let chain: BlockchainExplorer = 'ethereum'; // Default to Ethereum
    
    if (options.chain) {
      if (!(options.chain in EXPLORER_CONFIGS)) {
        console.error(`Unsupported blockchain: ${options.chain}`);
        console.error(`Supported blockchains: ${Object.keys(EXPLORER_CONFIGS).join(', ')}`);
        process.exit(1);
        return;
      }
      chain = options.chain as BlockchainExplorer;
    }

    const abiService = new AbiService(chain);
    const abiOptions: AbiOptions = {
      address,
      checkForProxy: !options.ignoreProxy,
      chain
    };

    // Prepare message with blockchain and proxy info
    const explorerName = abiService.getExplorerName();
    let detectionMsg = options.ignoreProxy ? 'ignoring proxy' : 'with proxy detection';
    
    // Get the ABI JSON
    const abiJson = await abiService.getContractAbiJson(abiOptions);
    
    // Print the raw JSON to stdout (to be redirected to a file if needed)
    console.log(abiJson);
    
  } catch (error) {
    console.error('Error fetching contract ABI:', error);
    process.exit(1);
  }
}
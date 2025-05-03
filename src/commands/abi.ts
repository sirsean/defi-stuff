import { AbiService } from '../api/etherscan/abiService.js';
import { AbiOptions } from '../types/etherscan.js';

interface AbiCommandOptions {
  ignoreProxy?: boolean;
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

    const abiService = new AbiService();
    const abiOptions: AbiOptions = {
      address,
      checkForProxy: !options.ignoreProxy
    };

    // Check if we should detect proxy implementations
    if (!options.ignoreProxy) {
      console.log(`Fetching ABI for ${address} (with proxy detection)...`);
    } else {
      console.log(`Fetching ABI for ${address} (ignoring proxy)...`);
    }
    
    // Get the ABI JSON
    const abiJson = await abiService.getContractAbiJson(abiOptions);
    
    // Print the raw JSON to stdout (to be redirected to a file if needed)
    console.log(abiJson);
    
  } catch (error) {
    console.error('Error fetching contract ABI:', error);
    process.exit(1);
  }
}
import { AbiService } from "../api/explorers/abiService.js";
import {
  AbiOptions,
  BlockchainExplorer,
  EXPLORER_CONFIGS,
} from "../types/etherscan.js";
import { writeFile } from "fs/promises";
import path from "path";

interface AbiCommandOptions {
  ignoreProxy?: boolean;
  chain?: string;
  output?: string;
}

/**
 * Command to fetch and print a contract's ABI
 * @param address The contract address
 * @param options Command options
 */
export async function abi(
  address: string,
  options: AbiCommandOptions = {},
): Promise<void> {
  try {
    if (!address) {
      console.error("Contract address parameter is required");
      process.exit(1);
      return;
    }

    // Validate Ethereum address format
    if (!address.match(/^0x[a-fA-F0-9]{40}$/)) {
      console.error("Invalid Ethereum address format");
      process.exit(1);
      return;
    }

    // Check if the specified chain is supported
    let chain: BlockchainExplorer = "ethereum"; // Default to Ethereum

    if (options.chain) {
      if (!(options.chain in EXPLORER_CONFIGS)) {
        console.error(`Unsupported blockchain: ${options.chain}`);
        console.error(
          `Supported blockchains: ${Object.keys(EXPLORER_CONFIGS).join(", ")}`,
        );
        process.exit(1);
        return;
      }
      chain = options.chain as BlockchainExplorer;
    }

    const abiService = new AbiService(chain);
    const abiOptions: AbiOptions = {
      address,
      checkForProxy: !options.ignoreProxy,
      chain,
    };

    // Get the ABI JSON
    const abiJson = await abiService.getContractAbiJson(abiOptions);

    if (options.output) {
      // Write to file
      const outputPath = path.resolve(options.output);
      await writeFile(outputPath, abiJson, "utf-8");
      console.log(`ABI written to: ${outputPath}`);
    } else {
      // Print to stdout (current behavior)
      console.log(abiJson);
    }
  } catch (error) {
    console.error("Error fetching contract ABI:", error);
    process.exit(1);
  }
}

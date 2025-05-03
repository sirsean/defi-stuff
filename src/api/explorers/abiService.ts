import { BlockchainExplorerClient } from './blockchainExplorerClient.js';
import { AbiOptions, BlockchainExplorer, ProxyImplementation } from '../../types/etherscan.js';

/**
 * Service for working with contract ABIs from blockchain explorers
 */
export class AbiService {
  private explorerClient: BlockchainExplorerClient;
  private chain: BlockchainExplorer;

  /**
   * Create a new ABI service
   * @param chain The blockchain to use (ethereum, base, etc.)
   */
  constructor(chain: BlockchainExplorer = 'ethereum') {
    this.chain = chain;
    this.explorerClient = new BlockchainExplorerClient(chain);
  }

  /**
   * Get ABI for a contract address, optionally resolving proxy implementation
   * @param options Options for fetching the ABI
   * @returns Contract ABI as parsed JSON
   */
  async getContractAbi(options: AbiOptions): Promise<any> {
    const { address, checkForProxy = true } = options;
    
    // Create client for the specified chain or use the default
    if (options.chain && options.chain !== this.chain) {
      this.explorerClient = new BlockchainExplorerClient(options.chain);
      this.chain = options.chain;
    }
    
    // Fetch the ABI string from the explorer
    const abiString = await this.explorerClient.getContractABI(address);
    const abi = JSON.parse(abiString);
    
    // If proxy checking is disabled, return the ABI directly
    if (!checkForProxy) {
      return abi;
    }

    // Check if this is a proxy contract and get implementation if needed
    const proxyInfo = await this.checkForProxyContract(address, abi);
    
    if (proxyInfo.isProxy && proxyInfo.implementationAbi) {
      return proxyInfo.implementationAbi;
    }
    
    return abi;
  }

  /**
   * Get ABI as a raw JSON string for a contract
   * @param options Options for fetching the ABI
   * @returns Contract ABI as a JSON string
   */
  async getContractAbiJson(options: AbiOptions): Promise<string> {
    const abi = await this.getContractAbi(options);
    return JSON.stringify(abi, null, 2);
  }

  /**
   * Check if a contract is a proxy and get its implementation
   * @param address Contract address
   * @param abi Contract ABI
   * @returns Proxy implementation info
   */
  async checkForProxyContract(address: string, abi: any[]): Promise<ProxyImplementation> {
    try {
      const sourceCode = await this.explorerClient.getContractSourceCode(address);
      
      // Check if the explorer has identified this as a proxy
      if (sourceCode.Implementation && sourceCode.Implementation !== "") {
        const implementationAddress = sourceCode.Implementation;
        const implementationAbiString = await this.explorerClient.getContractABI(implementationAddress);
        
        return {
          isProxy: true,
          implementationAddress,
          implementationAbi: JSON.parse(implementationAbiString)
        };
      }

      // Check common proxy patterns in the ABI
      const isEIP1967Proxy = abi.some(fragment => 
        fragment.name === "Upgraded" || 
        fragment.name === "AdminChanged" ||
        fragment.name === "BeaconUpgraded"
      );

      const isEIP897Proxy = abi.some(fragment => 
        fragment.name === "implementation" && 
        fragment.type === "function" && 
        fragment.outputs?.length === 1 && 
        fragment.outputs[0].type === "address"
      );

      const isOtherProxy = abi.some(fragment => 
        (fragment.name === "upgradeTo" || fragment.name === "upgradeToAndCall") && 
        fragment.type === "function"
      );

      if (isEIP1967Proxy || isEIP897Proxy || isOtherProxy) {
        // This contract appears to be a proxy, but we couldn't determine the implementation
        return {
          isProxy: true,
          implementationAddress: undefined
        };
      }

      // Not identified as a proxy
      return {
        isProxy: false
      };
    } catch (error) {
      console.error('Error checking for proxy contract:', error);
      // Return non-proxy result on error
      return {
        isProxy: false
      };
    }
  }
  
  /**
   * Get the name of the explorer being used
   * @returns The name of the explorer (e.g., "Etherscan", "Basescan")
   */
  getExplorerName(): string {
    return this.explorerClient.getExplorerName();
  }
}
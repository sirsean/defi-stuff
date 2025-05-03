import { EtherscanClient } from './etherscanClient.js';
import { AbiOptions, ProxyImplementation } from '../../types/etherscan.js';

/**
 * Service for working with contract ABIs from Etherscan
 */
export class AbiService {
  private etherscanClient: EtherscanClient;

  constructor() {
    this.etherscanClient = new EtherscanClient();
  }

  /**
   * Get ABI for a contract address, optionally resolving proxy implementation
   * @param options Options for fetching the ABI
   * @returns Contract ABI as parsed JSON
   */
  async getContractAbi(options: AbiOptions): Promise<any> {
    const { address, checkForProxy = true } = options;
    
    // Fetch the ABI string from Etherscan
    const abiString = await this.etherscanClient.getContractABI(address);
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
      const sourceCode = await this.etherscanClient.getContractSourceCode(address);
      
      // Check if Etherscan has identified this as a proxy
      if (sourceCode.Implementation && sourceCode.Implementation !== "") {
        const implementationAddress = sourceCode.Implementation;
        const implementationAbiString = await this.etherscanClient.getContractABI(implementationAddress);
        
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
}
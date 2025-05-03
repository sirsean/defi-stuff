import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AbiService } from '../../../src/api/etherscan/abiService.js';
import { EtherscanClient } from '../../../src/api/etherscan/etherscanClient.js';
import { 
  mockContractAbiResponse, 
  mockProxyContractAbiResponse,
  mockImplementationAbiResponse,
  mockContractSourceCodeResponse,
  mockProxySourceCodeResponse
} from '../../utils/etherscanTestData.js';

// Mock the EtherscanClient
vi.mock('../../../src/api/etherscan/etherscanClient.js', () => {
  return {
    EtherscanClient: vi.fn().mockImplementation(() => ({
      getContractABI: vi.fn(),
      getContractSourceCode: vi.fn()
    }))
  };
});

describe('AbiService', () => {
  let abiService: AbiService;
  let mockEtherscanClient: any;
  const testAddress = '0x1234567890abcdef1234567890abcdef12345678';
  const implementationAddress = '0x123456789abcdef123456789abcdef123456789a';

  beforeEach(() => {
    // Setup environment variables for testing
    process.env.ETHERSCAN_API_KEY = 'test-api-key';
    
    // Create a new instance of the service for each test
    abiService = new AbiService();
    
    // Get the mock instance
    mockEtherscanClient = (EtherscanClient as any).mock.results[0].value;
  });

  afterEach(() => {
    // Clean up after each test
    delete process.env.ETHERSCAN_API_KEY;
    vi.clearAllMocks();
  });

  describe('getContractAbi', () => {
    it('should fetch and parse contract ABI for a regular contract', async () => {
      // Arrange: Set up the mocks to return test data
      mockEtherscanClient.getContractABI.mockResolvedValue(mockContractAbiResponse.result);
      mockEtherscanClient.getContractSourceCode.mockResolvedValue(mockContractSourceCodeResponse.result[0]);

      // Act: Call the method being tested
      const result = await abiService.getContractAbi({ address: testAddress });

      // Assert: Verify the response is properly parsed
      expect(result).toEqual(JSON.parse(mockContractAbiResponse.result));
      expect(mockEtherscanClient.getContractABI).toHaveBeenCalledWith(testAddress);
      expect(mockEtherscanClient.getContractSourceCode).toHaveBeenCalledWith(testAddress);
    });

    it('should fetch implementation ABI for a proxy contract', async () => {
      // Arrange: Set up the mocks to return proxy data
      mockEtherscanClient.getContractABI
        .mockResolvedValueOnce(mockProxyContractAbiResponse.result)  // First call for proxy
        .mockResolvedValueOnce(mockImplementationAbiResponse.result); // Second call for implementation

      mockEtherscanClient.getContractSourceCode.mockResolvedValue(mockProxySourceCodeResponse.result[0]);

      // Act: Call the method being tested
      const result = await abiService.getContractAbi({ address: testAddress });

      // Assert: Verify we get the implementation ABI
      expect(result).toEqual(JSON.parse(mockImplementationAbiResponse.result));
      expect(mockEtherscanClient.getContractABI).toHaveBeenCalledWith(testAddress);
      expect(mockEtherscanClient.getContractABI).toHaveBeenCalledWith(implementationAddress);
      expect(mockEtherscanClient.getContractSourceCode).toHaveBeenCalledWith(testAddress);
    });

    it('should skip proxy checking when checkForProxy is false', async () => {
      // Arrange: Set up the mocks to return test data
      mockEtherscanClient.getContractABI.mockResolvedValue(mockContractAbiResponse.result);

      // Act: Call the method with checkForProxy set to false
      const result = await abiService.getContractAbi({ 
        address: testAddress, 
        checkForProxy: false 
      });

      // Assert: Verify we don't check for proxy and just return the ABI
      expect(result).toEqual(JSON.parse(mockContractAbiResponse.result));
      expect(mockEtherscanClient.getContractABI).toHaveBeenCalledWith(testAddress);
      expect(mockEtherscanClient.getContractSourceCode).not.toHaveBeenCalled();
    });
  });

  describe('getContractAbiJson', () => {
    it('should return ABI as formatted JSON string', async () => {
      // Arrange: Set up the mocks to return test data
      mockEtherscanClient.getContractABI.mockResolvedValue(mockContractAbiResponse.result);
      mockEtherscanClient.getContractSourceCode.mockResolvedValue(mockContractSourceCodeResponse.result[0]);

      // Act: Call the method being tested
      const result = await abiService.getContractAbiJson({ address: testAddress });

      // Assert: Verify we get properly formatted JSON
      const expected = JSON.stringify(JSON.parse(mockContractAbiResponse.result), null, 2);
      expect(result).toEqual(expected);
    });
  });

  describe('checkForProxyContract', () => {
    it('should identify a proxy contract from Etherscan metadata', async () => {
      // Arrange: Set up the mock to return proxy data
      mockEtherscanClient.getContractSourceCode.mockResolvedValue(mockProxySourceCodeResponse.result[0]);
      mockEtherscanClient.getContractABI.mockResolvedValue(mockImplementationAbiResponse.result);

      // Act: Call the method with an ABI that has proxy patterns
      const abi = JSON.parse(mockProxyContractAbiResponse.result);
      const result = await abiService.checkForProxyContract(testAddress, abi);

      // Assert: Verify we identified it as a proxy
      expect(result.isProxy).toBe(true);
      expect(result.implementationAddress).toBe(implementationAddress);
      expect(result.implementationAbi).toEqual(JSON.parse(mockImplementationAbiResponse.result));
    });

    it('should identify a proxy contract from ABI patterns even without Etherscan metadata', async () => {
      // Arrange: Set up the mock to return regular contract data (no proxy metadata)
      mockEtherscanClient.getContractSourceCode.mockResolvedValue(mockContractSourceCodeResponse.result[0]);

      // Act: Call the method with an ABI that has proxy patterns
      const abi = JSON.parse(mockProxyContractAbiResponse.result);
      const result = await abiService.checkForProxyContract(testAddress, abi);

      // Assert: Verify we identified it as a proxy from the ABI patterns
      expect(result.isProxy).toBe(true);
      // But we don't have implementation address
      expect(result.implementationAddress).toBeUndefined();
    });

    it('should identify a regular contract', async () => {
      // Arrange: Set up the mock to return regular contract data
      mockEtherscanClient.getContractSourceCode.mockResolvedValue(mockContractSourceCodeResponse.result[0]);

      // Act: Call the method with a regular contract ABI
      const abi = JSON.parse(mockContractAbiResponse.result);
      const result = await abiService.checkForProxyContract(testAddress, abi);

      // Assert: Verify we identified it as not a proxy
      expect(result.isProxy).toBe(false);
      expect(result.implementationAddress).toBeUndefined();
    });

    it('should handle errors gracefully', async () => {
      // Arrange: Set up the mock to throw an error
      mockEtherscanClient.getContractSourceCode.mockRejectedValue(new Error('API error'));

      // Act: Call the method
      const abi = JSON.parse(mockContractAbiResponse.result);
      const result = await abiService.checkForProxyContract(testAddress, abi);

      // Assert: Verify we don't crash and return a default value
      expect(result.isProxy).toBe(false);
    });
  });
});
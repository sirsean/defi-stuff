import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AbiService } from '../../../src/api/explorers/abiService.js';
import { BlockchainExplorerClient } from '../../../src/api/explorers/blockchainExplorerClient.js';
import { 
  mockContractAbiResponse, 
  mockProxyContractAbiResponse,
  mockImplementationAbiResponse,
  mockContractSourceCodeResponse,
  mockProxySourceCodeResponse
} from '../../utils/etherscanTestData.js';

// Mock the BlockchainExplorerClient
vi.mock('../../../src/api/explorers/blockchainExplorerClient.js', () => {
  return {
    BlockchainExplorerClient: vi.fn().mockImplementation(() => ({
      getContractABI: vi.fn(),
      getContractSourceCode: vi.fn(),
      getExplorerName: vi.fn().mockReturnValue('Etherscan'),
      getChain: vi.fn().mockReturnValue('ethereum')
    }))
  };
});

describe('AbiService', () => {
  let abiService: AbiService;
  let mockExplorerClient: any;
  const testAddress = '0x1234567890abcdef1234567890abcdef12345678';
  const implementationAddress = '0x123456789abcdef123456789abcdef123456789a';

  beforeEach(() => {
    // Setup environment variables for testing
    process.env.ETHERSCAN_API_KEY = 'test-etherscan-key';
    process.env.BASESCAN_API_KEY = 'test-basescan-key';
    
    // Reset mocks
    vi.clearAllMocks();
    
    // Create a new instance of the service for each test
    abiService = new AbiService('ethereum');
    
    // Get the mock instance
    mockExplorerClient = (BlockchainExplorerClient as any).mock.results[0].value;
  });

  afterEach(() => {
    // Clean up after each test
    delete process.env.ETHERSCAN_API_KEY;
    delete process.env.BASESCAN_API_KEY;
  });

  describe('getContractAbi', () => {
    it('should fetch and parse contract ABI for a regular contract', async () => {
      // Arrange: Set up the mocks to return test data
      mockExplorerClient.getContractABI.mockResolvedValue(mockContractAbiResponse.result);
      mockExplorerClient.getContractSourceCode.mockResolvedValue(mockContractSourceCodeResponse.result[0]);

      // Act: Call the method being tested
      const result = await abiService.getContractAbi({ address: testAddress });

      // Assert: Verify the response is properly parsed
      expect(result).toEqual(JSON.parse(mockContractAbiResponse.result));
      expect(mockExplorerClient.getContractABI).toHaveBeenCalledWith(testAddress);
      expect(mockExplorerClient.getContractSourceCode).toHaveBeenCalledWith(testAddress);
    });

    it('should fetch implementation ABI for a proxy contract', async () => {
      // Arrange: Set up the mocks to return proxy data
      mockExplorerClient.getContractABI
        .mockResolvedValueOnce(mockProxyContractAbiResponse.result)  // First call for proxy
        .mockResolvedValueOnce(mockImplementationAbiResponse.result); // Second call for implementation

      mockExplorerClient.getContractSourceCode.mockResolvedValue(mockProxySourceCodeResponse.result[0]);

      // Act: Call the method being tested
      const result = await abiService.getContractAbi({ address: testAddress });

      // Assert: Verify we get the implementation ABI
      expect(result).toEqual(JSON.parse(mockImplementationAbiResponse.result));
      expect(mockExplorerClient.getContractABI).toHaveBeenCalledWith(testAddress);
      expect(mockExplorerClient.getContractABI).toHaveBeenCalledWith(implementationAddress);
      expect(mockExplorerClient.getContractSourceCode).toHaveBeenCalledWith(testAddress);
    });

    it('should skip proxy checking when checkForProxy is false', async () => {
      // Arrange: Set up the mocks to return test data
      mockExplorerClient.getContractABI.mockResolvedValue(mockContractAbiResponse.result);

      // Act: Call the method with checkForProxy set to false
      const result = await abiService.getContractAbi({ 
        address: testAddress, 
        checkForProxy: false 
      });

      // Assert: Verify we don't check for proxy and just return the ABI
      expect(result).toEqual(JSON.parse(mockContractAbiResponse.result));
      expect(mockExplorerClient.getContractABI).toHaveBeenCalledWith(testAddress);
      expect(mockExplorerClient.getContractSourceCode).not.toHaveBeenCalled();
    });
    
    it('should use a different chain when specified', async () => {
      // Setup the initial mock
      mockExplorerClient.getContractABI.mockResolvedValue(mockContractAbiResponse.result);
      mockExplorerClient.getContractSourceCode.mockResolvedValue(mockContractSourceCodeResponse.result[0]);
      
      // Create a second instance of BlockchainExplorerClient for the 'base' chain
      vi.mocked(BlockchainExplorerClient).mockImplementationOnce(() => ({
        getContractABI: vi.fn().mockResolvedValue(mockContractAbiResponse.result),
        getContractSourceCode: vi.fn().mockResolvedValue(mockContractSourceCodeResponse.result[0]),
        getExplorerName: vi.fn().mockReturnValue('Basescan'),
        getChain: vi.fn().mockReturnValue('base')
      }));

      // Act: Call the method with a different chain
      await abiService.getContractAbi({ 
        address: testAddress, 
        chain: 'base' 
      });

      // Assert: Verify that a new explorer client was created (BlockchainExplorerClient was called again)
      expect(BlockchainExplorerClient).toHaveBeenCalledTimes(2);
      expect(BlockchainExplorerClient).toHaveBeenCalledWith('base');
    });
  });

  describe('getContractAbiJson', () => {
    it('should return ABI as formatted JSON string', async () => {
      // Arrange: Set up the mocks to return test data
      mockExplorerClient.getContractABI.mockResolvedValue(mockContractAbiResponse.result);
      mockExplorerClient.getContractSourceCode.mockResolvedValue(mockContractSourceCodeResponse.result[0]);

      // Act: Call the method being tested
      const result = await abiService.getContractAbiJson({ address: testAddress });

      // Assert: Verify we get properly formatted JSON
      const expected = JSON.stringify(JSON.parse(mockContractAbiResponse.result), null, 2);
      expect(result).toEqual(expected);
    });
  });

  describe('checkForProxyContract', () => {
    it('should identify a proxy contract from explorer metadata', async () => {
      // Arrange: Set up the mock to return proxy data
      mockExplorerClient.getContractSourceCode.mockResolvedValue(mockProxySourceCodeResponse.result[0]);
      mockExplorerClient.getContractABI.mockResolvedValue(mockImplementationAbiResponse.result);

      // Act: Call the method with an ABI that has proxy patterns
      const abi = JSON.parse(mockProxyContractAbiResponse.result);
      const result = await abiService.checkForProxyContract(testAddress, abi);

      // Assert: Verify we identified it as a proxy
      expect(result.isProxy).toBe(true);
      expect(result.implementationAddress).toBe(implementationAddress);
      expect(result.implementationAbi).toEqual(JSON.parse(mockImplementationAbiResponse.result));
    });

    it('should identify a proxy contract from ABI patterns even without explorer metadata', async () => {
      // Arrange: Set up the mock to return regular contract data (no proxy metadata)
      mockExplorerClient.getContractSourceCode.mockResolvedValue(mockContractSourceCodeResponse.result[0]);

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
      mockExplorerClient.getContractSourceCode.mockResolvedValue(mockContractSourceCodeResponse.result[0]);

      // Act: Call the method with a regular contract ABI
      const abi = JSON.parse(mockContractAbiResponse.result);
      const result = await abiService.checkForProxyContract(testAddress, abi);

      // Assert: Verify we identified it as not a proxy
      expect(result.isProxy).toBe(false);
      expect(result.implementationAddress).toBeUndefined();
    });

    it('should handle errors gracefully', async () => {
      // Arrange: Set up the mock to throw an error
      mockExplorerClient.getContractSourceCode.mockRejectedValue(new Error('API error'));

      // Act: Call the method
      const abi = JSON.parse(mockContractAbiResponse.result);
      const result = await abiService.checkForProxyContract(testAddress, abi);

      // Assert: Verify we don't crash and return a default value
      expect(result.isProxy).toBe(false);
    });
  });
  
  describe('getExplorerName', () => {
    it('should return the explorer name from the client', () => {
      // Act & Assert
      expect(abiService.getExplorerName()).toBe('Etherscan');
      expect(mockExplorerClient.getExplorerName).toHaveBeenCalled();
    });
  });
});
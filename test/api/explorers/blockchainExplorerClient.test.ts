import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import { BlockchainExplorerClient } from '../../../src/api/explorers/blockchainExplorerClient.js';
import { 
  mockContractAbiResponse, 
  mockContractSourceCodeResponse 
} from '../../utils/etherscanTestData.js';

describe('BlockchainExplorerClient', () => {
  let mock: MockAdapter;
  let ethClient: BlockchainExplorerClient;
  let baseClient: BlockchainExplorerClient;
  const testAddress = '0x1234567890abcdef1234567890abcdef12345678';

  beforeEach(() => {
    // Setup environment variables for testing
    process.env.ETHERSCAN_API_KEY = 'test-etherscan-key';
    
    // Create a fresh mock for each test
    mock = new MockAdapter(axios);
    
    // Create clients for both chains
    ethClient = new BlockchainExplorerClient('ethereum');
    baseClient = new BlockchainExplorerClient('base');
  });

  afterEach(() => {
    // Clean up after each test
    mock.restore();
    delete process.env.ETHERSCAN_API_KEY;
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should throw an error when API key is not set', () => {
      // Arrange: Remove the API key from environment variables
      delete process.env.ETHERSCAN_API_KEY;

      // Act & Assert: Verify that the constructor throws an error
      expect(() => new BlockchainExplorerClient('ethereum')).toThrow('ETHERSCAN_API_KEY environment variable is not set');
    });
    
    it('should throw an error for unsupported blockchain', () => {
      // Act & Assert: Verify that the constructor throws an error
      // @ts-ignore - Intentionally passing an invalid chain
      expect(() => new BlockchainExplorerClient('invalid-chain')).toThrow('Unsupported blockchain');
    });
    
    it('should default to ethereum when no chain is specified', () => {
      // Act: Create client without specifying chain
      const client = new BlockchainExplorerClient();
      
      // Assert: Check the chain and explorer name
      expect(client.getChain()).toBe('ethereum');
      expect(client.getExplorerName()).toBe('Etherscan');
    });
  });

  describe('getContractABI', () => {
    it('should fetch contract ABI from Etherscan (v2)', async () => {
      // Arrange: Set up the mock to return data for the Etherscan V2 API
      mock.onGet()
        .reply(config => {
          // Verify the URL matches Etherscan V2
          expect(config.baseURL).toBe('https://api.etherscan.io/v2/api');
          
          // Verify params
          expect(config.params).toEqual({
            module: 'contract',
            action: 'getabi',
            address: testAddress,
            apikey: 'test-etherscan-key',
            chainid: '1'
          });
          return [200, mockContractAbiResponse];
        });

      // Act: Call the method being tested
      const result = await ethClient.getContractABI(testAddress);

      // Assert: Verify the response matches our mock data
      expect(result).toEqual(mockContractAbiResponse.result);
    });
    
    it('should fetch contract ABI for Base via Etherscan V2', async () => {
      // Arrange: Set up the mock to return data for the Etherscan V2 API (Base)
      mock.onGet()
        .reply(config => {
          // Verify the URL matches Etherscan V2
          expect(config.baseURL).toBe('https://api.etherscan.io/v2/api');
          
          // Verify params
          expect(config.params).toEqual({
            module: 'contract',
            action: 'getabi',
            address: testAddress,
            apikey: 'test-etherscan-key',
            chainid: '8453'
          });
          return [200, mockContractAbiResponse];
        });

      // Act: Call the method being tested
      const result = await baseClient.getContractABI(testAddress);

      // Assert: Verify the response matches our mock data
      expect(result).toEqual(mockContractAbiResponse.result);
    });

    it('should throw an error when the API returns an error status', async () => {
      // Arrange: Set up the mock to simulate an API error
      mock.onGet()
        .reply(200, {
          status: "0",
          message: "NOTOK",
          result: "Error! Invalid address format"
        });

      // Act & Assert: Verify that the method throws an error
      await expect(ethClient.getContractABI(testAddress)).rejects.toThrow(/API error/);
    });

    it('should throw an error when the API request fails', async () => {
      // Arrange: Set up the mock to simulate a network error
      mock.onGet()
        .networkError();

      // Act & Assert: Verify that the method throws an error
      await expect(ethClient.getContractABI(testAddress)).rejects.toThrow();
    });
  });

  describe('getContractSourceCode', () => {
    it('should fetch contract source code from Etherscan V2', async () => {
      // Arrange: Set up the mock to return data for the Etherscan V2 API
      mock.onGet()
        .reply(config => {
          // Verify the URL matches Etherscan V2
          expect(config.baseURL).toBe('https://api.etherscan.io/v2/api');
          
          // Verify params
          expect(config.params).toEqual({
            module: 'contract',
            action: 'getsourcecode',
            address: testAddress,
            apikey: 'test-etherscan-key',
            chainid: '1'
          });
          return [200, mockContractSourceCodeResponse];
        });

      // Act: Call the method being tested
      const result = await ethClient.getContractSourceCode(testAddress);

      // Assert: Verify the response matches our mock data
      expect(result).toEqual(mockContractSourceCodeResponse.result[0]);
    });
    
    it('should fetch contract source code for Base via Etherscan V2', async () => {
      // Arrange: Set up the mock to return data for the Etherscan V2 API (Base)
      mock.onGet()
        .reply(config => {
          // Verify the URL matches Etherscan V2
          expect(config.baseURL).toBe('https://api.etherscan.io/v2/api');
          
          // Verify params
          expect(config.params).toEqual({
            module: 'contract',
            action: 'getsourcecode',
            address: testAddress,
            apikey: 'test-etherscan-key',
            chainid: '8453'
          });
          return [200, mockContractSourceCodeResponse];
        });

      // Act: Call the method being tested
      const result = await baseClient.getContractSourceCode(testAddress);

      // Assert: Verify the response matches our mock data
      expect(result).toEqual(mockContractSourceCodeResponse.result[0]);
    });

    it('should throw an error when the API returns an error status', async () => {
      // Arrange: Set up the mock to simulate an API error
      mock.onGet()
        .reply(200, {
          status: "0",
          message: "NOTOK",
          result: "Error! Invalid address format"
        });

      // Act & Assert: Verify that the method throws an error
      await expect(ethClient.getContractSourceCode(testAddress)).rejects.toThrow(/API error/);
    });

    it('should throw an error when the API request fails', async () => {
      // Arrange: Set up the mock to simulate a network error
      mock.onGet()
        .networkError();

      // Act & Assert: Verify that the method throws an error
      await expect(ethClient.getContractSourceCode(testAddress)).rejects.toThrow();
    });
  });
  
  describe('utility methods', () => {
    it('should return the correct explorer name for Ethereum', () => {
      expect(ethClient.getExplorerName()).toBe('Etherscan');
    });
    
    it('should return the correct explorer name for Base', () => {
      expect(baseClient.getExplorerName()).toBe('Etherscan');
    });
    
    it('should return the correct chain for Ethereum', () => {
      expect(ethClient.getChain()).toBe('ethereum');
    });
    
    it('should return the correct chain for Base', () => {
      expect(baseClient.getChain()).toBe('base');
    });
  });
});
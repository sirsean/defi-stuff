import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import { EtherscanClient } from '../../../src/api/etherscan/etherscanClient.js';
import { 
  mockContractAbiResponse, 
  mockContractSourceCodeResponse 
} from '../../utils/etherscanTestData.js';

describe('EtherscanClient', () => {
  let mock: MockAdapter;
  let client: EtherscanClient;
  const testAddress = '0x1234567890abcdef1234567890abcdef12345678';

  beforeEach(() => {
    // Setup environment variables for testing
    process.env.ETHERSCAN_API_KEY = 'test-api-key';
    
    // Create a fresh mock for each test
    mock = new MockAdapter(axios);
    client = new EtherscanClient();
  });

  afterEach(() => {
    // Clean up after each test
    mock.restore();
    delete process.env.ETHERSCAN_API_KEY;
    vi.clearAllMocks();
  });

  describe('getContractABI', () => {
    it('should fetch contract ABI for a valid address', async () => {
      // Arrange: Set up the mock to return data for the contract ABI endpoint
      mock.onGet()
        .reply(config => {
          // Verify the URL matches our expectations
          expect(config.baseURL).toBe('https://api.etherscan.io/api');
          
          // Verify params
          expect(config.params).toEqual({
            module: 'contract',
            action: 'getabi',
            address: testAddress,
            apikey: 'test-api-key'
          });
          return [200, mockContractAbiResponse];
        });

      // Act: Call the method being tested
      const result = await client.getContractABI(testAddress);

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
      await expect(client.getContractABI(testAddress)).rejects.toThrow(/Etherscan API error/);
    });

    it('should throw an error when the API request fails', async () => {
      // Arrange: Set up the mock to simulate a network error
      mock.onGet()
        .networkError();

      // Act & Assert: Verify that the method throws an error
      await expect(client.getContractABI(testAddress)).rejects.toThrow();
    });
  });

  describe('getContractSourceCode', () => {
    it('should fetch contract source code for a valid address', async () => {
      // Arrange: Set up the mock to return data for the contract source code endpoint
      mock.onGet()
        .reply(config => {
          // Verify the URL matches our expectations
          expect(config.baseURL).toBe('https://api.etherscan.io/api');
          
          // Verify params
          expect(config.params).toEqual({
            module: 'contract',
            action: 'getsourcecode',
            address: testAddress,
            apikey: 'test-api-key'
          });
          return [200, mockContractSourceCodeResponse];
        });

      // Act: Call the method being tested
      const result = await client.getContractSourceCode(testAddress);

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
      await expect(client.getContractSourceCode(testAddress)).rejects.toThrow(/Etherscan API error/);
    });

    it('should throw an error when the API request fails', async () => {
      // Arrange: Set up the mock to simulate a network error
      mock.onGet()
        .networkError();

      // Act & Assert: Verify that the method throws an error
      await expect(client.getContractSourceCode(testAddress)).rejects.toThrow();
    });
  });

  it('should throw an error when ETHERSCAN_API_KEY is not set', () => {
    // Arrange: Remove the API key from environment variables
    delete process.env.ETHERSCAN_API_KEY;

    // Act & Assert: Verify that the constructor throws an error
    expect(() => new EtherscanClient()).toThrow('ETHERSCAN_API_KEY environment variable is not set');
  });
});
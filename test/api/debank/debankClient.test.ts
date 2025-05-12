import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import { DebankClient } from '../../../src/api/debank/debankClient.js';
import { mockProtocolList, mockUserProtocolResponse, mockUserTotalBalanceResponse } from '../../utils/testData.js';

describe('DebankClient', () => {
  let mock: MockAdapter;
  let client: DebankClient;

  beforeEach(() => {
    // Setup environment variables for testing
    process.env.DEBANK_API_KEY = 'test-api-key';
    
    // Create a fresh mock for each test
    mock = new MockAdapter(axios);
    client = new DebankClient();
  });

  afterEach(() => {
    // Clean up after each test
    mock.restore();
    delete process.env.DEBANK_API_KEY;
    vi.clearAllMocks();
  });

  describe('getProtocolList', () => {
    it('should fetch protocol list for a specific chain', async () => {
      // Arrange: Set up the mock to return data for the protocol list endpoint
      mock.onGet('https://pro-openapi.debank.com/v1/protocol/list')
        .reply(200, mockProtocolList);

      // Act: Call the method being tested
      const result = await client.getProtocolList('eth');

      // Assert: Verify the response matches our mock data
      expect(result).toEqual(mockProtocolList);
      expect(mock.history.get[0].params).toEqual({ chain_id: 'eth' });
    });

    it('should throw an error when the API request fails', async () => {
      // Arrange: Set up the mock to simulate an API error
      mock.onGet('https://pro-openapi.debank.com/v1/protocol/list')
        .reply(500, { error: 'Internal server error' });

      // Act & Assert: Verify that the method throws an error
      await expect(client.getProtocolList('eth')).rejects.toThrow();
    });
  });

  describe('getUserProtocol', () => {
    const userAddress = '0x1234567890abcdef1234567890abcdef12345678';
    const protocolId = 'ethereum_aave';

    it('should fetch user protocol data', async () => {
      // Arrange: Set up the mock to return data for the user protocol endpoint
      mock.onGet('https://pro-openapi.debank.com/v1/user/protocol')
        .reply(200, mockUserProtocolResponse);

      // Act: Call the method being tested
      const result = await client.getUserProtocol(userAddress, protocolId);

      // Assert: Verify the response matches our mock data
      expect(result).toEqual(mockUserProtocolResponse);
      expect(mock.history.get[0].params).toEqual({
        id: userAddress,
        protocol_id: protocolId
      });
    });

    it('should throw a specific error for 404 responses', async () => {
      // Arrange: Set up the mock to simulate a 404 response
      mock.onGet('https://pro-openapi.debank.com/v1/user/protocol')
        .reply(404);

      // Act & Assert: Verify that the method throws a specific error
      await expect(client.getUserProtocol(userAddress, protocolId))
        .rejects.toThrow(`No data found for protocol ${protocolId} and user ${userAddress}`);
    });

    it('should throw an error for other API failures', async () => {
      // Arrange: Set up the mock to simulate a server error
      mock.onGet('https://pro-openapi.debank.com/v1/user/protocol')
        .reply(500, { error: 'Internal server error' });

      // Act & Assert: Verify that the method throws an error
      await expect(client.getUserProtocol(userAddress, protocolId)).rejects.toThrow();
    });
  });

  describe('getUserTotalBalance', () => {
    const userAddress = '0x1234567890abcdef1234567890abcdef12345678';

    it('should fetch user total balance data', async () => {
      // Arrange: Set up the mock to return data for the user total balance endpoint
      mock.onGet('https://pro-openapi.debank.com/v1/user/total_balance')
        .reply(200, mockUserTotalBalanceResponse);

      // Act: Call the method being tested
      const result = await client.getUserTotalBalance(userAddress);

      // Assert: Verify the response matches our mock data
      expect(result).toEqual(mockUserTotalBalanceResponse);
      expect(mock.history.get[0].params).toEqual({
        id: userAddress
      });
    });

    it('should throw a specific error for 404 responses', async () => {
      // Arrange: Set up the mock to simulate a 404 response
      mock.onGet('https://pro-openapi.debank.com/v1/user/total_balance')
        .reply(404);

      // Act & Assert: Verify that the method throws a specific error
      await expect(client.getUserTotalBalance(userAddress))
        .rejects.toThrow(`No balance data found for user ${userAddress}`);
    });

    it('should throw an error for other API failures', async () => {
      // Arrange: Set up the mock to simulate a server error
      mock.onGet('https://pro-openapi.debank.com/v1/user/total_balance')
        .reply(500, { error: 'Internal server error' });

      // Act & Assert: Verify that the method throws an error
      await expect(client.getUserTotalBalance(userAddress)).rejects.toThrow();
    });
  });
});
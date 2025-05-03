import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { UserProtocolService, PROTOCOL_POOL_NAMES } from '../../../src/api/debank/userProtocolService.js';
import { mockUserProtocolResponse } from '../../utils/testData.js';

// Mock the DebankClient
vi.mock('../../../src/api/debank/debankClient.js', () => {
  return {
    DebankClient: vi.fn().mockImplementation(() => {
      return {
        getUserProtocol: vi.fn().mockResolvedValue(mockUserProtocolResponse)
      };
    })
  };
});

describe('UserProtocolService', () => {
  let userProtocolService: UserProtocolService;
  const userAddress = '0x1234567890abcdef1234567890abcdef12345678';
  const protocolId = 'ethereum_aave';
  
  beforeEach(() => {
    // Set up environment for testing
    process.env.DEBANK_API_KEY = 'test-api-key';
    process.env.WALLET_ADDRESS = userAddress;
    userProtocolService = new UserProtocolService();
  });

  afterEach(() => {
    // Clean up
    delete process.env.DEBANK_API_KEY;
    delete process.env.WALLET_ADDRESS;
    vi.clearAllMocks();
  });

  describe('getUserProtocolData', () => {
    it('should return user protocol data', async () => {
      const result = await userProtocolService.getUserProtocolData(protocolId);
      
      expect(result).toEqual(mockUserProtocolResponse);
    });
  });

  describe('setWalletAddress', () => {
    it('should update the wallet address', () => {
      const newAddress = '0x9876543210abcdef9876543210abcdef98765432';
      userProtocolService.setWalletAddress(newAddress);
      
      // Note: We can't directly test the private property, but we can
      // verify it's been updated through behavior
      const getUserProtocolSpy = vi.spyOn(userProtocolService['debankClient'], 'getUserProtocol');
      
      userProtocolService.getUserProtocolData(protocolId);
      
      expect(getUserProtocolSpy).toHaveBeenCalledWith(newAddress, protocolId);
    });
  });
  
  describe('getPoolFriendlyName', () => {
    it('should return a protocol-specific pool name when available', () => {
      const name = UserProtocolService.getPoolFriendlyName('tokemak', '0x726104cfbd7ece2d1f5b3654a19109a9e2b6c27b');
      expect(name).toBe('autoUSD');
    });
    
    it('should return undefined when pool is not found', () => {
      const name = UserProtocolService.getPoolFriendlyName('unknown', 'unknown-pool');
      expect(name).toBeUndefined();
    });
  });
});
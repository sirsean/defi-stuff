import { describe, it, expect, vi, beforeEach } from 'vitest';
import { userProtocol } from '../../src/commands/userProtocol.js';
import { setupConsoleMocks, ConsoleMock } from '../utils/consoleMock.js';
import { UserProtocolService } from '../../src/api/debank/userProtocolService.js';
import { mockUserProtocolResponse } from '../utils/testData.js';

// Create mock functions
const mockGetUserProtocolData = vi.fn();
const mockSetWalletAddress = vi.fn();

// Create a mock object
const mockUserProtocolService = {
  getUserProtocolData: mockGetUserProtocolData,
  setWalletAddress: mockSetWalletAddress
};

// Mock the UserProtocolService constructor to return our mock object
vi.mock('../../src/api/debank/userProtocolService.js', () => {
  return {
    UserProtocolService: vi.fn(() => mockUserProtocolService),
    PROTOCOL_POOL_NAMES: {
      base_flex: {
        '0x053fa05d34c51afc5cb9f162fab3fd675ac06119': 'FLP'
      }
    }
  };
});

describe('userProtocol command', () => {
  // Set up console mocks for each test
  setupConsoleMocks();

  beforeEach(() => {
    // Reset mock functions before each test
    mockGetUserProtocolData.mockReset();
    mockSetWalletAddress.mockReset();
    
    // Mock the static method for pool name lookup
    UserProtocolService.getPoolFriendlyName = vi.fn().mockImplementation((protocolId, poolId) => {
      if (protocolId === 'base_flex' && poolId === '0x053fa05d34c51afc5cb9f162fab3fd675ac06119') {
        return 'FLP';
      }
      return undefined;
    });
  });

  it('should display an error if protocol ID is missing', async () => {
    // Execute the userProtocol command with an empty protocol ID
    await userProtocol('', {});
    
    // Verify error was logged
    expect(ConsoleMock.error).toHaveBeenCalledWith('Protocol ID parameter is required');
    
    // Verify process exit was called with error code
    expect(ConsoleMock.exit).toHaveBeenCalledWith(1);
    
    // Verify the service was not called
    expect(mockGetUserProtocolData).not.toHaveBeenCalled();
  });

  it('should use provided wallet address when specified', async () => {
    // Set up the mock to return sample data
    mockGetUserProtocolData.mockResolvedValue(mockUserProtocolResponse);
    
    // Custom wallet address
    const testAddress = '0xCustomAddress';
    
    // Execute the userProtocol command with address option
    await userProtocol('base_flex', { address: testAddress });
    
    // Verify wallet address was set
    expect(mockSetWalletAddress).toHaveBeenCalledWith(testAddress);
    
    // Verify the service was called with the right protocol ID
    expect(mockGetUserProtocolData).toHaveBeenCalledWith('base_flex');
  });

  it('should output JSON when json option is true', async () => {
    // Set up the mock to return sample data
    mockGetUserProtocolData.mockResolvedValue(mockUserProtocolResponse);
    
    // Execute the userProtocol command with json option
    await userProtocol('base_flex', { json: true });
    
    // Verify JSON was logged
    expect(ConsoleMock.log).toHaveBeenCalledWith(JSON.stringify(mockUserProtocolResponse, null, 2));
    
    // Verify no other outputs after the JSON
    expect(ConsoleMock.log).toHaveBeenCalledTimes(2); // Initial message + JSON
  });

  it('should display protocol overview and portfolio items', async () => {
    // Set up the mock to return sample data
    mockGetUserProtocolData.mockResolvedValue(mockUserProtocolResponse);
    
    // Execute the userProtocol command
    await userProtocol('base_flex', {});
    
    // Verify the service was called with the right protocol ID
    expect(mockGetUserProtocolData).toHaveBeenCalledWith('base_flex');
    
    // Verify protocol overview was displayed
    expect(ConsoleMock.log).toHaveBeenCalledWith('\n===== Flex Perpetuals (base_flex) =====');
    expect(ConsoleMock.log).toHaveBeenCalledWith('Chain: base');
    expect(ConsoleMock.log).toHaveBeenCalledWith('Website: https://app.flex.trade/');
    expect(ConsoleMock.log).toHaveBeenCalledWith('TVL: $2,384,245.20');
    expect(ConsoleMock.log).toHaveBeenCalledWith('Total Asset Value: $85,483.86');
    
    // Verify portfolio items count was displayed
    expect(ConsoleMock.log).toHaveBeenCalledWith('\nPortfolio Items (1):');
    
    // Verify friendly pool name was used
    expect(ConsoleMock.log).toHaveBeenCalledWith('--- FLP ---');
    
    // Verify item value was displayed
    expect(ConsoleMock.log).toHaveBeenCalledWith('Value: $85,483.86');
    
    // Verify token lists were displayed
    expect(ConsoleMock.log).toHaveBeenCalledWith('Supplied Assets:');
    expect(ConsoleMock.log).toHaveBeenCalledWith('Reward Assets:');
  });

  it('should handle errors from the service', async () => {
    // Set up the mock to throw an error
    const testError = new Error('Test error');
    mockGetUserProtocolData.mockRejectedValue(testError);
    
    // Execute the userProtocol command
    await userProtocol('base_flex', {});
    
    // Verify error was logged
    expect(ConsoleMock.error).toHaveBeenCalledWith('Error fetching user protocol data:', 'Test error');
    
    // Verify process exit was called with error code
    expect(ConsoleMock.exit).toHaveBeenCalledWith(1);
  });
});
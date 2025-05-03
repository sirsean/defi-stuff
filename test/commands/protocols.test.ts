import { describe, it, expect, vi, beforeEach } from 'vitest';
import { protocols } from '../../src/commands/protocols.js';
import { setupConsoleMocks, ConsoleMock } from '../utils/consoleMock.js';
import { ProtocolService } from '../../src/api/debank/protocolService.js';
import { mockProtocolList } from '../utils/testData.js';

// Create a mock object with a searchProtocols method
const mockSearchProtocols = vi.fn();
const mockProtocolService = {
  searchProtocols: mockSearchProtocols
};

// Mock the ProtocolService constructor to return our mock object
vi.mock('../../src/api/debank/protocolService.js', () => {
  return {
    ProtocolService: vi.fn(() => mockProtocolService)
  };
});

describe('protocols command', () => {
  // Set up console mocks for each test
  setupConsoleMocks();

  beforeEach(() => {
    // Reset mocks before each test
    mockSearchProtocols.mockReset();
  });

  it('should display an error if chain parameter is missing', async () => {
    // Execute the protocols command with an empty chain parameter
    await protocols('', {});
    
    // Verify error was logged
    expect(ConsoleMock.error).toHaveBeenCalledWith('Chain parameter is required');
    
    // Verify process exit was called with error code
    expect(ConsoleMock.exit).toHaveBeenCalledWith(1);
    
    // Verify the service was not called
    expect(mockSearchProtocols).not.toHaveBeenCalled();
  });

  it('should display a message if no protocols are found', async () => {
    // Set up the mock to return an empty array
    mockSearchProtocols.mockResolvedValue([]);
    
    // Execute the protocols command
    await protocols('eth', {});
    
    // Verify the service was called with the right parameters
    expect(mockSearchProtocols).toHaveBeenCalledWith({ chain: 'eth', searchTerm: undefined });
    
    // Verify the correct messages were logged
    expect(ConsoleMock.log).toHaveBeenCalledWith('Searching for protocols on eth...');
    expect(ConsoleMock.log).toHaveBeenCalledWith('No protocols found matching your criteria');
  });

  it('should display protocol details when protocols are found', async () => {
    // Set up the mock to return sample protocol data
    mockSearchProtocols.mockResolvedValue(mockProtocolList);
    
    // Execute the protocols command
    await protocols('eth', {});
    
    // Verify the service was called with the right parameters
    expect(mockSearchProtocols).toHaveBeenCalledWith({ chain: 'eth', searchTerm: undefined });
    
    // Verify the correct messages were logged
    expect(ConsoleMock.log).toHaveBeenCalledWith('Searching for protocols on eth...');
    expect(ConsoleMock.log).toHaveBeenCalledWith('Found 2 protocols:');
    
    // Verify protocol details were logged for both protocols
    expect(ConsoleMock.log).toHaveBeenCalledWith('\nAave (ethereum_aave)');
    expect(ConsoleMock.log).toHaveBeenCalledWith('Chain: eth');
    expect(ConsoleMock.log).toHaveBeenCalledWith('TVL: $6,000,000,000');
    expect(ConsoleMock.log).toHaveBeenCalledWith('Website: https://aave.com');
    expect(ConsoleMock.log).toHaveBeenCalledWith('Has Portfolio Support: Yes');
    
    expect(ConsoleMock.log).toHaveBeenCalledWith('\nUniswap (ethereum_uniswap)');
    expect(ConsoleMock.log).toHaveBeenCalledWith('Chain: eth');
    expect(ConsoleMock.log).toHaveBeenCalledWith('TVL: $5,500,000,000');
    expect(ConsoleMock.log).toHaveBeenCalledWith('Website: https://uniswap.org');
    expect(ConsoleMock.log).toHaveBeenCalledWith('Has Portfolio Support: Yes');
  });

  it('should use search term when provided', async () => {
    // Set up the mock to return filtered data
    mockSearchProtocols.mockResolvedValue([mockProtocolList[0]]);
    
    // Execute the protocols command with search option
    await protocols('eth', { search: 'Aave' });
    
    // Verify the service was called with the right parameters
    expect(mockSearchProtocols).toHaveBeenCalledWith({ chain: 'eth', searchTerm: 'Aave' });
    
    // Verify only one protocol was displayed
    expect(ConsoleMock.log).toHaveBeenCalledWith('Found 1 protocols:');
    expect(ConsoleMock.log).toHaveBeenCalledWith('\nAave (ethereum_aave)');
  });

  it('should handle errors from the service', async () => {
    // Set up the mock to throw an error
    const testError = new Error('Test error');
    mockSearchProtocols.mockRejectedValue(testError);
    
    // Execute the protocols command
    await protocols('eth', {});
    
    // Verify error was logged
    expect(ConsoleMock.error).toHaveBeenCalledWith('Error searching protocols:', testError);
    
    // Verify process exit was called with error code
    expect(ConsoleMock.exit).toHaveBeenCalledWith(1);
  });
});
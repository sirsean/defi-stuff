import { describe, it, expect, beforeEach, vi } from 'vitest';
import { abi } from '../../src/commands/abi.js';
import { setupConsoleMocks, ConsoleMock } from '../utils/consoleMock.js';

// Mock getContractAbiJson function
const mockGetContractAbiJson = vi.fn();
const mockGetExplorerName = vi.fn();

// Mock the AbiService class
vi.mock('../../src/api/explorers/abiService.js', () => {
  return {
    AbiService: vi.fn().mockImplementation(() => {
      return {
        getContractAbiJson: mockGetContractAbiJson,
        getExplorerName: mockGetExplorerName
      };
    })
  };
});

describe('abi command', () => {
  // Set up console mocks for each test
  setupConsoleMocks();

  const testAddress = '0x1234567890abcdef1234567890abcdef12345678';
  const testAbi = '[\n  {\n    "inputs": [],\n    "name": "name",\n    "outputs": [\n      {\n        "type": "string"\n      }\n    ],\n    "stateMutability": "view",\n    "type": "function"\n  }\n]';

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();
    
    // Set default mock implementations
    mockGetContractAbiJson.mockResolvedValue(testAbi);
    mockGetExplorerName.mockReturnValue('Etherscan');
  });

  it('should fetch and print ABI with proxy detection enabled by default', async () => {
    // Act: Call the command
    await abi(testAddress);

    // Assert: Verify the service was called with the right parameters
    expect(mockGetContractAbiJson).toHaveBeenCalledWith({
      address: testAddress,
      checkForProxy: true,
      chain: 'ethereum'
    });

    // Check console logs
    expect(ConsoleMock.log).toHaveBeenCalledWith(expect.stringContaining('Etherscan'));
    expect(ConsoleMock.log).toHaveBeenCalledWith(expect.stringContaining('with proxy detection'));
    expect(ConsoleMock.log).toHaveBeenCalledWith(testAbi);
  });

  it('should fetch and print ABI with proxy detection disabled when specified', async () => {
    // Act: Call the command with ignoreProxy option
    await abi(testAddress, { ignoreProxy: true });

    // Assert: Verify the service was called with the right parameters
    expect(mockGetContractAbiJson).toHaveBeenCalledWith({
      address: testAddress,
      checkForProxy: false,
      chain: 'ethereum'
    });

    // Check console logs
    expect(ConsoleMock.log).toHaveBeenCalledWith(expect.stringContaining('ignoring proxy'));
    expect(ConsoleMock.log).toHaveBeenCalledWith(testAbi);
  });
  
  it('should use the specified blockchain when provided', async () => {
    // Arrange: Mock for Base chain
    mockGetExplorerName.mockReturnValue('Basescan');
    
    // Act: Call the command with chain option
    await abi(testAddress, { chain: 'base' });

    // Assert: Verify the service was called with the base chain
    expect(mockGetContractAbiJson).toHaveBeenCalledWith({
      address: testAddress,
      checkForProxy: true,
      chain: 'base'
    });

    // Check console logs
    expect(ConsoleMock.log).toHaveBeenCalledWith(expect.stringContaining('Basescan'));
    expect(ConsoleMock.log).toHaveBeenCalledWith(testAbi);
  });
  
  it('should exit with error when an unsupported blockchain is specified', async () => {
    // Act: Call the command with an invalid chain
    await abi(testAddress, { chain: 'invalid-chain' });

    // Assert: Verify error handling
    expect(ConsoleMock.error).toHaveBeenCalledWith(expect.stringContaining('Unsupported blockchain'));
    expect(ConsoleMock.exit).toHaveBeenCalledWith(1);
    
    // Verify the service was not called
    expect(mockGetContractAbiJson).not.toHaveBeenCalled();
  });

  it('should exit with error when address is not provided', async () => {
    // Act: Call the command without an address
    await abi('');

    // Assert: Verify error handling
    expect(ConsoleMock.error).toHaveBeenCalledWith(expect.stringContaining('required'));
    expect(ConsoleMock.exit).toHaveBeenCalledWith(1);
    
    // Verify the service was not called
    expect(mockGetContractAbiJson).not.toHaveBeenCalled();
  });

  it('should exit with error when address format is invalid', async () => {
    // Act: Call the command with an invalid address
    await abi('0xinvalid');

    // Assert: Verify error handling
    expect(ConsoleMock.error).toHaveBeenCalledWith(expect.stringContaining('Invalid Ethereum address'));
    expect(ConsoleMock.exit).toHaveBeenCalledWith(1);
    
    // Verify the service was not called
    expect(mockGetContractAbiJson).not.toHaveBeenCalled();
  });

  it('should handle service errors gracefully', async () => {
    // Arrange: Set up the mock to throw an error
    const testError = new Error('Service error');
    mockGetContractAbiJson.mockRejectedValue(testError);

    // Act: Call the command
    await abi(testAddress);

    // Assert: Verify error handling
    expect(ConsoleMock.error).toHaveBeenCalledWith('Error fetching contract ABI:', testError);
    expect(ConsoleMock.exit).toHaveBeenCalledWith(1);
    
    // Verify the service was called
    expect(mockGetContractAbiJson).toHaveBeenCalled();
  });
});
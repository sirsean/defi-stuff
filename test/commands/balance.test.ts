import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { balance } from '../../src/commands/balance.js';
import { BalanceService } from '../../src/api/debank/balanceService.js';
import { mockUserTotalBalanceResponse } from '../utils/testData.js';

// Mock console.log and console.error
const mockConsoleLog = vi.fn();
const mockConsoleError = vi.fn();
const originalConsoleLog = console.log;
const originalConsoleError = console.error;
const mockProcessExit = vi.fn();
const originalProcessExit = process.exit;

// Mock setWalletAddress and getUserBalanceWithThreshold
const mockSetWalletAddress = vi.fn();
const mockGetUserBalanceWithThreshold = vi.fn();

// Mock the BalanceService
vi.mock('../../src/api/debank/balanceService.js', () => {
  return {
    BalanceService: vi.fn().mockImplementation(() => ({
      getUserBalanceWithThreshold: mockGetUserBalanceWithThreshold,
      setWalletAddress: mockSetWalletAddress
    }))
  };
});

describe('balance command', () => {
  const walletAddress = '0x1234567890abcdef1234567890abcdef12345678';
  const defaultWalletAddress = '0xdefault1234567890abcdef1234567890abcdef';
  
  beforeEach(() => {
    // Mock environment variables
    process.env.WALLET_ADDRESS = defaultWalletAddress;
    
    // Mock console methods before each test
    console.log = mockConsoleLog;
    console.error = mockConsoleError;
    process.exit = mockProcessExit as any;
    
    // Clear all mocks
    vi.clearAllMocks();
    
    // Reset mock implementation of getUserBalanceWithThreshold to avoid test interference
    mockGetUserBalanceWithThreshold.mockReset();
  });
  
  afterEach(() => {
    // Restore console methods after each test
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
    process.exit = originalProcessExit;
    
    // Clean up environment variables
    delete process.env.WALLET_ADDRESS;
  });
  
  it('should use address from parameter when provided', async () => {
    // Arrange: Mock the service method
    const filteredData = {
      total_usd_value: mockUserTotalBalanceResponse.total_usd_value,
      chain_list: mockUserTotalBalanceResponse.chain_list.filter(chain => chain.usd_value >= 1000)
    };
    mockGetUserBalanceWithThreshold.mockResolvedValue(filteredData);
    
    // Act: Call the command with address parameter
    await balance(walletAddress, {});
    
    // Assert: Check that setWalletAddress was called with the parameter address
    expect(mockSetWalletAddress).toHaveBeenCalledWith(walletAddress);
    expect(mockConsoleLog).toHaveBeenCalledWith(`Fetching balance for wallet ${walletAddress}...`);
  });
  
  it('should use address from --address option when provided', async () => {
    // Arrange: Mock the service method
    const filteredData = {
      total_usd_value: mockUserTotalBalanceResponse.total_usd_value,
      chain_list: mockUserTotalBalanceResponse.chain_list.filter(chain => chain.usd_value >= 1000)
    };
    mockGetUserBalanceWithThreshold.mockResolvedValue(filteredData);
    
    const optionAddress = '0xabcdef1234567890abcdef1234567890abcdef12';
    
    // Act: Call the command with address option
    await balance('', { address: optionAddress });
    
    // Assert: Check that setWalletAddress was called with the option address
    expect(mockSetWalletAddress).toHaveBeenCalledWith(optionAddress);
    expect(mockConsoleLog).toHaveBeenCalledWith(`Fetching balance for wallet ${optionAddress}...`);
  });
  
  it('should use default wallet when no address is provided', async () => {
    // Arrange: Mock the service method
    const filteredData = {
      total_usd_value: mockUserTotalBalanceResponse.total_usd_value,
      chain_list: mockUserTotalBalanceResponse.chain_list.filter(chain => chain.usd_value >= 1000)
    };
    mockGetUserBalanceWithThreshold.mockResolvedValue(filteredData);
    
    // Act: Call the command with no address
    await balance('', {});
    
    // Assert: Check that default wallet message is shown
    expect(mockConsoleLog).toHaveBeenCalledWith('Fetching balance for default wallet...');
  });
  
  it('should display wallet balance data with default threshold', async () => {
    // Arrange: Mock the service method
    const filteredData = {
      total_usd_value: mockUserTotalBalanceResponse.total_usd_value,
      chain_list: mockUserTotalBalanceResponse.chain_list.filter(chain => chain.usd_value >= 1000)
    };
    mockGetUserBalanceWithThreshold.mockResolvedValue(filteredData);
    
    // Act: Call the command
    await balance(walletAddress, {});
    
    // Assert: Check the expected console output
    expect(mockConsoleLog).toHaveBeenCalledWith(`\nTotal Balance: $${filteredData.total_usd_value.toLocaleString()}`);
    expect(mockConsoleLog).toHaveBeenCalledWith(`\nChain Balances (above $1,000 threshold):`);
    
    // Check that getUserBalanceWithThreshold was called with right parameters
    expect(mockGetUserBalanceWithThreshold).toHaveBeenCalledWith(walletAddress, 1000);
  });
  
  it('should display wallet balance with a custom threshold', async () => {
    // Arrange: Mock the service method with custom threshold (50000)
    const customThreshold = 50000;
    const filteredData = {
      total_usd_value: mockUserTotalBalanceResponse.total_usd_value,
      chain_list: mockUserTotalBalanceResponse.chain_list.filter(chain => chain.usd_value >= customThreshold)
    };
    mockGetUserBalanceWithThreshold.mockResolvedValue(filteredData);
    
    // Act: Call the command with custom threshold
    await balance(walletAddress, { threshold: customThreshold });
    
    // Assert: Check the service was called with the right threshold
    expect(mockGetUserBalanceWithThreshold).toHaveBeenCalledWith(walletAddress, customThreshold);
    expect(mockConsoleLog).toHaveBeenCalledWith(`\nChain Balances (above $${customThreshold.toLocaleString()} threshold):`);
  });
  
  it('should display a message when no chains meet the threshold', async () => {
    // Arrange: Mock empty chain list
    const threshold = 1000000; // 1 million
    const filteredData = {
      total_usd_value: mockUserTotalBalanceResponse.total_usd_value,
      chain_list: []
    };
    mockGetUserBalanceWithThreshold.mockResolvedValue(filteredData);
    
    // Act: Call the command with a very high threshold
    await balance(walletAddress, { threshold });
    
    // Assert: Check the appropriate messages
    expect(mockConsoleLog).toHaveBeenCalledWith(`\nTotal Balance: $${filteredData.total_usd_value.toLocaleString()}`);
    expect(mockConsoleLog).toHaveBeenCalledWith(`\nNo chains with balances above $${threshold.toLocaleString()} threshold.`);
  });
  
  it('should handle errors and exit with code 1', async () => {
    // Arrange: Mock service to throw an error
    const errorMessage = 'API connection failed';
    mockGetUserBalanceWithThreshold.mockRejectedValue(new Error(errorMessage));
    
    // Act: Call the command
    await balance(walletAddress, {});
    
    // Assert: Check error handling
    expect(mockConsoleError).toHaveBeenCalledWith('Error fetching balance:', expect.any(Error));
    expect(mockProcessExit).toHaveBeenCalledWith(1);
  });
});
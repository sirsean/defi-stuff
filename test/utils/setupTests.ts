import { beforeEach, afterEach, vi } from 'vitest';

// Auto mock the dotenv module for all tests
vi.mock('dotenv', () => ({
  default: {
    config: vi.fn(),
  },
}));

// Setup environment variables for testing
beforeEach(() => {
  // Mock environment variables
  process.env.DEBANK_API_KEY = 'test-api-key';
});

// Clean up environment between tests
afterEach(() => {
  // Clear environment variables
  delete process.env.DEBANK_API_KEY;
  
  // Clear all mocks
  vi.clearAllMocks();
});
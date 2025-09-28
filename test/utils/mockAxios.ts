import axios from "axios";
import MockAdapter from "axios-mock-adapter";

/**
 * Creates and returns a new mock axios instance for testing
 * @returns {MockAdapter} A mock adapter for axios
 */
export function createMockAxios(): MockAdapter {
  return new MockAdapter(axios);
}

/**
 * Resets the mock axios instance
 * @param mock The mock adapter instance to reset
 */
export function resetMockAxios(mock: MockAdapter): void {
  mock.reset();
}

/**
 * Restores the original axios instance
 * @param mock The mock adapter instance to restore
 */
export function restoreMockAxios(mock: MockAdapter): void {
  mock.restore();
}

import { vi } from "vitest";

/**
 * Utility for mocking console methods in tests
 */
export class ConsoleMock {
  // Mock functions
  static logMock = vi.fn();
  static errorMock = vi.fn();
  static exitMock = vi.fn();

  // Original functions
  private static originalLog: typeof console.log;
  private static originalError: typeof console.error;
  private static originalExit: typeof process.exit;

  /**
   * Setup console mocks
   */
  static setup(): void {
    // Store original functions
    this.originalLog = console.log;
    this.originalError = console.error;
    this.originalExit = process.exit;

    // Replace with mocks
    console.log = this.logMock;
    console.error = this.errorMock;
    process.exit = this.exitMock as any;
  }

  /**
   * Restore original console methods
   */
  static restore(): void {
    // Restore original functions
    console.log = this.originalLog;
    console.error = this.originalError;
    process.exit = this.originalExit;

    // Clear the mocks
    this.resetCalls();
  }

  /**
   * Get log mock
   */
  static get log(): typeof vi.fn {
    return this.logMock;
  }

  /**
   * Get error mock
   */
  static get error(): typeof vi.fn {
    return this.errorMock;
  }

  /**
   * Get exit mock
   */
  static get exit(): typeof vi.fn {
    return this.exitMock;
  }

  /**
   * Reset call counts
   */
  static resetCalls(): void {
    this.logMock.mockClear();
    this.errorMock.mockClear();
    this.exitMock.mockClear();
  }
}

/**
 * Setup and teardown for tests using console mocks
 *
 * Usage:
 * ```
 * describe('my test suite', () => {
 *   beforeEach(() => {
 *     ConsoleMock.setup();
 *   });
 *
 *   afterEach(() => {
 *     ConsoleMock.restore();
 *   });
 *
 *   // Tests...
 * });
 * ```
 */
export function setupConsoleMocks(): void {
  beforeEach(() => {
    ConsoleMock.setup();
  });

  afterEach(() => {
    ConsoleMock.restore();
  });
}

import { describe, it, expect, beforeEach, vi } from "vitest";
import path from "path";
import os from "os";

// Mock getContractAbiJson function
const mockGetContractAbiJson = vi.fn();
const mockGetExplorerName = vi.fn();

// Mock the AbiService class
vi.mock("../../src/api/explorers/abiService.js", () => {
  return {
    AbiService: vi.fn().mockImplementation(() => {
      return {
        getContractAbiJson: mockGetContractAbiJson,
        getExplorerName: mockGetExplorerName,
      };
    }),
  };
});

// Mock fs/promises - must use inline factory function
vi.mock("fs/promises", () => {
  return {
    writeFile: vi.fn(),
  };
});

// Import after mocks are defined
import { abi } from "../../src/commands/abi.js";
import { setupConsoleMocks, ConsoleMock } from "../utils/consoleMock.js";
import { writeFile } from "fs/promises";

describe("abi command", () => {
  // Set up console mocks for each test
  setupConsoleMocks();

  const testAddress = "0x1234567890abcdef1234567890abcdef12345678";
  const testAbi =
    '[\n  {\n    "inputs": [],\n    "name": "name",\n    "outputs": [\n      {\n        "type": "string"\n      }\n    ],\n    "stateMutability": "view",\n    "type": "function"\n  }\n]';

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Set default mock implementations
    mockGetContractAbiJson.mockResolvedValue(testAbi);
    mockGetExplorerName.mockReturnValue("Etherscan");
    vi.mocked(writeFile).mockResolvedValue(undefined);
  });

  it("should fetch and print ABI with proxy detection enabled by default", async () => {
    // Act: Call the command
    await abi(testAddress);

    // Assert: Verify the service was called with the right parameters
    expect(mockGetContractAbiJson).toHaveBeenCalledWith({
      address: testAddress,
      checkForProxy: true,
      chain: "ethereum",
    });

    // Check console logs: only raw ABI JSON should be printed
    expect(ConsoleMock.log).toHaveBeenCalledWith(testAbi);
  });

  it("should fetch and print ABI with proxy detection disabled when specified", async () => {
    // Act: Call the command with ignoreProxy option
    await abi(testAddress, { ignoreProxy: true });

    // Assert: Verify the service was called with the right parameters
    expect(mockGetContractAbiJson).toHaveBeenCalledWith({
      address: testAddress,
      checkForProxy: false,
      chain: "ethereum",
    });

    // Check console logs: only raw ABI JSON should be printed
    expect(ConsoleMock.log).toHaveBeenCalledWith(testAbi);
  });

  it("should use the specified blockchain when provided", async () => {
    // Arrange: Mock for Base chain
    mockGetExplorerName.mockReturnValue("Basescan");

    // Act: Call the command with chain option
    await abi(testAddress, { chain: "base" });

    // Assert: Verify the service was called with the base chain
    expect(mockGetContractAbiJson).toHaveBeenCalledWith({
      address: testAddress,
      checkForProxy: true,
      chain: "base",
    });

    // Check console logs: only raw ABI JSON should be printed
    expect(ConsoleMock.log).toHaveBeenCalledWith(testAbi);
  });

  it("should exit with error when an unsupported blockchain is specified", async () => {
    // Act: Call the command with an invalid chain
    await abi(testAddress, { chain: "invalid-chain" });

    // Assert: Verify error handling
    expect(ConsoleMock.error).toHaveBeenCalledWith(
      expect.stringContaining("Unsupported blockchain"),
    );
    expect(ConsoleMock.exit).toHaveBeenCalledWith(1);

    // Verify the service was not called
    expect(mockGetContractAbiJson).not.toHaveBeenCalled();
  });

  it("should exit with error when address is not provided", async () => {
    // Act: Call the command without an address
    await abi("");

    // Assert: Verify error handling
    expect(ConsoleMock.error).toHaveBeenCalledWith(
      expect.stringContaining("required"),
    );
    expect(ConsoleMock.exit).toHaveBeenCalledWith(1);

    // Verify the service was not called
    expect(mockGetContractAbiJson).not.toHaveBeenCalled();
  });

  it("should exit with error when address format is invalid", async () => {
    // Act: Call the command with an invalid address
    await abi("0xinvalid");

    // Assert: Verify error handling
    expect(ConsoleMock.error).toHaveBeenCalledWith(
      expect.stringContaining("Invalid Ethereum address"),
    );
    expect(ConsoleMock.exit).toHaveBeenCalledWith(1);

    // Verify the service was not called
    expect(mockGetContractAbiJson).not.toHaveBeenCalled();
  });

  it("should handle service errors gracefully", async () => {
    // Arrange: Set up the mock to throw an error
    const testError = new Error("Service error");
    mockGetContractAbiJson.mockRejectedValue(testError);

    // Act: Call the command
    await abi(testAddress);

    // Assert: Verify error handling
    expect(ConsoleMock.error).toHaveBeenCalledWith(
      "Error fetching contract ABI:",
      testError,
    );
    expect(ConsoleMock.exit).toHaveBeenCalledWith(1);

    // Verify the service was called
    expect(mockGetContractAbiJson).toHaveBeenCalled();
  });

  describe("--output file writing behavior", () => {
    it("should write ABI to file when --output is specified", async () => {
      // Arrange: Set up the mock
      const relPath = "abi.json";
      const expectedPath = path.resolve(relPath);

      // Act: Call the command with output option
      await abi(testAddress, { output: relPath });

      // Assert: Verify writeFile was called correctly
      expect(writeFile).toHaveBeenCalledWith(
        expectedPath,
        testAbi,
        "utf-8",
      );

      // Verify success message was logged
      expect(ConsoleMock.log).toHaveBeenCalledWith(
        `ABI written to: ${expectedPath}`,
      );

      // Ensure JSON itself was not printed to stdout
      expect(ConsoleMock.log).not.toHaveBeenCalledWith(testAbi);
    });

    it("should print success message only (not JSON) when writing to file", async () => {
      // Arrange
      const outputFile = "out.json";
      const expectedPath = path.resolve(outputFile);

      // Act
      await abi(testAddress, { output: outputFile });

      // Assert: First call should be success message
      expect(ConsoleMock.log).toHaveBeenCalledWith(
        `ABI written to: ${expectedPath}`,
      );

      // Not printing the actual JSON
      expect(ConsoleMock.log).not.toHaveBeenCalledWith(testAbi);
    });

    it("should print JSON to stdout when --output is not specified", async () => {
      // Act: Call without output option
      await abi(testAddress, {});

      // Assert: writeFile should not be called
      expect(writeFile).not.toHaveBeenCalled();

      // JSON should be printed to stdout
      expect(ConsoleMock.log).toHaveBeenCalledWith(testAbi);
    });

    it("should handle relative paths correctly", async () => {
      // Arrange
      const relative = "./artifacts/abi.json";
      const resolved = path.resolve(relative);

      // Act
      await abi(testAddress, { output: relative });

      // Assert
      expect(writeFile).toHaveBeenCalledWith(resolved, testAbi, "utf-8");
      expect(ConsoleMock.log).toHaveBeenCalledWith(
        `ABI written to: ${resolved}`,
      );
    });

    it("should handle absolute paths correctly", async () => {
      // Arrange
      const absolute = path.join(os.tmpdir(), "abi.json");

      // Act
      await abi(testAddress, { output: absolute });

      // Assert
      expect(writeFile).toHaveBeenCalledWith(absolute, testAbi, "utf-8");
      expect(ConsoleMock.log).toHaveBeenCalledWith(
        `ABI written to: ${absolute}`,
      );
    });

    it("should handle file write failures gracefully", async () => {
      // Arrange: Set up writeFile to fail
      const err = new Error("EACCES: permission denied");
      vi.mocked(writeFile).mockRejectedValue(err);

      // Act
      await abi(testAddress, { output: "abi.json" });

      // Assert: Error should be logged
      expect(ConsoleMock.error).toHaveBeenCalledWith(
        "Error fetching contract ABI:",
        err,
      );
      expect(ConsoleMock.exit).toHaveBeenCalledWith(1);

      // Do not print JSON to stdout on failure
      expect(ConsoleMock.log).not.toHaveBeenCalledWith(testAbi);
    });

    it("should work with --output and other options together", async () => {
      // Arrange
      const outputFile = "base-abi.json";
      const expectedPath = path.resolve(outputFile);

      // Act: Call with output, chain, and ignoreProxy options
      await abi(testAddress, {
        output: outputFile,
        chain: "base",
        ignoreProxy: true,
      });

      // Assert: Service should be called with correct options
      expect(mockGetContractAbiJson).toHaveBeenCalledWith({
        address: testAddress,
        checkForProxy: false,
        chain: "base",
      });

      // File should be written
      expect(writeFile).toHaveBeenCalledWith(
        expectedPath,
        testAbi,
        "utf-8",
      );

      // Success message should be logged
      expect(ConsoleMock.log).toHaveBeenCalledWith(
        `ABI written to: ${expectedPath}`,
      );
    });
  });
});

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { ProtocolService } from "../../../src/api/debank/protocolService.js";
import { mockProtocolList } from "../../utils/testData.js";

// Mock the DebankClient
vi.mock("../../../src/api/debank/debankClient.js", () => {
  return {
    DebankClient: vi.fn().mockImplementation(() => {
      return {
        getProtocolList: vi.fn().mockResolvedValue(mockProtocolList),
      };
    }),
  };
});

describe("ProtocolService", () => {
  let protocolService: ProtocolService;

  beforeEach(() => {
    // Set up environment for testing
    process.env.DEBANK_API_KEY = "test-api-key";
    protocolService = new ProtocolService();
  });

  afterEach(() => {
    // Clean up
    delete process.env.DEBANK_API_KEY;
    vi.clearAllMocks();
  });

  describe("getProtocols", () => {
    it("should return all protocols for a chain", async () => {
      const result = await protocolService.getProtocols("eth");

      expect(result).toEqual(mockProtocolList);
    });
  });

  describe("searchProtocols", () => {
    it("should return all protocols when no search term is provided", async () => {
      const result = await protocolService.searchProtocols({ chain: "eth" });

      expect(result).toEqual(mockProtocolList);
    });

    it("should filter protocols based on search term", async () => {
      const result = await protocolService.searchProtocols({
        chain: "eth",
        searchTerm: "Aave",
      });

      expect(result.length).toBe(1);
      expect(result[0].name).toBe("Aave");
    });

    it("should return empty array when no matches are found", async () => {
      const result = await protocolService.searchProtocols({
        chain: "eth",
        searchTerm: "NonExistentProtocol",
      });

      expect(result).toEqual([]);
    });
  });
});

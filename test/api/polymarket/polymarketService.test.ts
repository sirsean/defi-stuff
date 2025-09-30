import { describe, it, expect } from "vitest";
import { PolymarketService } from "../../../src/api/polymarket/polymarketService.js";

describe("PolymarketService", () => {
  describe("findNearestFutureDate", () => {
    it("should return the earliest future date when today is before all dates", () => {
      const service = new PolymarketService();
      const today = "2025-09-25";
      const available = [
        "2025-09-30",
        "2025-10-01",
        "2025-10-02",
        "2025-12-31",
      ];

      // Access private method via any cast for testing
      const result = (service as any).findNearestFutureDate(today, available);

      expect(result).toBe("2025-09-30");
    });

    it("should return today when today is in the available dates", () => {
      const service = new PolymarketService();
      const today = "2025-09-30";
      const available = [
        "2025-09-30",
        "2025-10-01",
        "2025-10-02",
        "2025-12-31",
      ];

      const result = (service as any).findNearestFutureDate(today, available);

      expect(result).toBe("2025-09-30");
    });

    it("should return the next date when today is between dates", () => {
      const service = new PolymarketService();
      const today = "2025-09-28";
      const available = [
        "2025-09-25",
        "2025-09-30",
        "2025-10-01",
        "2025-12-31",
      ];

      const result = (service as any).findNearestFutureDate(today, available);

      expect(result).toBe("2025-09-30");
    });

    it("should return the latest date when all dates are in the past", () => {
      const service = new PolymarketService();
      const today = "2025-12-31";
      const available = ["2025-09-30", "2025-10-01", "2025-10-02"];

      const result = (service as any).findNearestFutureDate(today, available);

      expect(result).toBe("2025-10-02");
    });

    it("should handle empty array by returning today", () => {
      const service = new PolymarketService();
      const today = "2025-09-30";
      const available: string[] = [];

      const result = (service as any).findNearestFutureDate(today, available);

      expect(result).toBe(today);
    });

    it("should handle single date correctly", () => {
      const service = new PolymarketService();
      const today = "2025-09-30";
      const available = ["2025-10-01"];

      const result = (service as any).findNearestFutureDate(today, available);

      expect(result).toBe("2025-10-01");
    });

    it("should skip past dates and find next future date", () => {
      const service = new PolymarketService();
      const today = "2025-10-03";
      const available = [
        "2024-11-30", // Past
        "2025-09-30", // Past
        "2025-10-01", // Past
        "2025-10-02", // Past
        "2025-10-03", // Today
        "2025-10-04", // Future
        "2025-12-31", // Future
      ];

      const result = (service as any).findNearestFutureDate(today, available);

      expect(result).toBe("2025-10-03");
    });
  });

  describe("findClosestDate", () => {
    it("should find the exact match when target exists", () => {
      const service = new PolymarketService();
      const target = "2025-10-01";
      const available = ["2025-09-30", "2025-10-01", "2025-10-02"];

      const result = (service as any).findClosestDate(target, available);

      expect(result).toBe("2025-10-01");
    });

    it("should find closest date when target is between two dates", () => {
      const service = new PolymarketService();
      const target = "2025-10-03";
      const available = [
        "2025-09-30",
        "2025-10-01",
        "2025-10-05",
        "2025-12-31",
      ];

      const result = (service as any).findClosestDate(target, available);

      // Should find 10-01 or 10-05, whichever is closer to 10-03
      // 10-03 - 10-01 = 2 days
      // 10-05 - 10-03 = 2 days
      // Tie: algorithm keeps first match found (10-01)
      expect(result).toBe("2025-10-01");
    });

    it("should find closest past date when target is after all dates", () => {
      const service = new PolymarketService();
      const target = "2026-01-01";
      const available = ["2025-09-30", "2025-10-01", "2025-12-31"];

      const result = (service as any).findClosestDate(target, available);

      expect(result).toBe("2025-12-31");
    });

    it("should find closest future date when target is before all dates", () => {
      const service = new PolymarketService();
      const target = "2025-09-01";
      const available = ["2025-09-30", "2025-10-01", "2025-12-31"];

      const result = (service as any).findClosestDate(target, available);

      expect(result).toBe("2025-09-30");
    });

    it("should return target when array is empty", () => {
      const service = new PolymarketService();
      const target = "2025-10-01";
      const available: string[] = [];

      const result = (service as any).findClosestDate(target, available);

      expect(result).toBe(target);
    });
  });
});

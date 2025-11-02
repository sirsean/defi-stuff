import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { confidenceStatus } from "../../src/commands/confidenceStatus.js";
import { ConfidenceCalibrationService } from "../../src/db/confidenceCalibrationService.js";
import type { CalibrationData } from "../../src/types/confidence.js";

// Mock the service
vi.mock("../../src/db/confidenceCalibrationService.js");

describe("confidenceStatus", () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.clearAllMocks();
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  const createMockCalibration = (
    timestampMs: number,
    overrides: Partial<CalibrationData> = {},
  ): { data: CalibrationData; timestamp: number } => {
    return {
      data: {
        market: "BTC",
        windowDays: 60,
        points: [],
        sampleSize: 50,
        correlation: 0.35,
        highConfWinRate: 0.65,
        lowConfWinRate: 0.45,
        ...overrides,
      },
      timestamp: timestampMs,
    };
  };

  const setupMocks = (
    data: CalibrationData | null,
    timestamp: number | null,
  ) => {
    vi.mocked(
      ConfidenceCalibrationService.prototype.getLatestCalibration,
    ).mockResolvedValue(data);
    vi.mocked(
      ConfidenceCalibrationService.prototype.getLatestCalibrationTimestamp,
    ).mockResolvedValue(timestamp);
  };

  describe("single market status", () => {
    it("should display healthy status for recent calibration with good correlation", async () => {
      const mock = createMockCalibration(Date.now(), { correlation: 0.35 });
      setupMocks(mock.data, mock.timestamp);

      await confidenceStatus({ market: "BTC" });

      const output = consoleLogSpy.mock.calls.map((call) => call[0]).join("\n");

      expect(output).toContain("📊 CONFIDENCE CALIBRATION STATUS");
      expect(output).toContain("✅ BTC");
      expect(output).toContain("HEALTHY");
      expect(output).toContain("Today");
      expect(output).toContain("50"); // sample size
      expect(output).toContain("+0.350"); // correlation
      expect(output).toContain("65.0%"); // high conf win rate
      expect(output).toContain("45.0%"); // low conf win rate
      expect(output).toContain("+20.0 pp"); // gap
      expect(output).toContain("Strong predictive power");
      expect(output).toContain("Calibration is fresh");
      expect(output).toContain("Calibration is in good health");
    });

    it("should display warning status for aging calibration", async () => {
      const nineDaysAgo = Date.now() - 9 * 24 * 60 * 60 * 1000;
      const mock = createMockCalibration(nineDaysAgo, { correlation: 0.25 });
      setupMocks(mock.data, mock.timestamp);

      await confidenceStatus({ market: "BTC" });

      const output = consoleLogSpy.mock.calls.map((call) => call[0]).join("\n");

      expect(output).toContain("⚠️ BTC");
      expect(output).toContain("WARNING");
      expect(output).toContain("9 days ago");
      expect(output).toContain("Calibration aging");
      expect(output).toContain("Consider recalibrating soon");
    });

    it("should display warning status for weak correlation", async () => {
      const mock = createMockCalibration(Date.now(), { correlation: 0.15 });
      setupMocks(mock.data, mock.timestamp);

      await confidenceStatus({ market: "BTC" });

      const output = consoleLogSpy.mock.calls.map((call) => call[0]).join("\n");

      expect(output).toContain("⚠️ BTC");
      expect(output).toContain("WARNING");
      expect(output).toContain("Weak predictive power");
      expect(output).toContain("Consider recalibrating soon");
    });

    it("should display needs recalibration status for stale calibration", async () => {
      const sixteenDaysAgo = Date.now() - 16 * 24 * 60 * 60 * 1000;
      const mock = createMockCalibration(sixteenDaysAgo, { correlation: 0.25 });
      setupMocks(mock.data, mock.timestamp);

      await confidenceStatus({ market: "BTC" });

      const output = consoleLogSpy.mock.calls.map((call) => call[0]).join("\n");

      expect(output).toContain("❌ BTC");
      expect(output).toContain("NEEDS_RECALIBRATION");
      expect(output).toContain("16 days ago");
      expect(output).toContain("Calibration is stale");
      expect(output).toContain("Recalibrate now");
    });

    it("should display needs recalibration status for poor correlation", async () => {
      const mock = createMockCalibration(Date.now(), { correlation: 0.05 });
      setupMocks(mock.data, mock.timestamp);

      await confidenceStatus({ market: "BTC" });

      const output = consoleLogSpy.mock.calls.map((call) => call[0]).join("\n");

      expect(output).toContain("❌ BTC");
      expect(output).toContain("NEEDS_RECALIBRATION");
      expect(output).toContain("Very weak predictive power");
      expect(output).toContain("Recalibrate now");
    });

    it("should display missing calibration status", async () => {
      setupMocks(null, null);

      await confidenceStatus({ market: "BTC" });

      const output = consoleLogSpy.mock.calls.map((call) => call[0]).join("\n");

      expect(output).toContain("❌ BTC");
      expect(output).toContain("MISSING CALIBRATION");
      expect(output).toContain(
        "Run: npm run dev -- confidence:calibrate -m BTC",
      );
    });

    it("should handle anti-predictive (negative) correlation", async () => {
      const mock = createMockCalibration(Date.now(), { correlation: -0.15 });
      setupMocks(mock.data, mock.timestamp);

      await confidenceStatus({ market: "BTC" });

      const output = consoleLogSpy.mock.calls.map((call) => call[0]).join("\n");

      expect(output).toContain("❌ BTC");
      expect(output).toContain("NEEDS_RECALIBRATION");
      expect(output).toContain("-0.150");
      expect(output).toContain("Anti-predictive (inverted)");
    });
  });

  describe("all markets status", () => {
    it("should display status for multiple markets", async () => {
      const btcMock = createMockCalibration(Date.now(), {
        market: "BTC",
        correlation: 0.35,
      });
      const ethMock = createMockCalibration(
        Date.now() - 10 * 24 * 60 * 60 * 1000,
        { market: "ETH", correlation: 0.15 },
      );

      vi.mocked(ConfidenceCalibrationService.prototype.getLatestCalibration)
        .mockResolvedValueOnce(btcMock.data)
        .mockResolvedValueOnce(ethMock.data);
      vi.mocked(
        ConfidenceCalibrationService.prototype.getLatestCalibrationTimestamp,
      )
        .mockResolvedValueOnce(btcMock.timestamp)
        .mockResolvedValueOnce(ethMock.timestamp);

      await confidenceStatus({});

      const output = consoleLogSpy.mock.calls.map((call) => call[0]).join("\n");

      expect(output).toContain("ALL MARKETS");
      expect(output).toContain("✅ BTC");
      expect(output).toContain("HEALTHY");
      expect(output).toContain("⚠️ ETH");
      expect(output).toContain("WARNING");
      expect(output).toContain("─".repeat(79)); // separator between markets
    });

    it("should display summary with all healthy", async () => {
      const btcMock = createMockCalibration(Date.now(), {
        market: "BTC",
        correlation: 0.35,
      });
      const ethMock = createMockCalibration(Date.now(), {
        market: "ETH",
        correlation: 0.3,
      });

      vi.mocked(ConfidenceCalibrationService.prototype.getLatestCalibration)
        .mockResolvedValueOnce(btcMock.data)
        .mockResolvedValueOnce(ethMock.data);
      vi.mocked(
        ConfidenceCalibrationService.prototype.getLatestCalibrationTimestamp,
      )
        .mockResolvedValueOnce(btcMock.timestamp)
        .mockResolvedValueOnce(ethMock.timestamp);

      await confidenceStatus({});

      const output = consoleLogSpy.mock.calls.map((call) => call[0]).join("\n");

      expect(output).toContain("📈 SUMMARY");
      expect(output).toContain("✅ Healthy:              2");
      expect(output).toContain("⚠️  Warning:              0");
      expect(output).toContain("❌ Needs Recalibration:  0");
      expect(output).toContain("❌ Missing Calibration:  0");
      expect(output).toContain("All calibrations are healthy ✅");
    });

    it("should display summary with mixed statuses", async () => {
      const btcMock = createMockCalibration(Date.now(), {
        market: "BTC",
        correlation: 0.35,
      });

      vi.mocked(ConfidenceCalibrationService.prototype.getLatestCalibration)
        .mockResolvedValueOnce(btcMock.data)
        .mockResolvedValueOnce(null); // ETH missing
      vi.mocked(
        ConfidenceCalibrationService.prototype.getLatestCalibrationTimestamp,
      )
        .mockResolvedValueOnce(btcMock.timestamp)
        .mockResolvedValueOnce(null);

      await confidenceStatus({});

      const output = consoleLogSpy.mock.calls.map((call) => call[0]).join("\n");

      expect(output).toContain("📈 SUMMARY");
      expect(output).toContain("✅ Healthy:              1");
      expect(output).toContain("❌ Missing Calibration:  1");
      expect(output).toContain("💡 ACTION REQUIRED");
      expect(output).toContain("Run calibration for markets marked with ❌");
    });

    it("should display warning recommendation for single market", async () => {
      // Explicitly reset all mocks first
      vi.resetAllMocks();

      const mock = createMockCalibration(Date.now(), { correlation: 0.15 });
      vi.mocked(
        ConfidenceCalibrationService.prototype.getLatestCalibration,
      ).mockResolvedValue(mock.data);
      vi.mocked(
        ConfidenceCalibrationService.prototype.getLatestCalibrationTimestamp,
      ).mockResolvedValue(mock.timestamp);

      await confidenceStatus({ market: "BTC" });

      const output = consoleLogSpy.mock.calls.map((call) => call[0]).join("\n");

      expect(output).toContain("⚠️ BTC");
      expect(output).toContain("WARNING");
      expect(output).toContain("⚠️  Warning:              1");
      expect(output).toContain("💡 RECOMMENDATION");
      expect(output).toContain("Consider recalibrating");
    });
  });

  describe("formatting", () => {
    it("should format age correctly for today", async () => {
      const mock = createMockCalibration(Date.now());
      setupMocks(mock.data, mock.timestamp);

      await confidenceStatus({ market: "BTC" });

      const output = consoleLogSpy.mock.calls.map((call) => call[0]).join("\n");

      expect(output).toContain("Today");
    });

    it("should format age correctly for 1 day", async () => {
      const yesterday = Date.now() - 1 * 24 * 60 * 60 * 1000;
      const mock = createMockCalibration(yesterday);
      setupMocks(mock.data, mock.timestamp);

      await confidenceStatus({ market: "BTC" });

      const output = consoleLogSpy.mock.calls.map((call) => call[0]).join("\n");

      expect(output).toContain("1 day ago");
    });

    it("should format correlation with sign", async () => {
      const mock = createMockCalibration(Date.now(), { correlation: 0.123 });
      setupMocks(mock.data, mock.timestamp);

      await confidenceStatus({ market: "BTC" });

      const output = consoleLogSpy.mock.calls.map((call) => call[0]).join("\n");

      expect(output).toContain("+0.123");
    });

    it("should format win rate gap with sign and pp", async () => {
      const mock = createMockCalibration(Date.now(), {
        highConfWinRate: 0.65,
        lowConfWinRate: 0.45,
      });
      setupMocks(mock.data, mock.timestamp);

      await confidenceStatus({ market: "BTC" });

      const output = consoleLogSpy.mock.calls.map((call) => call[0]).join("\n");

      expect(output).toContain("+20.0 pp");
    });

    it("should format negative gap correctly", async () => {
      const mock = createMockCalibration(Date.now(), {
        highConfWinRate: 0.45,
        lowConfWinRate: 0.65,
      });
      setupMocks(mock.data, mock.timestamp);

      await confidenceStatus({ market: "BTC" });

      const output = consoleLogSpy.mock.calls.map((call) => call[0]).join("\n");

      expect(output).toContain("-20.0 pp");
    });
  });

  describe("error handling", () => {
    it("should handle service errors gracefully", async () => {
      vi.mocked(
        ConfidenceCalibrationService.prototype.getLatestCalibration,
      ).mockRejectedValue(new Error("Database connection failed"));

      await expect(confidenceStatus({ market: "BTC" })).rejects.toThrow(
        "Database connection failed",
      );

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Error checking confidence status:",
        expect.any(Error),
      );
    });
  });

  describe("health thresholds", () => {
    it("should categorize r=0.21 as healthy", async () => {
      const mock = createMockCalibration(Date.now(), { correlation: 0.21 });
      setupMocks(mock.data, mock.timestamp);

      await confidenceStatus({ market: "BTC" });

      const output = consoleLogSpy.mock.calls.map((call) => call[0]).join("\n");

      expect(output).toContain("✅ BTC");
      expect(output).toContain("HEALTHY");
    });

    it("should categorize r=0.20 as warning (boundary)", async () => {
      const mock = createMockCalibration(Date.now(), { correlation: 0.2 });
      setupMocks(mock.data, mock.timestamp);

      await confidenceStatus({ market: "BTC" });

      const output = consoleLogSpy.mock.calls.map((call) => call[0]).join("\n");

      expect(output).toContain("⚠️ BTC");
      expect(output).toContain("WARNING");
    });

    it("should categorize r=0.09 as needs recalibration (boundary)", async () => {
      const mock = createMockCalibration(Date.now(), { correlation: 0.09 });
      setupMocks(mock.data, mock.timestamp);

      await confidenceStatus({ market: "BTC" });

      const output = consoleLogSpy.mock.calls.map((call) => call[0]).join("\n");

      expect(output).toContain("❌ BTC");
      expect(output).toContain("NEEDS_RECALIBRATION");
    });

    it("should categorize 7 days as warning (boundary)", async () => {
      const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
      const mock = createMockCalibration(sevenDaysAgo, { correlation: 0.35 });
      setupMocks(mock.data, mock.timestamp);

      await confidenceStatus({ market: "BTC" });

      const output = consoleLogSpy.mock.calls.map((call) => call[0]).join("\n");

      expect(output).toContain("⚠️ BTC");
      expect(output).toContain("WARNING");
    });

    it("should categorize 15 days as needs recalibration (boundary)", async () => {
      const fifteenDaysAgo = Date.now() - 15 * 24 * 60 * 60 * 1000;
      const mock = createMockCalibration(fifteenDaysAgo, { correlation: 0.35 });
      setupMocks(mock.data, mock.timestamp);

      await confidenceStatus({ market: "BTC" });

      const output = consoleLogSpy.mock.calls.map((call) => call[0]).join("\n");

      expect(output).toContain("❌ BTC");
      expect(output).toContain("NEEDS_RECALIBRATION");
    });
  });
});

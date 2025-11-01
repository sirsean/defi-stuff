import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { confidenceCalibrate } from '../../src/commands/confidenceCalibrate.js';
import type { CalibrationData } from '../../src/types/confidence.js';

// Mock console methods
const mockConsoleLog = vi.fn();
const mockConsoleError = vi.fn();
const mockConsoleWarn = vi.fn();
const originalConsoleLog = console.log;
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;
const mockProcessExit = vi.fn();
const originalProcessExit = process.exit;

// Mock the ConfidenceCalibrationService
vi.mock('../../src/db/confidenceCalibrationService.js', () => {
  const mockComputeCalibration = vi.fn();
  const mockSaveCalibration = vi.fn();
  const mockGetLatestCalibration = vi.fn();
  const mockClose = vi.fn();

  return {
    ConfidenceCalibrationService: vi.fn().mockImplementation(() => ({
      computeCalibration: mockComputeCalibration,
      saveCalibration: mockSaveCalibration,
      getLatestCalibration: mockGetLatestCalibration,
      close: mockClose,
    })),
    // Export mocks for test access
    mockComputeCalibration,
    mockSaveCalibration,
    mockGetLatestCalibration,
    mockClose,
  };
});

// Mock Discord service
vi.mock('../../src/api/discord/discordService.js', () => {
  const mockSendMessage = vi.fn();
  const mockShutdown = vi.fn();
  const mockCreateEmbedMessage = vi.fn();

  return {
    discordService: {
      sendMessage: mockSendMessage,
      shutdown: mockShutdown,
      createEmbedMessage: mockCreateEmbedMessage,
    },
    DiscordColors: {
      GREEN: 0x00ff00,
      RED: 0xff0000,
    },
    // Export mocks for test access
    mockSendMessage,
    mockShutdown,
    mockCreateEmbedMessage,
  };
});

// Import mocks after vi.mock calls
import type { Mock } from 'vitest';
const {
  mockComputeCalibration,
  mockSaveCalibration,
  mockGetLatestCalibration,
  mockClose,
} = await import('../../src/db/confidenceCalibrationService.js') as any;

const {
  mockSendMessage,
  mockShutdown,
  mockCreateEmbedMessage,
} = await import('../../src/api/discord/discordService.js') as any;

describe('confidenceCalibrate command', () => {
  // Sample calibration data for testing
  const mockCalibrationData: CalibrationData = {
    market: 'BTC',
    windowDays: 60,
    points: [
      { rawConfidence: 0.0, calibratedConfidence: 0.0 },
      { rawConfidence: 0.4, calibratedConfidence: 0.38 },
      { rawConfidence: 0.5, calibratedConfidence: 0.48 },
      { rawConfidence: 0.6, calibratedConfidence: 0.58 },
      { rawConfidence: 0.7, calibratedConfidence: 0.68 },
      { rawConfidence: 0.8, calibratedConfidence: 0.78 },
      { rawConfidence: 0.9, calibratedConfidence: 0.88 },
      { rawConfidence: 1.0, calibratedConfidence: 0.95 },
    ],
    sampleSize: 142,
    correlation: 0.234,
    highConfWinRate: 0.542,
    lowConfWinRate: 0.487,
  };

  beforeEach(() => {
    // Mock console methods
    console.log = mockConsoleLog;
    console.error = mockConsoleError;
    console.warn = mockConsoleWarn;
    process.exit = mockProcessExit as any;

    // Clear all mocks
    vi.clearAllMocks();

    // Set default mock implementation for computeCalibration
    // Return data matching the requested market and days
    mockComputeCalibration.mockImplementation(async (market: string, days: number) => {
      return {
        ...mockCalibrationData,
        market,
        windowDays: days,
      };
    });
    mockSaveCalibration.mockResolvedValue(1); // Mock returning ID
    mockGetLatestCalibration.mockResolvedValue(null); // No previous calibration by default
    mockClose.mockResolvedValue(undefined);
    mockSendMessage.mockResolvedValue(undefined);
    mockShutdown.mockResolvedValue(undefined);
    mockCreateEmbedMessage.mockReturnValue({
      addTitle: vi.fn().mockReturnThis(),
      setColor: vi.fn().mockReturnThis(),
      addDescription: vi.fn().mockReturnThis(),
      addFields: vi.fn().mockReturnThis(),
      addTimestamp: vi.fn().mockReturnThis(),
    });
  });

  afterEach(() => {
    // Restore console methods
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
    console.warn = originalConsoleWarn;
    process.exit = originalProcessExit;
  });

  describe('successful calibration', () => {
    it('should compute and save calibration with valid inputs', async () => {
      // Act
      await confidenceCalibrate({
        market: 'BTC',
        days: 60,
        dryRun: false,
      });

      // Assert: Service methods called correctly
      expect(mockComputeCalibration).toHaveBeenCalledWith('BTC', 60);
      expect(mockSaveCalibration).toHaveBeenCalledWith(mockCalibrationData);
      expect(mockClose).toHaveBeenCalled();

      // Assert: Output includes all required sections
      const output = mockConsoleLog.mock.calls.map(call => call[0]).join('\n');
      
      expect(output).toContain('🎯 CONFIDENCE CALIBRATION ANALYSIS');
      expect(output).toContain('Market: BTC');
      expect(output).toContain('Analysis Window: 60 days');
      expect(output).toContain('Sample Size: 142 recommendations');
      expect(output).toContain('📊 CURRENT PERFORMANCE (Before Calibration)');
      expect(output).toContain('Confidence-Return Correlation:');
      expect(output).toContain('High Confidence Win Rate:');
      expect(output).toContain('Low Confidence Win Rate:');
      expect(output).toContain('📈 CALIBRATION CURVE');
      expect(output).toContain('📋 CALIBRATION POINTS');
      expect(output).toContain('🎓 EXPECTED IMPROVEMENT (After Calibration)');
      expect(output).toContain('💾 CALIBRATION SAVED');
      expect(output).toContain('Saved to database: confidence_calibrations table');
    });

    it('should use default days value of 60 when not specified', async () => {
      // Act
      await confidenceCalibrate({
        market: 'ETH',
      });

      // Assert
      expect(mockComputeCalibration).toHaveBeenCalledWith('ETH', 60);
    });

    it('should convert market to uppercase', async () => {
      // Act
      await confidenceCalibrate({
        market: 'btc',
        days: 30,
      });

      // Assert
      expect(mockComputeCalibration).toHaveBeenCalledWith('BTC', 30);
    });

    it('should display correlation interpretation correctly', async () => {
      // Act
      await confidenceCalibrate({
        market: 'BTC',
        days: 60,
      });

      // Assert: Check correlation formatting
      const output = mockConsoleLog.mock.calls.map(call => call[0]).join('\n');
      expect(output).toContain('+0.234 (weak positive)');
    });

    it('should display win rates as percentages', async () => {
      // Act
      await confidenceCalibrate({
        market: 'BTC',
        days: 60,
      });

      // Assert
      const output = mockConsoleLog.mock.calls.map(call => call[0]).join('\n');
      expect(output).toContain('54.2%');
      expect(output).toContain('48.7%');
    });

    it('should render ASCII calibration curve', async () => {
      // Act
      await confidenceCalibrate({
        market: 'BTC',
        days: 60,
      });

      // Assert: Check for box-drawing characters
      const output = mockConsoleLog.mock.calls.map(call => call[0]).join('\n');
      expect(output).toContain('●'); // Plot points
      expect(output).toContain('└'); // Axis
      expect(output).toContain('Raw Confidence →');
    });
  });

  describe('dry-run mode', () => {
    it('should compute but not save calibration in dry-run mode', async () => {
      // Act
      await confidenceCalibrate({
        market: 'BTC',
        days: 60,
        dryRun: true,
      });

      // Assert: Compute called but not save
      expect(mockComputeCalibration).toHaveBeenCalledWith('BTC', 60);
      expect(mockSaveCalibration).not.toHaveBeenCalled();
      expect(mockClose).toHaveBeenCalled();

      // Assert: Output shows dry-run message
      const output = mockConsoleLog.mock.calls.map(call => call[0]).join('\n');
      expect(output).toContain('🔍 DRY RUN MODE');
      expect(output).toContain('Calibration computed but NOT saved to database');
      expect(output).toContain('Remove --dry-run flag to save and activate');
      
      // Should not show save confirmation
      expect(output).not.toContain('💾 CALIBRATION SAVED');
    });
  });

  describe('error handling', () => {
    it('should handle missing market parameter', async () => {
      // Act: Call with empty market
      //  Note: process.exit is mocked and doesn't actually exit,
      // so the function continues and may hit other code paths
      await confidenceCalibrate({
        market: '',
      }).catch(() => {});

      // Assert: Error message displayed before process.exit
      expect(mockConsoleError).toHaveBeenCalledWith('');
      expect(mockConsoleError).toHaveBeenCalledWith('❌ Error: Market parameter is required');
      
      const errorOutput = mockConsoleError.mock.calls.map(call => call[0]).join('\n');
      expect(errorOutput).toContain('Usage:');
      expect(errorOutput).toContain('Examples:');
      expect(errorOutput).toContain('npm run dev -- confidence:calibrate -m BTC');
      
      // Most importantly, process.exit was called with code 1
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });

    it('should handle insufficient data error', async () => {
      // Arrange: Mock service to throw insufficient data error
      mockComputeCalibration.mockRejectedValue(
        new Error('Insufficient data: need at least 10 trades, found 5'),
      );
      
      // Make process.exit throw to stop execution
      mockProcessExit.mockImplementationOnce((code) => {
        throw new Error(`Process exit: ${code}`);
      });

      // Act: Should throw from process.exit
      await expect(confidenceCalibrate({
        market: 'BTC',
        days: 60,
      })).rejects.toThrow('Process exit: 1');

      // Assert: Error handling
      expect(mockConsoleError).toHaveBeenCalledWith('');
      expect(mockConsoleError).toHaveBeenCalledWith(
        '❌ Calibration failed:',
        'Insufficient data: need at least 10 trades, found 5',
      );
      
      const errorOutput = mockConsoleError.mock.calls.map(call => call[0]).join('\n');
      expect(errorOutput).toContain('💡 Hints:');
      expect(errorOutput).toContain('Need at least 10 directional trades');
      expect(errorOutput).toContain('npm run dev -- trade:recommend -m BTC --db');
      expect(errorOutput).toContain('Try a longer time window: --days 90');
      
      expect(mockProcessExit).toHaveBeenCalledWith(1);
      expect(mockClose).toHaveBeenCalled();
    });

    it('should handle no recommendations error', async () => {
      // Arrange: Mock service to throw no recommendations error
      mockComputeCalibration.mockRejectedValue(
        new Error('No recommendations found in database'),
      );
      
      // Make process.exit throw to stop execution
      mockProcessExit.mockImplementationOnce((code) => {
        throw new Error(`Process exit: ${code}`);
      });

      // Act: Should throw from process.exit
      await expect(confidenceCalibrate({
        market: 'ETH',
        days: 90,
      })).rejects.toThrow('Process exit: 1');

      // Assert: Error handling with market name
      const errorOutput = mockConsoleError.mock.calls.map(call => call[0]).join('\n');
      expect(errorOutput).toContain('💡 Hints:');
      expect(errorOutput).toContain('No trade recommendations found in database');
      expect(errorOutput).toContain('npm run dev -- trade:recommend -m ETH --db');
      
      expect(mockProcessExit).toHaveBeenCalledWith(1);
      expect(mockClose).toHaveBeenCalled();
    });

    it('should handle generic errors', async () => {
      // Arrange: Mock service to throw generic error
      mockComputeCalibration.mockRejectedValue(
        new Error('Database connection failed'),
      );
      
      // Make process.exit throw to stop execution
      mockProcessExit.mockImplementationOnce((code) => {
        throw new Error(`Process exit: ${code}`);
      });

      // Act: Should throw from process.exit
      await expect(confidenceCalibrate({
        market: 'BTC',
        days: 60,
      })).rejects.toThrow('Process exit: 1');

      // Assert: Generic error handling
      expect(mockConsoleError).toHaveBeenCalledWith(
        '❌ Calibration failed:',
        'Database connection failed',
      );
      expect(mockProcessExit).toHaveBeenCalledWith(1);
      expect(mockClose).toHaveBeenCalled();
    });

    it('should ensure database cleanup even on error', async () => {
      // Arrange: Mock service to throw error
      mockComputeCalibration.mockRejectedValue(new Error('Test error'));
      
      // Make process.exit throw to stop execution
      mockProcessExit.mockImplementationOnce((code) => {
        throw new Error(`Process exit: ${code}`);
      });

      // Act: Should throw from process.exit
      await expect(confidenceCalibrate({
        market: 'BTC',
        days: 60,
      })).rejects.toThrow('Process exit: 1');

      // Assert: Close was called in finally block
      expect(mockClose).toHaveBeenCalled();
    });
  });

  describe('output formatting', () => {
    it('should format dates correctly', async () => {
      // Act
      await confidenceCalibrate({
        market: 'BTC',
        days: 60,
      });

      // Assert: Date format should be MM/DD/YYYY
      const output = mockConsoleLog.mock.calls.map(call => call[0]).join('\n');
      expect(output).toMatch(/Date Range: \d{2}\/\d{2}\/\d{4} - \d{2}\/\d{2}\/\d{4}/);
    });

    it('should display calibration points table', async () => {
      // Act
      await confidenceCalibrate({
        market: 'BTC',
        days: 60,
      });

      // Assert: Table headers and values
      const output = mockConsoleLog.mock.calls.map(call => call[0]).join('\n');
      expect(output).toContain('Raw      Calibrated');
      expect(output).toContain('0.40     0.38');
      expect(output).toContain('0.50     0.48');
      expect(output).toContain('0.60     0.58');
    });

    it('should show projected improvements', async () => {
      // Act
      await confidenceCalibrate({
        market: 'BTC',
        days: 60,
      });

      // Assert: Projected metrics section
      const output = mockConsoleLog.mock.calls.map(call => call[0]).join('\n');
      expect(output).toContain('Projected Correlation:');
      expect(output).toContain('High Confidence Win Rate:');
      expect(output).toContain('Low Confidence Win Rate:');
      expect(output).toContain('Impact:');
      expect(output).toContain('correlation improvement');
    });

    it('should use proper box-drawing characters', async () => {
      // Act
      await confidenceCalibrate({
        market: 'BTC',
        days: 60,
      });

      // Assert: Check for Unicode characters
      const output = mockConsoleLog.mock.calls.map(call => call[0]).join('\n');
      expect(output).toContain('═'); // Double horizontal
      expect(output).toContain('─'); // Single horizontal
      expect(output).toContain('└'); // Corner
      expect(output).toContain('┤'); // Right junction
    });

    it('should display market symbol in save confirmation', async () => {
      // Act
      await confidenceCalibrate({
        market: 'ETH',
        days: 90,
      });

      // Assert: Market name in confirmation
      const output = mockConsoleLog.mock.calls.map(call => call[0]).join('\n');
      expect(output).toContain('✓ Market: ETH');
      expect(output).toContain('npm run dev -- trade:recommend -m ETH --calibrate');
    });
  });

  describe('edge cases', () => {
    it('should handle negative correlation', async () => {
      // Arrange: Mock calibration with negative correlation
      const negativeCorrelationData: CalibrationData = {
        ...mockCalibrationData,
        correlation: -0.175,
      };
      mockComputeCalibration.mockResolvedValue(negativeCorrelationData);

      // Act
      await confidenceCalibrate({
        market: 'BTC',
        days: 14,
      });

      // Assert: Negative correlation formatted correctly
      const output = mockConsoleLog.mock.calls.map(call => call[0]).join('\n');
      expect(output).toContain('-0.175');
      expect(output).toContain('weak negative');
    });

    it('should handle perfect correlation', async () => {
      // Arrange: Mock calibration with perfect correlation
      const perfectCorrelationData: CalibrationData = {
        ...mockCalibrationData,
        correlation: 1.0,
      };
      mockComputeCalibration.mockResolvedValue(perfectCorrelationData);

      // Act
      await confidenceCalibrate({
        market: 'BTC',
        days: 60,
      });

      // Assert: Perfect correlation formatted correctly
      const output = mockConsoleLog.mock.calls.map(call => call[0]).join('\n');
      expect(output).toContain('+1.000');
      expect(output).toContain('strong positive');
    });

    it('should handle very small sample size', async () => {
      // Arrange: Mock calibration with small sample
      const smallSampleData: CalibrationData = {
        ...mockCalibrationData,
        sampleSize: 12,
      };
      mockComputeCalibration.mockResolvedValue(smallSampleData);

      // Act
      await confidenceCalibrate({
        market: 'BTC',
        days: 60,
      });

      // Assert: Sample size displayed correctly
      const output = mockConsoleLog.mock.calls.map(call => call[0]).join('\n');
      expect(output).toContain('Sample Size: 12 recommendations');
    });

    it('should handle custom days parameter', async () => {
      // Act
      await confidenceCalibrate({
        market: 'BTC',
        days: 180,
      });

      // Assert: Custom window used
      expect(mockComputeCalibration).toHaveBeenCalledWith('BTC', 180);
      
      const output = mockConsoleLog.mock.calls.map(call => call[0]).join('\n');
      expect(output).toContain('Analysis Window: 180 days');
    });
  });

  describe('Discord notifications', () => {
    const previousCalibrationLow: CalibrationData = {
      ...mockCalibrationData,
      correlation: 0.15,
      highConfWinRate: 0.45,
      lowConfWinRate: 0.52,
      sampleSize: 100,
    };

    const newCalibrationHigh: CalibrationData = {
      ...mockCalibrationData,
      correlation: 0.40,
      highConfWinRate: 0.62,
      lowConfWinRate: 0.48,
      sampleSize: 142,
    };

    const previousCalibrationHigh: CalibrationData = {
      ...mockCalibrationData,
      correlation: 0.35,
      highConfWinRate: 0.58,
      lowConfWinRate: 0.50,
      sampleSize: 120,
    };

    const newCalibrationLow: CalibrationData = {
      ...mockCalibrationData,
      correlation: 0.15,
      highConfWinRate: 0.48,
      lowConfWinRate: 0.52,
      sampleSize: 142,
    };

    beforeEach(() => {
      // Reset Discord mocks
      mockCreateEmbedMessage.mockClear();
      mockCreateEmbedMessage.mockReturnValue({
        addTitle: vi.fn().mockReturnThis(),
        setColor: vi.fn().mockReturnThis(),
        addDescription: vi.fn().mockReturnThis(),
        addFields: vi.fn().mockReturnThis(),
        addTimestamp: vi.fn().mockReturnThis(),
      });
    });

    it('should send Discord notification on significant improvement', async () => {
      // Arrange: Previous correlation 0.15, new 0.40 (+0.25)
      mockGetLatestCalibration.mockResolvedValue(previousCalibrationLow);
      mockComputeCalibration.mockResolvedValue(newCalibrationHigh);

      // Act
      await confidenceCalibrate({
        market: 'BTC',
        days: 60,
        discord: true,
      });

      // Assert: Discord notification sent
      expect(mockSendMessage).toHaveBeenCalledTimes(1);
      expect(mockShutdown).toHaveBeenCalledTimes(1);

      // Assert: Improvement title used
      const embedBuilder = mockCreateEmbedMessage.mock.results[0].value;
      expect(embedBuilder.addTitle).toHaveBeenCalledWith('🎯 Confidence Calibration Improvement');
      expect(embedBuilder.setColor).toHaveBeenCalledWith(0x00ff00); // GREEN

      // Assert: Console log confirmation
      const output = mockConsoleLog.mock.calls.map(call => call[0]).join('\n');
      expect(output).toContain('✓ Discord notification sent: Improvement');
    });

    it('should send Discord notification on significant degradation', async () => {
      // Arrange: Previous correlation 0.35, new 0.15 (-0.20)
      mockGetLatestCalibration.mockResolvedValue(previousCalibrationHigh);
      mockComputeCalibration.mockResolvedValue(newCalibrationLow);

      // Act
      await confidenceCalibrate({
        market: 'BTC',
        days: 60,
        discord: true,
      });

      // Assert: Discord notification sent
      expect(mockSendMessage).toHaveBeenCalledTimes(1);
      expect(mockShutdown).toHaveBeenCalledTimes(1);

      // Assert: Degradation title used
      const embedBuilder = mockCreateEmbedMessage.mock.results[0].value;
      expect(embedBuilder.addTitle).toHaveBeenCalledWith('⚠️ Confidence Calibration Degradation');
      expect(embedBuilder.setColor).toHaveBeenCalledWith(0xff0000); // RED

      // Assert: Console log confirmation
      const output = mockConsoleLog.mock.calls.map(call => call[0]).join('\n');
      expect(output).toContain('✓ Discord notification sent: Degradation');
    });

    it('should not send notification for insignificant change', async () => {
      // Arrange: Previous correlation 0.234, new 0.284 (+0.05)
      const previousCalibration: CalibrationData = {
        ...mockCalibrationData,
        correlation: 0.234,
      };
      const newCalibration: CalibrationData = {
        ...mockCalibrationData,
        correlation: 0.284,
      };
      mockGetLatestCalibration.mockResolvedValue(previousCalibration);
      mockComputeCalibration.mockResolvedValue(newCalibration);

      // Act
      await confidenceCalibrate({
        market: 'BTC',
        days: 60,
        discord: true,
      });

      // Assert: No Discord notification sent
      expect(mockSendMessage).not.toHaveBeenCalled();
      expect(mockShutdown).not.toHaveBeenCalled();

      // Assert: No Discord log message
      const output = mockConsoleLog.mock.calls.map(call => call[0]).join('\n');
      expect(output).not.toContain('Discord notification sent');
    });

    it('should not send notification when discord flag is false', async () => {
      // Arrange: Significant improvement but discord flag not set
      mockGetLatestCalibration.mockResolvedValue(previousCalibrationLow);
      mockComputeCalibration.mockResolvedValue(newCalibrationHigh);

      // Act
      await confidenceCalibrate({
        market: 'BTC',
        days: 60,
        discord: false,
      });

      // Assert: No Discord calls made
      expect(mockSendMessage).not.toHaveBeenCalled();
      expect(mockShutdown).not.toHaveBeenCalled();
    });

    it('should not send notification on first calibration (no previous)', async () => {
      // Arrange: No previous calibration exists
      mockGetLatestCalibration.mockResolvedValue(null);
      mockComputeCalibration.mockResolvedValue(newCalibrationHigh);

      // Act
      await confidenceCalibrate({
        market: 'BTC',
        days: 60,
        discord: true,
      });

      // Assert: No Discord notification (can't compare)
      expect(mockSendMessage).not.toHaveBeenCalled();
      expect(mockShutdown).not.toHaveBeenCalled();
    });

    it('should handle Discord failure gracefully', async () => {
      // Arrange: Discord sendMessage fails
      mockGetLatestCalibration.mockResolvedValue(previousCalibrationLow);
      mockComputeCalibration.mockResolvedValue(newCalibrationHigh);
      mockSendMessage.mockRejectedValue(new Error('Discord API error'));

      // Act: Should not throw
      await confidenceCalibrate({
        market: 'BTC',
        days: 60,
        discord: true,
      });

      // Assert: Calibration still saved
      expect(mockSaveCalibration).toHaveBeenCalled();

      // Assert: Warning logged
      const warnOutput = mockConsoleWarn.mock.calls.map(call => call[0]).join('\n');
      expect(warnOutput).toContain('⚠️  Failed to send Discord notification:');

      // Assert: Shutdown still called
      expect(mockShutdown).toHaveBeenCalled();
    });

    it('should include all metrics in Discord embed', async () => {
      // Arrange
      mockGetLatestCalibration.mockResolvedValue(previousCalibrationLow);
      mockComputeCalibration.mockResolvedValue(newCalibrationHigh);

      // Act
      await confidenceCalibrate({
        market: 'BTC',
        days: 60,
        discord: true,
      });

      // Assert: Embed builder methods called with correct data
      const embedBuilder = mockCreateEmbedMessage.mock.results[0].value;
      expect(embedBuilder.addDescription).toHaveBeenCalledWith('Market: **BTC**');
      expect(embedBuilder.addFields).toHaveBeenCalled();

      // Check that fields include before/after metrics
      const fieldsCall = embedBuilder.addFields.mock.calls[0][0];
      expect(fieldsCall).toHaveLength(4); // Before, After, Change, Curve
      expect(fieldsCall[0].name).toBe('Before Metrics');
      expect(fieldsCall[1].name).toBe('After Metrics');
      expect(fieldsCall[2].name).toBe('Change Summary');
      expect(fieldsCall[3].name).toBe('Calibration Curve');

      // Check timestamp added
      expect(embedBuilder.addTimestamp).toHaveBeenCalled();
    });

    it('should respect improvement threshold of 0.2', async () => {
      // Arrange: Correlation change exactly 0.2 (threshold)
      const previous: CalibrationData = {
        ...mockCalibrationData,
        correlation: 0.20,
      };
      const current: CalibrationData = {
        ...mockCalibrationData,
        correlation: 0.40, // +0.20 exactly
      };
      mockGetLatestCalibration.mockResolvedValue(previous);
      mockComputeCalibration.mockResolvedValue(current);

      // Act
      await confidenceCalibrate({
        market: 'BTC',
        days: 60,
        discord: true,
      });

      // Assert: Notification sent (threshold met)
      expect(mockSendMessage).toHaveBeenCalledTimes(1);
    });

    it('should respect degradation threshold of -0.15', async () => {
      // Arrange: Correlation change exactly -0.15 (threshold)
      const previous: CalibrationData = {
        ...mockCalibrationData,
        correlation: 0.30,
      };
      const current: CalibrationData = {
        ...mockCalibrationData,
        correlation: 0.15, // 0.15 - 0.30 = -0.15 exactly
      };
      mockGetLatestCalibration.mockResolvedValue(previous);
      mockComputeCalibration.mockResolvedValue(current);

      // Act
      await confidenceCalibrate({
        market: 'BTC',
        days: 60,
        discord: true,
      });

      // Assert: Notification sent (threshold met)
      expect(mockSendMessage).toHaveBeenCalledTimes(1);
    });
  });
});

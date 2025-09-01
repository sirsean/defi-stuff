import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { chart } from '../../src/commands/chart.js';
import { ChartDataService } from '../../src/db/chartDataService.js';
import { ChartGenerator } from '../../src/utils/chartGenerator.js';
import { setupConsoleMocks, ConsoleMock } from '../utils/consoleMock.js';
import '../utils/setupTests.js';

// Mock the dependencies
vi.mock('../../src/db/chartDataService.js');
vi.mock('../../src/utils/chartGenerator.js');

describe('chart command', () => {
  let mockChartDataService: any;
  let mockChartGenerator: any;

  // Set up console mocks for each test
  setupConsoleMocks();

  beforeEach(() => {
    // Create mock instances
    mockChartDataService = {
      getChartData: vi.fn(),
      close: vi.fn()
    };

    mockChartGenerator = {
      generatePortfolioChart: vi.fn(),
      generateSimplifiedChart: vi.fn(),
      cleanupOldCharts: vi.fn()
    };

    // Mock the constructors
    (ChartDataService as any).mockImplementation(() => mockChartDataService);
    (ChartGenerator as any).mockImplementation(() => mockChartGenerator);

    // Set up environment variable
    process.env.WALLET_ADDRESS = '0x1234567890abcdef1234567890abcdef12345678';
  });

  afterEach(() => {
    vi.clearAllMocks();
    delete process.env.WALLET_ADDRESS;
  });

  it('should generate both chart types by default', async () => {
    // Mock successful chart data
    const mockChartData = {
      labels: ['Oct 1', 'Oct 2'],
      datasets: [
        {
          label: 'Total USD',
          data: [100000, 105000],
          borderColor: '#2563eb',
          backgroundColor: 'rgba(37, 99, 235, 0.1)',
          fill: false,
          tension: 0.1
        }
      ]
    };

    mockChartDataService.getChartData.mockResolvedValue(mockChartData);
    mockChartGenerator.generatePortfolioChart.mockResolvedValue('charts/portfolio-full-7d.png');
    mockChartGenerator.generateSimplifiedChart.mockResolvedValue('charts/portfolio-simple-7d.png');

    await chart('', {});

    expect(mockChartDataService.getChartData).toHaveBeenCalledWith('', 7);
    expect(mockChartGenerator.generatePortfolioChart).toHaveBeenCalled();
    expect(mockChartGenerator.generateSimplifiedChart).toHaveBeenCalled();
    expect(mockChartGenerator.cleanupOldCharts).toHaveBeenCalledWith(30);
    expect(mockChartDataService.close).toHaveBeenCalled();

    expect(ConsoleMock.log).toHaveBeenCalledWith('🎯 Generating portfolio charts...');
    expect(ConsoleMock.log).toHaveBeenCalledWith('✅ Found data for 1 metrics over 2 days');
    expect(ConsoleMock.log).toHaveBeenCalledWith('📈 Generating full portfolio chart...');
    expect(ConsoleMock.log).toHaveBeenCalledWith('📊 Generating simplified chart...');
    expect(ConsoleMock.log).toHaveBeenCalledWith('\n🎉 Chart generation complete!');
  });

  it('should generate only full chart when type is full', async () => {
    const mockChartData = {
      labels: ['Oct 1'],
      datasets: [
        {
          label: 'Total USD',
          data: [100000],
          borderColor: '#2563eb',
          backgroundColor: 'rgba(37, 99, 235, 0.1)',
          fill: false,
          tension: 0.1
        }
      ]
    };

    mockChartDataService.getChartData.mockResolvedValue(mockChartData);
    mockChartGenerator.generatePortfolioChart.mockResolvedValue('charts/portfolio-full-7d.png');

    await chart('', { type: 'full' });

    expect(mockChartGenerator.generatePortfolioChart).toHaveBeenCalled();
    expect(mockChartGenerator.generateSimplifiedChart).not.toHaveBeenCalled();

    expect(ConsoleMock.log).toHaveBeenCalledWith('📈 Generating full portfolio chart...');
    expect(ConsoleMock.log).not.toHaveBeenCalledWith('📊 Generating simplified chart...');
  });

  it('should generate only simplified chart when type is simple', async () => {
    const mockChartData = {
      labels: ['Oct 1'],
      datasets: [
        {
          label: 'Total USD',
          data: [100000],
          borderColor: '#2563eb',
          backgroundColor: 'rgba(37, 99, 235, 0.1)',
          fill: false,
          tension: 0.1
        }
      ]
    };

    mockChartDataService.getChartData.mockResolvedValue(mockChartData);
    mockChartGenerator.generateSimplifiedChart.mockResolvedValue('charts/portfolio-simple-7d.png');

    await chart('', { type: 'simple' });

    expect(mockChartGenerator.generateSimplifiedChart).toHaveBeenCalled();
    expect(mockChartGenerator.generatePortfolioChart).not.toHaveBeenCalled();

    expect(ConsoleMock.log).toHaveBeenCalledWith('📊 Generating simplified chart...');
    expect(ConsoleMock.log).not.toHaveBeenCalledWith('📈 Generating full portfolio chart...');
  });

  it('should use custom days parameter', async () => {
    const mockChartData = {
      labels: [],
      datasets: []
    };

    mockChartDataService.getChartData.mockResolvedValue(mockChartData);

    await chart('0xtest', { days: 14 });

    expect(mockChartDataService.getChartData).toHaveBeenCalledWith('0xtest', 14);
    expect(ConsoleMock.log).toHaveBeenCalledWith('📊 Fetching 14 days of data for 0xtest...');
  });

  it('should use custom wallet address', async () => {
    const mockChartData = {
      labels: [],
      datasets: []
    };

    mockChartDataService.getChartData.mockResolvedValue(mockChartData);

    await chart('', { address: '0xcustom' });

    expect(mockChartDataService.getChartData).toHaveBeenCalledWith('0xcustom', 7);
  });

  it('should handle no data gracefully', async () => {
    const mockChartData = {
      labels: [],
      datasets: []
    };

    mockChartDataService.getChartData.mockResolvedValue(mockChartData);

    await chart('', {});

    expect(ConsoleMock.log).toHaveBeenCalledWith('⚠️  No data found for the specified period.');
    expect(ConsoleMock.log).toHaveBeenCalledWith('💡 Make sure you have run the daily command with --db flag to save historical data.');
    expect(mockChartGenerator.generatePortfolioChart).not.toHaveBeenCalled();
    expect(mockChartGenerator.generateSimplifiedChart).not.toHaveBeenCalled();
  });

  it('should handle errors and provide helpful messages', async () => {
    const mockError = new Error('WALLET_ADDRESS not found');
    mockChartDataService.getChartData.mockRejectedValue(mockError);

    // Mock process.exit to prevent actual exit
    const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);

    await chart('', {});

    expect(ConsoleMock.error).toHaveBeenCalledWith('❌ Error generating charts:', 'WALLET_ADDRESS not found');
    expect(ConsoleMock.log).toHaveBeenCalledWith('💡 Tip: Set WALLET_ADDRESS in your .env file or use the -a option to specify an address');
    expect(mockExit).toHaveBeenCalledWith(1);

    mockExit.mockRestore();
  });

  it('should provide helpful error message for connection errors', async () => {
    const mockError = new Error('Database connection failed');
    mockChartDataService.getChartData.mockRejectedValue(mockError);

    const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);

    await chart('', {});

    expect(ConsoleMock.error).toHaveBeenCalledWith('❌ Error generating charts:', 'Database connection failed');
    expect(ConsoleMock.log).toHaveBeenCalledWith('💡 Tip: Make sure your database is set up and migrations have been run');
    expect(ConsoleMock.log).toHaveBeenCalledWith('   Run: npm run db:migrate');
    expect(mockExit).toHaveBeenCalledWith(1);

    mockExit.mockRestore();
  });

  it('should provide helpful error message for canvas errors', async () => {
    const mockError = new Error('canvas');
    mockChartDataService.getChartData.mockRejectedValue(mockError);

    const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);

    await chart('', {});

    expect(ConsoleMock.error).toHaveBeenCalledWith('❌ Error generating charts:', 'canvas');
    expect(ConsoleMock.log).toHaveBeenCalledWith('💡 Tip: Make sure chartjs-node-canvas is properly installed');
    expect(ConsoleMock.log).toHaveBeenCalledWith('   Run: npm install chartjs-node-canvas chart.js');
    expect(mockExit).toHaveBeenCalledWith(1);

    mockExit.mockRestore();
  });

  it('should display data summary when charts are generated', async () => {
    const mockChartData = {
      labels: ['Oct 1', 'Oct 2'],
      datasets: [
        {
          label: 'Total USD',
          data: [100000, 105000],
          borderColor: '#2563eb',
          backgroundColor: 'rgba(37, 99, 235, 0.1)',
          fill: false,
          tension: 0.1
        },
        {
          label: 'Auto USD',
          data: [25000, 30000],
          borderColor: '#16a34a',
          backgroundColor: 'rgba(22, 163, 74, 0.1)',
          fill: false,
          tension: 0.1
        }
      ]
    };

    mockChartDataService.getChartData.mockResolvedValue(mockChartData);
    mockChartGenerator.generatePortfolioChart.mockResolvedValue('charts/portfolio-full-7d.png');
    mockChartGenerator.generateSimplifiedChart.mockResolvedValue('charts/portfolio-simple-7d.png');

    await chart('', {});

    expect(ConsoleMock.log).toHaveBeenCalledWith('\n📊 Data Summary:');
    expect(ConsoleMock.log).toHaveBeenCalledWith('   • Total USD: 100000.00 - 105000.00');
    expect(ConsoleMock.log).toHaveBeenCalledWith('   • Auto USD: 25000.00 - 30000.00');
  });
});

import { BalanceRecordService, BalanceType } from './balanceRecordService.js';

/**
 * Interface for chart data points
 */
export interface ChartDataPoint {
  date: string;
  totalUsd: number;
  autoUsd: number;
  autoEth: number;
  dineroEth: number;
  flp: number;
  baseUsd: number;
  flexRewards: number;
  tokemakRewards: number;
  baseTokemakRewards: number;
}

/**
 * Interface for formatted chart data ready for chart.js
 */
export interface ChartData {
  labels: string[];
  datasets: Array<{
    label: string;
    data: number[];
    borderColor: string;
    backgroundColor: string;
    fill: boolean;
    tension: number;
    yAxisID?: string;
  }>;
}

/**
 * Service for querying and formatting historical balance data for charts
 */
export class ChartDataService {
  private balanceRecordService: BalanceRecordService;

  constructor(environment: string = 'development') {
    this.balanceRecordService = new BalanceRecordService(environment);
  }

  /**
   * Get chart data for a wallet over the past N days
   * @param walletAddress The wallet address to get data for
   * @param days Number of days to look back (default: 7)
   * @returns Chart data ready for visualization
   */
  async getChartData(walletAddress?: string, days: number = 7): Promise<ChartData> {
    // Use environment variable if no address provided
    if (!walletAddress) {
      walletAddress = process.env.WALLET_ADDRESS;
      if (!walletAddress) {
        throw new Error('No wallet address provided and WALLET_ADDRESS environment variable is not set');
      }
    }

    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - days + 1); // Include today as day 1

    const endDateStr = endDate.toISOString().split('T')[0];
    const startDateStr = startDate.toISOString().split('T')[0];

    // Get all balance records in the date range
    const records = await this.balanceRecordService.getBalanceRecordsByDateRange(
      walletAddress,
      startDateStr,
      endDateStr
    );

    // Group records by date and organize by balance type
    const dataByDate = this.groupRecordsByDate(records);
    
    // Determine dates to use for charting
    let dates: string[] = [];

    if (records.length > 0) {
      // Use the unique dates present in the records (sorted ascending)
      const uniqueDates = Array.from(new Set(Object.keys(dataByDate))).sort();
      // Limit to the requested number of days (take the last N to show most recent first)
      const limited = uniqueDates.slice(-days);
      dates = limited;
    } else {
      // Fallback: generate array of dates for the past N days based on the requested range
      for (let i = 0; i < days; i++) {
        const date = new Date(startDate);
        date.setDate(startDate.getDate() + i);
        dates.push(date.toISOString().split('T')[0]);
      }
    }

    // Create data points for each selected date
    const dataPoints = dates.map(date => this.createDataPointForDate(date, dataByDate[date] || []));

    // Format for chart.js
    return this.formatForChartJs(dataPoints);
  }

  /**
   * Group balance records by date
   * @param records Array of balance records
   * @returns Records grouped by date
   */
  private groupRecordsByDate(records: any[]): Record<string, any[]> {
    const grouped: Record<string, any[]> = {};
    
    for (const record of records) {
      if (!grouped[record.date]) {
        grouped[record.date] = [];
      }
      grouped[record.date].push(record);
    }

    return grouped;
  }

  /**
   * Create a data point for a specific date
   * @param date The date string
   * @param records The balance records for that date
   * @returns Chart data point
   */
  private createDataPointForDate(date: string, records: any[]): ChartDataPoint {
    const dataPoint: ChartDataPoint = {
      date,
      totalUsd: 0,
      autoUsd: 0,
      autoEth: 0,
      dineroEth: 0,
      flp: 0,
      baseUsd: 0,
      flexRewards: 0,
      tokemakRewards: 0,
      baseTokemakRewards: 0,
    };

    // Process each record and aggregate by balance type
    for (const record of records) {
      const amount = parseFloat(record.amount.toString());
      
      switch (record.balance_type) {
        case BalanceType.TOTAL:
          if (record.currency === 'USD') {
            dataPoint.totalUsd = amount;
          }
          break;
        case BalanceType.AUTO_USD:
          if (record.currency === 'USD') {
            dataPoint.autoUsd = amount;
          }
          break;
        case BalanceType.AUTO_ETH:
          if (record.currency === 'ETH') {
            dataPoint.autoEth = amount;
          }
          break;
        case BalanceType.DINERO_ETH:
          if (record.currency === 'ETH') {
            dataPoint.dineroEth = amount;
          }
          break;
        case BalanceType.FLP:
          if (record.currency === 'USD') {
            dataPoint.flp = amount;
          }
          break;
        case BalanceType.BASE_USD:
          if (record.currency === 'USD') {
            dataPoint.baseUsd = amount;
          }
          break;
        case BalanceType.FLEX_REWARDS:
          if (record.currency === 'USD') {
            dataPoint.flexRewards = amount;
          }
          break;
        case BalanceType.TOKEMAK_REWARDS:
          if (record.currency === 'USD') {
            dataPoint.tokemakRewards = amount;
          }
          break;
        case BalanceType.BASE_TOKEMAK_REWARDS:
          if (record.currency === 'USD') {
            dataPoint.baseTokemakRewards = amount;
          }
          break;
      }
    }

    return dataPoint;
  }

  /**
   * Format data points for chart.js
   * @param dataPoints Array of chart data points
   * @returns Chart.js formatted data
   */
  private formatForChartJs(dataPoints: ChartDataPoint[]): ChartData {
    const labels = dataPoints.map(point => {
      // Fix timezone issue by explicitly setting time to local midnight
      const date = new Date(point.date + 'T00:00:00');
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    });

    const datasets = [
      {
        label: 'Total USD',
        data: dataPoints.map(p => p.totalUsd),
        borderColor: '#2563eb', // Blue
        backgroundColor: 'rgba(37, 99, 235, 0.1)',
        fill: false,
        tension: 0.1,
        yAxisID: 'usd',
      },
      {
        label: 'Auto USD',
        data: dataPoints.map(p => p.autoUsd),
        borderColor: '#16a34a', // Green
        backgroundColor: 'rgba(22, 163, 74, 0.1)',
        fill: false,
        tension: 0.1,
        yAxisID: 'usd',
      },
      {
        label: 'Auto ETH',
        data: dataPoints.map(p => p.autoEth),
        borderColor: '#dc2626', // Red
        backgroundColor: 'rgba(220, 38, 38, 0.1)',
        fill: false,
        tension: 0.1,
        yAxisID: 'eth',
      },
      {
        label: 'Dinero ETH',
        data: dataPoints.map(p => p.dineroEth),
        borderColor: '#ea580c', // Orange
        backgroundColor: 'rgba(234, 88, 12, 0.1)',
        fill: false,
        tension: 0.1,
        yAxisID: 'eth',
      },
      {
        label: 'FLP USD',
        data: dataPoints.map(p => p.flp),
        borderColor: '#7c2d12', // Brown
        backgroundColor: 'rgba(124, 45, 18, 0.1)',
        fill: false,
        tension: 0.1,
        yAxisID: 'usd',
      },
      {
        label: 'Base USD',
        data: dataPoints.map(p => p.baseUsd),
        borderColor: '#1e40af', // Dark Blue
        backgroundColor: 'rgba(30, 64, 175, 0.1)',
        fill: false,
        tension: 0.1,
        yAxisID: 'usd',
      },
      {
        label: 'Total Rewards',
        data: dataPoints.map(p => p.flexRewards + p.tokemakRewards + p.baseTokemakRewards),
        borderColor: '#7c3aed', // Purple
        backgroundColor: 'rgba(124, 58, 237, 0.1)',
        fill: false,
        tension: 0.1,
        yAxisID: 'usd',
      },
    ];

    // Filter out datasets with no data (all zeros)
    const filteredDatasets = datasets.filter(dataset => 
      dataset.data.some(value => value > 0)
    );

    return {
      labels,
      datasets: filteredDatasets,
    };
  }

  /**
   * Close the database connection
   */
  async close(): Promise<void> {
    await this.balanceRecordService.close();
  }
}

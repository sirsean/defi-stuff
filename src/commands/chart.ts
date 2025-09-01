import { ChartDataService } from '../db/chartDataService.js';
import { ChartGenerator } from '../utils/chartGenerator.js';

interface ChartCommandOptions {
  address?: string;
  days?: number;
  type?: 'full' | 'simple' | 'both';
  output?: string;
}

/**
 * Command to generate portfolio performance charts
 * @param walletAddressParam Optional wallet address to query (overrides the one from .env if provided)
 * @param options Command options
 */
export async function chart(
  walletAddressParam: string,
  options: ChartCommandOptions = {}
): Promise<void> {
  try {
    console.log('🎯 Generating portfolio charts...');

    // Set up services
    const chartDataService = new ChartDataService();
    const chartGenerator = new ChartGenerator(800, 400, options.output || 'charts');

    // Determine which wallet address to use
    const walletAddress = options.address || walletAddressParam;
    
    // Determine number of days (default: 7)
    const days = options.days || 7;
    
    // Determine chart type (default: both)
    const chartType = options.type || 'both';

    console.log(`📊 Fetching ${days} days of data${walletAddress ? ` for ${walletAddress}` : ''}...`);

    // Get chart data
    const chartData = await chartDataService.getChartData(walletAddress, days);

    // Check if we have any data
    if (chartData.datasets.length === 0) {
      console.log('⚠️  No data found for the specified period.');
      console.log('💡 Make sure you have run the daily command with --db flag to save historical data.');
      return;
    }

    console.log(`✅ Found data for ${chartData.datasets.length} metrics over ${chartData.labels.length} days`);

    // Generate charts based on type
    let generatedFiles: string[] = [];

    if (chartType === 'full' || chartType === 'both') {
      console.log('📈 Generating full portfolio chart...');
      const fullChart = await chartGenerator.generatePortfolioChart(
        chartData,
        `Portfolio Performance - ${days} Days`,
        `portfolio-full-${days}d`
      );
      generatedFiles.push(fullChart);
      console.log(`✅ Full chart saved: ${fullChart}`);
    }

    if (chartType === 'simple' || chartType === 'both') {
      console.log('📊 Generating simplified chart...');
      const simpleChart = await chartGenerator.generateSimplifiedChart(
        chartData,
        `Key Portfolio Metrics - ${days} Days`,
        `portfolio-simple-${days}d`
      );
      generatedFiles.push(simpleChart);
      console.log(`✅ Simplified chart saved: ${simpleChart}`);
    }

    // Clean up old charts
    await chartGenerator.cleanupOldCharts(30);

    // Summary
    console.log('\n🎉 Chart generation complete!');
    console.log(`📁 Charts saved to: ${options.output || 'charts'}/`);
    generatedFiles.forEach(file => {
      console.log(`   • ${file}`);
    });
    
    if (chartData.datasets.length > 0) {
      console.log('\n📊 Data Summary:');
      chartData.datasets.forEach(dataset => {
        const maxValue = Math.max(...dataset.data);
        const minValue = Math.min(...dataset.data);
        if (maxValue > 0) {
          console.log(`   • ${dataset.label}: ${minValue.toFixed(2)} - ${maxValue.toFixed(2)}`);
        }
      });
    }

    // Close database connection
    await chartDataService.close();

  } catch (error) {
    if (error instanceof Error) {
      console.error('❌ Error generating charts:', error.message);
      
      // Provide helpful error messages for common issues
      if (error.message.includes('WALLET_ADDRESS')) {
        console.log('💡 Tip: Set WALLET_ADDRESS in your .env file or use the -a option to specify an address');
      } else if (error.message.includes('connection')) {
        console.log('💡 Tip: Make sure your database is set up and migrations have been run');
        console.log('   Run: npm run db:migrate');
      } else if (error.message.includes('canvas')) {
        console.log('💡 Tip: Make sure chartjs-node-canvas is properly installed');
        console.log('   Run: npm install chartjs-node-canvas chart.js');
      }
      
      console.error(error);
    } else {
      console.error('❌ Unexpected error:', error);
    }
    process.exit(1);
  }
}

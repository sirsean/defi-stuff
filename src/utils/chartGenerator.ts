import { ChartJSNodeCanvas } from 'chartjs-node-canvas';
import { ChartConfiguration } from 'chart.js';
import { ChartData } from '../db/chartDataService.js';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';

/**
 * Service for generating chart images from data
 */
export class ChartGenerator {
  private chartJSNodeCanvas: ChartJSNodeCanvas;
  private outputDir: string;

  constructor(width: number = 1200, height: number = 800, outputDir: string = 'charts') {
    this.chartJSNodeCanvas = new ChartJSNodeCanvas({ 
      width, 
      height,
      backgroundColour: 'white'
    });
    this.outputDir = outputDir;
  }

  /**
   * Generate a portfolio chart and save it as a PNG file
   * @param chartData The data to chart
   * @param title The chart title
   * @param filename The filename for the output PNG (without extension)
   * @returns The path to the generated chart file
   */
  async generatePortfolioChart(
    chartData: ChartData, 
    title: string = 'Portfolio Performance',
    filename: string = 'portfolio-chart'
  ): Promise<string> {
    // Ensure output directory exists
    await this.ensureOutputDir();

    // Create Chart.js configuration
    const configuration: ChartConfiguration = {
      type: 'line',
      data: chartData,
      options: {
        responsive: false,
        plugins: {
          title: {
            display: true,
            text: title,
            font: {
              size: 16,
              weight: 'bold'
            },
            padding: {
              bottom: 20
            }
          },
          legend: {
            display: true,
            position: 'top',
            align: 'center',
            labels: {
              usePointStyle: true,
              padding: 15,
              font: {
                size: 11
              }
            }
          }
        },
        scales: {
          x: {
            display: true,
            title: {
              display: true,
              text: 'Date',
              font: {
                size: 12,
                weight: 'bold'
              }
            },
            grid: {
              display: true,
              color: 'rgba(0, 0, 0, 0.1)'
            }
          },
          usd: {
            type: 'linear',
            display: true,
            position: 'left',
            title: {
              display: true,
              text: 'USD Value',
              font: {
                size: 12,
                weight: 'bold'
              },
              color: '#2563eb'
            },
            grid: {
              display: true,
              color: 'rgba(0, 0, 0, 0.1)'
            },
            ticks: {
              color: '#2563eb',
              callback: function(value: any) {
                // Format USD numbers with appropriate units
                const num = parseFloat(value.toString());
                if (num >= 1000000) {
                  return '$' + (num / 1000000).toFixed(1) + 'M';
                } else if (num >= 1000) {
                  return '$' + (num / 1000).toFixed(1) + 'K';
                } else if (num >= 1) {
                  return '$' + num.toFixed(0);
                } else {
                  return '$' + num.toFixed(2);
                }
              }
            }
          },
          eth: {
            type: 'linear',
            display: true,
            position: 'right',
            title: {
              display: true,
              text: 'ETH Value',
              font: {
                size: 12,
                weight: 'bold'
              },
              color: '#dc2626'
            },
            grid: {
              display: false, // Don't show grid for right axis to avoid conflict
            },
            ticks: {
              color: '#dc2626',
              callback: function(value: any) {
                // Format ETH numbers with appropriate precision
                const num = parseFloat(value.toString());
                if (num >= 1) {
                  return num.toFixed(2) + ' ETH';
                } else {
                  return num.toFixed(4) + ' ETH';
                }
              }
            }
          }
        },
        elements: {
          line: {
            borderWidth: 2
          },
          point: {
            radius: 4,
            hoverRadius: 6
          }
        },
        interaction: {
          intersect: false,
          mode: 'index'
        }
      },
    };

    // Generate the chart as a buffer
    const imageBuffer = await this.chartJSNodeCanvas.renderToBuffer(configuration);

    // Create the output file path
    const outputPath = path.join(this.outputDir, `${filename}.png`);

    // Write the image buffer to file
    await writeFile(outputPath, imageBuffer);

    return outputPath;
  }

  /**
   * Generate a simplified chart with only the most important metrics
   * @param chartData The data to chart
   * @param title The chart title
   * @param filename The filename for the output PNG (without extension)
   * @returns The path to the generated chart file
   */
  async generateSimplifiedChart(
    chartData: ChartData,
    title: string = 'Key Portfolio Metrics',
    filename: string = 'portfolio-simple'
  ): Promise<string> {
    return this.generateMultiPanelChart(chartData, title, filename);
  }

  /**
   * Generate a multi-panel chart with separate panels for different metric groups
   * @param chartData The data to chart
   * @param title The chart title
   * @param filename The filename for the output PNG (without extension)
   * @returns The path to the generated chart file
   */
  async generateMultiPanelChart(
    chartData: ChartData,
    title: string = 'Portfolio Performance',
    filename: string = 'portfolio-multi'
  ): Promise<string> {
    // Import canvas for composite image creation
    const { createCanvas, loadImage } = await import('canvas');
    
    // Ensure output directory exists
    await this.ensureOutputDir();

    // Define panel dimensions
    const panelWidth = 580;
    const panelHeight = 350;
    const padding = 20;
    
    // Create main canvas (2x2 grid) - no title space needed
    const canvasWidth = (panelWidth * 2) + (padding * 3);
    const canvasHeight = (panelHeight * 2) + (padding * 3);
    const canvas = createCanvas(canvasWidth, canvasHeight);
    const ctx = canvas.getContext('2d');
    
    // Fill background
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    
    // Create individual chart panels
    const panels = await this.createChartPanels(chartData, panelWidth, panelHeight);
    
    // Position each panel on the canvas
    const positions = [
      { x: padding, y: padding }, // Top left
      { x: panelWidth + (padding * 2), y: padding }, // Top right
      { x: padding, y: panelHeight + (padding * 2) }, // Bottom left
      { x: panelWidth + (padding * 2), y: panelHeight + (padding * 2) } // Bottom right
    ];
    
    for (let i = 0; i < panels.length && i < positions.length; i++) {
      const panelImage = await loadImage(panels[i].buffer);
      ctx.drawImage(panelImage, positions[i].x, positions[i].y);
    }
    
    // Save composite image
    const outputPath = path.join(this.outputDir, `${filename}.png`);
    const buffer = canvas.toBuffer('image/png');
    await writeFile(outputPath, buffer);
    
    return outputPath;
  }
  
  /**
   * Create individual chart panels for different metric groups
   * @param chartData The complete chart data
   * @param panelWidth Width of each panel
   * @param panelHeight Height of each panel
   * @returns Array of chart buffers
   */
  private async createChartPanels(
    chartData: ChartData, 
    panelWidth: number, 
    panelHeight: number
  ): Promise<Array<{ buffer: Buffer; title: string }>> {
    // Create smaller chart generators for panels
    const panelGenerator = new ChartJSNodeCanvas({
      width: panelWidth,
      height: panelHeight,
      backgroundColour: 'white'
    });
    
    const panels = [];
    
    // Panel 1: Total USD value only
    const totalUsdDataset = chartData.datasets.find(d => d.label === 'Total USD');
    if (totalUsdDataset) {
      const panel1Config: ChartConfiguration = {
        type: 'line',
        data: {
          labels: chartData.labels,
          datasets: [{ ...totalUsdDataset, yAxisID: undefined }]
        },
        options: this.createPanelOptions('Portfolio', '#2563eb', 'USD')
      };
      const buffer1 = await panelGenerator.renderToBuffer(panel1Config);
      panels.push({ buffer: buffer1, title: 'Portfolio' });
    }
    
    // Panel 2: Total ETH value (Auto ETH + Dinero ETH combined)
    const autoEthDataset = chartData.datasets.find(d => d.label === 'Auto ETH');
    const dineroEthDataset = chartData.datasets.find(d => d.label === 'Dinero ETH');
    if (autoEthDataset && dineroEthDataset) {
      // Create combined ETH dataset
      const combinedEthData = autoEthDataset.data.map((autoValue, index) => 
        autoValue + dineroEthDataset.data[index]
      );
      
      const combinedEthDataset = {
        label: 'Total ETH',
        data: combinedEthData,
        borderColor: '#dc2626',
        backgroundColor: 'rgba(220, 38, 38, 0.1)',
        fill: false,
        tension: 0.1
      };
      
      const panel2Config: ChartConfiguration = {
        type: 'line',
        data: {
          labels: chartData.labels,
          datasets: [combinedEthDataset]
        },
        options: this.createPanelOptions('Tokemak: ETH', '#dc2626', 'ETH')
      };
      const buffer2 = await panelGenerator.renderToBuffer(panel2Config);
      panels.push({ buffer: buffer2, title: 'Tokemak: ETH' });
    }
    
    // Panel 3: FLP USD only
    const flpDataset = chartData.datasets.find(d => d.label === 'FLP USD');
    if (flpDataset) {
      const panel3Config: ChartConfiguration = {
        type: 'line',
        data: {
          labels: chartData.labels,
          datasets: [{ ...flpDataset, yAxisID: undefined }]
        },
        options: this.createPanelOptions('Flex FLP', '#7c2d12', 'USD')
      };
      const buffer3 = await panelGenerator.renderToBuffer(panel3Config);
      panels.push({ buffer: buffer3, title: 'Flex FLP' });
    }
    
    // Panel 4: Auto USD + Base USD combined
    const autoUsdDataset = chartData.datasets.find(d => d.label === 'Auto USD');
    const baseUsdDataset = chartData.datasets.find(d => d.label === 'Base USD');
    if (autoUsdDataset && baseUsdDataset) {
      // Create combined Auto + Base USD dataset
      const combinedUsdData = autoUsdDataset.data.map((autoValue, index) => 
        autoValue + baseUsdDataset.data[index]
      );
      
      const combinedUsdDataset = {
        label: 'Auto + Base USD',
        data: combinedUsdData,
        borderColor: '#16a34a',
        backgroundColor: 'rgba(22, 163, 74, 0.1)',
        fill: false,
        tension: 0.1
      };
      
      const panel4Config: ChartConfiguration = {
        type: 'line',
        data: {
          labels: chartData.labels,
          datasets: [combinedUsdDataset]
        },
        options: this.createPanelOptions('Tokemak: USD', '#16a34a', 'USD')
      };
      const buffer4 = await panelGenerator.renderToBuffer(panel4Config);
      panels.push({ buffer: buffer4, title: 'Tokemak: USD' });
    }
    
    return panels;
  }
  
  /**
   * Create panel-specific chart options
   * @param title Panel title
   * @param color Primary color for the panel
   * @param unit Unit for formatting (USD or ETH)
   * @returns Chart options configuration
   */
  private createPanelOptions(title: string, color: string, unit: 'USD' | 'ETH'): any {
    return {
      responsive: false,
      plugins: {
        title: {
          display: true,
          text: title,
          font: {
            size: 14,
            weight: 'bold'
          },
          color: color,
          padding: {
            bottom: 15
          }
        },
        legend: {
          display: false
        }
      },
      scales: {
        x: {
          display: true,
          grid: {
            display: true,
            color: 'rgba(0, 0, 0, 0.1)'
          },
          ticks: {
            font: {
              size: 10
            }
          }
        },
        y: {
          display: true,
          title: {
            display: false
          },
          grid: {
            display: true,
            color: 'rgba(0, 0, 0, 0.1)'
          },
          ticks: {
            color: color,
            font: {
              size: 10
            },
            callback: function(value: any) {
              const num = parseFloat(value.toString());
              if (unit === 'USD') {
                if (num >= 1000000) {
                  return '$' + (num / 1000000).toFixed(1) + 'M';
                } else if (num >= 1000) {
                  return '$' + (num / 1000).toFixed(1) + 'K';
                } else if (num >= 1) {
                  return '$' + num.toFixed(0);
                } else {
                  return '$' + num.toFixed(2);
                }
              } else {
                if (num >= 1) {
                  return num.toFixed(2) + ' ETH';
                } else {
                  return num.toFixed(4) + ' ETH';
                }
              }
            }
          }
        }
      },
      elements: {
        line: {
          borderWidth: 2
        },
        point: {
          radius: 3,
          hoverRadius: 4
        }
      },
      interaction: {
        intersect: false,
        mode: 'index'
      }
    };
  }

  /**
   * Generate multiple chart variations
   * @param chartData The data to chart
   * @param baseFilename Base filename for the charts
   * @returns Object with paths to generated charts
   */
  async generateChartSet(
    chartData: ChartData,
    baseFilename: string = 'portfolio'
  ): Promise<{
    full: string;
    simplified: string;
  }> {
    const timestamp = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    
    const [fullChart, simplifiedChart] = await Promise.all([
      this.generatePortfolioChart(
        chartData, 
        `Portfolio Performance - ${timestamp}`, 
        `${baseFilename}-full-${timestamp}`
      ),
      this.generateSimplifiedChart(
        chartData,
        `Key Portfolio Metrics - ${timestamp}`,
        `${baseFilename}-simple-${timestamp}`
      )
    ]);

    return {
      full: fullChart,
      simplified: simplifiedChart
    };
  }

  /**
   * Ensure the output directory exists
   */
  private async ensureOutputDir(): Promise<void> {
    try {
      await mkdir(this.outputDir, { recursive: true });
    } catch (error: any) {
      if (error.code !== 'EEXIST') {
        throw error;
      }
    }
  }

  /**
   * Get the absolute path for a chart file
   * @param filename The filename (with or without extension)
   * @returns Absolute path to the file
   */
  getChartPath(filename: string): string {
    if (!filename.endsWith('.png')) {
      filename += '.png';
    }
    return path.resolve(this.outputDir, filename);
  }

  /**
   * Clean up old chart files
   * @param daysToKeep Number of days worth of charts to keep (default: 30)
   */
  async cleanupOldCharts(daysToKeep: number = 30): Promise<void> {
    try {
      const fs = await import('fs/promises');
      const files = await fs.readdir(this.outputDir);
      
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
      
      for (const file of files) {
        if (file.endsWith('.png')) {
          const filePath = path.join(this.outputDir, file);
          const stats = await fs.stat(filePath);
          
          if (stats.mtime < cutoffDate) {
            await fs.unlink(filePath);
            console.log(`Cleaned up old chart: ${file}`);
          }
        }
      }
    } catch (error) {
      console.warn('Error cleaning up old charts:', error);
    }
  }
}

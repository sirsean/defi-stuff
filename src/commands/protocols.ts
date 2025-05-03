import { ProtocolService } from '../api/debank/protocolService.js';
import { ProtocolSearchOptions } from '../types/debank.js';

interface ProtocolCommandOptions {
  search?: string;
}

/**
 * Command to search for protocols on a specific blockchain
 * @param chain The blockchain to search on (e.g., 'eth', 'bsc', 'arbitrum')
 * @param options Command options
 */
export async function protocols(chain: string, options: ProtocolCommandOptions): Promise<void> {
  try {
    if (!chain) {
      console.error('Chain parameter is required');
      process.exit(1);
      return; // This ensures the function returns early in tests
    }

    console.log(`Searching for protocols on ${chain}...`);
    
    const protocolService = new ProtocolService();
    const searchOptions: ProtocolSearchOptions = {
      chain,
      searchTerm: options.search
    };
    
    const protocols = await protocolService.searchProtocols(searchOptions);
    
    if (protocols.length === 0) {
      console.log('No protocols found matching your criteria');
      return;
    }
    
    console.log(`Found ${protocols.length} protocols:`);
    
    // Format and display the results
    protocols.forEach(protocol => {
      console.log(`\n${protocol.name} (${protocol.id})`);
      console.log(`Chain: ${protocol.chain}`);
      console.log(`TVL: $${protocol.tvl.toLocaleString()}`);
      console.log(`Website: ${protocol.site_url}`);
      console.log(`Has Portfolio Support: ${protocol.has_supported_portfolio ? 'Yes' : 'No'}`);
    });
    
  } catch (error) {
    console.error('Error searching protocols:', error);
    process.exit(1);
  }
}
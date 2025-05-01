import Fuse from 'fuse.js';
import { DebankClient } from './debankClient.js';
import { DebankProtocol, ProtocolSearchOptions } from '../../types/debank.js';

/**
 * Service for working with Debank protocols
 */
export class ProtocolService {
  private debankClient: DebankClient;

  constructor() {
    this.debankClient = new DebankClient();
  }

  /**
   * Get all protocols for a specific chain
   * @param chain The blockchain to query
   * @returns List of protocols on the specified chain
   */
  async getProtocols(chain: string): Promise<DebankProtocol[]> {
    return this.debankClient.getProtocolList(chain);
  }

  /**
   * Search for protocols by name or ID
   * @param options Search options containing chain and optional search term
   * @returns Filtered and sorted list of protocols
   */
  async searchProtocols(options: ProtocolSearchOptions): Promise<DebankProtocol[]> {
    const { chain, searchTerm } = options;
    
    // Get all protocols for the specified chain
    const protocols = await this.getProtocols(chain);
    
    // If no search term is provided, return all protocols
    if (!searchTerm) {
      return protocols;
    }
    
    // Configure Fuse for fuzzy searching
    const fuse = new Fuse(protocols, {
      keys: ['id', 'name'],
      includeScore: true,
      threshold: 0.4 // Lower threshold = stricter matching
    });
    
    // Perform the fuzzy search
    const searchResults = fuse.search(searchTerm);
    
    // Return the matched items
    return searchResults.map(result => result.item);
  }
}
import { KnexConnector } from './knexConnector.js';

/**
 * Utility function to close database connections
 * This ensures we don't leave hanging connections that can cause the process to hang
 */
export async function closeAllConnections(): Promise<void> {
  try {
    await KnexConnector.destroy();
    console.debug('Database connections closed successfully');
  } catch (error) {
    console.error('Error closing database connections:', error);
  }
}
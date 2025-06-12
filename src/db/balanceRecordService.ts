import { Knex } from 'knex';
import { KnexConnector } from './knexConnector.js';

/**
 * Interface for balance record data
 */
export interface BalanceRecord {
  id?: number;
  timestamp?: Date;
  date: string; // YYYY-MM-DD format
  wallet_address: string;
  balance_type: string;
  currency: string;
  amount: number;
  metadata?: Record<string, any>;
}

/**
 * Valid balance types for the balance_records table
 */
export enum BalanceType {
  TOTAL = 'total',
  AUTO_USD = 'autoUSD',
  AUTO_ETH = 'autoETH',
  DINERO_ETH = 'dineroETH',
  FLP = 'FLP',
  BASE_USD = 'baseUSD',
  FLEX_REWARDS = 'flex_rewards',
  TOKEMAK_REWARDS = 'tokemak_rewards',
  BASE_TOKEMAK_REWARDS = 'base_tokemak_rewards'
}

/**
 * Service for managing balance records in the database
 */
export class BalanceRecordService {
  private db!: Knex; // Using the ! non-null assertion operator since we initialize it in initDatabase
  private tableName = 'balance_records';

  /**
   * Create an instance of the BalanceRecordService
   * @param environment The database environment to use
   */
  constructor(environment: string = 'development') {
    this.initDatabase(environment);
  }

  /**
   * Initialize the database connection
   * @param environment The database environment to use
   */
  public async initDatabase(environment: string): Promise<void> {
    this.db = await KnexConnector.getConnection(environment);
  }
  
  /**
   * Close the database connection
   */
  public async close(): Promise<void> {
    await KnexConnector.destroy();
  }

  /**
   * Save a balance record to the database
   * Will upsert (update if exists, insert if not) based on unique constraint
   * @param record The balance record to save
   * @returns The saved record with its ID
   */
  async saveBalanceRecord(record: BalanceRecord): Promise<BalanceRecord> {
    try {
      // Make sure DB is initialized
      if (!this.db) {
        await this.initDatabase('development');
      }
      
      // Check that DB is valid
      if (!this.db) {
        throw new Error('Database connection could not be established');
      }
      
      // First try to find an existing record
      const existingRecord = await this.db(this.tableName)
        .where({
          wallet_address: record.wallet_address,
          date: record.date,
          balance_type: record.balance_type,
          currency: record.currency
        })
        .first();
      
      if (existingRecord) {
        // Update the existing record
        const updated = await this.db(this.tableName)
          .where({ id: existingRecord.id })
          .update({
            amount: record.amount,
            timestamp: new Date(), // Update timestamp to current time
            metadata: record.metadata ? JSON.stringify(record.metadata) : null
          })
          .returning('*');
        
        return updated[0];
      } else {
        // Insert a new record
        const result = await this.db(this.tableName)
          .insert(record)
          .returning('*');
        
        // Check if we got a result
        if (!result || !Array.isArray(result) || result.length === 0) {
          throw new Error('Insert operation returned empty result');
        }
        
        return result[0];
      }
    } catch (error) {
      console.error('Error saving balance record:', error);
      throw error;
    }
  }

  /**
   * Save multiple balance records in a transaction
   * @param records Array of balance records to save
   * @returns Array of saved records with their IDs
   */
  async saveBalanceRecords(records: BalanceRecord[]): Promise<BalanceRecord[]> {
    try {
      // Make sure DB is initialized
      if (!this.db) {
        await this.initDatabase('development');
      }
      
      // Check that DB is valid
      if (!this.db) {
        throw new Error('Database connection could not be established');
      }
      
      // Use a transaction to ensure all records are saved or none are
      const savedRecords = await this.db.transaction(async (trx) => {
        const results: BalanceRecord[] = [];
        
        for (const record of records) {
          // First try to find an existing record
          const existingRecord = await trx(this.tableName)
            .where({
              wallet_address: record.wallet_address,
              date: record.date,
              balance_type: record.balance_type,
              currency: record.currency
            })
            .first();
          
          let savedRecord;
          if (existingRecord) {
            // Update the existing record
            const updated = await trx(this.tableName)
              .where({ id: existingRecord.id })
              .update({
                amount: record.amount,
                timestamp: new Date(), // Update timestamp to current time
                metadata: record.metadata ? JSON.stringify(record.metadata) : null
              })
              .returning('*');
            
            savedRecord = updated[0];
          } else {
            // Insert a new record
            const inserted = await trx(this.tableName)
              .insert(record)
              .returning('*');
            
            savedRecord = inserted[0];
          }
          
          results.push(savedRecord);
        }
        
        return results;
      });
      
      return savedRecords;
    } catch (error) {
      console.error('Error saving balance records:', error);
      throw error;
    }
  }

  /**
   * Get balance records for a wallet on a specific date
   * @param walletAddress The wallet address to get records for
   * @param date The date to get records for (YYYY-MM-DD format)
   * @returns Array of balance records
   */
  async getBalanceRecordsByDate(
    walletAddress: string,
    date: string
  ): Promise<BalanceRecord[]> {
    try {
      // Make sure DB is initialized
      if (!this.db) {
        await this.initDatabase('development');
      }
      
      return await this.db(this.tableName)
        .where({
          wallet_address: walletAddress,
          date: date
        })
        .orderBy([
          { column: 'balance_type' },
          { column: 'currency' }
        ]);
    } catch (error) {
      console.error('Error getting balance records by date:', error);
      throw error;
    }
  }

  /**
   * Get all balance records for a wallet within a date range
   * @param walletAddress The wallet address to get records for
   * @param startDate The start date of the range (inclusive, YYYY-MM-DD format)
   * @param endDate The end date of the range (inclusive, YYYY-MM-DD format)
   * @returns Array of balance records
   */
  async getBalanceRecordsByDateRange(
    walletAddress: string,
    startDate: string,
    endDate: string
  ): Promise<BalanceRecord[]> {
    try {
      // Make sure DB is initialized
      if (!this.db) {
        await this.initDatabase('development');
      }
      
      return await this.db(this.tableName)
        .where({ wallet_address: walletAddress })
        .whereBetween('date', [startDate, endDate])
        .orderBy([
          { column: 'date', order: 'desc' },
          { column: 'balance_type' },
          { column: 'currency' }
        ]);
    } catch (error) {
      console.error('Error getting balance records by date range:', error);
      throw error;
    }
  }

  /**
   * Get the most recent date for which a wallet has balance records
   * @param walletAddress The wallet address to get the date for
   * @returns The most recent date or null if no records exist
   */
  async getLatestBalanceDate(walletAddress: string): Promise<string | null> {
    try {
      // Make sure DB is initialized
      if (!this.db) {
        await this.initDatabase('development');
      }
      
      const result = await this.db(this.tableName)
        .where({ wallet_address: walletAddress })
        .max('date as latest_date')
        .first();
      
      return result?.latest_date || null;
    } catch (error) {
      console.error('Error getting latest balance date:', error);
      throw error;
    }
  }

  /**
   * Get all balance records of a specific type for a wallet
   * @param walletAddress The wallet address to get records for
   * @param balanceType The type of balance to get
   * @returns Array of balance records
   */
  async getBalanceRecordsByType(
    walletAddress: string,
    balanceType: string
  ): Promise<BalanceRecord[]> {
    try {
      // Make sure DB is initialized
      if (!this.db) {
        await this.initDatabase('development');
      }
      
      return await this.db(this.tableName)
        .where({
          wallet_address: walletAddress,
          balance_type: balanceType
        })
        .orderBy('date', 'desc');
    } catch (error) {
      console.error('Error getting balance records by type:', error);
      throw error;
    }
  }

  /**
   * Delete balance records for a wallet on a specific date
   * @param walletAddress The wallet address to delete records for
   * @param date The date to delete records for (YYYY-MM-DD format)
   * @returns Number of records deleted
   */
  async deleteBalanceRecordsByDate(
    walletAddress: string,
    date: string
  ): Promise<number> {
    try {
      // Make sure DB is initialized
      if (!this.db) {
        await this.initDatabase('development');
      }
      
      const count = await this.db(this.tableName)
        .where({
          wallet_address: walletAddress,
          date: date
        })
        .delete();
      
      return count;
    } catch (error) {
      console.error('Error deleting balance records:', error);
      throw error;
    }
  }
}
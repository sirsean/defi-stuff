import { Knex } from 'knex';
import { KnexConnector } from './knexConnector.js';

/**
 * Interface for daily balance data
 */
export interface DailyBalanceRecord {
  id?: number;
  timestamp?: Date;
  wallet_address: string;
  total_usd_value: number;
  auto_usd_value: number;
  auto_eth_value: number;
  dinero_eth_value: number;
  flp_usd_value: number;
  pending_toke_amount: number;
  pending_usdc_amount: number;
  pending_rewards_usd_value: number;
  metadata?: Record<string, any>;
}

/**
 * Service for managing daily balance records in the database
 */
export class DailyBalanceService {
  private db!: Knex; // Using the ! non-null assertion operator since we initialize it in initDatabase
  private tableName = 'daily_balance';

  /**
   * Create an instance of the DailyBalanceService
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
   * Save a daily balance record to the database
   * @param record The daily balance record to save
   * @returns The saved record with its ID
   */
  async saveDailyBalance(record: DailyBalanceRecord): Promise<DailyBalanceRecord> {
    try {
      // Make sure DB is initialized
      if (!this.db) {
        await this.initDatabase('development');
      }
      
      // Check that DB is valid
      if (!this.db) {
        throw new Error('Database connection could not be established');
      }
      
      // Insert the record and get back the ID
      const result = await this.db(this.tableName).insert(record).returning('*');
      
      // Check if we got a result
      if (!result || !Array.isArray(result) || result.length === 0) {
        throw new Error('Insert operation returned empty result');
      }
      
      const [savedRecord] = result;
      return savedRecord;
    } catch (error) {
      console.error('Error saving daily balance record:', error);
      throw error;
    }
  }

  /**
   * Get all daily balance records for a wallet
   * @param walletAddress The wallet address to get records for
   * @param limit Maximum number of records to return
   * @param offset Number of records to skip
   * @returns Array of daily balance records
   */
  async getDailyBalancesByWallet(
    walletAddress: string,
    limit: number = 100,
    offset: number = 0
  ): Promise<DailyBalanceRecord[]> {
    try {
      // Make sure DB is initialized
      if (!this.db) {
        await this.initDatabase('development');
      }
      
      return await this.db(this.tableName)
        .where({ wallet_address: walletAddress })
        .orderBy('timestamp', 'desc')
        .limit(limit)
        .offset(offset);
    } catch (error) {
      console.error('Error getting daily balance records:', error);
      throw error;
    }
  }

  /**
   * Get all daily balance records for a wallet within a date range
   * @param walletAddress The wallet address to get records for
   * @param startDate The start date of the range (inclusive)
   * @param endDate The end date of the range (inclusive)
   * @param limit Maximum number of records to return
   * @param offset Number of records to skip
   * @returns Array of daily balance records
   */
  async getDailyBalancesByWalletAndDateRange(
    walletAddress: string,
    startDate: Date,
    endDate: Date,
    limit: number = 100,
    offset: number = 0
  ): Promise<DailyBalanceRecord[]> {
    try {
      // Make sure DB is initialized
      if (!this.db) {
        await this.initDatabase('development');
      }
      
      return await this.db(this.tableName)
        .where({ wallet_address: walletAddress })
        .whereBetween('timestamp', [startDate, endDate])
        .orderBy('timestamp', 'desc')
        .limit(limit)
        .offset(offset);
    } catch (error) {
      console.error('Error getting daily balance records by date range:', error);
      throw error;
    }
  }

  /**
   * Get all daily balance records for a wallet
   * No pagination, returns all records
   * @param walletAddress The wallet address to get all records for
   * @returns Array of all daily balance records
   */
  async getAllDailyBalancesByWallet(
    walletAddress: string
  ): Promise<DailyBalanceRecord[]> {
    try {
      // Make sure DB is initialized
      if (!this.db) {
        await this.initDatabase('development');
      }
      
      return await this.db(this.tableName)
        .where({ wallet_address: walletAddress })
        .orderBy('timestamp', 'desc');
    } catch (error) {
      console.error('Error getting all daily balance records:', error);
      throw error;
    }
  }

  /**
   * Get a daily balance record by ID
   * @param id The ID of the record to get
   * @returns The daily balance record or null if not found
   */
  async getDailyBalanceById(id: number): Promise<DailyBalanceRecord | null> {
    try {
      // Make sure DB is initialized
      if (!this.db) {
        await this.initDatabase('development');
      }
      
      const record = await this.db(this.tableName).where({ id }).first();
      return record || null;
    } catch (error) {
      console.error('Error getting daily balance record by ID:', error);
      throw error;
    }
  }

  /**
   * Get the most recent daily balance record for a wallet
   * @param walletAddress The wallet address to get the record for
   * @returns The most recent daily balance record or null if none exists
   */
  async getLatestDailyBalance(walletAddress: string): Promise<DailyBalanceRecord | null> {
    try {
      // Make sure DB is initialized
      if (!this.db) {
        await this.initDatabase('development');
      }
      
      const record = await this.db(this.tableName)
        .where({ wallet_address: walletAddress })
        .orderBy('timestamp', 'desc')
        .first();
      return record || null;
    } catch (error) {
      console.error('Error getting latest daily balance record:', error);
      throw error;
    }
  }

  /**
   * Delete a daily balance record by ID
   * @param id The ID of the record to delete
   * @returns True if the record was deleted
   */
  async deleteDailyBalance(id: number): Promise<boolean> {
    try {
      // Make sure DB is initialized
      if (!this.db) {
        await this.initDatabase('development');
      }
      
      const count = await this.db(this.tableName).where({ id }).delete();
      return count > 0;
    } catch (error) {
      console.error('Error deleting daily balance record:', error);
      throw error;
    }
  }
}
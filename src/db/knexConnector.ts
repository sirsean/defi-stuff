import knex, { Knex } from 'knex';
import path from 'path';

/**
 * Provides a connection to the database using Knex
 */
export class KnexConnector {
  private static instance: Knex | null = null;
  private static config: any;

  /**
   * Initialize the knex connection
   * 
   * @param environment The environment to use (development, test, production)
   * @returns The knex instance
   */
  public static async initialize(environment: string = 'development'): Promise<Knex> {
    if (!this.config) {
      try {
        // Create a hard-coded config since we can't easily load from knexfile.cjs in ES modules
        this.config = {
          development: {
            client: 'sqlite3',
            connection: {
              filename: './db/defi_data_dev.sqlite3'
            },
            migrations: {
              directory: './db/migrations'
            },
            seeds: {
              directory: './db/seeds'
            },
            useNullAsDefault: true
          },
          test: {
            client: 'sqlite3',
            connection: {
              filename: ':memory:'
            },
            migrations: {
              directory: './db/migrations'
            },
            seeds: {
              directory: './db/seeds'
            },
            useNullAsDefault: true
          },
          production: {
            client: 'sqlite3',
            connection: {
              filename: './db/defi_data.sqlite3'
            },
            migrations: {
              directory: './db/migrations'
            },
            seeds: {
              directory: './db/seeds'
            },
            useNullAsDefault: true
          }
        };
      } catch (error) {
        console.error('Error creating database configuration:', error);
        throw new Error('Could not load database configuration');
      }
    }

    // If environment is not valid, default to development
    if (!this.config[environment]) {
      console.warn(`Environment ${environment} not found in knexfile.cjs, using development`);
      environment = 'development';
    }

    // Create a new knex instance if one doesn't exist
    if (!this.instance) {
      this.instance = knex(this.config[environment]);
    }

    return this.instance;
  }

  /**
   * Get the current knex instance or initialize a new one
   * 
   * @param environment The environment to use (development, test, production)
   * @returns The knex instance
   */
  public static async getConnection(environment: string = 'development'): Promise<Knex> {
    if (!this.instance) {
      return await this.initialize(environment);
    }
    return this.instance;
  }

  /**
   * Close the knex connection
   */
  public static async destroy(): Promise<void> {
    if (this.instance) {
      await this.instance.destroy();
      this.instance = null;
    }
  }
}
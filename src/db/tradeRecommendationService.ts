import { Knex } from "knex";
import { KnexConnector } from "./knexConnector.js";
import type {
  MarketContext,
  TradeRecommendation,
} from "../types/tradeRecommendation.js";

/**
 * Interface for trade recommendation record in the database
 */
export interface TradeRecommendationRecord {
  id?: number;
  timestamp: Date;
  market: string;
  price: number;
  action: "long" | "short" | "hold" | "close";
  raw_confidence: number;
  confidence: number;
  size_usd: number | null;
  timeframe: "intraday" | "short" | "medium" | "long";
  reasoning: string;
  risk_factors: string[] | null;
  inputs: string | null;
}

/**
 * Service for managing trade recommendation records in the database
 */
export class TradeRecommendationService {
  private db!: Knex; // Using the ! non-null assertion operator since we initialize it in initDatabase
  private tableName = "trade_recommendations";

  /**
   * Create an instance of the TradeRecommendationService
   * @param environment The database environment to use
   */
  constructor(environment: string = "development") {
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
   * Convert domain TradeRecommendation to database record
   * @param recommendation The recommendation from the domain layer
   * @param currentPrice The current market price (for price field)
   * @returns Database record ready for insertion
   */
  private toRecord(
    recommendation: TradeRecommendation,
    currentPrice: number,
    context?: MarketContext,
  ): Omit<TradeRecommendationRecord, "id"> {
    // Serialize risk_factors to JSON string if present
    let riskFactorsJson: string | null = null;
    if (recommendation.risk_factors && recommendation.risk_factors.length > 0) {
      riskFactorsJson = JSON.stringify(recommendation.risk_factors);
    }

    // Serialize context to JSON string if present
    let inputsJson: string | null = null;
    if (context) {
      inputsJson = JSON.stringify(context);
    }

    return {
      timestamp: new Date(),
      market: recommendation.market,
      price: currentPrice,
      action: recommendation.action,
      raw_confidence: recommendation.raw_confidence,
      confidence: recommendation.confidence,
      size_usd: recommendation.size_usd,
      timeframe: recommendation.timeframe,
      reasoning: recommendation.reasoning,
      risk_factors: riskFactorsJson as any, // Store as JSON string
      inputs: inputsJson,
    };
  }

  /**
   * Deserialize risk_factors from JSON string to array
   * @param dbRecord The raw record from database
   * @returns Record with parsed risk_factors
   */
  private fromDbRecord(dbRecord: any): TradeRecommendationRecord {
    const record = { ...dbRecord };

    // Parse risk_factors JSON string back to array
    if (record.risk_factors && typeof record.risk_factors === "string") {
      try {
        record.risk_factors = JSON.parse(record.risk_factors);
      } catch (error) {
        console.warn("Failed to parse risk_factors JSON:", error);
        record.risk_factors = null;
      }
    }

    return record;
  }

  /**
   * Save a trade recommendation to the database
   * @param recommendation The recommendation to save
   * @param currentPrice The current market price at time of recommendation
   * @returns The saved record with its ID
   */
  async saveRecommendation(
    recommendation: TradeRecommendation,
    currentPrice: number,
    context?: MarketContext,
  ): Promise<TradeRecommendationRecord> {
    try {
      // Make sure DB is initialized
      if (!this.db) {
        await this.initDatabase("development");
      }

      // Check that DB is valid
      if (!this.db) {
        throw new Error("Database connection could not be established");
      }

      const record = this.toRecord(recommendation, currentPrice, context);

      // Insert the record
      const result = await this.db(this.tableName)
        .insert(record)
        .returning("*");

      // Check if we got a result
      if (!result || !Array.isArray(result) || result.length === 0) {
        throw new Error("Insert operation returned empty result");
      }

      return this.fromDbRecord(result[0]);
    } catch (error) {
      console.error("Error saving trade recommendation:", error);
      throw error;
    }
  }

  /**
   * Save multiple trade recommendations in a transaction
   * @param recommendations Array of recommendations with their current prices
   * @returns Array of saved records with their IDs
   */
  async saveRecommendations(
    recommendations: Array<{
      recommendation: TradeRecommendation;
      currentPrice: number;
    }>,
    context?: MarketContext,
  ): Promise<TradeRecommendationRecord[]> {
    try {
      // Make sure DB is initialized
      if (!this.db) {
        await this.initDatabase("development");
      }

      // Check that DB is valid
      if (!this.db) {
        throw new Error("Database connection could not be established");
      }

      // Use a transaction to ensure all records are saved or none are
      const savedRecords = await this.db.transaction(async (trx) => {
        const results: TradeRecommendationRecord[] = [];

        for (const { recommendation, currentPrice } of recommendations) {
          const record = this.toRecord(recommendation, currentPrice, context);

          const inserted = await trx(this.tableName)
            .insert(record)
            .returning("*");

          results.push(this.fromDbRecord(inserted[0]));
        }

        return results;
      });

      return savedRecords;
    } catch (error) {
      console.error("Error saving trade recommendations:", error);
      throw error;
    }
  }

  /**
   * Get trade recommendations for a specific market
   * @param market The market symbol (e.g., "BTC", "ETH")
   * @param limit Maximum number of records to return
   * @returns Array of recommendations, most recent first
   */
  async getRecommendationsByMarket(
    market: string,
    limit: number = 20,
  ): Promise<TradeRecommendationRecord[]> {
    try {
      // Make sure DB is initialized
      if (!this.db) {
        await this.initDatabase("development");
      }

      const results = await this.db(this.tableName)
        .where({ market: market })
        .orderBy("timestamp", "desc")
        .limit(limit);

      return results.map((r) => this.fromDbRecord(r));
    } catch (error) {
      console.error("Error getting recommendations by market:", error);
      throw error;
    }
  }

  /**
   * Get all trade recommendations within a date range
   * @param startDate The start date of the range (inclusive)
   * @param endDate The end date of the range (inclusive)
   * @returns Array of recommendations, most recent first
   */
  async getRecommendationsByDateRange(
    startDate: Date,
    endDate: Date,
  ): Promise<TradeRecommendationRecord[]> {
    try {
      // Make sure DB is initialized
      if (!this.db) {
        await this.initDatabase("development");
      }

      const results = await this.db(this.tableName)
        .whereBetween("timestamp", [startDate, endDate])
        .orderBy("timestamp", "desc");

      return results.map((r) => this.fromDbRecord(r));
    } catch (error) {
      console.error("Error getting recommendations by date range:", error);
      throw error;
    }
  }

  /**
   * Get the most recent trade recommendations across all markets
   * @param limit Maximum number of records to return
   * @returns Array of recommendations, most recent first
   */
  async getLatestRecommendations(
    limit: number = 20,
  ): Promise<TradeRecommendationRecord[]> {
    try {
      // Make sure DB is initialized
      if (!this.db) {
        await this.initDatabase("development");
      }

      const results = await this.db(this.tableName)
        .orderBy("timestamp", "desc")
        .limit(limit);

      return results.map((r) => this.fromDbRecord(r));
    } catch (error) {
      console.error("Error getting latest recommendations:", error);
      throw error;
    }
  }

  /**
   * Get recommendations by action type
   * @param action The action type to filter by
   * @param limit Maximum number of records to return
   * @returns Array of recommendations, most recent first
   */
  async getRecommendationsByAction(
    action: "long" | "short" | "hold" | "close",
    limit: number = 20,
  ): Promise<TradeRecommendationRecord[]> {
    try {
      // Make sure DB is initialized
      if (!this.db) {
        await this.initDatabase("development");
      }

      const results = await this.db(this.tableName)
        .where({ action: action })
        .orderBy("timestamp", "desc")
        .limit(limit);

      return results.map((r) => this.fromDbRecord(r));
    } catch (error) {
      console.error("Error getting recommendations by action:", error);
      throw error;
    }
  }

  /**
   * Get the most recent recommendation for a specific market
   * @param market The market symbol (e.g., "BTC", "ETH")
   * @returns The most recent recommendation or null if none exists
   */
  async getLatestRecommendationForMarket(
    market: string,
  ): Promise<TradeRecommendationRecord | null> {
    try {
      // Make sure DB is initialized
      if (!this.db) {
        await this.initDatabase("development");
      }

      const result = await this.db(this.tableName)
        .where({ market: market })
        .orderBy("timestamp", "desc")
        .first();

      return result ? this.fromDbRecord(result) : null;
    } catch (error) {
      console.error("Error getting latest recommendation for market:", error);
      throw error;
    }
  }
}

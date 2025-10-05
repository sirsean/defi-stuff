/**
 * Migration to create the trade_recommendations table
 * Stores AI-generated trade recommendations for historical analysis
 */
exports.up = async function(knex) {
  await knex.schema.createTable('trade_recommendations', function(table) {
    // Primary key
    table.increments('id').primary();
    
    // Timestamp of when the recommendation was generated
    table.timestamp('timestamp').notNullable().defaultTo(knex.fn.now());
    
    // Market symbol (e.g., "BTC", "ETH")
    table.string('market').notNullable();
    
    // Current market price at time of recommendation
    table.decimal('price', 30, 10).notNullable();
    
    // Trade action: long, short, hold, close
    table.string('action').notNullable();
    
    // Confidence score (0.0 to 1.0)
    table.decimal('confidence', 5, 4).notNullable();
    
    // Suggested position size in USD (nullable)
    table.decimal('size_usd', 30, 10).nullable();
    
    // Expected holding period: intraday, short, medium, long
    table.string('timeframe').notNullable();
    
    // AI-generated reasoning
    table.text('reasoning').notNullable();
    
    // Risk factors as JSON array
    table.json('risk_factors').nullable();
    
    // Indexes for common queries
    table.index(['market'], 'tr_market_idx');
    table.index(['timestamp'], 'tr_timestamp_idx');
    table.index(['action'], 'tr_action_idx');
  });
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('trade_recommendations');
};

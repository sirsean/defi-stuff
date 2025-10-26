/**
 * Migration to create the confidence_calibrations table
 * Stores calibration mappings that adjust LLM confidence scores based on historical performance
 */
exports.up = async function(knex) {
  await knex.schema.createTable('confidence_calibrations', function(table) {
    // Primary key
    table.increments('id').primary();
    
    // Timestamp of when the calibration was computed
    table.timestamp('timestamp').notNullable().defaultTo(knex.fn.now());
    
    // Market symbol (e.g., "BTC", "ETH")
    table.string('market', 255).notNullable();
    
    // Rolling window size in days used for calibration
    table.integer('window_days').notNullable();
    
    // Calibration mapping as JSON array of {rawConfidence, calibratedConfidence} points
    // Example: [{"rawConfidence": 0.0, "calibratedConfidence": 0.0}, {"rawConfidence": 0.5, "calibratedConfidence": 0.45}, ...]
    table.json('calibration_data').notNullable();
    
    // Number of trade recommendations used to compute this calibration
    table.integer('sample_size').notNullable();
    
    // Pearson correlation coefficient between confidence and trade outcomes
    table.decimal('correlation', 5, 4).notNullable();
    
    // Win rate for high confidence trades (confidence >= 0.7)
    table.decimal('high_conf_win_rate', 5, 4).nullable();
    
    // Win rate for low confidence trades (confidence < 0.7)
    table.decimal('low_conf_win_rate', 5, 4).nullable();
    
    // Composite index for efficient lookups (most recent calibration per market)
    table.index(['market', 'timestamp'], 'cc_market_timestamp_idx');
    
    // Index for timestamp-based queries
    table.index(['timestamp'], 'cc_timestamp_idx');
  });
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('confidence_calibrations');
};

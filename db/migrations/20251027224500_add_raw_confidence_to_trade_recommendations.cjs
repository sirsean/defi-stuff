/**
 * Migration to add raw_confidence column to trade_recommendations table
 * 
 * This migration supports Phase 6 of the confidence recalibration system.
 * It adds a separate column for the raw LLM confidence score, allowing us to
 * store both the original score and the calibrated score.
 * 
 * Migration strategy:
 * 1. Add raw_confidence column (nullable initially)
 * 2. Copy existing confidence values to raw_confidence (preserve historical data)
 * 3. Add index for query performance
 * 
 * After this migration:
 * - raw_confidence: Original LLM-generated confidence score
 * - confidence: Will be calibrated score (after Phase 7 integration)
 * 
 * For historical data, both columns will have identical values until
 * calibration is applied in Phase 7.
 */

exports.up = async function(knex) {
  // Step 1: Add raw_confidence column
  await knex.schema.table('trade_recommendations', function(table) {
    table.decimal('raw_confidence', 5, 4).nullable();
  });

  // Step 2: Copy existing confidence values to raw_confidence
  // This preserves historical data
  await knex.raw(`
    UPDATE trade_recommendations 
    SET raw_confidence = confidence 
    WHERE raw_confidence IS NULL
  `);

  // Step 3: Add index for query performance
  await knex.schema.table('trade_recommendations', function(table) {
    table.index('raw_confidence', 'tr_raw_confidence_idx');
  });
};

exports.down = async function(knex) {
  // Rollback: Remove index and column
  await knex.schema.table('trade_recommendations', function(table) {
    table.dropIndex('raw_confidence', 'tr_raw_confidence_idx');
    table.dropColumn('raw_confidence');
  });
};

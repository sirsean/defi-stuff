/**
 * Migration to add inputs column to trade_recommendations table
 * Stores the full input context used to generate the recommendation
 */
exports.up = async function(knex) {
  await knex.schema.alterTable('trade_recommendations', function(table) {
    // Input context as JSON string (nullable for existing records)
    table.text('inputs').nullable();
  });
};

exports.down = async function(knex) {
  await knex.schema.alterTable('trade_recommendations', function(table) {
    table.dropColumn('inputs');
  });
};

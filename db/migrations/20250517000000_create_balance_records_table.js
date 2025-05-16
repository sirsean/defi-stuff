/**
 * Migration to create the balance_records table
 * This table stores daily balance data with a more flexible schema
 */
export function up(knex) {
  return knex.schema.createTable('balance_records', table => {
    table.increments('id').primary();
    table.timestamp('timestamp').notNullable().defaultTo(knex.fn.now());
    table.date('date').notNullable();
    table.string('wallet_address').notNullable();
    table.string('balance_type').notNullable();
    table.string('currency').notNullable();
    table.decimal('amount', 36, 18).notNullable();
    
    // Metadata for additional information if needed
    table.json('metadata').nullable();
    
    // Indexes
    table.index('wallet_address');
    table.index('date');
    table.index('balance_type');
    
    // Unique constraint - prevents duplicate entries for the same date + address + balance type
    table.unique(['wallet_address', 'date', 'balance_type', 'currency']);
  });
}

export function down(knex) {
  return knex.schema.dropTable('balance_records');
}
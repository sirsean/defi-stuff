#!/usr/bin/env node
/**
 * Simple script to check the database status and print migration info
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Paths to databases
const prodDbPath = path.join(__dirname, '../db/defi_data.sqlite3');
const devDbPath = path.join(__dirname, '../db/defi_data_dev.sqlite3');

// Check if database files exist
const checkDb = (dbPath, label) => {
  try {
    if (fs.existsSync(dbPath)) {
      const stats = fs.statSync(dbPath);
      const sizeInKB = stats.size / 1024;
      console.log(`✅ ${label} database exists (${sizeInKB.toFixed(2)} KB)`);
      return true;
    } else {
      console.log(`❌ ${label} database does not exist`);
      return false;
    }
  } catch (err) {
    console.error(`Error checking ${label} database:`, err);
    return false;
  }
};

// Check migration directory
const checkMigrations = () => {
  const migrationsPath = path.join(__dirname, '../db/migrations');
  
  try {
    if (fs.existsSync(migrationsPath)) {
      const files = fs.readdirSync(migrationsPath);
      if (files.length === 0) {
        console.log('❌ No migration files found');
        return;
      }
      
      console.log(`✅ Found ${files.length} migration file(s):`);
      files.forEach(file => {
        console.log(`   - ${file}`);
      });
    } else {
      console.log('❌ Migrations directory does not exist');
    }
  } catch (err) {
    console.error('Error checking migrations:', err);
  }
};

// Main function
const main = () => {
  console.log('=== DATABASE STATUS ===');
  
  // Check database files
  const devExists = checkDb(devDbPath, 'Development');
  const prodExists = checkDb(prodDbPath, 'Production');
  
  // Check migrations
  console.log('\n=== MIGRATIONS ===');
  checkMigrations();
  
  console.log('\n=== RECOMMENDATIONS ===');
  if (!devExists && !prodExists) {
    console.log('• Run migrations to create database files:');
    console.log('  npm run db:migrate');
  } else {
    console.log('• Database exists and appears to be set up correctly');
    console.log('• You can use the daily command with --db flag to store reports:');
    console.log('  node dist/index.js daily --db');
  }
};

// Run the script
main();
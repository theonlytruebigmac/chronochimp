#!/usr/bin/env node

const sqlite3 = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

// Configure logging
const logFile = path.join(process.cwd(), 'db-debug.log');
const log = (message) => {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}\n`;
  fs.appendFileSync(logFile, logMessage);
  console.log(message);
};

try {
  // Clear previous log
  fs.writeFileSync(logFile, '');
  
  // Log environment
  log('Environment variables:');
  log(`NODE_ENV: ${process.env.NODE_ENV}`);
  log(`USER: ${process.env.USER}`);
  log(`UID: ${process.getuid?.() || 'N/A'}`);
  log(`GID: ${process.getgid?.() || 'N/A'}`);
  
  // Log database path
  const dataDir = path.join(process.cwd(), '.data');
  const dbPath = path.join(dataDir, 'chrono.db');
  log(`Database path: ${dbPath}`);
  
  // Check if directory and file exist
  log(`Data directory exists: ${fs.existsSync(dataDir)}`);
  log(`Database file exists: ${fs.existsSync(dbPath)}`);
  
  if (fs.existsSync(dbPath)) {
    // Get file stats
    const stats = fs.statSync(dbPath);
    log(`Database file size: ${stats.size} bytes`);
    log(`Database file permissions: ${stats.mode.toString(8)}`);
    log(`Database file owner: UID=${stats.uid}, GID=${stats.gid}`);
  }
  
  // Try to open database with verbose error reporting
  log('Attempting to open database...');
  const dbOptions = { verbose: console.log };
  const db = new sqlite3(dbPath, dbOptions);
  log('Database opened successfully!');
  
  // Test schema access
  log('Checking database schema...');
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
  log(`Tables in database: ${tables.map(t => t.name).join(', ')}`);
  
  // Test write operation
  log('Testing write operation...');
  const testTable = `
    CREATE TABLE IF NOT EXISTS debug_test (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      message TEXT,
      timestamp TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `;
  db.exec(testTable);
  log('Test table created or exists');
  
  // Insert test data
  const insert = db.prepare('INSERT INTO debug_test (message) VALUES (?)');
  const result = insert.run(`Test message at ${new Date().toISOString()}`);
  log(`Insert result: ${JSON.stringify(result)}`);
  
  // Read test data
  const rows = db.prepare('SELECT * FROM debug_test ORDER BY id DESC LIMIT 5').all();
  log(`Recent rows: ${JSON.stringify(rows)}`);
  
  // Close database
  db.close();
  log('Database test completed successfully!');
} catch (error) {
  log(`ERROR: ${error.message}`);
  log(error.stack);
}

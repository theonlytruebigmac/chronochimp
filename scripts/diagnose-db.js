#!/usr/bin/env node

/**
 * Database Diagnostic Tool
 * 
 * This script performs comprehensive testing of database access, including
 * permissions, connectivity, and CRUD operations.
 */

const fs = require('fs');
const path = require('path');
const childProcess = require('child_process');
const sqlite3 = require('better-sqlite3');

// Configuration
const DATA_DIR = path.join(process.cwd(), '.data');
const DB_PATH = path.join(DATA_DIR, 'chrono.db');
const LOG_PATH = path.join(process.cwd(), 'db-diagnostics.log');

// Setup logging
const log = (message) => {
  const timestamp = new Date().toISOString();
  const formattedMessage = `[${timestamp}] ${message}\n`;
  
  // Log to console
  console.log(message);
  
  // Append to log file
  fs.appendFileSync(LOG_PATH, formattedMessage);
};

// Initialize log file
fs.writeFileSync(LOG_PATH, '=== Database Diagnostics Report ===\n\n');

// Run diagnostics
async function runDiagnostics() {
  try {
    log('Starting database diagnostics...');
    
    // System information
    log('\n=== System Information ===');
    log(`Node Version: ${process.version}`);
    log(`Platform: ${process.platform}`);
    log(`User: ${process.env.USER || 'unknown'}`);
    log(`Current Directory: ${process.cwd()}`);
    log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    
    try {
      const uid = process.getuid ? process.getuid() : 'N/A';
      const gid = process.getgid ? process.getgid() : 'N/A';
      log(`Process UID: ${uid}, GID: ${gid}`);
    } catch (e) {
      log(`Could not get process UID/GID: ${e.message}`);
    }
    
    // File system checks
    log('\n=== File System Checks ===');
    checkDirectory();
    checkDatabaseFile();
    
    // Database operations
    log('\n=== Database Operations ===');
    testDatabaseConnection();
    testTableCreation();
    testDataOperations();
    
    log('\nDiagnostics completed successfully!');
  } catch (error) {
    log(`\n❌ ERROR: Diagnostics failed: ${error.message}`);
    log(error.stack);
  }
}

// Check data directory
function checkDirectory() {
  log(`Checking data directory: ${DATA_DIR}`);
  
  // Check if directory exists
  if (!fs.existsSync(DATA_DIR)) {
    log(`Data directory does not exist. Creating...`);
    try {
      fs.mkdirSync(DATA_DIR, { recursive: true });
      log(`✅ Data directory created successfully.`);
    } catch (e) {
      log(`❌ Failed to create data directory: ${e.message}`);
      throw e;
    }
  } else {
    log(`✅ Data directory exists.`);
  }
  
  // Check directory permissions
  try {
    const stats = fs.statSync(DATA_DIR);
    log(`Directory mode: ${stats.mode.toString(8)}`);
    log(`Directory owner: UID=${stats.uid}, GID=${stats.gid}`);
    
    // Test write permission
    const testFile = path.join(DATA_DIR, '.test-write');
    fs.writeFileSync(testFile, 'test');
    fs.unlinkSync(testFile);
    log(`✅ Directory is writable.`);
  } catch (e) {
    log(`❌ Directory permission check failed: ${e.message}`);
    throw e;
  }
}

// Check database file
function checkDatabaseFile() {
  log(`Checking database file: ${DB_PATH}`);
  
  // Check if file exists
  if (!fs.existsSync(DB_PATH)) {
    log(`Database file does not exist. Creating empty file...`);
    try {
      fs.writeFileSync(DB_PATH, '');
      log(`✅ Empty database file created.`);
    } catch (e) {
      log(`❌ Failed to create database file: ${e.message}`);
      throw e;
    }
  } else {
    log(`✅ Database file exists.`);
  }
  
  // Check file permissions
  try {
    const stats = fs.statSync(DB_PATH);
    log(`File size: ${stats.size} bytes`);
    log(`File mode: ${stats.mode.toString(8)}`);
    log(`File owner: UID=${stats.uid}, GID=${stats.gid}`);
    
    // Test write permission
    fs.appendFileSync(DB_PATH, '');
    log(`✅ Database file is writable.`);
  } catch (e) {
    log(`❌ File permission check failed: ${e.message}`);
    throw e;
  }
}

// Test database connection
function testDatabaseConnection() {
  log('Attempting to open database connection...');
  
  try {
    const db = new sqlite3(DB_PATH, { verbose: console.log });
    log(`✅ Database connection successful.`);
    
    // Check SQLite version
    const versionResult = db.prepare('SELECT sqlite_version() as version').get();
    log(`SQLite version: ${versionResult.version}`);
    
    db.close();
  } catch (e) {
    log(`❌ Database connection failed: ${e.message}`);
    throw e;
  }
}

// Test table creation
function testTableCreation() {
  log('Testing table creation...');
  
  try {
    const db = new sqlite3(DB_PATH);
    
    // Create test table
    db.exec(`
      CREATE TABLE IF NOT EXISTS diagnostics_test (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        test_name TEXT NOT NULL,
        timestamp TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Verify table was created
    const tableExists = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='diagnostics_test'`).get();
    
    if (tableExists) {
      log(`✅ Test table created successfully.`);
    } else {
      log(`❌ Failed to create test table.`);
      throw new Error('Table creation failed');
    }
    
    db.close();
  } catch (e) {
    log(`❌ Table creation test failed: ${e.message}`);
    throw e;
  }
}

// Test data operations
function testDataOperations() {
  log('Testing CRUD operations...');
  
  try {
    const db = new sqlite3(DB_PATH);
    
    // Insert data
    const testName = `test_${Date.now()}`;
    const insertStmt = db.prepare('INSERT INTO diagnostics_test (test_name) VALUES (?)');
    const insertResult = insertStmt.run(testName);
    
    log(`Insert result: ${JSON.stringify({
      changes: insertResult.changes,
      lastInsertRowid: insertResult.lastInsertRowid
    })}`);
    
    if (insertResult.changes !== 1) {
      throw new Error(`Insert failed: expected 1 change, got ${insertResult.changes}`);
    }
    
    // Read data
    const readResult = db.prepare('SELECT * FROM diagnostics_test WHERE test_name = ?').get(testName);
    log(`Read result: ${JSON.stringify(readResult)}`);
    
    if (!readResult || readResult.test_name !== testName) {
      throw new Error('Read failed: could not retrieve inserted record');
    }
    
    // Update data
    const updatedName = `${testName}_updated`;
    const updateStmt = db.prepare('UPDATE diagnostics_test SET test_name = ? WHERE id = ?');
    const updateResult = updateStmt.run(updatedName, readResult.id);
    
    log(`Update result: ${JSON.stringify({
      changes: updateResult.changes
    })}`);
    
    if (updateResult.changes !== 1) {
      throw new Error(`Update failed: expected 1 change, got ${updateResult.changes}`);
    }
    
    // Verify update
    const verifyUpdate = db.prepare('SELECT * FROM diagnostics_test WHERE id = ?').get(readResult.id);
    log(`Verification result: ${JSON.stringify(verifyUpdate)}`);
    
    if (!verifyUpdate || verifyUpdate.test_name !== updatedName) {
      throw new Error('Update verification failed');
    }
    
    // Delete data
    const deleteStmt = db.prepare('DELETE FROM diagnostics_test WHERE id = ?');
    const deleteResult = deleteStmt.run(readResult.id);
    
    log(`Delete result: ${JSON.stringify({
      changes: deleteResult.changes
    })}`);
    
    if (deleteResult.changes !== 1) {
      throw new Error(`Delete failed: expected 1 change, got ${deleteResult.changes}`);
    }
    
    // Verify all operations
    log(`✅ All CRUD operations completed successfully.`);
    
    db.close();
  } catch (e) {
    log(`❌ CRUD operations test failed: ${e.message}`);
    throw e;
  }
}

// Run the diagnostics
runDiagnostics().then(() => {
  log(`\nDiagnostics report saved to: ${LOG_PATH}`);
}).catch(err => {
  log(`Fatal error: ${err.message}`);
  process.exit(1);
});

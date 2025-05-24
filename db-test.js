// Simple script to test database operations
const sqlite3 = require('better-sqlite3');
const path = require('path');

try {
  console.log('Opening database...');
  const db = new sqlite3(path.join(process.cwd(), '.data', 'chrono.db'));
  
  console.log('Creating test table...');
  db.exec('CREATE TABLE IF NOT EXISTS db_test (id INTEGER PRIMARY KEY, value TEXT, timestamp TEXT DEFAULT CURRENT_TIMESTAMP)');
  
  console.log('Inserting test row...');
  const insertStmt = db.prepare('INSERT INTO db_test (value) VALUES (?)');
  const result = insertStmt.run('Test value from ' + new Date().toISOString());
  
  console.log('Insert result:', result);
  
  console.log('Reading test rows...');
  const rows = db.prepare('SELECT * FROM db_test ORDER BY id DESC LIMIT 5').all();
  console.log('Recent rows:', rows);
  
  db.close();
  console.log('Database test completed successfully!');
} catch (error) {
  console.error('Database test failed:', error);
}

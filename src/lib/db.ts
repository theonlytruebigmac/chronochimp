import Database from 'better-sqlite3';
import type { Database as DatabaseType } from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const dataDir = path.join(process.cwd(), '.data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'chrono.db');

function initDatabase() {
  const db = new Database(dbPath);

  // Add functions to ensure proper UUID handling
  db.function('ensure_uuid', (id: string) => {
    if (!id) return null;
    // UUID pattern: 8-4-4-4-12 chars
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidPattern.test(id) ? id : null;
  });

  db.function('match_uuid', (id: string, pattern: string) => {
    if (!id || !pattern) return 0;
    return id.toLowerCase() === pattern.toLowerCase() ? 1 : 0;
  });

  return db;
}

export const db = initDatabase();

// Create tasks table if it doesn't exist
const createTasksTable = `
  CREATE TABLE IF NOT EXISTS tasks (
    id CHAR(36) PRIMARY KEY CHECK (ensure_uuid(id) IS NOT NULL),
    userId CHAR(36) NOT NULL CHECK (ensure_uuid(userId) IS NOT NULL),
    title TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'Backlog',
    priority TEXT DEFAULT 'medium',
    dueDate TEXT,
    startDate TEXT,
    tags TEXT, /* JSON string array */
    subtasks TEXT, /* JSON string array of Subtask objects */
    timeLogs TEXT, /* JSON string array of TimeLog objects */
    notes TEXT,
    createdAt TEXT DEFAULT (STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
    updatedAt TEXT DEFAULT (STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
  );
`;
db.exec(createTasksTable);

// Add userId column to tasks table if it doesn't exist (for existing databases)
try {
  const stmt = db.prepare(`PRAGMA table_info(tasks)`);
  const existingColumns = stmt.all() as { name: string }[];
  if (!existingColumns.some(ec => ec.name === 'userId')) {
    // console.log(`Adding 'userId' column to 'tasks' table.`); // Removed for cleaner logs
    db.exec(`ALTER TABLE tasks ADD COLUMN userId TEXT`);
  }
} catch (error) {
  console.warn(`Could not check/add column userId to tasks table:`, error);
}


// Create a trigger to update the updatedAt timestamp for tasks
const createTasksUpdatedAtTrigger = `
  CREATE TRIGGER IF NOT EXISTS update_tasks_updatedAt
  AFTER UPDATE ON tasks
  FOR EACH ROW
  BEGIN
    UPDATE tasks SET updatedAt = (STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now')) WHERE id = OLD.id;
  END;
`;
db.exec(createTasksUpdatedAtTrigger);

// Create users table
const createUsersTable = `
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'Viewer', -- Admin, Editor, Viewer
    avatarUrl TEXT,
    isTwoFactorEnabled BOOLEAN DEFAULT FALSE,
    twoFactorSecret TEXT, -- CRITICAL: MUST be encrypted at rest in production
    emailNotificationsEnabled BOOLEAN DEFAULT TRUE,
    inAppNotificationsEnabled BOOLEAN DEFAULT TRUE,
    smtpHost TEXT,
    smtpPort INTEGER,
    smtpEncryption TEXT,
    smtpUsername TEXT,
    smtpPassword TEXT, -- CRITICAL: MUST be encrypted at rest in production
    smtpSendFrom TEXT,
    joinedDate TEXT DEFAULT (STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updatedAt TEXT DEFAULT (STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now'))
  );
`;
db.exec(createUsersTable);

// Add columns if they don't exist (migration for existing dbs)
const userColumnsToEnsure = [
  { name: 'isTwoFactorEnabled', type: 'BOOLEAN DEFAULT FALSE' },
  { name: 'twoFactorSecret', type: 'TEXT' }, 
  { name: 'emailNotificationsEnabled', type: 'BOOLEAN DEFAULT TRUE' },
  { name: 'inAppNotificationsEnabled', type: 'BOOLEAN DEFAULT TRUE' },
  { name: 'smtpHost', type: 'TEXT' },
  { name: 'smtpPort', type: 'INTEGER' },
  { name: 'smtpEncryption', type: 'TEXT' },
  { name: 'smtpUsername', type: 'TEXT' },
  { name: 'smtpPassword', type: 'TEXT' }, 
  { name: 'smtpSendFrom', type: 'TEXT' },
];

userColumnsToEnsure.forEach(column => {
  try {
    const stmt = db.prepare(`PRAGMA table_info(users)`);
    const existingColumns = stmt.all() as { name: string }[];
    if (!existingColumns.some(ec => ec.name === column.name)) {
      // console.log(`Adding '${column.name}' column to 'users' table.`); // Removed for cleaner logs
      db.exec(`ALTER TABLE users ADD COLUMN ${column.name} ${column.type}`);
    }
  } catch (error) {
    console.warn(`Could not check/add column ${column.name} to users table:`, error);
  }
});


// Create a trigger to update the updatedAt timestamp for users
const createUsersUpdatedAtTrigger = `
  CREATE TRIGGER IF NOT EXISTS update_users_updatedAt
  AFTER UPDATE ON users
  FOR EACH ROW
  BEGIN
    UPDATE users SET updatedAt = (STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now')) WHERE id = OLD.id;
  END;
`;
db.exec(createUsersUpdatedAtTrigger);


// Create api_keys table
const createApiKeysTable = `
  CREATE TABLE IF NOT EXISTS api_keys (
    id TEXT PRIMARY KEY,
    userId TEXT NOT NULL,
    name TEXT NOT NULL,
    hashedKey TEXT NOT NULL UNIQUE,
    keyPrefix TEXT NOT NULL,
    last4 TEXT NOT NULL,
    createdAt TEXT DEFAULT (STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now')),
    expiresAt TEXT,
    lastUsedAt TEXT,
    revoked INTEGER DEFAULT 0,
    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
  );

  -- Create index on hashedKey for fast lookups during validation
  CREATE INDEX IF NOT EXISTS idx_api_keys_hashedKey ON api_keys(hashedKey);
  -- Create index on keyPrefix for fast lookups during validation
  CREATE INDEX IF NOT EXISTS idx_api_keys_keyPrefix ON api_keys(keyPrefix);
  -- Create index on userId for fast key listing
  CREATE INDEX IF NOT EXISTS idx_api_keys_userId ON api_keys(userId);
  -- Create index on revoked and expiresAt for fast validation checks
  CREATE INDEX IF NOT EXISTS idx_api_keys_status ON api_keys(revoked, expiresAt);
`;
db.exec(createApiKeysTable);

// Add keyPrefix column if it doesn't exist
try {
  const stmt = db.prepare(`PRAGMA table_info(api_keys)`);
  const existingColumns = stmt.all() as { name: string }[];
  if (!existingColumns.some(ec => ec.name === 'keyPrefix')) {
    console.log('Adding keyPrefix column to api_keys table...');
    db.exec(`ALTER TABLE api_keys ADD COLUMN keyPrefix TEXT`);
    
    // Update existing rows to include keyPrefix based on hashedKey
    const updateStmt = db.prepare(`
      UPDATE api_keys 
      SET keyPrefix = substr(hashedKey, 1, 8) 
      WHERE keyPrefix IS NULL
    `);
    updateStmt.run();
    
    // Add NOT NULL constraint
    db.exec(`
      CREATE TABLE api_keys_new (
        id TEXT PRIMARY KEY,
        userId TEXT NOT NULL,
        name TEXT NOT NULL,
        hashedKey TEXT NOT NULL UNIQUE,
        keyPrefix TEXT NOT NULL,
        last4 TEXT NOT NULL,
        createdAt TEXT DEFAULT (STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now')),
        expiresAt TEXT,
        lastUsedAt TEXT,
        revoked INTEGER DEFAULT 0,
        FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
      );
      
      INSERT INTO api_keys_new 
      SELECT * FROM api_keys;
      
      DROP TABLE api_keys;
      ALTER TABLE api_keys_new RENAME TO api_keys;
      
      -- Recreate indexes
      CREATE INDEX IF NOT EXISTS idx_api_keys_hashedKey ON api_keys(hashedKey);
      CREATE INDEX IF NOT EXISTS idx_api_keys_keyPrefix ON api_keys(keyPrefix);
      CREATE INDEX IF NOT EXISTS idx_api_keys_userId ON api_keys(userId);
      CREATE INDEX IF NOT EXISTS idx_api_keys_status ON api_keys(revoked, expiresAt);
    `);
  }
} catch (error) {
  console.warn('Could not check/add column keyPrefix to api_keys table:', error);
}

// Create password_reset_tokens table
const createPasswordResetTokensTable = `
  CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id TEXT PRIMARY KEY,
    userId TEXT NOT NULL,
    token TEXT NOT NULL UNIQUE, -- Stores the HASHED token
    expiresAt TEXT NOT NULL,
    createdAt TEXT DEFAULT (STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now')),
    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
  );
`;
db.exec(createPasswordResetTokensTable);

// Create user_invites table
const createUserInvitesTable = `
  CREATE TABLE IF NOT EXISTS user_invites (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE, 
    role TEXT NOT NULL DEFAULT 'Viewer',
    token TEXT NOT NULL UNIQUE, -- Stores the HASHED invite token
    status TEXT NOT NULL DEFAULT 'pending', -- e.g., pending, accepted, expired
    expiresAt TEXT NOT NULL,
    createdAt TEXT DEFAULT (STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now'))
  );
`;
db.exec(createUserInvitesTable);

// Create indexes for better query performance
const createIndexes = `
  -- Tasks indexes
  CREATE INDEX IF NOT EXISTS idx_tasks_userId ON tasks(userId);
  CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
  CREATE INDEX IF NOT EXISTS idx_tasks_dueDate ON tasks(dueDate);
  
  -- API keys indexes
  CREATE INDEX IF NOT EXISTS idx_api_keys_userId ON api_keys(userId);
  CREATE INDEX IF NOT EXISTS idx_api_keys_hashedKey ON api_keys(hashedKey);
  CREATE INDEX IF NOT EXISTS idx_api_keys_lastUsedAt ON api_keys(lastUsedAt);
  CREATE INDEX IF NOT EXISTS idx_api_keys_status ON api_keys(revoked, expiresAt);
  
  -- Password reset tokens index
  CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_userId ON password_reset_tokens(userId);
  CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_expiresAt ON password_reset_tokens(expiresAt);
  
  -- User invites indexes
  CREATE INDEX IF NOT EXISTS idx_user_invites_email ON user_invites(email);
  CREATE INDEX IF NOT EXISTS idx_user_invites_status ON user_invites(status);
  CREATE INDEX IF NOT EXISTS idx_user_invites_expiresAt ON user_invites(expiresAt);
`;
db.exec(createIndexes);

// console.log('Database initialized and connected at', dbPath); // Removed for cleaner logs in production

// Helper to safely parse JSON
export function safeJSONParse<T>(jsonString: string | null | undefined, defaultValue: T): T {
  if (jsonString === null || jsonString === undefined) {
    return defaultValue;
  }
  try {
    return JSON.parse(jsonString);
  } catch (e) {
    return defaultValue;
  }
}

// Helper for safe database operations with proper cleanup
export function withDb<T>(operation: (db: DatabaseType) => T): T {
  const stmt = {
    finalized: false,
    handle: null as any,
    finalize() {
      if (!this.finalized && this.handle) {
        this.handle.finalize();
        this.finalized = true;
      }
    }
  };

  try {
    return operation(db);
  } catch (error) {
    console.error('Database operation failed:', error);
    throw error;
  } finally {
    stmt.finalize();
  }
}

// Register cleanup handler
process.on('exit', () => {
  try {
    db.close();
  } catch (error) {
    console.error('Error closing database connection:', error);
  }
});

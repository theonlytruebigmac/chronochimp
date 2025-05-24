import Database from 'better-sqlite3';
import type { Database as DatabaseType } from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { 
  ensureDatabaseAccess, 
  runWithRecovery, 
  safeQuery as utilsSafeQuery, 
  safeQueryAll as utilsSafeQueryAll, 
  safeExecute as utilsSafeExecute, 
  safeTransaction as utilsSafeTransaction 
} from './db-utils';

// Re-export database utilities with our db instance
export const safeQuery = <T>(sql: string, params: any[] = [], defaultValue: T | null = null) => 
  utilsSafeQuery<T>(db, sql, params, defaultValue);

export const safeQueryAll = <T>(sql: string, params: any[] = [], defaultValue: T[] = []) => 
  utilsSafeQueryAll<T>(db, sql, params, defaultValue);

export const safeExecute = (sql: string, params: any[] = []) => 
  utilsSafeExecute(db, sql, params);

export const safeTransaction = <T>(operations: Array<{ sql: string; params?: any[] }>) => 
  utilsSafeTransaction(db, operations);

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

// Check if we should skip database operations (only during build)
const shouldSkipDb = process.env.NEXT_BUILD_SKIP_DB === 'true';

// Create a mock database for build time
class MockDatabase {
  prepare() {
    return {
      all: () => [],
      get: () => null,
      run: () => ({ changes: 0 }),
    };
  }
  
  exec() {}
  function() {}
  close() {}
}

// Always use data directory in the application root
const dataDir = path.join(process.cwd(), '.data');
const dbPath = path.join(dataDir, 'chrono.db');

// Ensure the database directory exists if we're not in build mode
if (!shouldSkipDb) {
  try {
    // This is synchronous to ensure the directory exists before we try to open the database
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
      console.log(`Created data directory: ${dataDir}`);
    }
    
    // Ensure we have the right permissions (especially in production)
    if (process.env.NODE_ENV === 'production') {
      // The async version will run in the background and not block startup
      ensureDatabaseAccess(dbPath).catch(err => {
        console.warn(`Warning: Could not set database permissions: ${err}`);
      });
    }
  } catch (err) {
    console.warn(`Warning: Error preparing database directory: ${err}`);
  }
}

function initDatabase() {
  if (shouldSkipDb) {
    console.log('Skipping database initialization during build...');
    return new MockDatabase() as unknown as DatabaseType;
  }

  try {
    // Attempt to open the database with better error handling
    console.log(`Opening database at: ${dbPath}`);
    const db = new Database(dbPath, {
      verbose: process.env.DEBUG === 'true' ? console.log : undefined,
    });

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

    console.log('Database initialized successfully');
    return db;
  } catch (error) {
    console.error(`Failed to initialize database: ${error}`);
    console.warn('Falling back to mock database to prevent application crash');
    return new MockDatabase() as unknown as DatabaseType;
  }
}

export const db = initDatabase();

// Create database schema if we're not in build mode
if (!shouldSkipDb) {
  try {
    console.log('Initializing database schema...');
    
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
        tags TEXT,
        subtasks TEXT,
        timeLogs TEXT,
        notes TEXT,
        createdAt TEXT DEFAULT (STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
        updatedAt TEXT DEFAULT (STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
        FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
      );
    `;
    db.exec(createTasksTable);

    // Add userId column to tasks table if it doesn't exist (for existing databases)
    try {
      const existingColumns = safeQueryAll<{ name: string }>(db, `PRAGMA table_info(tasks)`, [], []);
      if (!existingColumns.some(ec => ec.name === 'userId')) {
        console.log(`Adding 'userId' column to 'tasks' table.`);
        safeExecute(db, `ALTER TABLE tasks ADD COLUMN userId TEXT`);
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
    safeExecute(db, createTasksUpdatedAtTrigger);

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

    // Create trigger to update the updatedAt timestamp for users
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

    // Check if keyPrefix column exists in api_keys table and add it if needed
    try {
      const apiKeysColumns = safeQueryAll<{ name: string }>(db, `PRAGMA table_info(api_keys)`, [], []);
      
      if (!apiKeysColumns.some(col => col.name === 'keyPrefix')) {
        console.log(`Adding 'keyPrefix' column to 'api_keys' table.`);
        safeExecute(db, `ALTER TABLE api_keys ADD COLUMN keyPrefix TEXT`);
      }
      
      if (!apiKeysColumns.some(col => col.name === 'last4')) {
        console.log(`Adding 'last4' column to 'api_keys' table.`);
        safeExecute(db, `ALTER TABLE api_keys ADD COLUMN last4 TEXT`);
      }
    } catch (error) {
      console.warn(`Could not check/add columns to api_keys table:`, error);
    }

    // Create sessions table
    const createSessionsTable = `
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        userId TEXT NOT NULL,
        token TEXT NOT NULL UNIQUE,
        expiresAt TEXT NOT NULL,
        createdAt TEXT DEFAULT (STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now')),
        ipAddress TEXT,
        userAgent TEXT,
        lastActive TEXT DEFAULT (STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now')),
        FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
      );

      -- Create index on token for fast lookups during validation
      CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
      -- Create index on userId for fast session listing
      CREATE INDEX IF NOT EXISTS idx_sessions_userId ON sessions(userId);
      -- Create index on expiresAt for cleaning up expired sessions
      CREATE INDEX IF NOT EXISTS idx_sessions_expiresAt ON sessions(expiresAt);
    `;
    db.exec(createSessionsTable);

    // Create password_reset_tokens table
    const createPasswordResetTokensTable = `
      CREATE TABLE IF NOT EXISTS password_reset_tokens (
        id TEXT PRIMARY KEY,
        userId TEXT NOT NULL,
        token TEXT NOT NULL UNIQUE,
        expiresAt TEXT NOT NULL,
        createdAt TEXT DEFAULT (STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now')),
        used INTEGER DEFAULT 0,
        FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
      );

      -- Create index on token for fast lookups
      CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_token ON password_reset_tokens(token);
      -- Create index on userId for fast token listing
      CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_userId ON password_reset_tokens(userId);
    `;
    db.exec(createPasswordResetTokensTable);

    // Create user_invitations table
    const createUserInvitationsTable = `
      CREATE TABLE IF NOT EXISTS user_invitations (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL,
        token TEXT NOT NULL UNIQUE,
        role TEXT NOT NULL DEFAULT 'Viewer',
        invitedBy TEXT NOT NULL,
        expiresAt TEXT NOT NULL,
        createdAt TEXT DEFAULT (STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now')),
        acceptedAt TEXT,
        FOREIGN KEY (invitedBy) REFERENCES users(id) ON DELETE CASCADE
      );

      -- Create index on token for fast lookups
      CREATE INDEX IF NOT EXISTS idx_user_invitations_token ON user_invitations(token);
      -- Create index on email for checking duplicates
      CREATE INDEX IF NOT EXISTS idx_user_invitations_email ON user_invitations(email);
    `;
    db.exec(createUserInvitationsTable);

    // Create system_settings table
    const createSystemSettingsTable = `
      CREATE TABLE IF NOT EXISTS system_settings (
        id TEXT PRIMARY KEY,
        key TEXT NOT NULL UNIQUE,
        value TEXT NOT NULL,
        description TEXT,
        updatedAt TEXT DEFAULT (STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now')),
        updatedBy TEXT,
        FOREIGN KEY (updatedBy) REFERENCES users(id) ON DELETE SET NULL
      );

      -- Create index on key for fast lookups
      CREATE INDEX IF NOT EXISTS idx_system_settings_key ON system_settings(key);
    `;
    db.exec(createSystemSettingsTable);

    // Create audit_logs table
    const createAuditLogsTable = `
      CREATE TABLE IF NOT EXISTS audit_logs (
        id TEXT PRIMARY KEY,
        userId TEXT,
        action TEXT NOT NULL,
        resourceType TEXT NOT NULL,
        resourceId TEXT,
        details TEXT, -- JSON string with additional details
        timestamp TEXT DEFAULT (STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now')),
        ipAddress TEXT,
        userAgent TEXT,
        FOREIGN KEY (userId) REFERENCES users(id) ON DELETE SET NULL
      );

      -- Create index on userId for fast filtering
      CREATE INDEX IF NOT EXISTS idx_audit_logs_userId ON audit_logs(userId);
      -- Create index on resourceType and resourceId for fast filtering
      CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON audit_logs(resourceType, resourceId);
      -- Create index on timestamp for chronological querying
      CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp);
    `;
    db.exec(createAuditLogsTable);
    
    console.log('Database schema initialization complete');
  } catch (error) {
    console.error('Error initializing database schema:', error);
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

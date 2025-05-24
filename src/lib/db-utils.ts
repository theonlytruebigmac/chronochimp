// This file provides robust database initialization and error handling
import path from 'path';
import fs from 'fs';
import { exec as execCallback } from 'child_process';
import { promisify } from 'util';
import type { Database as DatabaseType } from 'better-sqlite3';

const exec = promisify(execCallback);

/**
 * Ensure proper database file permissions and access with enhanced error recovery
 */
export async function ensureDatabaseAccess(dbPath: string): Promise<void> {
  try {
    // Check if file exists, create if it doesn't
    if (!fs.existsSync(dbPath)) {
      console.log(`Database file doesn't exist, creating: ${dbPath}`);
      
      // Ensure directory exists with proper permissions
      const dbDir = path.dirname(dbPath);
      if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true, mode: 0o755 });
        console.log(`Created database directory: ${dbDir}`);
      }
      
      // Create empty file with proper permissions
      fs.writeFileSync(dbPath, '', { mode: 0o644 });
      console.log(`Created empty database file: ${dbPath}`);
    }
    
    const stats = fs.statSync(dbPath);
    const mode = stats.mode & 0o777;
    
    // Ensure proper permissions
    try {
      // Set directory permissions to be traversable but restrictive
      fs.chmodSync(path.dirname(dbPath), 0o755);
      
      // Set database file to be readable/writable by owner and group, readable by others
      if (mode !== 0o644) {
        fs.chmodSync(dbPath, 0o644);
        console.log(`Updated database file permissions to 644`);
      }
      
      // In production, ensure proper ownership
      if (process.env.NODE_ENV === 'production') {
        try {
          // Try to set ownership to the application user
          await exec(`chown -R nextjs:nodejs ${path.dirname(dbPath)} || true`);
          await exec(`chown nextjs:nodejs ${dbPath} || true`);
          console.log(`Set proper ownership on database files`);
        } catch (e) {
          // Log but continue - we might still have write access
          console.warn(`Could not change file ownership: ${e}`);
        }
      }
    } catch (e) {
      console.warn(`Could not set optimal permissions: ${e}`);
    }
    
    // Verify we have proper access
    try {
      // Test file access
      const testFile = path.join(path.dirname(dbPath), '.test');
      fs.writeFileSync(testFile, '');
      fs.unlinkSync(testFile);
    } catch (e) {
      throw new Error(`Database directory is not writable: ${e}`);
    }
    
    console.log(`Database access verified for: ${dbPath} (mode: ${mode.toString(8)})`);
  } catch (error) {
    console.error(`Fatal error ensuring database access: ${error}`);
    throw new Error(`Database initialization failed: ${error}`);
  }
}

/**
 * Execute a database operation with enhanced recovery and retry logic
 */
export function runWithRecovery<T>(
  operation: () => T,
  config: {
    maxRetries?: number;
    delayMs?: number;
    recoveryFn?: () => T | null;
    errorMessage?: string;
  } = {}
): Promise<T> {
  const {
    maxRetries = 3,
    delayMs = 1000,
    recoveryFn,
    errorMessage = 'Database operation failed'
  } = config;

  return new Promise(async (resolve, reject) => {
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const result = operation();
        resolve(result);
        return;
      } catch (error) {
        lastError = error as Error;
        console.warn(`${errorMessage} (attempt ${attempt}/${maxRetries}):`, error);
        
        if (attempt === maxRetries && recoveryFn) {
          try {
            const recovered = recoveryFn();
            if (recovered !== null) {
              resolve(recovered);
              return;
            }
          } catch (recoveryError) {
            console.error('Recovery attempt failed:', recoveryError);
          }
        }
        
        if (attempt < maxRetries) {
          await new Promise(res => setTimeout(res, delayMs));
        }
      }
    }
    
    reject(lastError);
  });
}

// Helper for safely running database queries with proper error handling
export function safeQuery<T>(
  db: DatabaseType, 
  sql: string, 
  params: any[] = [], 
  defaultValue: T | null = null
): T | null {
  try {
    const stmt = db.prepare(sql);
    return stmt.get(...params) as T || defaultValue;
  } catch (error) {
    console.error(`Query failed - SQL: ${sql}, Params: ${JSON.stringify(params)}`, error);
    return defaultValue;
  }
}

// Helper for safely running database queries that return multiple rows
export function safeQueryAll<T>(
  db: DatabaseType, 
  sql: string, 
  params: any[] = [], 
  defaultValue: T[] = []
): T[] {
  try {
    const stmt = db.prepare(sql);
    return stmt.all(...params) as T[] || defaultValue;
  } catch (error) {
    console.error(`Query failed - SQL: ${sql}, Params: ${JSON.stringify(params)}`, error);
    return defaultValue;
  }
}

// Helper for safely running database queries that modify data
export function safeExecute(
  db: DatabaseType, 
  sql: string, 
  params: any[] = []
): { changes: number, lastInsertRowid: number | null } {
  try {
    const stmt = db.prepare(sql);
    const result = stmt.run(...params);
    return { 
      changes: result.changes, 
      lastInsertRowid: result.lastInsertRowid ? Number(result.lastInsertRowid) : null 
    };
  } catch (error) {
    console.error(`Execute failed - SQL: ${sql}, Params: ${JSON.stringify(params)}`, error);
    return { changes: 0, lastInsertRowid: null };
  }
}

// Helper for safely executing multiple statements in a transaction
export function safeTransaction<T>(
  db: DatabaseType, 
  operation: (db: DatabaseType) => T
): T | null {
  try {
    let result: T;
    db.transaction(() => {
      result = operation(db);
    })();
    return result!;
  } catch (error) {
    console.error(`Transaction failed:`, error);
    return null;
  }
}

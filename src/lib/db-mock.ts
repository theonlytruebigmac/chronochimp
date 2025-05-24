// This is a simplified version of db.ts that avoids database operations during build
// It exposes the same API as the original db.ts but uses mock implementations
// during the build process

import type { Database as DatabaseType } from 'better-sqlite3';

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

// Create a mock database
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

// Export a mock database instance
export const db = new MockDatabase() as unknown as DatabaseType;

// Helper for safe database operations with proper cleanup
export function withDb<T>(operation: (db: DatabaseType) => T): T {
  try {
    return operation(db);
  } catch (error) {
    console.error('Database operation failed:', error);
    throw error;
  }
}

import { NextResponse, NextRequest } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { getAuthUserId } from '@/lib/auth';

// This endpoint needs Node.js runtime for database operations
export const runtime = 'nodejs';

export interface ApiKey {
  id: string;
  name: string;
  hashedKey: string;
  keyPrefix: string; // First few characters of the key
  last4: string;
  fullKey?: string; // Only for immediate display after creation
  createdAt: string;
  expiresAt?: string | null; // Allow null
  lastUsedAt?: string | null; // Allow null
  userId?: string;
}

const CreateApiKeySchema = z.object({
  name: z.string().min(1, { message: "API Key name cannot be empty." }),
  expiresInDays: z.number().int().positive().optional().nullable(),
});

// Generate a UUID using Web Crypto API
function generateUUID(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  array[6] = (array[6] & 0x0f) | 0x40; // version 4
  array[8] = (array[8] & 0x3f) | 0x80; // variant
  
  // Convert to hex string with dashes
  const hex = Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
}

// Hash API key using Web Crypto API
async function hashAPIKey(key: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function GET(request: NextRequest) {
  const userId = await getAuthUserId(request);
  
  if (!userId) {
    const authHeader = request.headers.get('Authorization');
    const xUserId = request.headers.get('X-User-Id');
    
    console.debug("Auth failure in /api/me/api_keys:", {
      hasAuthHeader: !!authHeader,
      headerUserId: xUserId
    });
    
    return NextResponse.json(
      { 
        error: 'Unauthorized',
        details: 'This endpoint requires authentication. You can authenticate using either:\n' +
                '1. Session token cookie (for browser requests)\n' +
                '2. API key in Authorization header (for API requests, format: "Bearer YOUR_API_KEY")'
      },
      { 
        status: 401,
        headers: {
          'Content-Type': 'application/json',
          'WWW-Authenticate': 'Bearer realm="ChronoChimp API"'
        }
      }
    );
  }

  try {
    // Fetch API keys directly from database
    const stmt = db.prepare(`
      SELECT id, name, hashedKey, last4, createdAt, expiresAt, lastUsedAt
      FROM api_keys 
      WHERE userId = ? AND revoked = 0
      ORDER BY createdAt DESC
    `);
    
    const apiKeys = stmt.all(userId) as ApiKey[];
    return NextResponse.json(apiKeys);
  } catch (error) {
    console.error('Failed to fetch API keys:', error);
    return NextResponse.json({ error: 'Failed to fetch API keys' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const userId = await getAuthUserId(request);
  
  if (!userId) {
    const authHeader = request.headers.get('Authorization');
    const xUserId = request.headers.get('X-User-Id');
    
    console.debug("Auth failure in /api/me/api_keys (POST):", {
      hasAuthHeader: !!authHeader,
      headerUserId: xUserId
    });
    
    return NextResponse.json(
      { 
        error: 'Unauthorized',
        details: 'This endpoint requires authentication. You can authenticate using either:\n' +
                '1. Session token cookie (for browser requests)\n' +
                '2. API key in Authorization header (for API requests, format: "Bearer YOUR_API_KEY")'
      },
      { 
        status: 401,
        headers: {
          'Content-Type': 'application/json',
          'WWW-Authenticate': 'Bearer realm="ChronoChimp API"'
        }
      }
    );
  }

  try {
    const body = await request.json();
    const validationResult = CreateApiKeySchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json({ error: 'Invalid input.', details: validationResult.error.flatten().fieldErrors }, { status: 400 });
    }
    
    const { name, expiresInDays } = validationResult.data;

    const newApiKeyId = generateUUID();
    const now = new Date();
    const createdAtIso = now.toISOString();
    
    let expiresAtIso: string | null = null;
    if (expiresInDays) {
      const expiresAtDate = new Date(now);
      expiresAtDate.setDate(expiresAtDate.getDate() + expiresInDays);
      expiresAtIso = expiresAtDate.toISOString();
    }

    // Generate a random API key using Web Crypto API
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    const keyHash = Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
    const fullKey = keyHash;
    const keyPrefix = keyHash.slice(0, 8);
    const last4 = keyHash.slice(-4);
    
    // Hash the API key for storage
    const hashedKey = await hashAPIKey(fullKey);

    // Store the API key in the database
    const stmt = db.prepare(`
      INSERT INTO api_keys (id, userId, name, hashedKey, keyPrefix, last4, createdAt, expiresAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      newApiKeyId,
      userId,
      name.trim(),
      hashedKey,
      keyPrefix,
      last4,
      createdAtIso,
      expiresAtIso
    );

    const newApiKeyResponse: ApiKey = {
      id: newApiKeyId,
      name: name.trim(),
      hashedKey,
      keyPrefix,
      last4,
      fullKey, // Only returned once during creation
      createdAt: createdAtIso,
      expiresAt: expiresAtIso,
    };
    
    return NextResponse.json(newApiKeyResponse, { status: 201 });
  } catch (error) {
    console.error('Failed to create API key:', error);
    return NextResponse.json({ error: 'Failed to create API key' }, { status: 500 });
  }
}

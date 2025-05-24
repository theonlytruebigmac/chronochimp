import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import type { UserRole } from '@/app/admin/page';
import { z } from 'zod';

const SALT_ROUNDS = 10;

const RegisterInputSchema = z.object({
  name: z.string().min(1, { message: "Name is required." }),
  email: z.string().email({ message: "Invalid email address." }),
  password: z.string().min(6, { message: "Password must be at least 6 characters long." }),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    const validationResult = RegisterInputSchema.safeParse(body);

    if (!validationResult.success) {
      const errorMessages = validationResult.error.errors.map(e => e.message).join(', ');
      return NextResponse.json({ error: errorMessages }, { status: 400 });
    }

    const { name, email, password } = validationResult.data;

    // Check if user already exists
    const existingUser = db.prepare('SELECT id FROM users WHERE email = ?').get(email);

    if (existingUser) {
      return NextResponse.json({ error: 'Email address is already in use.' }, { status: 409 });
    }

    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
    const newUserId = randomUUID();
    const now = new Date().toISOString();

    // First ensure users table exists
    const createUsersTable = `
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'Viewer',
        avatarUrl TEXT,
        isTwoFactorEnabled BOOLEAN DEFAULT FALSE,
        twoFactorSecret TEXT,
        emailNotificationsEnabled BOOLEAN DEFAULT TRUE,
        inAppNotificationsEnabled BOOLEAN DEFAULT TRUE,
        smtpHost TEXT,
        smtpPort INTEGER,
        smtpEncryption TEXT,
        smtpUsername TEXT,
        smtpPassword TEXT,
        smtpSendFrom TEXT,
        joinedDate TEXT DEFAULT (STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now')),
        updatedAt TEXT DEFAULT (STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now'))
      );
    `;
    db.exec(createUsersTable);

    // Determine role with better error handling
    let role: UserRole = 'Viewer'; // Initialize with a default value
    
    // Run this in a transaction to ensure consistency
    db.transaction(() => {
      // Query to check if any users exist (run before inserting the new user)
      const existingUsersStmt = db.prepare('SELECT COUNT(*) as count FROM users');
      const result = existingUsersStmt.get() as { count: number };
      const hasExistingUsers = result && result.count > 0;
      
      // Log for debugging
      console.log(`Checking existing users. Count: ${result?.count}`);
      
      // Set role based on whether any users exist
      role = hasExistingUsers ? 'Viewer' : 'Admin';
      console.log(`Determined role for new user: ${role} (existing users: ${hasExistingUsers})`);
    })();

    // Insert the new user
    const insertStmt = db.prepare(`
      INSERT INTO users (id, name, email, password, role, joinedDate, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    
    try {
      insertStmt.run(newUserId, name, email, hashedPassword, role, now, now);

      // Do not return password or sensitive data in the response
      const newUserResponse = {
        id: newUserId,
        name,
        email,
        role: role,
        joinedDate: now,
      };
      
      console.log(`User registered successfully: ${email} with role ${role}`);
      return NextResponse.json(newUserResponse, { status: 201 });
    } catch (dbError: any) {
      console.error('Registration failed:', dbError);
      if (dbError.code === 'SQLITE_CONSTRAINT_UNIQUE' && dbError.message.includes('users.email')) {
        return NextResponse.json({ error: 'Email address already in use.' }, { status: 409 });
      }
      return NextResponse.json({ error: 'Failed to register user. Please try again later.' }, { status: 500 });
    }
  } catch (error: any) {
    console.error('Registration failed:', error);
    return NextResponse.json({ error: error.message || 'Registration failed.' }, { status: 500 });
  }
}


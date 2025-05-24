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

    // Determine role with better error handling
    let role: UserRole = 'Viewer'; // Default role
    try {
      const stmt = db.prepare('SELECT COUNT(*) as count FROM users');
      const result = stmt.get();
      const userCount = result ? (result as { count: number }).count : 0;
      role = userCount === 0 ? 'Admin' : 'Viewer';
      console.log(`Determined role for new user: ${role} (user count: ${userCount})`);
    } catch (error) {
      console.error('Error getting user count:', error);
      // If we can't get a count, fall back to checking if any users exist
      try {
        const stmt = db.prepare('SELECT 1 FROM users LIMIT 1');
        const anyUser = stmt.get();
        role = anyUser ? 'Viewer' : 'Admin';
        console.log(`Fallback role determination: ${role}`);
      } catch (innerError) {
        console.error('Error checking for any users:', innerError);
        role = 'Admin'; // If all else fails, make the user an Admin since we can't verify
        console.log('Fallback to Admin role due to database error');
      }
    }

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


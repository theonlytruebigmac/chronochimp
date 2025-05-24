import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { safeQuery, safeQueryAll, safeExecute } from '@/lib/db';
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

    // Check if user already exists using safe query
    const existingUser = safeQuery(db, 'SELECT id FROM users WHERE email = ?', [email]);

    if (existingUser) {
      return NextResponse.json({ error: 'Email address is already in use.' }, { status: 409 });
    }

    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
    const newUserId = randomUUID();
    const now = new Date().toISOString();

    // Determine role with better error handling
    let role: UserRole = 'Viewer'; // Default role
    try {
      // Use safe query for user count
      const result = safeQuery<{ count: number }>(db, 'SELECT COUNT(*) as count FROM users', [], { count: 0 });
      role = result?.count === 0 ? 'Admin' : 'Viewer';
      console.log(`Determined role for new user: ${role} (user count: ${result?.count})`);
    } catch (error) {
      console.error('Error getting user count:', error);
      // If we can't get a count, fall back to checking if any users exist
      try {
        const anyUser = safeQuery(db, 'SELECT 1 FROM users LIMIT 1');
        role = anyUser ? 'Viewer' : 'Admin';
        console.log(`Fallback role determination: ${role}`);
      } catch (innerError) {
        console.error('Error checking for any users:', innerError);
        // Keep the default 'Viewer' role
      }
    }

    // Use the safer execute function for inserting the new user
    const result = safeExecute(db, `
      INSERT INTO users (id, name, email, password, role, joinedDate, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [newUserId, name, email, hashedPassword, role, now, now]);

    if (result.changes === 0) {
      console.error('Failed to insert new user - no rows affected');
      return NextResponse.json({ error: 'Failed to register user. Please try again later.' }, { status: 500 });
    }

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
  } catch (error: any) {
    console.error('Registration failed:', error);
    // Check for specific SQLite unique constraint error (though the check above should catch it)
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE' && error.message.includes('users.email')) {
        return NextResponse.json({ error: 'Email address already in use.' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Failed to register user. Please try again later.' }, { status: 500 });
  }
}


import { NextResponse, NextRequest } from 'next/server';
import { db } from '@/lib/db';
import bcrypt from 'bcrypt';
import { SignJWT } from 'jose';

// This endpoint needs server runtime for bcrypt and database access
export const runtime = 'nodejs';
import { cookies } from 'next/headers';
import type { UserRole, MockUser as User } from '@/app/admin/page';
import { getSecureCookieSettings } from '@/lib/auth-helpers';

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRATION = '24h'; // Extended to 24 hours

// User type from DB might include isTwoFactorEnabled and twoFactorSecret
type UserFromDb = User & {
  password?: string;
  isTwoFactorEnabled?: boolean;
  twoFactorSecret?: string | null;
};

export async function POST(request: Request) {
  try {
    if (!JWT_SECRET) {
      console.error("CRITICAL: JWT_SECRET is not defined in environment variables. Authentication cannot proceed securely.");
      return NextResponse.json({ error: 'Server configuration error.' }, { status: 500 });
    }

    let body;
    try {
      body = await request.json();
    } catch (parseError) {
      console.error('Login request JSON parsing failed:', {
        error: parseError,
        contentType: request.headers.get('Content-Type'),
        method: request.method,
      });
      return NextResponse.json({ error: 'Invalid request format. Expected JSON.' }, { status: 400 });
    }

    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required.' }, { status: 400 });
    }

    let user: UserFromDb | undefined;
    try {
      const stmt = db.prepare('SELECT id, name, email, password, role, avatarUrl, joinedDate, isTwoFactorEnabled, twoFactorSecret FROM users WHERE email = ?');
      user = stmt.get(email) as UserFromDb | undefined;
      
      if (!user) {
        console.warn(`Login attempt failed: No user found with email ${email}`);
        return NextResponse.json({ error: 'Invalid email or password.' }, { status: 401 });
      }
      
      if (!user.password) {
        console.error(`User found but password is missing for email ${email}`);
        return NextResponse.json({ error: 'Account error. Please contact support.' }, { status: 500 });
      }
    } catch (dbError) {
      console.error('Database error during login:', dbError);
      return NextResponse.json({ error: 'Server error during authentication.' }, { status: 500 });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return NextResponse.json({ error: 'Invalid email or password.' }, { status: 401 });
    }

    // Check for 2FA
    if (user.isTwoFactorEnabled && user.twoFactorSecret) {
      return NextResponse.json({
        twoFactorRequired: true,
        userId: user.id,
        message: "Two-Factor Authentication required."
      }, { status: 200 });
    }

    // Convert the JWT_SECRET string to a Uint8Array before using it
    const secretKey = new TextEncoder().encode(JWT_SECRET);

    // Make sure the JWT includes the user's role, using capital-case format for Admin role
    const token = await new SignJWT({
      userId: user.id,
      name: user.name,
      email: user.email,
      role: user.role // Ensure role is properly formatted (should be "Admin" not "admin")
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime(JWT_EXPIRATION || '1h')
      .sign(secretKey);

    // When deploying behind a reverse proxy like Traefik that handles SSL:
    // 1. Ensure `NODE_ENV` is set to `production` in your Next.js environment.
    //    This makes `secure: true` for the cookie.
    // 2. Ensure your reverse proxy (Traefik) sends the `X-Forwarded-Proto: https` header
    //    so Next.js knows the original connection was secure.
    
    // Get cookie security settings based on environment
    const cookieSettings = getSecureCookieSettings();
    
    (await cookies()).set('session_token', token, {
      httpOnly: true,
      secure: cookieSettings.secure,
      maxAge: 60 * 60 * 24, // 24 hours in seconds
      path: '/',
      sameSite: cookieSettings.sameSite,
    });

    return NextResponse.json({ user, message: "Login successful" });

  } catch (error) {
    console.error('Login failed:', error);
    return NextResponse.json({ error: 'An unexpected error occurred during login. Please try again.' }, { status: 500 });
  }
}

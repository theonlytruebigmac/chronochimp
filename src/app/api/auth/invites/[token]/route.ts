import { NextResponse, NextRequest } from 'next/server';
import { db } from '@/lib/db';
import bcrypt from 'bcrypt';
import { z } from 'zod';

type RouteParams = {
  token: string;
};

export async function GET(request: NextRequest, { params }: { params: RouteParams }) {
  try {
    const { token: rawToken } = params;

    if (!rawToken || typeof rawToken !== 'string') {
      return NextResponse.json({ error: 'Invite token is required.' }, { status: 400 });
    }

    // We need to find the invite by hashing the rawToken and comparing it to stored hashed tokens.
    // This is not the most efficient way if there are many tokens, but it's secure.
    // A more optimized approach might involve a secondary lookup key if performance becomes an issue.
    const allInvitesStmt = db.prepare('SELECT id, email, role, token as hashedTokenInDb, expiresAt, status FROM user_invites WHERE status = ?');
    const pendingInvites = allInvitesStmt.all('pending') as { id: string; email: string; role: string; hashedTokenInDb: string; expiresAt: string; status: string }[];

    let foundInvite = null;
    for (const invite of pendingInvites) {
      const isMatch = await bcrypt.compare(rawToken, invite.hashedTokenInDb);
      if (isMatch) {
        foundInvite = invite;
        break;
      }
    }

    if (!foundInvite) {
      return NextResponse.json({ error: 'Invite not found or expired.' }, { status: 404 });
    }

    // Check if the invite has expired
    const expiryDate = new Date(foundInvite.expiresAt);
    if (expiryDate < new Date()) {
      return NextResponse.json({ error: 'Invite has expired.' }, { status: 410 });
    }

    // Return relevant invite details (avoiding sensitive data)
    return NextResponse.json({
      email: foundInvite.email,
      role: foundInvite.role,
      expiresAt: foundInvite.expiresAt
    });

  } catch (error) {
    console.error('Failed to validate invite token:', error);
    return NextResponse.json({ error: 'Failed to validate invite token.' }, { status: 500 });
  }
}

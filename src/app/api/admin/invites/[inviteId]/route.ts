import { NextResponse, NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUserId, verify } from '@/lib/auth';

type RouteParams = {
  inviteId: string;
};

export async function DELETE(request: NextRequest, { params }: { params: RouteParams }) {
  const authUser = await verify(request);

  if (!authUser) {
    return NextResponse.json(
      { 
        error: 'Unauthorized',
        details: 'This endpoint requires authentication'
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
  
  // Check if user has admin role
  if (authUser.role !== 'Admin') {
    return NextResponse.json(
      { 
        error: 'Forbidden',
        details: 'This endpoint requires admin privileges'
      },
      { 
        status: 403,
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );
  }

  try {
    const inviteId = params.inviteId;
    
    // Check if the invite exists
    const checkStmt = db.prepare('SELECT id FROM user_invites WHERE id = ?');
    const existingInvite = checkStmt.get(inviteId);
    
    if (!existingInvite) {
      return NextResponse.json({ error: 'Invite not found' }, { status: 404 });
    }
    
    // Delete the invite
    const deleteStmt = db.prepare('DELETE FROM user_invites WHERE id = ?');
    deleteStmt.run(inviteId);
    
    return NextResponse.json({ message: 'Invite deleted successfully' });
  } catch (error) {
    console.error('Failed to delete invite:', error);
    return NextResponse.json({ error: 'Failed to delete invite' }, { status: 500 });
  }
}

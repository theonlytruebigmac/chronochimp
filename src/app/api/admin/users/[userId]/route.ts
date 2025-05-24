import { NextResponse, NextRequest } from 'next/server';
import { db } from '@/lib/db'; // Fixed import to use named export
import type { MockUser as User } from '@/app/admin/page'; // Fixed to use the correct type name
import { getAuthUserId, verify } from '@/lib/auth';

// Helper function to check if an email exists
const isEmailInUse = (email: string, excludeUserId?: string): boolean => {
  const query = excludeUserId
    ? 'SELECT COUNT(*) as count FROM users WHERE email = ? AND id != ?'
    : 'SELECT COUNT(*) as count FROM users WHERE email = ?';
    
  const params = excludeUserId ? [email, excludeUserId] : [email];
  const result = db.prepare(query).get(...params) as { count: number };
  
  return result.count > 0;
};

type RouteParams = {
  userId: string;
};

export async function GET(
  request: NextRequest,
  { params }: { params: RouteParams }
) {
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
    // Access userId through params
    const { userId } = params;
    
    const stmt = db.prepare('SELECT id, name, email, role, joinedDate, avatarUrl, isTwoFactorEnabled FROM users WHERE id = ?');
    let user = stmt.get(userId) as User | undefined;
    
    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    // Ensure boolean fields are correctly represented
    if (user) {
        user.isTwoFactorEnabled = !!user.isTwoFactorEnabled;
    }
    return NextResponse.json(user);
  } catch (error) {
    console.error("Error fetching user:", error);
    return NextResponse.json(
      { error: "Failed to fetch user" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: RouteParams }
) {
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
    const { userId } = params;
    const data = await request.json();
    
    // Check if user exists
    const userCheck = db.prepare('SELECT id FROM users WHERE id = ?').get(userId);
    if (!userCheck) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }
    
    // Check if email is already in use by another user
    if (data.email && isEmailInUse(data.email, userId)) {
      return NextResponse.json(
        { error: "Email address already in use" },
        { status: 400 }
      );
    }
    
    // Prepare update data
    const updateFields = [];
    const updateValues = [];
    
    // Handle each field that can be updated
    if (data.name !== undefined) {
      updateFields.push('name = ?');
      updateValues.push(data.name);
    }
    
    if (data.email !== undefined) {
      updateFields.push('email = ?');
      updateValues.push(data.email);
    }
    
    if (data.role !== undefined) {
      updateFields.push('role = ?');
      updateValues.push(data.role);
    }
    
    if (data.avatarUrl !== undefined) {
      updateFields.push('avatarUrl = ?');
      updateValues.push(data.avatarUrl);
    }
    
    if (data.isTwoFactorEnabled !== undefined) {
      updateFields.push('isTwoFactorEnabled = ?');
      updateValues.push(data.isTwoFactorEnabled ? 1 : 0);
    }
    
    if (data.password !== undefined) {
      // In a real app, hash the password before storing
      updateFields.push('password = ?');
      updateValues.push(data.password);
    }
    
    // If no fields to update, return early
    if (updateFields.length === 0) {
      return NextResponse.json(
        { error: "No fields to update" },
        { status: 400 }
      );
    }
    
    // Add user ID to the end of values for the WHERE clause
    updateValues.push(userId);
    
    // Construct and execute update query
    const updateQuery = `UPDATE users SET ${updateFields.join(', ')} WHERE id = ?`;
    const result = db.prepare(updateQuery).run(...updateValues);
    
    if (result.changes === 0) {
      return NextResponse.json(
        { error: "Failed to update user" },
        { status: 500 }
      );
    }
    
    // Get the updated user data to return
    const updatedUser = db.prepare('SELECT id, name, email, role, joinedDate, avatarUrl, isTwoFactorEnabled FROM users WHERE id = ?').get(userId);
    
    return NextResponse.json(updatedUser);
  } catch (error) {
    console.error("Error updating user:", error);
    return NextResponse.json(
      { error: "Failed to update user" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: RouteParams }
) {
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
    const { userId } = params;
    
    // Check if user exists
    const userCheck = db.prepare('SELECT id FROM users WHERE id = ?').get(userId);
    if (!userCheck) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }
    
    // Execute delete query
    const result = db.prepare('DELETE FROM users WHERE id = ?').run(userId);
    
    if (result.changes === 0) {
      return NextResponse.json(
        { error: "Failed to delete user" },
        { status: 500 }
      );
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting user:", error);
    return NextResponse.json(
      { error: "Failed to delete user" },
      { status: 500 }
    );
  }
}

import { NextResponse, NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUserId } from '@/lib/auth';

interface ApiResponse {
  message?: string;
  error?: string;
}

type RouteParams = {
  apiKeyId: string;
};

export async function DELETE(
  request: NextRequest,
  { params }: { params: RouteParams }
): Promise<NextResponse<ApiResponse>> {
  const userId = await getAuthUserId(request);

  if (!userId) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  try {
    const { apiKeyId } = params;

    // Delete the API key, but only if it belongs to this user
    const stmt = db.prepare('DELETE FROM api_keys WHERE id = ? AND userId = ?');
    const result = stmt.run(apiKeyId, userId);

    if (result.changes === 0) {
      return NextResponse.json(
        { error: 'API key not found or does not belong to user' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { message: 'API key deleted successfully' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Failed to delete API key:', error);
    return NextResponse.json(
      { error: 'Failed to delete API key' },
      { status: 500 }
    );
  }
}

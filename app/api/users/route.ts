import { NextResponse } from 'next/server';
import { pool } from '@/app/lib/db';
import { auth } from '@/auth';

export async function GET(request: Request) {
  try {
    const session = await auth();
    const role = (session?.user as any)?.role || '';

    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
    }
    if (role !== 'super_admin') {
      return NextResponse.json({ success: false, error: 'Not authorized' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';

    let query = `
      SELECT user_id, full_name, phone, email, role, is_active, created_at
      FROM users WHERE deleted_at IS NULL
    `;
    const params: any[] = [];
    if (search) {
      query += ` AND (full_name LIKE ? OR email LIKE ? OR phone LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }
    query += ` ORDER BY created_at DESC`;

    const [rows] = await pool.query(query, params);
    return NextResponse.json({ success: true, data: rows });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await auth();
    const role = (session?.user as any)?.role || '';
    const sessionUserId = (session?.user as any)?.id || null;

    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
    }
    if (role !== 'super_admin') {
      return NextResponse.json({ success: false, error: 'Not authorized' }, { status: 403 });
    }

    const { userId, role: newRole, isActive } = await request.json();

    if (!userId) {
      return NextResponse.json({ success: false, error: 'userId is required' }, { status: 400 });
    }

    // prevent a super_admin from demoting or deactivating their own account
    // (avoids accidentally locking everyone out of admin access)
    if (String(userId) === String(sessionUserId)) {
      if (newRole !== undefined && newRole !== 'super_admin') {
        return NextResponse.json({ success: false, error: 'You cannot change your own role' }, { status: 400 });
      }
      if (isActive === false || isActive === 0) {
        return NextResponse.json({ success: false, error: 'You cannot deactivate your own account' }, { status: 400 });
      }
    }

    const fields: string[] = [];
    const params: any[] = [];

    if (newRole !== undefined) { fields.push('role = ?'); params.push(newRole); }
    if (isActive !== undefined) { fields.push('is_active = ?'); params.push(isActive ? 1 : 0); }

    if (fields.length === 0) {
      return NextResponse.json({ success: false, error: 'No fields to update' }, { status: 400 });
    }
    params.push(userId);

    await pool.query(`UPDATE users SET ${fields.join(', ')} WHERE user_id = ?`, params);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
import { NextResponse } from 'next/server';
import { pool } from '@/app/lib/db';

export async function GET(request: Request) {
  try {
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
    const { userId, role, isActive } = await request.json();
    const fields: string[] = [];
    const params: any[] = [];

    if (role !== undefined) { fields.push('role = ?'); params.push(role); }
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
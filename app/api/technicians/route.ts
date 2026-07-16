import { pool } from '../../lib/db';
import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import bcrypt from 'bcryptjs';

export async function GET() {
  const session = await auth();
  const role = (session?.user as any)?.role || '';
  const sessionDealerId = (session?.user as any)?.dealer_id || null;

  if (!session?.user) {
    return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
  }
  if (role !== 'dealer' && role !== 'super_admin') {
    return NextResponse.json({ success: false, error: 'Not authorized' }, { status: 403 });
  }

  try {
    let query = `
      SELECT t.technician_id, t.dealer_id, t.is_active, t.created_at, u.full_name, u.phone, u.email, d.dealer_name
      FROM technicians t
      JOIN users u ON t.user_id = u.user_id
      JOIN dealers d ON t.dealer_id = d.dealer_id
      WHERE t.deleted_at IS NULL
    `;
    const params: any[] = [];

    if (role === 'dealer') {
      query += ` AND t.dealer_id = ?`;
      params.push(sessionDealerId || -1);
    }

    query += ` ORDER BY u.full_name ASC`;

    const [rows] = await pool.query(query, params);
    return NextResponse.json({ success: true, data: rows });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
export async function POST(req: Request) {
  const session = await auth();
  const role = (session?.user as any)?.role || '';
  const sessionDealerId = (session?.user as any)?.dealer_id || null;

  if (!session?.user) {
    return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
  }
  if (role !== 'dealer' && role !== 'super_admin') {
    return NextResponse.json({ success: false, error: 'Not authorized' }, { status: 403 });
  }

  const conn = await pool.getConnection();
  try {
    const body = await req.json();
    const { full_name, phone, email, password, dealer_id: bodyDealerId } = body;

    if (!full_name || !phone || !password) {
      return NextResponse.json({ success: false, error: 'full_name, phone, and password are required' }, { status: 400 });
    }

    const dealer_id = role === 'dealer' ? sessionDealerId : bodyDealerId;
    if (!dealer_id) {
      return NextResponse.json({ success: false, error: 'dealer_id is required' }, { status: 400 });
    }

    await conn.beginTransaction();

    const password_hash = await bcrypt.hash(password, 10);

    const [userResult]: any = await conn.query(
      `INSERT INTO users (full_name, phone, email, password_hash, role, is_active, dealer_id)
       VALUES (?, ?, ?, ?, 'technician', 1, ?)`,
      [full_name, phone, email || null, password_hash, dealer_id]
    );

    const [techResult]: any = await conn.query(
      `INSERT INTO technicians (user_id, dealer_id, is_active) VALUES (?, ?, 1)`,
      [userResult.insertId, dealer_id]
    );

    await conn.commit();

    return NextResponse.json({
      success: true,
      data: { technician_id: techResult.insertId, user_id: userResult.insertId },
    });
  } catch (error: any) {
    await conn.rollback();
    if (error.code === 'ER_DUP_ENTRY') {
      return NextResponse.json({ success: false, error: 'Phone or email already in use' }, { status: 409 });
    }
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  } finally {
    conn.release();
  }
}
import { pool } from '@/app/lib/db';
import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import bcrypt from 'bcryptjs';

// GET: current logged-in user's full profile, role-aware
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
  }

  const userId = (session.user as any).id;
  const role = (session.user as any).role;

  try {
    const [userRows]: any = await pool.query(
      'SELECT user_id, full_name, phone, email, role, created_at FROM users WHERE user_id = ?',
      [userId]
    );
    if (userRows.length === 0) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }
    const user = userRows[0];

    let extra: any = {};

    if (role === 'dealer') {
      const [rows]: any = await pool.query(
        `SELECT d.dealer_id, d.dealer_name, d.address, c.city_name
         FROM dealers d JOIN cities c ON d.city_id = c.city_id
         WHERE d.dealer_id = ?`,
        [(session.user as any).dealer_id]
      );
      extra = rows[0] || {};
    }

    if (role === 'technician') {
      const [rows]: any = await pool.query(
        `SELECT d.dealer_name FROM technicians t JOIN dealers d ON t.dealer_id = d.dealer_id WHERE t.user_id = ?`,
        [userId]
      );
      extra = rows[0] || {};
    }

    if (role === 'customer') {
      const [rows]: any = await pool.query(
        'SELECT address FROM customers WHERE phone = ?',
        [user.phone]
      );
      extra = rows[0] || {};
    }

    return NextResponse.json({ success: true, data: { ...user, ...extra } });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// PATCH: update own profile (name/phone/email, plus role-specific business fields)
export async function PATCH(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
  }

  const userId = (session.user as any).id;
  const role = (session.user as any).role;
  const body = await request.json();
  const { fullName, phone, email, dealerName, address } = body;

  try {
    await pool.query(
      `UPDATE users SET full_name = COALESCE(?, full_name), phone = COALESCE(?, phone), email = COALESCE(?, email) WHERE user_id = ?`,
      [fullName || null, phone || null, email || null, userId]
    );

    if (role === 'dealer' && (dealerName || address)) {
      const dealerId = (session.user as any).dealer_id;
      await pool.query(
        `UPDATE dealers SET dealer_name = COALESCE(?, dealer_name), address = COALESCE(?, address) WHERE dealer_id = ?`,
        [dealerName || null, address || null, dealerId]
      );
    }

    if (role === 'customer' && address) {
      await pool.query(`UPDATE customers SET address = ? WHERE phone = ?`, [address, phone || (session.user as any).phone]);
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
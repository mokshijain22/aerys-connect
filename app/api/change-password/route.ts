import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { auth } from '@/auth';
import { pool } from '@/app/lib/db';

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
    }

    const { currentPassword, newPassword } = await request.json();

    if (!currentPassword || !newPassword) {
      return NextResponse.json({ success: false, error: 'Current and new password are required' }, { status: 400 });
    }

    if (newPassword.length < 8) {
      return NextResponse.json({ success: false, error: 'New password must be at least 8 characters' }, { status: 400 });
    }

    const userId = (session.user as any).id;

    const [rows]: any = await pool.query(
      `SELECT password_hash FROM users WHERE user_id = ? AND deleted_at IS NULL`,
      [userId]
    );

    const user = rows[0];
    if (!user) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    const matches = await bcrypt.compare(currentPassword, user.password_hash);
    if (!matches) {
      return NextResponse.json({ success: false, error: 'Current password is incorrect' }, { status: 401 });
    }

    const newHash = await bcrypt.hash(newPassword, 10);

    await pool.query(
      `UPDATE users SET password_hash = ? WHERE user_id = ?`,
      [newHash, userId]
    );

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error changing password:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
import { pool } from '@/app/lib/db';
import { NextResponse } from 'next/server';
import { auth } from '@/auth';

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
  }
  const userId = (session.user as any).id;

  try {
    const [rows]: any = await pool.query(
      `SELECT notification_id, title, message, job_card_id, is_read, created_at
       FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 20`,
      [userId]
    );
    const [[unread]]: any = await pool.query(
      `SELECT COUNT(*) AS total FROM notifications WHERE user_id = ? AND is_read = 0`,
      [userId]
    );
    return NextResponse.json({ success: true, data: rows, unreadCount: unread.total });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
  }
  const userId = (session.user as any).id;
  const { notificationId, markAll } = await request.json();

  try {
    if (markAll) {
      await pool.query(`UPDATE notifications SET is_read = 1 WHERE user_id = ?`, [userId]);
    } else if (notificationId) {
      await pool.query(
        `UPDATE notifications SET is_read = 1 WHERE notification_id = ? AND user_id = ?`,
        [notificationId, userId]
      );
    }
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
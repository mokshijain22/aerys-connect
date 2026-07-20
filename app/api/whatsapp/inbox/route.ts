import { pool } from '@/app/lib/db';
import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { sendWhatsAppMessage } from '@/app/lib/whatsappSend';

// List conversations that need a human (dealer/support)
export async function GET() {
  const session = await auth();
  const role = (session?.user as any)?.role || '';
  if (role !== 'dealer' && role !== 'super_admin') {
    return NextResponse.json({ success: false, error: 'Not authorized' }, { status: 403 });
  }

  const [rows]: any = await pool.query(
    `SELECT conversation_id, phone, handoff_to_human, last_message_at
     FROM whatsapp_conversations WHERE handoff_to_human = 1
     ORDER BY last_message_at DESC`
  );
  return NextResponse.json({ success: true, data: rows });
}

// Fetch full message thread for one conversation, or send a reply
export async function POST(request: Request) {
  const session = await auth();
  const role = (session?.user as any)?.role || '';
  if (role !== 'dealer' && role !== 'super_admin') {
    return NextResponse.json({ success: false, error: 'Not authorized' }, { status: 403 });
  }

  const { conversationId, action, message } = await request.json();

  if (action === 'fetch_messages') {
    const [rows]: any = await pool.query(
      `SELECT direction, body, created_at FROM whatsapp_messages WHERE conversation_id = ? ORDER BY created_at ASC`,
      [conversationId]
    );
    return NextResponse.json({ success: true, data: rows });
  }

  if (action === 'reply') {
    const [[conv]]: any = await pool.query(
      `SELECT phone FROM whatsapp_conversations WHERE conversation_id = ?`, [conversationId]
    );
    if (!conv) return NextResponse.json({ success: false, error: 'Conversation not found' }, { status: 404 });

    await sendWhatsAppMessage(conv.phone, message);
    await pool.query(
      `INSERT INTO whatsapp_messages (conversation_id, direction, body) VALUES (?, 'outgoing', ?)`,
      [conversationId, message]
    );
    return NextResponse.json({ success: true });
  }

  if (action === 'close') {
    await pool.query(`UPDATE whatsapp_conversations SET handoff_to_human = 0 WHERE conversation_id = ?`, [conversationId]);
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ success: false, error: 'Unknown action' }, { status: 400 });
}
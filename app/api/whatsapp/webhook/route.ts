import { NextResponse } from 'next/server';
import { handleIncomingWhatsAppMessage } from '@/app/lib/whatsappBot';

// Meta calls this once, at setup time, to verify your webhook URL.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    return new Response(challenge, { status: 200 });
  }
  return new Response('Forbidden', { status: 403 });
}

// Meta sends every incoming message here.
export async function POST(request: Request) {
  try {
    const body = await request.json();

    const entry = body.entry?.[0];
    const change = entry?.changes?.[0];
    const message = change?.value?.messages?.[0];

    if (message && message.type === 'text') {
      const from = message.from; // phone number, e.g. "919876543210"
      const text = message.text.body;
      // don't await — respond to Meta immediately, process in background
      handleIncomingWhatsAppMessage(from, text).catch((err) => console.error('Bot error:', err));
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Webhook error:', error.message);
    return NextResponse.json({ success: false }, { status: 200 }); // always 200 so Meta doesn't retry endlessly
  }
}
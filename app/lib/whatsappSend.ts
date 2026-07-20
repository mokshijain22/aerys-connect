const GRAPH_API_URL = `https://graph.facebook.com/v20.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`;

export async function sendWhatsAppMessage(to: string, body: string) {
    console.log('Sending to:', to, 'via', GRAPH_API_URL, 'token len:', process.env.WHATSAPP_ACCESS_TOKEN?.length);

  try {
    const res = await fetch(GRAPH_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to,
        type: 'text',
        text: { body },
      }),
    });
    if (!res.ok) {
      const err = await res.text();
      console.error('WhatsApp send failed:', err);
    }
  } catch (err: any) {
    console.error('WhatsApp send error:', err.message);
  }
}
import { pool } from './db';
import { sendWhatsAppMessage } from './whatsappSend';

const MENU_TEXT = `Namaste! 👋 AERYS Service Connect mein aapka swagat hai.

Kripya ek option chuno (number bhejo):
1️⃣ Complaint / service request raise karein
2️⃣ Customer care se baat karein
3️⃣ Apni complaint ka status check karein

Kisi bhi waqt "menu" likh kar wapas is list par aa sakte hain.`;

async function getOrCreateConversation(phone: string) {
  const [[existing]]: any = await pool.query(
    'SELECT * FROM whatsapp_conversations WHERE phone = ?', [phone]
  );
  if (existing) return existing;

  await pool.query(
    'INSERT INTO whatsapp_conversations (phone, state) VALUES (?, ?)', [phone, 'menu']
  );
  const [[created]]: any = await pool.query(
    'SELECT * FROM whatsapp_conversations WHERE phone = ?', [phone]
  );
  return created;
}

async function updateConversation(phone: string, state: string, context: any = {}) {
  await pool.query(
    `UPDATE whatsapp_conversations SET state = ?, context_json = ?, last_message_at = NOW() WHERE phone = ?`,
    [state, JSON.stringify(context), phone]
  );
}

async function logMessage(conversationId: number, direction: 'incoming' | 'outgoing', body: string) {
  await pool.query(
    `INSERT INTO whatsapp_messages (conversation_id, direction, body) VALUES (?, ?, ?)`,
    [conversationId, direction, body]
  );
}

async function reply(phone: string, conversationId: number, text: string) {
  await sendWhatsAppMessage(phone, text);
  await logMessage(conversationId, 'outgoing', text);
}

/** Main entrypoint — called once per incoming WhatsApp message. */
export async function handleIncomingWhatsAppMessage(phone: string, text: string) {
  const conv = await getOrCreateConversation(phone);
  await logMessage(conv.conversation_id, 'incoming', text);

  const trimmed = text.trim().toLowerCase();
  const context = conv.context_json ? JSON.parse(conv.context_json) : {};

  // If a human (dealer/support) has taken over, the bot stops responding —
  // messages just get logged for the human to see in the WhatsApp Inbox.
  if (conv.handoff_to_human && trimmed !== 'menu') {
    return;
  }

  // "menu" always resets, regardless of state
  if (trimmed === 'menu') {
    await updateConversation(phone, 'menu', {});
    await pool.query(`UPDATE whatsapp_conversations SET handoff_to_human = 0 WHERE phone = ?`, [phone]);
    await reply(phone, conv.conversation_id, MENU_TEXT);
    return;
  }

  switch (conv.state) {
    case 'menu': {
      if (trimmed === '1') {
        await updateConversation(phone, 'awaiting_chassis', {});
        await reply(phone, conv.conversation_id, 'Kripya apni vehicle ka chassis number bhejein.');
      } else if (trimmed === '2') {
        await pool.query(`UPDATE whatsapp_conversations SET handoff_to_human = 1 WHERE phone = ?`, [phone]);
        await reply(phone, conv.conversation_id, 'Aapko humari customer care team se jodा jaa raha hai. Kripya thoda intezaar karein, hamari team jald hi reply karegi.');
        // TODO: notify dealer/support team here (e.g. via existing notifications system)
      } else if (trimmed === '3') {
        await updateConversation(phone, 'awaiting_status_chassis', {});
        await reply(phone, conv.conversation_id, 'Status check karne ke liye chassis number bhejein.');
      } else {
        await reply(phone, conv.conversation_id, 'Samajh nahi aaya. ' + MENU_TEXT);
      }
      break;
    }

    case 'awaiting_chassis': {
      const [[vehicle]]: any = await pool.query(
        `SELECT vehicle_id, dealer_id FROM vehicles WHERE chassis_number = ?`, [text.trim()]
      );
      if (!vehicle) {
        await reply(phone, conv.conversation_id, 'Ye chassis number system mein nahi mila. Kripya sahi number bhejein, ya "menu" likhein.');
        return;
      }
      await updateConversation(phone, 'awaiting_complaint', { chassisNumber: text.trim(), vehicleId: vehicle.vehicle_id, dealerId: vehicle.dealer_id });
      await reply(phone, conv.conversation_id, 'Dhanyawad! Ab apni complaint / problem ka detail bhejein.');
      break;
    }

    case 'awaiting_complaint': {
      const [result]: any = await pool.query(
        `INSERT INTO job_cards (vehicle_id, dealer_id, complaint_text, service_type, priority, status)
         VALUES (?, ?, ?, 'paid', 'normal', 'registered')`,
        [context.vehicleId, context.dealerId, text.trim()]
      );
      await updateConversation(phone, 'menu', {});
      await reply(
        phone, conv.conversation_id,
        `Aapki complaint darj ho gayi hai! Job Card #${result.insertId}\n\nHamari team jald hi contact karegi. "menu" likh kar wapas jaa sakte hain.`
      );
      break;
    }

    case 'awaiting_status_chassis': {
      const [[job]]: any = await pool.query(
        `SELECT jc.job_card_id, jc.status, jc.registered_at
         FROM job_cards jc JOIN vehicles v ON jc.vehicle_id = v.vehicle_id
         WHERE v.chassis_number = ? ORDER BY jc.registered_at DESC LIMIT 1`,
        [text.trim()]
      );
      await updateConversation(phone, 'menu', {});
      if (!job) {
        await reply(phone, conv.conversation_id, 'Is chassis number ke liye koi complaint nahi mili. "menu" likhein.');
        return;
      }
      const STATUS_LABEL_HI: Record<string, string> = {
        registered: 'Darj hui hai', acknowledged: 'Dealer ne accept kiya hai',
        technician_assigned: 'Technician assign ho gaya hai', in_progress: 'Kaam chal raha hai',
        completed: 'Poora ho gaya hai', delivered: 'Deliver ho chuka hai',
        rejected_by_dealer: 'Reject ho gayi thi',
      };
      await reply(
        phone, conv.conversation_id,
        `Job Card #${job.job_card_id}\nStatus: ${STATUS_LABEL_HI[job.status] || job.status}\n\n"menu" likh kar wapas jaa sakte hain.`
      );
      break;
    }

    default: {
      await updateConversation(phone, 'menu', {});
      await reply(phone, conv.conversation_id, MENU_TEXT);
    }
  }
}
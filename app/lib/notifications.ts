import { pool } from './db';
import { sendWhatsAppMessage } from './whatsappSend';

type NotifyParams = {
  userId?: number | null;
  phone?: string | null;
  title: string;
  message: string;
  jobCardId?: number | null;
};

/**
 * Sends a notification to a user. Right now this only logs to console and
 * saves to the `notifications` table (shown in the in-app bell icon).
 *
 * When a real WhatsApp Business API or SMS gateway (Twilio, MSG91, etc.) is
 * ready, only this function needs to change — swap the console.log block
 * for an actual API call. Every call-site in the app stays untouched.
 */
export async function sendNotification({ userId, phone, title, message, jobCardId }: NotifyParams) {
  try {
    console.log(`[NOTIFY] → ${phone || 'user:' + userId} | ${title}: ${message}`);

    await pool.query(
      `INSERT INTO notifications (user_id, phone, channel, title, message, job_card_id)
       VALUES (?, ?, 'in_app', ?, ?, ?)`,
      [userId || null, phone || null, title, message, jobCardId || null]
    );

    // Best-effort WhatsApp push alongside the in-app notification.
    // Phone numbers in this system are stored as 10-digit local numbers
    // (e.g. "9876543210"), but the WhatsApp Graph API needs the country
    // code prefixed (e.g. "919876543210") — same format the webhook
    // gives us in `message.from`.
    if (phone) {
      const digitsOnly = phone.replace(/\D/g, '');
      const waNumber = digitsOnly.length === 10 ? `91${digitsOnly}` : digitsOnly;
      sendWhatsAppMessage(waNumber, `*${title}*\n${message}`).catch((err) => {
        console.error('WhatsApp notify failed:', err.message);
      });
    }
  } catch (err: any) {
    console.error('sendNotification failed:', err.message);
    // never throw — a notification failure must not break the main flow
  }
}

/** Convenience helper: look up a customer's user_id + phone from a vehicle/job card, then notify. */
export async function notifyCustomerForJobCard(jobCardId: number, title: string, message: string) {
  const [[row]]: any = await pool.query(
    `SELECT c.phone, u.user_id
     FROM job_cards jc
     JOIN vehicles v ON jc.vehicle_id = v.vehicle_id
     JOIN customers c ON v.customer_id = c.customer_id
     LEFT JOIN users u ON u.phone = c.phone AND u.role = 'customer'
     WHERE jc.job_card_id = ?`,
    [jobCardId]
  );
  if (!row) return;
  await sendNotification({ userId: row.user_id, phone: row.phone, title, message, jobCardId });
}

export async function notifyDealerForJobCard(jobCardId: number, title: string, message: string) {
  const [[row]]: any = await pool.query(
    `SELECT u.user_id, u.phone
     FROM job_cards jc
     JOIN users u ON u.dealer_id = jc.dealer_id AND u.role = 'dealer'
     WHERE jc.job_card_id = ? LIMIT 1`,
    [jobCardId]
  );
  if (!row) return;
  await sendNotification({ userId: row.user_id, phone: row.phone, title, message, jobCardId });
}

export async function notifyTechnicianForJobCard(jobCardId: number, title: string, message: string) {
  const [[row]]: any = await pool.query(
    `SELECT u.user_id, u.phone
     FROM job_cards jc
     JOIN technicians t ON jc.technician_id = t.technician_id
     JOIN users u ON t.user_id = u.user_id
     WHERE jc.job_card_id = ?`,
    [jobCardId]
  );
  if (!row) return;
  await sendNotification({ userId: row.user_id, phone: row.phone, title, message, jobCardId });
}
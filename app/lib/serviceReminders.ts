import { pool } from './db';
import { notifyCustomerForJobCard } from './notifications';

// Nudge customers to book their next service this many days after their
// last delivered job card — and never remind the same job card twice.
const REMINDER_AFTER_DAYS = 90;

export async function sendNextServiceReminders() {
  const [rows]: any = await pool.query(
    `SELECT job_card_id
     FROM job_cards
     WHERE status = 'delivered'
       AND service_reminder_sent_at IS NULL
       AND delivered_at IS NOT NULL
       AND TIMESTAMPDIFF(DAY, delivered_at, NOW()) >= ?
     -- only remind once per vehicle for its most recent delivered job,
     -- so an older job card doesn't nag after a newer one already has
     AND job_card_id IN (
       SELECT MAX(jc2.job_card_id) FROM job_cards jc2
       WHERE jc2.status = 'delivered'
       GROUP BY jc2.vehicle_id
     )`,
    [REMINDER_AFTER_DAYS]
  );

  for (const jc of rows) {
    try {
      await notifyCustomerForJobCard(
        jc.job_card_id,
        'Time for your next service',
        `It's been ${REMINDER_AFTER_DAYS} days since your last service. Book your next appointment to keep your vehicle running smoothly.`
      );
      await pool.query(
        `UPDATE job_cards SET service_reminder_sent_at = NOW() WHERE job_card_id = ?`,
        [jc.job_card_id]
      );
    } catch (err: any) {
      console.error('Service reminder failed for job card', jc.job_card_id, err.message);
    }
  }
}
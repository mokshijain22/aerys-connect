import { pool } from './db';

async function findLeastBusyTechnician(dealerId: number) {
  const [rows]: any = await pool.query(
    `SELECT t.technician_id,
            (SELECT COUNT(*) FROM job_cards jc2
             WHERE jc2.technician_id = t.technician_id
               AND jc2.status IN ('technician_assigned','in_progress')) AS active_jobs
     FROM technicians t
     WHERE t.dealer_id = ?
       AND t.is_active = 1
       AND t.deleted_at IS NULL
     ORDER BY active_jobs ASC
     LIMIT 1`,
    [dealerId]
  );
  return rows[0]?.technician_id ?? null;
}

async function findLeastBusyTechnicianInSameState(dealerId: number, excludeDealerId: number) {
  const [rows]: any = await pool.query(
    `SELECT t.technician_id, t.dealer_id,
            (SELECT COUNT(*) FROM job_cards jc2
             WHERE jc2.technician_id = t.technician_id
               AND jc2.status IN ('technician_assigned','in_progress')) AS active_jobs
     FROM technicians t
     JOIN dealers d ON t.dealer_id = d.dealer_id
     JOIN cities c ON d.city_id = c.city_id
     JOIN districts dist ON c.district_id = dist.district_id
     WHERE dist.state_id = (
       SELECT dist2.state_id FROM dealers d2
       JOIN cities c2 ON d2.city_id = c2.city_id
       JOIN districts dist2 ON c2.district_id = dist2.district_id
       WHERE d2.dealer_id = ?
     )
     AND t.dealer_id != ?
     AND t.is_active = 1
     AND t.deleted_at IS NULL
     ORDER BY active_jobs ASC
     LIMIT 1`,
    [dealerId, excludeDealerId]
  );
  if (rows.length === 0) return null;
  return { technicianId: rows[0].technician_id, dealerId: rows[0].dealer_id };
}

async function assign(jobCardId: number, technicianId: number, newDealerId: number | null) {
  if (newDealerId) {
    await pool.query(
      `UPDATE job_cards
       SET dealer_id = ?, technician_id = ?, status = 'technician_assigned',
           technician_assigned_at = NOW(),
           acknowledged_at = COALESCE(acknowledged_at, NOW()),
           auto_assigned = 1
       WHERE job_card_id = ?`,
      [newDealerId, technicianId, jobCardId]
    );
  } else {
    await pool.query(
      `UPDATE job_cards
       SET technician_id = ?, status = 'technician_assigned',
           technician_assigned_at = NOW(),
           acknowledged_at = COALESCE(acknowledged_at, NOW()),
           auto_assigned = 1
       WHERE job_card_id = ?`,
      [technicianId, jobCardId]
    );
  }
  await pool.query(
    `INSERT INTO job_card_technician_history (job_card_id, technician_id, response) VALUES (?, ?, 'pending')`,
    [jobCardId, technicianId]
  );
}

/**
 * Two triggers for auto-assignment, both bypassing the dealer:
 *
 *   1. REJECTED by dealer -> immediately hand off to another dealer in the same state
 *      (never assigned to a technician under the rejecting dealer).
 *
 *   2. NO ACTION at all (still 'registered' or 'acknowledged' with no technician) for
 *      more than 15 minutes -> auto-assign, trying the original dealer's own technician
 *      first, falling back to another dealer in the same state if none available there.
 */
export async function autoAssignOverdueJobCards() {
  // --- Case 1: rejected -> immediate reassignment to a different dealer ---
  const [rejected]: any = await pool.query(
    `SELECT job_card_id, dealer_id FROM job_cards
     WHERE technician_id IS NULL AND status = 'rejected_by_dealer'`
  );

  for (const jc of rejected) {
    const fallback = await findLeastBusyTechnicianInSameState(jc.dealer_id, jc.dealer_id);
    if (fallback) {
      await assign(jc.job_card_id, fallback.technicianId, fallback.dealerId);
    }
    // if nobody in the state has an active technician, leave it — nothing to assign yet
  }

  // --- Case 2: no action for 15+ minutes -> same dealer first, then fallback ---
  const [overdue]: any = await pool.query(
    `SELECT job_card_id, dealer_id FROM job_cards
     WHERE technician_id IS NULL
       AND status IN ('registered', 'acknowledged')
       AND TIMESTAMPDIFF(MINUTE, registered_at, NOW()) > 15`
  );

  for (const jc of overdue) {
    const sameDealerTech = await findLeastBusyTechnician(jc.dealer_id);
    if (sameDealerTech) {
      await assign(jc.job_card_id, sameDealerTech, null);
      continue;
    }
    const fallback = await findLeastBusyTechnicianInSameState(jc.dealer_id, jc.dealer_id);
    if (fallback) {
      await assign(jc.job_card_id, fallback.technicianId, fallback.dealerId);
    }
  }
}
import { pool } from './db';
import { haversineKm } from './geo';

// A technician's location must be this fresh to be trusted for proximity
// scoring. Older/missing pings just fall back to workload-only ranking.
const LOCATION_FRESH_MINUTES = 30;

// Distance dominates the ranking (nearest-first), workload only breaks
// close ties between technicians who are roughly equally near.
const DISTANCE_WEIGHT = 3;
const WORKLOAD_WEIGHT = 1;
// Applied when the technician has specific skills set AND the job's part
// category isn't one of them. Large enough to lose to any in-skill or
// generalist (skills = NULL) candidate, but still a valid fallback if
// nobody else is available.
const SKILL_MISMATCH_PENALTY = 50;
// Applied when the job needs a specific part category and the technician's
// dealer has none in stock. Smaller than the skill penalty (skill mismatch
// is a harder blocker; parts can still be sourced after assignment).
const PARTS_UNAVAILABLE_PENALTY = 10;

function isSkillMismatch(skills: string | null, partCategory: string | null) {
  if (!skills || !partCategory) return false; // generalist, or job has no category — no penalty
  const skillList = skills.split(',').map((s) => s.trim()).filter(Boolean);
  return skillList.length > 0 && !skillList.includes(partCategory);
}

function scoreCandidate(activeJobs: number, distanceKm: number | null, skillMismatch: boolean, partsUnavailable: boolean) {
  const base = distanceKm === null
    ? activeJobs * WORKLOAD_WEIGHT
    : distanceKm * DISTANCE_WEIGHT + activeJobs * WORKLOAD_WEIGHT;
  const withSkillPenalty = skillMismatch ? base + SKILL_MISMATCH_PENALTY : base;
  return partsUnavailable ? withSkillPenalty + PARTS_UNAVAILABLE_PENALTY : withSkillPenalty;
}

async function rankCandidates(rows: any[], destLat: number | null, destLng: number | null, partCategory: string | null = null) {
  const withLocation = rows.filter((r) => r.tech_lat != null && r.tech_lng != null);
  const withoutLocation = rows.filter((r) => r.tech_lat == null || r.tech_lng == null);

  const scored = rows.map((r) => {
    let distanceKm: number | null = null;
    if (destLat != null && destLng != null && r.tech_lat != null && r.tech_lng != null) {
      distanceKm = haversineKm(destLat, destLng, Number(r.tech_lat), Number(r.tech_lng));
    }
    const skillMismatch = isSkillMismatch(r.skills, partCategory);
    const partsUnavailable = r.has_stock === false;
    return { ...r, distanceKm, score: scoreCandidate(r.active_jobs, distanceKm, skillMismatch, partsUnavailable) };
  });

  // Prefer any candidate with a usable distance score over pure guesswork,
  // then sort within each group by score ascending (lower = better).
  const scoredWithDistance = scored.filter((r) => r.distanceKm !== null).sort((a, b) => a.score - b.score);
  const scoredWithoutDistance = scored.filter((r) => r.distanceKm === null).sort((a, b) => a.score - b.score);

  return [...scoredWithDistance, ...scoredWithoutDistance];
}

async function findLeastBusyTechnician(dealerId: number, destLat: number | null = null, destLng: number | null = null, partCategory: string | null = null) {
  const [rows]: any = await pool.query(
    `SELECT t.technician_id, t.skills,
            (SELECT COUNT(*) FROM job_cards jc2
             WHERE jc2.technician_id = t.technician_id
               AND jc2.status IN ('technician_assigned','in_progress')) AS active_jobs,
            tl.latitude AS tech_lat, tl.longitude AS tech_lng,
            CASE WHEN ? IS NULL THEN NULL ELSE EXISTS (
              SELECT 1 FROM dealer_stock ds
              JOIN spare_parts sp ON sp.part_id = ds.part_id
              WHERE ds.dealer_id = t.dealer_id AND sp.category = ? AND ds.quantity > 0
            ) END AS has_stock
     FROM technicians t
     LEFT JOIN technician_locations tl
       ON tl.technician_id = t.technician_id
       AND tl.updated_at > DATE_SUB(NOW(), INTERVAL ${LOCATION_FRESH_MINUTES} MINUTE)
     WHERE t.dealer_id = ?
       AND t.is_active = 1
       AND t.deleted_at IS NULL`,
    [partCategory, partCategory, dealerId]
  );
  if (rows.length === 0) return null;
  const ranked = await rankCandidates(rows, destLat, destLng, partCategory);
  return ranked[0]?.technician_id ?? null;
}

async function findLeastBusyTechnicianInSameState(
  dealerId: number,
  excludeDealerId: number,
  destLat: number | null = null,
  destLng: number | null = null,
  partCategory: string | null = null
) {
  const [rows]: any = await pool.query(
    `SELECT t.technician_id, t.dealer_id, t.skills,
            (SELECT COUNT(*) FROM job_cards jc2
             WHERE jc2.technician_id = t.technician_id
               AND jc2.status IN ('technician_assigned','in_progress')) AS active_jobs,
            tl.latitude AS tech_lat, tl.longitude AS tech_lng,
            CASE WHEN ? IS NULL THEN NULL ELSE EXISTS (
              SELECT 1 FROM dealer_stock ds
              JOIN spare_parts sp ON sp.part_id = ds.part_id
              WHERE ds.dealer_id = t.dealer_id AND sp.category = ? AND ds.quantity > 0
            ) END AS has_stock
     FROM technicians t
     JOIN dealers d ON t.dealer_id = d.dealer_id
     JOIN cities c ON d.city_id = c.city_id
     JOIN districts dist ON c.district_id = dist.district_id
     LEFT JOIN technician_locations tl
       ON tl.technician_id = t.technician_id
       AND tl.updated_at > DATE_SUB(NOW(), INTERVAL ${LOCATION_FRESH_MINUTES} MINUTE)
     WHERE dist.state_id = (
       SELECT dist2.state_id FROM dealers d2
       JOIN cities c2 ON d2.city_id = c2.city_id
       JOIN districts dist2 ON c2.district_id = dist2.district_id
       WHERE d2.dealer_id = ?
     )
     AND t.dealer_id != ?
     AND t.is_active = 1
     AND t.deleted_at IS NULL`,
    [partCategory, partCategory, dealerId, excludeDealerId]
  );
  if (rows.length === 0) return null;
  const ranked = await rankCandidates(rows, destLat, destLng, partCategory);
  const best = ranked[0];
  if (!best) return null;
  return { technicianId: best.technician_id, dealerId: best.dealer_id };
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
    `SELECT job_card_id, dealer_id, dest_latitude, dest_longitude, part_category FROM job_cards
     WHERE technician_id IS NULL AND status = 'rejected_by_dealer'`
  );

  for (const jc of rejected) {
    const destLat = jc.dest_latitude != null ? Number(jc.dest_latitude) : null;
    const destLng = jc.dest_longitude != null ? Number(jc.dest_longitude) : null;
    const fallback = await findLeastBusyTechnicianInSameState(jc.dealer_id, jc.dealer_id, destLat, destLng, jc.part_category || null);
    if (fallback) {
      await assign(jc.job_card_id, fallback.technicianId, fallback.dealerId);
    }
    // if nobody in the state has an active technician, leave it — nothing to assign yet
  }

  // --- Case 2: no action for 15+ minutes -> same dealer first, then fallback ---
  const [overdue]: any = await pool.query(
    `SELECT job_card_id, dealer_id, dest_latitude, dest_longitude, part_category FROM job_cards
     WHERE technician_id IS NULL
       AND status IN ('registered', 'acknowledged')
       AND (
         TIMESTAMPDIFF(MINUTE, registered_at, NOW()) > 15
         OR (priority = 'emergency' AND TIMESTAMPDIFF(MINUTE, registered_at, NOW()) > 2)
         OR (priority = 'urgent' AND TIMESTAMPDIFF(MINUTE, registered_at, NOW()) > 5)
       )
     ORDER BY FIELD(priority, 'emergency', 'urgent', 'normal'), registered_at ASC`
  );

  for (const jc of overdue) {
    const destLat = jc.dest_latitude != null ? Number(jc.dest_latitude) : null;
    const destLng = jc.dest_longitude != null ? Number(jc.dest_longitude) : null;
    const sameDealerTech = await findLeastBusyTechnician(jc.dealer_id, destLat, destLng, jc.part_category || null);
    if (sameDealerTech) {
      await assign(jc.job_card_id, sameDealerTech, null);
      continue;
    }
    const fallback = await findLeastBusyTechnicianInSameState(jc.dealer_id, jc.dealer_id, destLat, destLng, jc.part_category || null);
    if (fallback) {
      await assign(jc.job_card_id, fallback.technicianId, fallback.dealerId);
    }
  }
}
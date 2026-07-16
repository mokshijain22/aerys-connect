import { pool } from '../../../lib/db';
import { NextResponse } from 'next/server';
import { auth } from '@/auth';

export async function PATCH(request: Request) {
  const { jobCardId, action, rejectionReason } = await request.json();

  const session = await auth();
  const role = (session?.user as any)?.role || '';
  const sessionUserId = (session?.user as any)?.id || null;

  if (!session?.user) {
    return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
  }
  if (role !== 'technician') {
    return NextResponse.json({ success: false, error: 'Only technicians can respond to assignments' }, { status: 403 });
  }
  if (!['accept', 'reject'].includes(action)) {
    return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 });
  }
  if (action === 'reject' && !rejectionReason) {
    return NextResponse.json({ success: false, error: 'Rejection reason is required' }, { status: 400 });
  }

  try {
    const [techRows]: any = await pool.query(
      'SELECT technician_id FROM technicians WHERE user_id = ? AND deleted_at IS NULL',
      [sessionUserId]
    );
    const myTechnicianId = techRows[0]?.technician_id ?? null;
    if (!myTechnicianId) {
      return NextResponse.json({ success: false, error: 'Technician profile not found' }, { status: 403 });
    }

    const [jcRows]: any = await pool.query(
      'SELECT technician_id, dealer_id, status FROM job_cards WHERE job_card_id = ?',
      [jobCardId]
    );
    if (jcRows.length === 0) {
      return NextResponse.json({ success: false, error: 'Job card not found' }, { status: 404 });
    }
    if (jcRows[0].technician_id !== myTechnicianId) {
      return NextResponse.json({ success: false, error: 'This job card is not assigned to you' }, { status: 403 });
    }
    if (jcRows[0].status !== 'technician_assigned') {
      return NextResponse.json({ success: false, error: 'This job card is not pending your response' }, { status: 400 });
    }

    const dealerId = jcRows[0].dealer_id;

    if (action === 'accept') {
      await pool.query(
        `UPDATE job_cards SET status = 'in_progress', service_started_at = NOW() WHERE job_card_id = ?`,
        [jobCardId]
      );
      await pool.query(
        `UPDATE job_card_technician_history SET response = 'accepted', responded_at = NOW()
         WHERE job_card_id = ? AND technician_id = ? AND response = 'pending'`,
        [jobCardId, myTechnicianId]
      );
      return NextResponse.json({ success: true, reassigned: false });
    }

    // action === 'reject'
    await pool.query(
      `UPDATE job_card_technician_history SET response = 'rejected', rejection_reason = ?, responded_at = NOW()
       WHERE job_card_id = ? AND technician_id = ? AND response = 'pending'`,
      [rejectionReason, jobCardId, myTechnicianId]
    );

    // find next available technician for this dealer: active, not already tried on this job card,
    // ordered by current active workload (fewest jobs first)
    const [candidates]: any = await pool.query(
      `SELECT t.technician_id,
              (SELECT COUNT(*) FROM job_cards jc
               WHERE jc.technician_id = t.technician_id
                 AND jc.status IN ('technician_assigned','in_progress')) AS active_jobs
       FROM technicians t
       WHERE t.dealer_id = ?
         AND t.is_active = 1
         AND t.deleted_at IS NULL
         AND t.technician_id NOT IN (
           SELECT technician_id FROM job_card_technician_history WHERE job_card_id = ?
         )
       ORDER BY active_jobs ASC
       LIMIT 1`,
      [dealerId, jobCardId]
    );

    if (candidates.length === 0) {
      // no one left to try, kick it back to the dealer
      await pool.query(
        `UPDATE job_cards SET status = 'acknowledged', technician_id = NULL WHERE job_card_id = ?`,
        [jobCardId]
      );
      return NextResponse.json({ success: true, reassigned: false, message: 'No available technicians left, sent back to dealer' });
    }

    const nextTechnicianId = candidates[0].technician_id;

    await pool.query(
      `UPDATE job_cards SET technician_id = ?, technician_assigned_at = NOW() WHERE job_card_id = ?`,
      [nextTechnicianId, jobCardId]
    );
    await pool.query(
      `INSERT INTO job_card_technician_history (job_card_id, technician_id, response) VALUES (?, ?, 'pending')`,
      [jobCardId, nextTechnicianId]
    );

    return NextResponse.json({ success: true, reassigned: true, newTechnicianId: nextTechnicianId });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
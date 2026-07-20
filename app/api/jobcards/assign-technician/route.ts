import { pool } from '../../../lib/db';
import { NextResponse } from 'next/server';
import { auth } from '@/auth';

export async function POST(request: Request) {
  const { jobCardId, technicianId } = await request.json();

  const session = await auth();
  const role = (session?.user as any)?.role || '';
  const sessionDealerId = (session?.user as any)?.dealer_id || null;

  if (!session?.user) {
    return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
  }
  if (role !== 'dealer' && role !== 'super_admin') {
    return NextResponse.json({ success: false, error: 'Not authorized' }, { status: 403 });
  }

  try {
    const [jcRows]: any = await pool.query(
      'SELECT dealer_id, status FROM job_cards WHERE job_card_id = ?',
      [jobCardId]
    );
    if (jcRows.length === 0) {
      return NextResponse.json({ success: false, error: 'Job card not found' }, { status: 404 });
    }
    if (role === 'dealer' && jcRows[0].dealer_id !== sessionDealerId) {
      return NextResponse.json({ success: false, error: 'You do not have access to this job card' }, { status: 403 });
    }
    if (!['acknowledged', 'technician_assigned'].includes(jcRows[0].status)) {
      return NextResponse.json({ success: false, error: 'Job card must be acknowledged before assigning a technician' }, { status: 400 });
    }

    const [techRows]: any = await pool.query(
      'SELECT technician_id, dealer_id, is_active FROM technicians WHERE technician_id = ? AND deleted_at IS NULL',
      [technicianId]
    );
    if (techRows.length === 0 || !techRows[0].is_active) {
      return NextResponse.json({ success: false, error: 'Technician not found or inactive' }, { status: 400 });
    }
    if (techRows[0].dealer_id !== jcRows[0].dealer_id) {
      return NextResponse.json({ success: false, error: 'Technician does not belong to this dealer' }, { status: 403 });
    }

    await pool.query(
      `UPDATE job_cards SET status = 'technician_assigned', technician_id = ?, technician_assigned_at = NOW() WHERE job_card_id = ?`,
      [technicianId, jobCardId]
    );

    await pool.query(
      `INSERT INTO job_card_technician_history (job_card_id, technician_id, response) VALUES (?, ?, 'pending')`,
      [jobCardId, technicianId]
    );

    const { notifyCustomerForJobCard, notifyTechnicianForJobCard } = await import('../../../lib/notifications');
    notifyCustomerForJobCard(jobCardId, 'Technician assigned', 'A technician has been assigned to your service request.').catch(() => {});
    notifyTechnicianForJobCard(jobCardId, 'New job assigned', 'A new job card has been assigned to you. Please accept or reject.').catch(() => {});

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
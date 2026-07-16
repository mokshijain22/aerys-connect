import { pool } from '../../../lib/db';
import { NextResponse } from 'next/server';
import { auth } from '@/auth';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const session = await auth();
  const role = (session?.user as any)?.role || '';
  const dealerId = (session?.user as any)?.dealer_id || null;
  const customerId = (session?.user as any)?.customer_id || null;
  const userId = (session?.user as any)?.id || null;

  if (!session?.user) {
    return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
  }

  try {
    const [rows]: any = await pool.query(
      `SELECT
        jc.job_card_id, jc.complaint_text, jc.status, jc.service_type,
        jc.part_category, jc.symptom_type,
        jc.registered_at, jc.acknowledged_at, jc.technician_assigned_at, jc.arrived_at,
        jc.service_started_at, jc.service_completed_at, jc.delivered_at,
        jc.dealer_rejection_reason, jc.escalated, jc.auto_assigned,
        jc.dealer_id, jc.technician_id,
        v.chassis_number, v.vehicle_id, c.full_name, c.phone, c.customer_id,
        d.dealer_name, d.phone AS dealer_phone,
        tu.full_name AS technician_name, tu.phone AS technician_phone
      FROM job_cards jc
      JOIN vehicles v ON jc.vehicle_id = v.vehicle_id
      JOIN customers c ON v.customer_id = c.customer_id
      JOIN dealers d ON jc.dealer_id = d.dealer_id
      LEFT JOIN technicians t ON jc.technician_id = t.technician_id
      LEFT JOIN users tu ON t.user_id = tu.user_id
      WHERE jc.job_card_id = ?`,
      [id]
    );

    if (rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Job card not found' }, { status: 404 });
    }
    const jc = rows[0];

    // access control
    if (role === 'dealer' && jc.dealer_id !== dealerId) {
      return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 });
    }
    if (role === 'customer' && jc.customer_id !== customerId) {
      return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 });
    }
    if (role === 'technician') {
      const [techRows]: any = await pool.query(
        'SELECT technician_id FROM technicians WHERE user_id = ?',
        [userId]
      );
      const myTechId = techRows[0]?.technician_id;
      if (jc.technician_id !== myTechId) {
        return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 });
      }
    }

    const [attachments]: any = await pool.query(
      `SELECT attachment_id, file_path, file_type, stage, created_at
       FROM job_card_attachments WHERE job_card_id = ? AND deleted_at IS NULL ORDER BY created_at ASC`,
      [id]
    );

    return NextResponse.json({ success: true, data: { ...jc, attachments } });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
import { pool } from '../../lib/db';
import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { generateInvoiceForJobCard } from '../../lib/invoice';
import { autoAssignOverdueJobCards } from '../../lib/autoAssign';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const body = await request.json();
  const { chassisNumber, complaintText, serviceType, partCategory, symptomType } = body;

  const session = await auth();
  const role = (session?.user as any)?.role || '';
  const sessionDealerId = (session?.user as any)?.dealer_id || null;

  if (!session?.user) {
    return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
  }

  try {
    // find the vehicle (and its dealer) by chassis number
    const [vehicleRows]: any = await pool.query(
      'SELECT vehicle_id, dealer_id FROM vehicles WHERE chassis_number = ?',
      [chassisNumber]
    );

    if (vehicleRows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No vehicle found with that chassis number' },
        { status: 404 }
      );
    }

    const vehicle = vehicleRows[0];

    // dealers can only create job cards for their own vehicles
    if (role === 'dealer' && vehicle.dealer_id !== sessionDealerId) {
      return NextResponse.json(
        { success: false, error: 'You do not have access to this vehicle' },
        { status: 403 }
      );
    }

    const [result]: any = await pool.query(
      `INSERT INTO job_cards (vehicle_id, dealer_id, complaint_text, service_type, part_category, symptom_type, status)
       VALUES (?, ?, ?, ?, ?, ?, 'registered')`,
      [vehicle.vehicle_id, vehicle.dealer_id, complaintText, serviceType, partCategory || null, symptomType || null]
    );

    return NextResponse.json({ success: true, jobCardId: result.insertId });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function GET() {
  const session = await auth();
  const role = (session?.user as any)?.role || '';
  const dealerId = (session?.user as any)?.dealer_id || null;
  const userId = (session?.user as any)?.id || null;

  await autoAssignOverdueJobCards();

  await pool.query(
    `UPDATE job_cards
     SET escalated = 1, escalated_at = NOW()
     WHERE escalated = 0
       AND status NOT IN ('delivered', 'cancelled')
       AND TIMESTAMPDIFF(MINUTE, registered_at, NOW()) > 360`
  );

  let technicianRecordId: number | null = null;
  if (role === 'technician' && userId) {
    const [techRows]: any = await pool.query(
      'SELECT technician_id FROM technicians WHERE user_id = ?',
      [userId]
    );
    technicianRecordId = techRows[0]?.technician_id ?? null;
  }

  let query = `
    SELECT
      jc.job_card_id, jc.complaint_text, jc.status, jc.service_type,
      jc.part_category, jc.symptom_type,
      jc.registered_at, jc.escalated, jc.escalated_at, jc.arrived_at, jc.auto_assigned,
      v.chassis_number, c.full_name, c.phone,
      tu.full_name AS technician_name, tu.phone AS technician_phone,
      TIMESTAMPDIFF(MINUTE, jc.registered_at, NOW()) AS minutes_elapsed
    FROM job_cards jc
    JOIN vehicles v ON jc.vehicle_id = v.vehicle_id
    JOIN customers c ON v.customer_id = c.customer_id
    LEFT JOIN technicians t ON jc.technician_id = t.technician_id
    LEFT JOIN users tu ON t.user_id = tu.user_id
  `;
  const params: any[] = [];
  const customerId = (session?.user as any)?.customer_id || null;

  if (role === 'dealer') {
    query += ` WHERE jc.dealer_id = ?`;
    params.push(dealerId || -1);
  } else if (role === 'technician') {
    query += ` WHERE jc.technician_id = ?`;
    params.push(technicianRecordId || -1);
  } else if (role === 'customer') {
    query += ` WHERE v.customer_id = ?`;
    params.push(customerId || -1);
  }

  query += ` ORDER BY jc.registered_at DESC`;

  const [rows] = await pool.query(query, params);
  return NextResponse.json({ success: true, data: rows });
}

export async function PATCH(request: Request) {
  const { jobCardId, newStatus, rejectionReason } = await request.json();

  const session = await auth();
  const role = (session?.user as any)?.role || '';
  const sessionDealerId = (session?.user as any)?.dealer_id || null;

  if (!session?.user) {
    return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
  }
  if (role !== 'super_admin' && role !== 'dealer' && role !== 'technician') {
    return NextResponse.json({ success: false, error: 'Not authorized to update job cards' }, { status: 403 });
  }

  if (role === 'technician' && !['in_progress', 'completed'].includes(newStatus)) {
    return NextResponse.json({ success: false, error: 'Technicians can only set status to in_progress or completed' }, { status: 403 });
  }

  if (role === 'dealer' && !['acknowledged', 'rejected_by_dealer', 'delivered'].includes(newStatus)) {
    return NextResponse.json({ success: false, error: 'Dealers can only acknowledge, reject, or mark delivered' }, { status: 403 });
  }

  if (newStatus === 'rejected_by_dealer' && !rejectionReason) {
    return NextResponse.json({ success: false, error: 'Rejection reason is required' }, { status: 400 });
  }

  const timestampColumn: Record<string, string> = {
    acknowledged: 'acknowledged_at',
    technician_assigned: 'technician_assigned_at',
    in_progress: 'service_started_at',
    completed: 'service_completed_at',
    delivered: 'delivered_at',
  };

  const column = timestampColumn[newStatus];

  try {
    if (role === 'dealer') {
      const [jcRows]: any = await pool.query(
        'SELECT dealer_id FROM job_cards WHERE job_card_id = ?',
        [jobCardId]
      );
      if (jcRows.length === 0 || jcRows[0].dealer_id !== sessionDealerId) {
        return NextResponse.json({ success: false, error: 'You do not have access to this job card' }, { status: 403 });
      }
    }

    if (role === 'technician') {
      const sessionUserId = (session?.user as any)?.id || null;
      const [jcRows]: any = await pool.query(
        'SELECT technician_id FROM job_cards WHERE job_card_id = ?',
        [jobCardId]
      );
      const [techRows]: any = await pool.query(
        'SELECT technician_id FROM technicians WHERE user_id = ? AND deleted_at IS NULL',
        [sessionUserId]
      );
      const myTechnicianId = techRows[0]?.technician_id ?? null;

      if (
        jcRows.length === 0 ||
        !myTechnicianId ||
        jcRows[0].technician_id !== myTechnicianId
      ) {
        return NextResponse.json({ success: false, error: 'You do not have access to this job card' }, { status: 403 });
      }
    }
    if (newStatus === 'rejected_by_dealer') {
      await pool.query(
        `UPDATE job_cards SET status = ?, dealer_rejection_reason = ?, dealer_rejected_at = NOW() WHERE job_card_id = ?`,
        [newStatus, rejectionReason, jobCardId]
      );
    } else if (column) {
      await pool.query(
        `UPDATE job_cards SET status = ?, ${column} = NOW() WHERE job_card_id = ?`,
        [newStatus, jobCardId]
      );
    } else {
      await pool.query(
        `UPDATE job_cards SET status = ? WHERE job_card_id = ?`,
        [newStatus, jobCardId]
      );
    }

    if (newStatus === 'completed') {
      try {
        await generateInvoiceForJobCard(jobCardId);
      } catch (invErr: any) {
        console.error('Invoice generation failed:', invErr.message);
        // don't fail the status update if invoice generation has an issue
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
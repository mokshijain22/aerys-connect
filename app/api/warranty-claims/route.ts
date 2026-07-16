import { pool } from '../../lib/db';
import { NextResponse } from 'next/server';
import { auth } from '@/auth';

function generateClaimNumber() {
  const ts = Date.now().toString(36).toUpperCase();
  return `WC-${ts}`;
}

export async function POST(request: Request) {
  const body = await request.json();
  const { chassisNumber, component, remarks } = body;

  const session = await auth();
  const role = (session?.user as any)?.role || '';
  const sessionDealerId = (session?.user as any)?.dealer_id || null;

  if (!session?.user) {
    return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
  }

  if (role === 'customer') {
    return NextResponse.json({ success: false, error: 'Customers cannot file warranty claims directly. Please contact your dealer.' }, { status: 403 });
  }

  try {
    // find the vehicle by chassis number, its most recent job card, and its warranty window
    const [rows]: any = await pool.query(
      `SELECT jc.job_card_id, jc.dealer_id, v.vehicle_id, v.battery_warranty_end, v.motor_warranty_end, v.charger_warranty_end
       FROM vehicles v
       JOIN job_cards jc ON jc.vehicle_id = v.vehicle_id
       WHERE v.chassis_number = ?
       ORDER BY jc.registered_at DESC
       LIMIT 1`,
      [chassisNumber]
    );

    if (rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No job card found for that chassis number. Register a job card first.' },
        { status: 404 }
      );
    }

    const vehicle = rows[0];
    const jobCardId = vehicle.job_card_id;

    // dealers can only file claims against their own job cards
    if (role === 'dealer' && vehicle.dealer_id !== sessionDealerId) {
      return NextResponse.json(
        { success: false, error: 'You do not have access to this job card' },
        { status: 403 }
      );
    }

    const warrantyEndMap: Record<string, string> = {
      battery: vehicle.battery_warranty_end,
      motor: vehicle.motor_warranty_end,
      charger: vehicle.charger_warranty_end,
    };

    const warrantyEnd = warrantyEndMap[component];
    if (!warrantyEnd) {
      return NextResponse.json(
        { success: false, error: `Unknown component: ${component}` },
        { status: 400 }
      );
    }

    const warrantyStatusAtClaim = new Date(warrantyEnd) >= new Date() ? 'covered' : 'expired';
    const claimNumber = generateClaimNumber();

    await pool.query(
      `INSERT INTO warranty_claims
        (claim_number, job_card_id, vehicle_id, component, warranty_status_at_claim, remarks, status)
       VALUES (?, ?, ?, ?, ?, ?, 'submitted')`,
      [claimNumber, jobCardId, vehicle.vehicle_id, component, warrantyStatusAtClaim, remarks ?? null]
    );

    return NextResponse.json({ success: true, claimNumber });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function GET() {
  const session = await auth();
  const role = (session?.user as any)?.role || '';
  const dealerId = (session?.user as any)?.dealer_id || null;
  const customerId = (session?.user as any)?.customer_id || null;
  const userId = (session?.user as any)?.id || null;

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
      wc.claim_id, wc.claim_number, wc.component, wc.warranty_status_at_claim,
      wc.status, wc.submitted_at, wc.resolved_at, wc.remarks,
      v.chassis_number, c.full_name, c.phone,
      d.dealer_name
    FROM warranty_claims wc
    JOIN job_cards jc ON wc.job_card_id = jc.job_card_id
    JOIN vehicles v ON wc.vehicle_id = v.vehicle_id
    JOIN customers c ON v.customer_id = c.customer_id
    JOIN dealers d ON jc.dealer_id = d.dealer_id
  `;
  const params: any[] = [];

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

  query += ` ORDER BY wc.submitted_at DESC`;

  const [rows] = await pool.query(query, params);
  return NextResponse.json({ success: true, data: rows });
}

export async function PATCH(request: Request) {
  const { claimId, newStatus, remarks } = await request.json();

  const session = await auth();
  const role = (session?.user as any)?.role || '';
  const sessionDealerId = (session?.user as any)?.dealer_id || null;

  if (!session?.user) {
    return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
  }
  if (role !== 'super_admin' && role !== 'dealer') {
    return NextResponse.json({ success: false, error: 'Not authorized to update warranty claims' }, { status: 403 });
  }

  const resolvedStatuses = ['company_approved', 'rejected'];
  const isResolved = resolvedStatuses.includes(newStatus);

  try {
    if (role === 'dealer') {
      const [claimRows]: any = await pool.query(
        `SELECT jc.dealer_id FROM warranty_claims wc
         JOIN job_cards jc ON wc.job_card_id = jc.job_card_id
         WHERE wc.claim_id = ?`,
        [claimId]
      );
      if (claimRows.length === 0 || claimRows[0].dealer_id !== sessionDealerId) {
        return NextResponse.json({ success: false, error: 'You do not have access to this claim' }, { status: 403 });
      }
    }

    if (isResolved) {
      await pool.query(
        `UPDATE warranty_claims SET status = ?, resolved_at = NOW(), remarks = COALESCE(?, remarks) WHERE claim_id = ?`,
        [newStatus, remarks ?? null, claimId]
      );
    } else {
      await pool.query(
        `UPDATE warranty_claims SET status = ?, remarks = COALESCE(?, remarks) WHERE claim_id = ?`,
        [newStatus, remarks ?? null, claimId]
      );
    }
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
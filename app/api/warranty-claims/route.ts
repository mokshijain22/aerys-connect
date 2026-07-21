import { pool } from '@/app/lib/db';
import { NextResponse } from 'next/server';
import { auth } from '@/auth';

function generateClaimNumber() {
  const ts = Date.now().toString(36).toUpperCase();
  return `WC-${ts}`;
}

const OPEN_CLAIM_STATUSES = ['submitted', 'dealer_approved', 'company_approved'];

// Chassis numbers in this system are alphanumeric (with optional hyphens),
// between 8 and 20 characters. Anything outside this shape is rejected
// as an invalid/suspicious chassis number before we even query the DB.
const CHASSIS_NUMBER_REGEX = /^[A-Za-z0-9-]{8,20}$/;

function isValidChassisNumber(chassisNumber: unknown): chassisNumber is string {
  return typeof chassisNumber === 'string' && CHASSIS_NUMBER_REGEX.test(chassisNumber.trim());
}

// Fraud/duplicate detection:
// 1. Same vehicle + same component already has an OPEN claim -> block (duplicate)
// 2. Same vehicle + same component was REJECTED and re-submitted within 7 days -> flag as suspicious
async function checkForDuplicateOrFraud(vehicleId: number, component: string) {
  const [rows]: any = await pool.query(
    `SELECT claim_id, claim_number, status, submitted_at, resolved_at
     FROM warranty_claims
     WHERE vehicle_id = ? AND component = ? AND deleted_at IS NULL
     ORDER BY submitted_at DESC
     LIMIT 5`,
    [vehicleId, component]
  );

  const openClaim = rows.find((r: any) => OPEN_CLAIM_STATUSES.includes(r.status));
  if (openClaim) {
    return {
      blocked: true,
      reason: `An open claim (${openClaim.claim_number}) already exists for this component. Please wait for it to be resolved before filing a new one.`,
    };
  }

  const recentRejected = rows.find((r: any) => {
    if (r.status !== 'rejected' || !r.resolved_at) return false;
    const daysSinceRejection = (Date.now() - new Date(r.resolved_at).getTime()) / (1000 * 60 * 60 * 24);
    return daysSinceRejection <= 7;
  });
  if (recentRejected) {
    return {
      blocked: false,
      flagged: true,
      reason: `This component's claim (${recentRejected.claim_number}) was rejected within the last 7 days and is being resubmitted.`,
    };
  }

  return { blocked: false, flagged: false };
}

// Suspicious dealer activity: a dealer whose claims are flagged or rejected
// unusually often (vs. total claims filed) in a rolling 30-day window gets
// surfaced — doesn't block the claim, just marks it for admin review.
const SUSPICIOUS_MIN_CLAIMS = 5;      // don't judge a dealer on too small a sample
const SUSPICIOUS_FLAG_RATE = 0.4;     // 40%+ flagged/rejected in the window looks unusual

async function checkSuspiciousDealerActivity(dealerId: number) {
  const [rows]: any = await pool.query(
    `SELECT wc.status, wc.is_flagged
     FROM warranty_claims wc
     JOIN job_cards jc ON wc.job_card_id = jc.job_card_id
     WHERE jc.dealer_id = ?
       AND wc.deleted_at IS NULL
       AND wc.submitted_at > DATE_SUB(NOW(), INTERVAL 30 DAY)`,
    [dealerId]
  );

  const total = rows.length;
  if (total < SUSPICIOUS_MIN_CLAIMS) return { suspicious: false };

  const flaggedOrRejected = rows.filter((r: any) => r.is_flagged === 1 || r.status === 'rejected').length;
  const rate = flaggedOrRejected / total;

  if (rate >= SUSPICIOUS_FLAG_RATE) {
    return {
      suspicious: true,
      reason: `Dealer has ${flaggedOrRejected}/${total} claims flagged or rejected in the last 30 days (${Math.round(rate * 100)}%) — above the normal pattern.`,
    };
  }
  return { suspicious: false };
}

export async function POST(request: Request) {
  const body = await request.json();
  const { chassisNumber, component, remarks } = body;

  if (!isValidChassisNumber(chassisNumber)) {
    return NextResponse.json(
      { success: false, error: 'Invalid chassis number format. Chassis numbers must be 8-20 alphanumeric characters.' },
      { status: 400 }
    );
  }

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

    // --- Fraud / duplicate check ---
    const duplicateCheck = await checkForDuplicateOrFraud(vehicle.vehicle_id, component);
    if (duplicateCheck.blocked) {
      return NextResponse.json(
        { success: false, error: duplicateCheck.reason },
        { status: 409 }
      );
    }

    // --- Suspicious dealer activity check (doesn't block, just flags) ---
    const dealerCheck = await checkSuspiciousDealerActivity(vehicle.dealer_id);

    const isFlagged = duplicateCheck.flagged || dealerCheck.suspicious;
    const flagReasons = [duplicateCheck.flagged && duplicateCheck.reason, dealerCheck.suspicious && dealerCheck.reason]
      .filter(Boolean) as string[];

    const claimNumber = generateClaimNumber();
    const finalRemarks = flagReasons.length
      ? `${remarks ?? ''}\n[SYSTEM FLAG: ${flagReasons.join(' | ')}]`.trim()
      : remarks ?? null;

    await pool.query(
      `INSERT INTO warranty_claims
        (claim_number, job_card_id, vehicle_id, component, warranty_status_at_claim, remarks, status, is_flagged)
       VALUES (?, ?, ?, ?, ?, ?, 'submitted', ?)`,
      [claimNumber, jobCardId, vehicle.vehicle_id, component, warrantyStatusAtClaim, finalRemarks, isFlagged ? 1 : 0]
    );

    return NextResponse.json({
      success: true,
      claimNumber,
      flagged: isFlagged,
      flagReason: flagReasons.length ? flagReasons.join(' | ') : undefined,
    });
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
      wc.status, wc.submitted_at, wc.resolved_at, wc.remarks, wc.approved_cost, wc.is_flagged,
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
  const { claimId, newStatus, remarks, approvedCost } = await request.json();

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
      const costValue = newStatus === 'company_approved' && approvedCost !== undefined && approvedCost !== null && approvedCost !== ''
        ? Number(approvedCost)
        : null;
      await pool.query(
        `UPDATE warranty_claims SET status = ?, resolved_at = NOW(), remarks = COALESCE(?, remarks), approved_cost = COALESCE(?, approved_cost) WHERE claim_id = ?`,
        [newStatus, remarks ?? null, costValue, claimId]
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
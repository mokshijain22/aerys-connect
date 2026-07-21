import { pool } from '@/app/lib/db';
import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { generateInvoiceForJobCard } from '../../lib/invoice';
import { autoAssignOverdueJobCards } from '../../lib/autoAssign';
import { sendNextServiceReminders } from '../../lib/serviceReminders';
import { notifyCustomerForJobCard, notifyDealerForJobCard } from '../../lib/notifications';

export const dynamic = 'force-dynamic';

let lastAutoAssignRun = 0;
let lastServiceReminderRun = 0;

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Fake service completion detection — no single check proves fraud, so we
// flag on any of these and let a human review, same pattern as the
// warranty-claim fraud check:
// 1. Marked complete under 2 minutes after work started — implausibly fast
// 2. Completion GPS location is >5km from the customer's registered address
// 3. No completion-stage photo/video was ever uploaded for this job
const MIN_SERVICE_MINUTES = 2;
const MAX_COMPLETION_DISTANCE_KM = 5;

async function checkFakeCompletion(jobCardId: string) {
  const [rows]: any = await pool.query(
    `SELECT service_started_at, dest_latitude, dest_longitude, completion_latitude, completion_longitude
     FROM job_cards WHERE job_card_id = ?`,
    [jobCardId]
  );
  const jc = rows[0];
  if (!jc) return { flagged: false, reasons: [] as string[] };

  const reasons: string[] = [];

  if (jc.service_started_at) {
    const minutesWorked = (Date.now() - new Date(jc.service_started_at).getTime()) / 60000;
    if (minutesWorked < MIN_SERVICE_MINUTES) {
      reasons.push(`Marked complete just ${minutesWorked.toFixed(1)} minute(s) after work started`);
    }
  }

  if (jc.completion_latitude != null && jc.completion_longitude != null && jc.dest_latitude != null && jc.dest_longitude != null) {
    const distanceKm = haversineKm(
      Number(jc.dest_latitude), Number(jc.dest_longitude),
      Number(jc.completion_latitude), Number(jc.completion_longitude)
    );
    if (distanceKm > MAX_COMPLETION_DISTANCE_KM) {
      reasons.push(`Completion location is ${distanceKm.toFixed(1)}km from the customer's registered address`);
    }
  }

  const [[attCount]]: any = await pool.query(
    `SELECT COUNT(*) AS total FROM job_card_attachments WHERE job_card_id = ? AND stage = 'completion' AND deleted_at IS NULL`,
    [jobCardId]
  );
  if (attCount.total === 0) {
    reasons.push('No completion photo/video was uploaded');
  }

  return { flagged: reasons.length > 0, reasons };
}

export async function POST(request: Request) {
  const body = await request.json();
  const {
    chassisNumber, complaintText, serviceType, partCategory, symptomType, priority,
    destLatitude, destLongitude, destAddressText,
  } = body;

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

    const hasCoords = typeof destLatitude === 'number' && typeof destLongitude === 'number';

    const [result]: any = await pool.query(
      `INSERT INTO job_cards
        (vehicle_id, dealer_id, complaint_text, service_type, part_category, symptom_type, priority, status,
         dest_latitude, dest_longitude, dest_address_text, dest_captured_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'registered', ?, ?, ?, ?)`,
      [
        vehicle.vehicle_id, vehicle.dealer_id, complaintText, serviceType,
        partCategory || null, symptomType || null, priority || 'normal',
        hasCoords ? destLatitude : null,
        hasCoords ? destLongitude : null,
        destAddressText || null,
        (hasCoords || destAddressText) ? new Date() : null,
      ]
    );

    notifyCustomerForJobCard(
      result.insertId,
      'Complaint registered',
      `Your complaint has been registered. Our team will get back to you shortly.`
    ).catch(() => {});
    notifyDealerForJobCard(
      result.insertId,
      'New job card',
      `A new job card has been registered and needs your acknowledgement.`
    ).catch(() => {});

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

  const now = Date.now();
  if (now - lastAutoAssignRun > 60_000) {
    lastAutoAssignRun = now;
    autoAssignOverdueJobCards().catch((err) => console.error('autoAssign failed:', err));
    pool.query(
      `UPDATE job_cards
       SET escalated = 1, escalated_at = NOW()
       WHERE escalated = 0
         AND status NOT IN ('delivered', 'cancelled')
         AND TIMESTAMPDIFF(MINUTE, registered_at, NOW()) > 360`
    ).catch((err) => console.error('escalation update failed:', err));
  }
  // Service reminders are a daily check, not a per-minute one — separate,
  // longer throttle so we don't scan job_cards on every request.
  if (now - lastServiceReminderRun > 24 * 60 * 60 * 1000) {
    lastServiceReminderRun = now;
    sendNextServiceReminders().catch((err) => console.error('service reminders failed:', err));
  }

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
      jc.part_category, jc.symptom_type, jc.priority,
      jc.registered_at, jc.escalated, jc.escalated_at, jc.arrived_at, jc.auto_assigned,
      jc.customer_verified_at, jc.verification_phone,
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

  query += ` ORDER BY FIELD(jc.priority, 'emergency', 'urgent', 'normal'), jc.registered_at DESC`;

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

  if (role === 'dealer' && !['acknowledged', 'rejected_by_dealer'].includes(newStatus)) {
    return NextResponse.json({ success: false, error: 'Use the delivery verification flow to mark a job delivered' }, { status: 403 });
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

      try {
        const { flagged, reasons } = await checkFakeCompletion(jobCardId);
        if (flagged) {
          await pool.query(
            `UPDATE job_cards SET completion_flagged = 1, completion_flag_reason = ? WHERE job_card_id = ?`,
            [reasons.join('; '), jobCardId]
          );
        }
      } catch (flagErr: any) {
        console.error('Fake completion check failed:', flagErr.message);
      }
    }

    const STATUS_MESSAGES: Record<string, { title: string; message: string }> = {
      acknowledged: { title: 'Complaint accepted', message: 'Your complaint has been accepted by the service centre. A technician will be assigned soon.' },
      rejected_by_dealer: { title: 'Complaint update', message: `Your complaint could not be processed: ${rejectionReason || 'no reason given'}. Please contact the dealer.` },
      in_progress: { title: 'Service started', message: 'The technician has started working on your vehicle.' },
      completed: { title: 'Service completed', message: 'Your service is complete. Please verify to confirm delivery.' },
      delivered: { title: 'Vehicle delivered', message: 'Your vehicle has been delivered. Thank you for choosing AERYS!' },
    };
    const notif = STATUS_MESSAGES[newStatus];
    if (notif) {
      notifyCustomerForJobCard(jobCardId, notif.title, notif.message).catch(() => {});
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
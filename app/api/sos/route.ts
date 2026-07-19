import { pool } from '@/app/lib/db';
import { NextResponse } from 'next/server';
import { auth } from '@/auth';

const REASONS = ['accident', 'safety_threat', 'medical', 'vehicle_breakdown', 'harassment', 'other'];

// POST: technician or customer raises an SOS
export async function POST(request: Request) {
  const session = await auth();
  const role = (session?.user as any)?.role || '';
  const userId = (session?.user as any)?.id || null;

  if (!session?.user) {
    return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
  }
  if (role !== 'technician' && role !== 'customer') {
    return NextResponse.json({ success: false, error: 'Only technicians and customers can raise SOS' }, { status: 403 });
  }

  const { reason, note, latitude, longitude, jobCardId } = await request.json();

  if (!REASONS.includes(reason)) {
    return NextResponse.json({ success: false, error: 'Invalid reason' }, { status: 400 });
  }

  try {
    let dealerId: number | null = null;

    if (jobCardId) {
      const [jcRows]: any = await pool.query(
        `SELECT jc.dealer_id, jc.technician_id, v.customer_id
         FROM job_cards jc JOIN vehicles v ON jc.vehicle_id = v.vehicle_id
         WHERE jc.job_card_id = ?`,
        [jobCardId]
      );
      if (jcRows.length === 0) {
        return NextResponse.json({ success: false, error: 'Job card not found' }, { status: 404 });
      }
      dealerId = jcRows[0].dealer_id;

      // sanity: make sure this job card actually belongs to the person raising SOS
      if (role === 'technician') {
        const [techRows]: any = await pool.query(
          'SELECT technician_id FROM technicians WHERE user_id = ? AND deleted_at IS NULL',
          [userId]
        );
        if (techRows[0]?.technician_id !== jcRows[0].technician_id) {
          return NextResponse.json({ success: false, error: 'This job card is not assigned to you' }, { status: 403 });
        }
      }
      if (role === 'customer') {
        const sessionCustomerId = (session?.user as any)?.customer_id || null;
        if (jcRows[0].customer_id !== sessionCustomerId) {
          return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 });
        }
      }
    } else {
      // General SOS (no job card) — technician's own dealer, or customer's most recent dealer
      if (role === 'technician') {
        dealerId = (session?.user as any)?.dealer_id || null;
      } else {
        const [rows]: any = await pool.query(
          `SELECT jc.dealer_id FROM job_cards jc
           JOIN vehicles v ON jc.vehicle_id = v.vehicle_id
           WHERE v.customer_id = ? ORDER BY jc.registered_at DESC LIMIT 1`,
          [(session?.user as any)?.customer_id || -1]
        );
        dealerId = rows[0]?.dealer_id ?? null;
      }
    }

    const [result]: any = await pool.query(
      `INSERT INTO sos_alerts (raised_by_user_id, raised_by_role, job_card_id, dealer_id, reason, note, latitude, longitude)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [userId, role, jobCardId || null, dealerId, reason, note || null, latitude ?? null, longitude ?? null]
    );

    return NextResponse.json({ success: true, sosId: result.insertId });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// GET: dealer/admin fetches open SOS alerts
export async function GET() {
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
    let query = `
      SELECT sa.sos_id, sa.raised_by_role, sa.job_card_id, sa.reason, sa.note,
             sa.latitude, sa.longitude, sa.status, sa.created_at,
             u.full_name AS raiser_name, u.phone AS raiser_phone
      FROM sos_alerts sa
      JOIN users u ON sa.raised_by_user_id = u.user_id
      WHERE sa.status = 'open'
    `;
    const params: any[] = [];
    if (role === 'dealer') {
      query += ` AND sa.dealer_id = ?`;
      params.push(sessionDealerId || -1);
    }
    query += ` ORDER BY sa.created_at DESC`;

    const [rows] = await pool.query(query, params);
    return NextResponse.json({ success: true, data: rows });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// PATCH: dealer/admin resolves an SOS
export async function PATCH(request: Request) {
  const session = await auth();
  const role = (session?.user as any)?.role || '';
  const sessionDealerId = (session?.user as any)?.dealer_id || null;
  const userId = (session?.user as any)?.id || null;

  if (!session?.user) {
    return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
  }
  if (role !== 'dealer' && role !== 'super_admin') {
    return NextResponse.json({ success: false, error: 'Not authorized' }, { status: 403 });
  }

  const { sosId } = await request.json();

  try {
    if (role === 'dealer') {
      const [rows]: any = await pool.query('SELECT dealer_id FROM sos_alerts WHERE sos_id = ?', [sosId]);
      if (rows.length === 0 || rows[0].dealer_id !== sessionDealerId) {
        return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 });
      }
    }

    await pool.query(
      `UPDATE sos_alerts SET status = 'resolved', resolved_at = NOW(), resolved_by = ? WHERE sos_id = ?`,
      [userId, sosId]
    );

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
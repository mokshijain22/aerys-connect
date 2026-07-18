import { pool } from '../../../lib/db';
import { NextResponse } from 'next/server';
import { auth } from '@/auth';

// GET: for the dealer's "Live Map" dashboard — every technician currently
// assigned to an active job for this dealer, with their latest known
// location (if shared).
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
      SELECT
        jc.job_card_id, jc.status, jc.dealer_id,
        t.technician_id, u.full_name AS technician_name, u.phone AS technician_phone,
        c.full_name AS customer_name, v.chassis_number,
        tl.latitude, tl.longitude, tl.accuracy_meters, tl.updated_at
      FROM job_cards jc
      JOIN technicians t ON jc.technician_id = t.technician_id
      JOIN users u ON t.user_id = u.user_id
      JOIN vehicles v ON jc.vehicle_id = v.vehicle_id
      JOIN customers c ON v.customer_id = c.customer_id
      LEFT JOIN technician_locations tl ON tl.technician_id = t.technician_id
      WHERE jc.status IN ('technician_assigned', 'in_progress')
    `;
    const params: any[] = [];
    if (role === 'dealer') {
      query += ` AND jc.dealer_id = ?`;
      params.push(sessionDealerId || -1);
    }
    query += ` ORDER BY tl.updated_at DESC`;

    const [rows]: any = await pool.query(query, params);

    const data = rows.map((r: any) => {
      const hasLocation = r.latitude != null;
      const secondsAgo = hasLocation ? Math.max(0, Math.round((Date.now() - new Date(r.updated_at).getTime()) / 1000)) : null;
      return {
        jobCardId: r.job_card_id,
        status: r.status,
        technicianId: r.technician_id,
        technicianName: r.technician_name,
        technicianPhone: r.technician_phone,
        customerName: r.customer_name,
        chassisNumber: r.chassis_number,
        latitude: hasLocation ? Number(r.latitude) : null,
        longitude: hasLocation ? Number(r.longitude) : null,
        accuracyMeters: r.accuracy_meters !== null ? Number(r.accuracy_meters) : null,
        secondsAgo,
        isStale: secondsAgo !== null ? secondsAgo > 180 : null,
      };
    });

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
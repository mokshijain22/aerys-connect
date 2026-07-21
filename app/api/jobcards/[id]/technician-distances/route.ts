import { pool } from '../../../../lib/db';
import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { haversineKm, estimateEtaMinutes } from '../../../../lib/geo';

const LOCATION_FRESH_MINUTES = 30;

// GET: for the manual "assign technician" dropdown on a specific job card —
// returns every active technician for the dealer, with distance/ETA to the
// job's destination if both the technician's location and the destination
// are known. Nearest-first; technicians with no usable location go last.
export async function GET(request: Request, { params }: { params: { id: string } }) {
  const session = await auth();
  const role = (session?.user as any)?.role || '';
  const sessionDealerId = (session?.user as any)?.dealer_id || null;

  if (!session?.user) {
    return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
  }
  if (role !== 'dealer' && role !== 'super_admin') {
    return NextResponse.json({ success: false, error: 'Not authorized' }, { status: 403 });
  }

  const jobCardId = params.id;

  try {
    const [jcRows]: any = await pool.query(
      'SELECT job_card_id, dealer_id, dest_latitude, dest_longitude FROM job_cards WHERE job_card_id = ?',
      [jobCardId]
    );
    if (jcRows.length === 0) {
      return NextResponse.json({ success: false, error: 'Job card not found' }, { status: 404 });
    }
    const jc = jcRows[0];
    if (role === 'dealer' && jc.dealer_id !== sessionDealerId) {
      return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 });
    }

    const destLat = jc.dest_latitude != null ? Number(jc.dest_latitude) : null;
    const destLng = jc.dest_longitude != null ? Number(jc.dest_longitude) : null;

    const [rows]: any = await pool.query(
      `SELECT t.technician_id, u.full_name,
              (SELECT COUNT(*) FROM job_cards jc2
               WHERE jc2.technician_id = t.technician_id
                 AND jc2.status IN ('technician_assigned','in_progress')) AS active_jobs,
              tl.latitude AS tech_lat, tl.longitude AS tech_lng
       FROM technicians t
       JOIN users u ON t.user_id = u.user_id
       LEFT JOIN technician_locations tl
         ON tl.technician_id = t.technician_id
         AND tl.updated_at > DATE_SUB(NOW(), INTERVAL ${LOCATION_FRESH_MINUTES} MINUTE)
       WHERE t.dealer_id = ?
         AND t.is_active = 1
         AND t.deleted_at IS NULL
       ORDER BY u.full_name ASC`,
      [jc.dealer_id]
    );

    const withDistance: any[] = [];
    const withoutDistance: any[] = [];

    for (const r of rows) {
      let distanceKm: number | null = null;
      let etaMinutes: number | null = null;
      if (destLat != null && destLng != null && r.tech_lat != null && r.tech_lng != null) {
        distanceKm = haversineKm(destLat, destLng, Number(r.tech_lat), Number(r.tech_lng));
        etaMinutes = estimateEtaMinutes(distanceKm);
      }
      const entry = {
        technicianId: r.technician_id,
        fullName: r.full_name,
        activeJobs: r.active_jobs,
        distanceKm: distanceKm !== null ? Math.round(distanceKm * 10) / 10 : null,
        etaMinutes,
      };
      if (distanceKm !== null) withDistance.push(entry);
      else withoutDistance.push(entry);
    }

    withDistance.sort((a, b) => a.distanceKm - b.distanceKm);

    return NextResponse.json({ success: true, data: [...withDistance, ...withoutDistance] });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
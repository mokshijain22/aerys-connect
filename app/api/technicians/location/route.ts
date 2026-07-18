import { pool } from '../../../lib/db';
import { NextResponse } from 'next/server';
import { auth } from '@/auth';

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

// Rough ETA assumption for doorstep EV service in mixed city/suburban traffic.
const ASSUMED_SPEED_KMH = 22;

// POST: technician pushes their current GPS position (see previous behaviour, unchanged).
export async function POST(request: Request) {
  const session = await auth();
  const role = (session?.user as any)?.role || '';
  const sessionUserId = (session?.user as any)?.id || null;

  if (!session?.user) {
    return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
  }
  if (role !== 'technician') {
    return NextResponse.json({ success: false, error: 'Only technicians can push location' }, { status: 403 });
  }

  const { latitude, longitude, accuracy, jobCardId } = await request.json();

  if (typeof latitude !== 'number' || typeof longitude !== 'number') {
    return NextResponse.json({ success: false, error: 'latitude and longitude are required numbers' }, { status: 400 });
  }
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    return NextResponse.json({ success: false, error: 'latitude/longitude out of range' }, { status: 400 });
  }

  try {
    const [techRows]: any = await pool.query(
      'SELECT technician_id FROM technicians WHERE user_id = ? AND deleted_at IS NULL',
      [sessionUserId]
    );
    const technicianId = techRows[0]?.technician_id;
    if (!technicianId) {
      return NextResponse.json({ success: false, error: 'Technician profile not found' }, { status: 403 });
    }

    let validatedJobCardId: number | null = null;
    if (jobCardId) {
      const [jcRows]: any = await pool.query(
        'SELECT job_card_id FROM job_cards WHERE job_card_id = ? AND technician_id = ?',
        [jobCardId, technicianId]
      );
      validatedJobCardId = jcRows[0]?.job_card_id ?? null;
    }

    await pool.query(
      `INSERT INTO technician_locations (technician_id, job_card_id, latitude, longitude, accuracy_meters)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         job_card_id = VALUES(job_card_id),
         latitude = VALUES(latitude),
         longitude = VALUES(longitude),
         accuracy_meters = VALUES(accuracy_meters),
         updated_at = CURRENT_TIMESTAMP`,
      [technicianId, validatedJobCardId, latitude, longitude, accuracy ?? null]
    );

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// PUT: customer (or dealer, on the customer's behalf) captures the service
// destination's GPS coordinates once, so distance/ETA can be computed.
// Typically called silently the first time the customer opens the tracking
// view, using the browser's own geolocation.
export async function PUT(request: Request) {
  const session = await auth();
  const role = (session?.user as any)?.role || '';
  const sessionCustomerId = (session?.user as any)?.customer_id || null;

  if (!session?.user) {
    return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
  }
  if (role !== 'customer' && role !== 'dealer' && role !== 'super_admin') {
    return NextResponse.json({ success: false, error: 'Not authorized' }, { status: 403 });
  }

  const { jobCardId, latitude, longitude } = await request.json();

  if (!jobCardId || typeof latitude !== 'number' || typeof longitude !== 'number') {
    return NextResponse.json({ success: false, error: 'jobCardId, latitude and longitude are required' }, { status: 400 });
  }

  try {
    const [jcRows]: any = await pool.query(
      `SELECT jc.job_card_id, v.customer_id
       FROM job_cards jc JOIN vehicles v ON jc.vehicle_id = v.vehicle_id
       WHERE jc.job_card_id = ?`,
      [jobCardId]
    );
    if (jcRows.length === 0) {
      return NextResponse.json({ success: false, error: 'Job card not found' }, { status: 404 });
    }
    if (role === 'customer' && jcRows[0].customer_id !== sessionCustomerId) {
      return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 });
    }

    await pool.query(
      `UPDATE job_cards SET dest_latitude = ?, dest_longitude = ? WHERE job_card_id = ?`,
      [latitude, longitude, jobCardId]
    );

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// GET: fetch a technician's latest location for a specific job card, plus
// distance/ETA to the customer's destination if it has been captured.
export async function GET(request: Request) {
  const session = await auth();
  const role = (session?.user as any)?.role || '';
  const sessionDealerId = (session?.user as any)?.dealer_id || null;
  const sessionCustomerId = (session?.user as any)?.customer_id || null;
  const sessionUserId = (session?.user as any)?.id || null;

  if (!session?.user) {
    return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const jobCardId = searchParams.get('jobCardId');

  if (!jobCardId) {
    return NextResponse.json({ success: false, error: 'jobCardId is required' }, { status: 400 });
  }

  try {
    const [jcRows]: any = await pool.query(
      `SELECT jc.job_card_id, jc.dealer_id, jc.technician_id, jc.status, jc.dest_latitude, jc.dest_longitude,
              v.customer_id
       FROM job_cards jc
       JOIN vehicles v ON jc.vehicle_id = v.vehicle_id
       WHERE jc.job_card_id = ?`,
      [jobCardId]
    );

    if (jcRows.length === 0) {
      return NextResponse.json({ success: false, error: 'Job card not found' }, { status: 404 });
    }
    const jc = jcRows[0];

    if (role === 'dealer' && jc.dealer_id !== sessionDealerId) {
      return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 });
    }
    if (role === 'customer' && jc.customer_id !== sessionCustomerId) {
      return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 });
    }
    if (role === 'technician') {
      const [techRows]: any = await pool.query(
        'SELECT technician_id FROM technicians WHERE user_id = ?',
        [sessionUserId]
      );
      if (techRows[0]?.technician_id !== jc.technician_id) {
        return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 });
      }
    }

    if (!jc.technician_id) {
      return NextResponse.json({ success: true, data: null, message: 'No technician assigned yet' });
    }

    const [locRows]: any = await pool.query(
      `SELECT tl.latitude, tl.longitude, tl.accuracy_meters, tl.updated_at,
              u.full_name AS technician_name, u.phone AS technician_phone
       FROM technician_locations tl
       JOIN technicians t ON tl.technician_id = t.technician_id
       JOIN users u ON t.user_id = u.user_id
       WHERE tl.technician_id = ?`,
      [jc.technician_id]
    );

    if (locRows.length === 0) {
      return NextResponse.json({ success: true, data: null, message: 'Technician has not shared location yet' });
    }

    const loc = locRows[0];
    const secondsAgo = Math.max(0, Math.round((Date.now() - new Date(loc.updated_at).getTime()) / 1000));

    let distanceKm: number | null = null;
    let etaMinutes: number | null = null;
    if (jc.dest_latitude != null && jc.dest_longitude != null) {
      distanceKm = haversineKm(
        Number(loc.latitude), Number(loc.longitude),
        Number(jc.dest_latitude), Number(jc.dest_longitude)
      );
      etaMinutes = Math.max(1, Math.round((distanceKm / ASSUMED_SPEED_KMH) * 60));
    }

    return NextResponse.json({
      success: true,
      data: {
        latitude: Number(loc.latitude),
        longitude: Number(loc.longitude),
        accuracyMeters: loc.accuracy_meters !== null ? Number(loc.accuracy_meters) : null,
        updatedAt: loc.updated_at,
        secondsAgo,
        isStale: secondsAgo > 180,
        technicianName: loc.technician_name,
        technicianPhone: loc.technician_phone,
        distanceKm: distanceKm !== null ? Math.round(distanceKm * 10) / 10 : null,
        etaMinutes,
        hasDestination: jc.dest_latitude != null,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
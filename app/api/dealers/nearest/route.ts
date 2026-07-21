import { pool } from '@/app/lib/db';
import { NextResponse } from 'next/server';
import { haversineKm } from '@/app/lib/geo';

// Public — no auth. Customer app uses this before booking a service,
// to show the closest approved dealers to their current location.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const lat = Number(searchParams.get('lat'));
  const lng = Number(searchParams.get('lng'));

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ success: false, error: 'lat and lng query params are required' }, { status: 400 });
  }

  try {
    const [rows]: any = await pool.query(
      `SELECT d.dealer_id, d.dealer_name, d.phone, d.address, d.latitude, d.longitude, c.city_name
       FROM dealers d
       JOIN cities c ON d.city_id = c.city_id
       WHERE d.deleted_at IS NULL AND d.is_approved = 1
         AND d.latitude IS NOT NULL AND d.longitude IS NOT NULL`
    );

    const withDistance = rows
      .map((d: any) => ({
        dealerId: d.dealer_id,
        dealerName: d.dealer_name,
        phone: d.phone,
        address: d.address,
        cityName: d.city_name,
        distanceKm: Math.round(haversineKm(lat, lng, Number(d.latitude), Number(d.longitude)) * 10) / 10,
      }))
      .sort((a: any, b: any) => a.distanceKm - b.distanceKm)
      .slice(0, 10);

    return NextResponse.json({ success: true, data: withDistance });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
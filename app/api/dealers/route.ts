import { NextResponse } from 'next/server';
import { pool } from '@/app/lib/db';
import { auth } from '@/auth';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status') || '';
    const city = searchParams.get('city') || '';

    let query = `
      SELECT d.dealer_id, d.dealer_name, d.phone, d.address,
             d.is_approved, d.approved_at, d.created_at,
             c.city_name
      FROM dealers d
      JOIN cities c ON d.city_id = c.city_id
      WHERE d.deleted_at IS NULL
    `;
    const params: any[] = [];

    if (search) {
      query += ` AND (d.dealer_name LIKE ? OR c.city_name LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`);
    }
    if (status === 'active') {
      query += ` AND d.is_approved = 1`;
    } else if (status === 'inactive') {
      query += ` AND d.is_approved = 0`;
    }
    if (city) {
      query += ` AND c.city_name = ?`;
      params.push(city);
    }

    query += ` ORDER BY d.dealer_name ASC`;

    const [rows]: any = await pool.query(query, params);

    const [[totalRow]]: any = await pool.query(
      `SELECT COUNT(*) AS total FROM dealers WHERE deleted_at IS NULL`
    );
    const [[activeRow]]: any = await pool.query(
      `SELECT COUNT(*) AS total FROM dealers WHERE deleted_at IS NULL AND is_approved = 1`
    );
    // Cities that already have at least one dealer — used for the filter dropdown
    const [cityRows]: any = await pool.query(
      `SELECT DISTINCT c.city_name FROM dealers d
       JOIN cities c ON d.city_id = c.city_id
       WHERE d.deleted_at IS NULL ORDER BY c.city_name ASC`
    );

    // Full State -> City hierarchy pan-India, for the "Add Dealer" cascading dropdowns.
    const [locRows]: any = await pool.query(
      `SELECT s.state_id, s.state_name, c.city_id, c.city_name
       FROM cities c
       JOIN districts dist ON c.district_id = dist.district_id
       JOIN states s ON dist.state_id = s.state_id
       ORDER BY s.state_name ASC, c.city_name ASC`
    );

    const statesMap = new Map<number, string>();
    const citiesByState: Record<number, { city_id: number; city_name: string }[]> = {};
    for (const r of locRows) {
      statesMap.set(r.state_id, r.state_name);
      if (!citiesByState[r.state_id]) citiesByState[r.state_id] = [];
      citiesByState[r.state_id].push({ city_id: r.city_id, city_name: r.city_name });
    }
    const states = Array.from(statesMap.entries()).map(([state_id, state_name]) => ({ state_id, state_name }));

    // All dealers (id/name/city) — used by the Technicians page so super_admin
    // can pick which dealer/service centre a new technician belongs to.
    const [dealerListRows]: any = await pool.query(
      `SELECT d.dealer_id, d.dealer_name, c.city_name
       FROM dealers d JOIN cities c ON d.city_id = c.city_id
       WHERE d.deleted_at IS NULL ORDER BY d.dealer_name ASC`
    );

    return NextResponse.json({
      success: true,
      data: rows,
      stats: {
        totalDealers: totalRow.total,
        activeDealers: activeRow.total,
        activePercent: totalRow.total ? Math.round((activeRow.total / totalRow.total) * 100 * 10) / 10 : 0,
      },
      cities: cityRows.map((r: any) => r.city_name),
      states,
      citiesByState,
      dealerList: dealerListRows,
    });
  } catch (error: any) {
    console.error('Error fetching dealers:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const { dealerId, isApproved } = await request.json();
    await pool.query(
      `UPDATE dealers SET is_approved = ?, approved_at = ? WHERE dealer_id = ?`,
      [isApproved ? 1 : 0, isApproved ? new Date() : null, dealerId]
    );
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
export async function POST(request: Request) {
  try {
    const session = await auth();
    const role = (session?.user as any)?.role || '';

    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
    }
    if (role !== 'super_admin') {
      return NextResponse.json({ success: false, error: 'Only super admin can add dealers' }, { status: 403 });
    }

    const { dealerName, phone, address, cityName } = await request.json();

    if (!dealerName || !cityName) {
      return NextResponse.json({ success: false, error: 'Dealer name and city are required' }, { status: 400 });
    }

    const [[cityRow]]: any = await pool.query(
      `SELECT city_id FROM cities WHERE city_name = ?`,
      [cityName]
    );
    if (!cityRow) {
      return NextResponse.json({ success: false, error: 'Invalid city selected' }, { status: 400 });
    }
    const cityId = cityRow.city_id;

    const [result]: any = await pool.query(
      `INSERT INTO dealers (dealer_name, phone, address, city_id, is_approved, created_at)
       VALUES (?, ?, ?, ?, 0, NOW())`,
      [dealerName, phone || null, address || null, cityId]
    );

    return NextResponse.json({ success: true, dealerId: result.insertId });
  } catch (error: any) {
    console.error('Error creating dealer:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
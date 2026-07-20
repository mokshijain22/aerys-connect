import { NextResponse } from 'next/server';
import { pool } from '@/app/lib/db';
import { auth } from '@/auth';

export async function GET(request: Request) {
  try {
    const session = await auth();
    const role = (session?.user as any)?.role || '';
    const sessionDealerId = (session?.user as any)?.dealer_id || null;

    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const days = Number(searchParams.get('days')) || 30;
    const limit = Number(searchParams.get('limit')) || 10;
    let dealerId = searchParams.get('dealer') || '';

    if (role === 'dealer') {
      dealerId = sessionDealerId ? String(sessionDealerId) : '-1';
    }

    let query = `
      SELECT sp.part_id, sp.part_name, sp.part_code, sp.category, sp.unit_price,
             SUM(jcp.quantity) AS total_quantity_used,
             COUNT(DISTINCT jcp.job_card_id) AS jobs_used_in
      FROM job_card_parts_used jcp
      JOIN spare_parts sp ON jcp.part_id = sp.part_id
      JOIN job_cards jc ON jcp.job_card_id = jc.job_card_id
      WHERE jc.registered_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
    `;
    const params: any[] = [days];

    if (dealerId) {
      query += ` AND jc.dealer_id = ?`;
      params.push(dealerId);
    }

    query += `
      GROUP BY sp.part_id, sp.part_name, sp.part_code, sp.category, sp.unit_price
      ORDER BY total_quantity_used DESC
      LIMIT ?
    `;
    params.push(limit);

    const [rows]: any = await pool.query(query, params);

    return NextResponse.json({
      success: true,
      data: rows,
      periodDays: days,
    });
  } catch (error: any) {
    console.error('Error fetching fast-moving parts report:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
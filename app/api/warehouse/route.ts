import { NextResponse } from 'next/server';
import { pool } from '@/app/lib/db';
import { auth } from '@/auth';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';

    let query = `
      SELECT ws.part_id, ws.quantity, sp.part_name, sp.part_code, sp.category, sp.unit_price
      FROM warehouse_stock ws
      JOIN spare_parts sp ON ws.part_id = sp.part_id
      WHERE 1=1
    `;
    const params: any[] = [];
    if (search) {
      query += ` AND (sp.part_name LIKE ? OR sp.part_code LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`);
    }
    query += ` ORDER BY sp.part_name ASC`;

    const [rows]: any = await pool.query(query, params);

    const [[totals]]: any = await pool.query(
      `SELECT COUNT(*) AS total_parts, COALESCE(SUM(ws.quantity), 0) AS total_units,
              COALESCE(SUM(ws.quantity * sp.unit_price), 0) AS total_value
       FROM warehouse_stock ws JOIN spare_parts sp ON ws.part_id = sp.part_id`
    );
    const [[pendingCount]]: any = await pool.query(
      `SELECT COUNT(*) AS pending FROM part_dispatches WHERE status IN ('created','in_transit')`
    );

    const [dealerRows]: any = await pool.query(
      `SELECT dealer_id, dealer_name FROM dealers WHERE deleted_at IS NULL ORDER BY dealer_name ASC`
    );
    const [partRows]: any = await pool.query(
      `SELECT part_id, part_name, part_code, category, unit_price FROM spare_parts ORDER BY part_name ASC`
    );
    const [dispatchRows]: any = await pool.query(
      `SELECT pd.dispatch_id, pd.part_id, pd.dealer_id, pd.quantity, pd.status,
              pd.created_at, pd.dispatched_at, pd.received_at,
              sp.part_name, sp.part_code, d.dealer_name
       FROM part_dispatches pd
       JOIN spare_parts sp ON pd.part_id = sp.part_id
       JOIN dealers d ON pd.dealer_id = d.dealer_id
       ORDER BY pd.created_at DESC`
    );

    return NextResponse.json({
      success: true,
      data: rows,
      stats: {
        totalParts: totals.total_parts,
        totalUnits: totals.total_units,
        totalValue: totals.total_value,
        pendingDispatches: pendingCount.pending,
      },
      dealers: dealerRows,
      parts: partRows,
      dispatches: dispatchRows,
    });
  } catch (error: any) {
    console.error('Error fetching warehouse stock:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    const role = (session?.user as any)?.role || '';
    if (!session?.user || role !== 'super_admin') {
      return NextResponse.json({ success: false, error: 'Only super admin can add warehouse stock' }, { status: 403 });
    }

    const body = await request.json();
    const { partId, quantity } = body;
    if (!partId || quantity === undefined) {
      return NextResponse.json({ success: false, error: 'Part and quantity are required' }, { status: 400 });
    }

    await pool.query(
      `INSERT INTO warehouse_stock (part_id, quantity) VALUES (?, ?)
       ON DUPLICATE KEY UPDATE quantity = quantity + VALUES(quantity)`,
      [partId, quantity]
    );

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error adding warehouse stock:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
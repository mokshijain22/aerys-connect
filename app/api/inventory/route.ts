import { NextResponse } from 'next/server';
import { pool } from '@/app/lib/db';
import { auth } from '@/auth';

export async function GET(request: Request) {
  try {
    const session = await auth();
    const role = (session?.user as any)?.role || '';
    const sessionDealerId = (session?.user as any)?.dealer_id || null;

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status') || '';
    const category = searchParams.get('category') || '';
    let dealerId = searchParams.get('dealer') || '';

    if (role === 'dealer') {
      dealerId = sessionDealerId ? String(sessionDealerId) : '-1';
    }

    let query = `
      SELECT ds.dealer_id, ds.part_id, ds.quantity, ds.min_stock_alert,
             sp.part_name, sp.part_code, sp.category, sp.unit_price,
             d.dealer_name
      FROM dealer_stock ds
      JOIN spare_parts sp ON ds.part_id = sp.part_id
      JOIN dealers d ON ds.dealer_id = d.dealer_id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (search) {
      query += ` AND (sp.part_name LIKE ? OR sp.part_code LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`);
    }
    if (dealerId) {
      query += ` AND ds.dealer_id = ?`;
      params.push(dealerId);
    }
    if (category) {
      query += ` AND sp.category = ?`;
      params.push(category);
    }
    if (status === 'in_stock') {
      query += ` AND ds.quantity > ds.min_stock_alert`;
    } else if (status === 'low_stock') {
      query += ` AND ds.quantity > 0 AND ds.quantity <= ds.min_stock_alert`;
    } else if (status === 'out_of_stock') {
      query += ` AND ds.quantity = 0`;
    }

    query += ` ORDER BY sp.part_name ASC`;

    const [rows]: any = await pool.query(query, params);

    let statsQuery = `
      SELECT
        COUNT(*) AS total_rows,
        SUM(CASE WHEN quantity > min_stock_alert THEN 1 ELSE 0 END) AS in_stock_count,
        SUM(CASE WHEN quantity > 0 AND quantity <= min_stock_alert THEN 1 ELSE 0 END) AS low_stock_count,
        SUM(CASE WHEN quantity = 0 THEN 1 ELSE 0 END) AS out_of_stock_count
      FROM dealer_stock
    `;
    let valueQuery = `
      SELECT SUM(ds.quantity * sp.unit_price) AS total_value
      FROM dealer_stock ds
      JOIN spare_parts sp ON ds.part_id = sp.part_id
    `;
    const statsParams: any[] = [];
    const valueParams: any[] = [];
    if (role === 'dealer') {
      statsQuery += ` WHERE dealer_id = ?`;
      statsParams.push(dealerId);
      valueQuery += ` WHERE ds.dealer_id = ?`;
      valueParams.push(dealerId);
    }

    const [[totals]]: any = await pool.query(statsQuery, statsParams);
    const [[valueRow]]: any = await pool.query(valueQuery, valueParams);

    const [dealerRows]: any = role === 'dealer'
      ? await pool.query(`SELECT dealer_id, dealer_name FROM dealers WHERE dealer_id = ? AND deleted_at IS NULL`, [dealerId])
      : await pool.query(`SELECT dealer_id, dealer_name FROM dealers WHERE deleted_at IS NULL ORDER BY dealer_name ASC`);

    const [partRows]: any = await pool.query(
      `SELECT part_id, part_name, part_code, category, unit_price FROM spare_parts ORDER BY part_name ASC`
    );

    const CATEGORIES = ['Battery', 'Motor', 'Charger', 'Brakes', 'Electrical', 'Body', 'Tyres', 'Other'];

    return NextResponse.json({
      success: true,
      data: rows,
      stats: {
        totalItems: totals.total_rows,
        inStock: totals.in_stock_count,
        lowStock: totals.low_stock_count,
        outOfStock: totals.out_of_stock_count,
        totalValue: valueRow.total_value || 0,
      },
      dealers: dealerRows,
      parts: partRows,
      categories: CATEGORIES,
    });
  } catch (error: any) {
    console.error('Error fetching inventory:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await auth();
    const role = (session?.user as any)?.role || '';
    const sessionDealerId = (session?.user as any)?.dealer_id || null;

    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
    }
    if (role !== 'super_admin' && role !== 'dealer') {
      return NextResponse.json({ success: false, error: 'Not authorized' }, { status: 403 });
    }

    const body = await request.json();
    const { partId, quantity, minStockAlert } = body;
    const dealerId = role === 'dealer' ? sessionDealerId : body.dealerId;

    if (!dealerId) {
      return NextResponse.json({ success: false, error: 'No dealer specified' }, { status: 400 });
    }

    await pool.query(
      `UPDATE dealer_stock SET quantity = ?, min_stock_alert = ? WHERE dealer_id = ? AND part_id = ?`,
      [quantity, minStockAlert, dealerId, partId]
    );
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { mode, quantity, minStockAlert } = body;

    const session = await auth();
    const role = (session?.user as any)?.role || '';
    const sessionDealerId = (session?.user as any)?.dealer_id || null;

    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
    }

    // dealers can only add stock for their own dealer — ignore whatever the client sent
    const dealerId = role === 'dealer' ? sessionDealerId : body.dealerId;

    if (!dealerId) {
      return NextResponse.json({ success: false, error: 'No dealer specified' }, { status: 400 });
    }

    let partId = body.partId;

    if (mode === 'new') {
      const { partName, partCode, unitPrice, category } = body;
      if (!partName || !partCode || unitPrice === undefined) {
        return NextResponse.json({ success: false, error: 'Part name, code, and unit price are required' }, { status: 400 });
      }
      const [insertPart]: any = await pool.query(
        `INSERT INTO spare_parts (part_name, part_code, unit_price, category) VALUES (?, ?, ?, ?)`,
        [partName, partCode, unitPrice, category || null]
      );
      partId = insertPart.insertId;
    }

    if (!partId || !dealerId || quantity === undefined) {
      return NextResponse.json({ success: false, error: 'Part, dealer, and quantity are required' }, { status: 400 });
    }

    await pool.query(
      `INSERT INTO dealer_stock (dealer_id, part_id, quantity, min_stock_alert)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE quantity = quantity + VALUES(quantity), min_stock_alert = VALUES(min_stock_alert)`,
      [dealerId, partId, quantity, minStockAlert || 0]
    );

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error adding inventory item:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
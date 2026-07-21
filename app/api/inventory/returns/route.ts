import { NextResponse } from 'next/server';
import { pool } from '@/app/lib/db';
import { auth } from '@/auth';

export async function GET(request: Request) {
  try {
    const session = await auth();
    const role = (session?.user as any)?.role || '';
    const sessionDealerId = (session?.user as any)?.dealer_id || null;

    const { searchParams } = new URL(request.url);
    let dealerId = searchParams.get('dealer') || '';
    const status = searchParams.get('status') || '';

    if (role === 'dealer') {
      dealerId = sessionDealerId ? String(sessionDealerId) : '-1';
    }

    let query = `
      SELECT pr.return_id, pr.dealer_id, pr.part_id, pr.quantity, pr.reason,
             pr.status, pr.reported_at, pr.resolved_at,
             sp.part_name, sp.part_code, d.dealer_name
      FROM part_returns pr
      JOIN spare_parts sp ON pr.part_id = sp.part_id
      JOIN dealers d ON pr.dealer_id = d.dealer_id
      WHERE 1=1
    `;
    const params: any[] = [];
    if (dealerId) {
      query += ` AND pr.dealer_id = ?`;
      params.push(dealerId);
    }
    if (status) {
      query += ` AND pr.status = ?`;
      params.push(status);
    }
    query += ` ORDER BY pr.reported_at DESC`;

    const [rows]: any = await pool.query(query, params);
    return NextResponse.json({ success: true, data: rows });
  } catch (error: any) {
    console.error('Error fetching returns:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    const role = (session?.user as any)?.role || '';
    const sessionDealerId = (session?.user as any)?.dealer_id || null;
    const sessionUserId = (session?.user as any)?.id || null;

    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
    }

    const body = await request.json();
    const { partId, quantity, reason } = body;
    const dealerId = role === 'dealer' ? sessionDealerId : body.dealerId;

    if (!dealerId || !partId || !quantity || !reason) {
      return NextResponse.json({ success: false, error: 'Dealer, part, quantity, and reason are required' }, { status: 400 });
    }

    const [stockRows]: any = await pool.query(
      `SELECT quantity FROM dealer_stock WHERE dealer_id = ? AND part_id = ?`,
      [dealerId, partId]
    );
    if (stockRows.length === 0 || stockRows[0].quantity < quantity) {
      return NextResponse.json({ success: false, error: 'Not enough stock at this dealer to return that quantity' }, { status: 400 });
    }

    await pool.query(
      `INSERT INTO part_returns (dealer_id, part_id, quantity, reason, reported_by)
       VALUES (?, ?, ?, ?, ?)`,
      [dealerId, partId, quantity, reason, sessionUserId]
    );

    // Pull the damaged units out of sellable stock immediately.
    await pool.query(
      `UPDATE dealer_stock SET quantity = quantity - ? WHERE dealer_id = ? AND part_id = ?`,
      [quantity, dealerId, partId]
    );

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error creating return:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await auth();
    const role = (session?.user as any)?.role || '';
    if (role !== 'super_admin') {
      return NextResponse.json({ success: false, error: 'Not authorized' }, { status: 403 });
    }

    const body = await request.json();
    const { returnId, status } = body;
    if (!returnId || !['approved', 'rejected'].includes(status)) {
      return NextResponse.json({ success: false, error: 'Valid returnId and status are required' }, { status: 400 });
    }

    await pool.query(
      `UPDATE part_returns SET status = ?, resolved_at = NOW() WHERE return_id = ?`,
      [status, returnId]
    );
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
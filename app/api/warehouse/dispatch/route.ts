import { NextResponse } from 'next/server';
import { pool } from '@/app/lib/db';
import { auth } from '@/auth';

export async function POST(request: Request) {
  const conn = await pool.getConnection();
  try {
    const session = await auth();
    const role = (session?.user as any)?.role || '';
    if (!session?.user || role !== 'super_admin') {
      return NextResponse.json({ success: false, error: 'Only super admin can create dispatches' }, { status: 403 });
    }

    const body = await request.json();
    const { partId, dealerId, quantity } = body;
    if (!partId || !dealerId || !quantity) {
      return NextResponse.json({ success: false, error: 'Part, dealer, and quantity are required' }, { status: 400 });
    }

    await conn.beginTransaction();

    const [[stockRow]]: any = await conn.query(
      `SELECT quantity FROM warehouse_stock WHERE part_id = ? FOR UPDATE`,
      [partId]
    );
    if (!stockRow || stockRow.quantity < quantity) {
      await conn.rollback();
      return NextResponse.json({ success: false, error: 'Not enough warehouse stock for this dispatch' }, { status: 400 });
    }

    await conn.query(
      `UPDATE warehouse_stock SET quantity = quantity - ? WHERE part_id = ?`,
      [quantity, partId]
    );
    await conn.query(
      `INSERT INTO part_dispatches (part_id, dealer_id, quantity, status) VALUES (?, ?, ?, 'created')`,
      [partId, dealerId, quantity]
    );

    await conn.commit();
    return NextResponse.json({ success: true });
  } catch (error: any) {
    await conn.rollback();
    console.error('Error creating dispatch:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  } finally {
    conn.release();
  }
}

export async function PATCH(request: Request) {
  const conn = await pool.getConnection();
  try {
    const session = await auth();
    const role = (session?.user as any)?.role || '';
    if (!session?.user || (role !== 'super_admin' && role !== 'dealer')) {
      return NextResponse.json({ success: false, error: 'Not authorized' }, { status: 403 });
    }

    const body = await request.json();
    const { dispatchId, status } = body;
    if (!dispatchId || !['in_transit', 'received'].includes(status)) {
      return NextResponse.json({ success: false, error: 'Valid dispatchId and status are required' }, { status: 400 });
    }

    await conn.beginTransaction();

    const [[dispatch]]: any = await conn.query(
      `SELECT * FROM part_dispatches WHERE dispatch_id = ? FOR UPDATE`,
      [dispatchId]
    );
    if (!dispatch) {
      await conn.rollback();
      return NextResponse.json({ success: false, error: 'Dispatch not found' }, { status: 404 });
    }

    // Dealers can only mark their own dispatches received; only super_admin can mark in_transit.
    const sessionDealerId = (session?.user as any)?.dealer_id || null;
    if (role === 'dealer' && (status !== 'received' || dispatch.dealer_id !== sessionDealerId)) {
      await conn.rollback();
      return NextResponse.json({ success: false, error: 'Not authorized for this action' }, { status: 403 });
    }

    if (status === 'in_transit') {
      if (dispatch.status !== 'created') {
        await conn.rollback();
        return NextResponse.json({ success: false, error: 'Dispatch must be in "created" status first' }, { status: 400 });
      }
      await conn.query(
        `UPDATE part_dispatches SET status = 'in_transit', dispatched_at = NOW() WHERE dispatch_id = ?`,
        [dispatchId]
      );
    } else if (status === 'received') {
      if (dispatch.status !== 'in_transit') {
        await conn.rollback();
        return NextResponse.json({ success: false, error: 'Dispatch must be in "in_transit" status first' }, { status: 400 });
      }
      await conn.query(
        `UPDATE part_dispatches SET status = 'received', received_at = NOW() WHERE dispatch_id = ?`,
        [dispatchId]
      );
      await conn.query(
        `INSERT INTO dealer_stock (dealer_id, part_id, quantity, min_stock_alert)
         VALUES (?, ?, ?, 0)
         ON DUPLICATE KEY UPDATE quantity = quantity + VALUES(quantity)`,
        [dispatch.dealer_id, dispatch.part_id, dispatch.quantity]
      );
    }

    await conn.commit();
    return NextResponse.json({ success: true });
  } catch (error: any) {
    await conn.rollback();
    console.error('Error updating dispatch:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  } finally {
    conn.release();
  }
}
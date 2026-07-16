import { NextResponse } from 'next/server';
import { pool } from '@/app/lib/db';
import { auth } from '@/auth';

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await auth();
    const role = (session?.user as any)?.role || '';
    const sessionDealerId = (session?.user as any)?.dealer_id || null;

    if (role !== 'super_admin' && role !== 'dealer') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const technicianId = params.id;
    const body = await req.json();
    const { full_name, phone, email, is_active } = body;

    // Verify ownership if dealer
    if (role === 'dealer') {
      const [[tech]]: any = await pool.query(
        `SELECT dealer_id FROM technicians WHERE technician_id = ? AND deleted_at IS NULL`,
        [technicianId]
      );
      if (!tech || tech.dealer_id !== sessionDealerId) {
        return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
      }
    }

    const [[tech]]: any = await pool.query(
      `SELECT user_id FROM technicians WHERE technician_id = ? AND deleted_at IS NULL`,
      [technicianId]
    );
    if (!tech) {
      return NextResponse.json({ success: false, error: 'Technician not found' }, { status: 404 });
    }

    if (full_name || phone || email) {
      await pool.query(
        `UPDATE users SET full_name = COALESCE(?, full_name), phone = COALESCE(?, phone), email = COALESCE(?, email) WHERE user_id = ?`,
        [full_name || null, phone || null, email || null, tech.user_id]
      );
    }

    if (typeof is_active === 'boolean') {
      await pool.query(`UPDATE technicians SET is_active = ? WHERE technician_id = ?`, [is_active ? 1 : 0, technicianId]);
      await pool.query(`UPDATE users SET is_active = ? WHERE user_id = ?`, [is_active ? 1 : 0, tech.user_id]);
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error updating technician:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await auth();
    const role = (session?.user as any)?.role || '';
    const sessionDealerId = (session?.user as any)?.dealer_id || null;

    if (role !== 'super_admin' && role !== 'dealer') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const technicianId = params.id;

    if (role === 'dealer') {
      const [[tech]]: any = await pool.query(
        `SELECT dealer_id FROM technicians WHERE technician_id = ? AND deleted_at IS NULL`,
        [technicianId]
      );
      if (!tech || tech.dealer_id !== sessionDealerId) {
        return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
      }
    }

    await pool.query(`UPDATE technicians SET deleted_at = NOW() WHERE technician_id = ?`, [technicianId]);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting technician:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
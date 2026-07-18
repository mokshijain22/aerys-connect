import { pool } from '../../../../lib/db';
import { NextResponse } from 'next/server';
import { auth } from '@/auth';

// POST: technician saves their GPS position at the moment of marking a job complete.
// This is separate from the completion photo upload — call it right before or
// right after that upload from the frontend.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  const role = (session?.user as any)?.role || '';
  const sessionUserId = (session?.user as any)?.id || null;

  if (!session?.user) {
    return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
  }
  if (role !== 'technician') {
    return NextResponse.json({ success: false, error: 'Only technicians can log completion location' }, { status: 403 });
  }

  const { latitude, longitude } = await request.json();

  if (typeof latitude !== 'number' || typeof longitude !== 'number') {
    return NextResponse.json({ success: false, error: 'latitude and longitude are required numbers' }, { status: 400 });
  }

  try {
    const [techRows]: any = await pool.query(
      'SELECT technician_id FROM technicians WHERE user_id = ? AND deleted_at IS NULL',
      [sessionUserId]
    );
    const myTechnicianId = techRows[0]?.technician_id ?? null;
    if (!myTechnicianId) {
      return NextResponse.json({ success: false, error: 'Technician profile not found' }, { status: 403 });
    }

    const [jcRows]: any = await pool.query(
      'SELECT technician_id FROM job_cards WHERE job_card_id = ?',
      [id]
    );
    if (jcRows.length === 0) {
      return NextResponse.json({ success: false, error: 'Job card not found' }, { status: 404 });
    }
    if (jcRows[0].technician_id !== myTechnicianId) {
      return NextResponse.json({ success: false, error: 'This job card is not assigned to you' }, { status: 403 });
    }

    await pool.query(
      `UPDATE job_cards
       SET completion_latitude = ?, completion_longitude = ?, completion_location_captured_at = NOW()
       WHERE job_card_id = ?`,
      [latitude, longitude, id]
    );

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
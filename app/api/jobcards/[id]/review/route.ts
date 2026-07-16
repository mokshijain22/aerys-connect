import { pool } from '../../../../lib/db';
import { NextResponse } from 'next/server';
import { auth } from '@/auth';

// GET: returns all reviews for a job card, keyed by reviewer_role
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [rows]: any = await pool.query(
    'SELECT review_id, reviewer_role, rating, review_text, created_at FROM job_card_reviews WHERE job_card_id = ?',
    [id]
  );
  const byRole: Record<string, any> = {};
  for (const r of rows) byRole[r.reviewer_role] = r;
  return NextResponse.json({ success: true, data: byRole });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const jobCardId = Number(id);
  const { rating, reviewText } = await request.json();

  const session = await auth();
  const role = (session?.user as any)?.role || '';
  const customerId = (session?.user as any)?.customer_id || null;
  const technicianId = (session?.user as any)?.technician_id || null;
  const dealerId = (session?.user as any)?.dealer_id || null;

  if (!session?.user) {
    return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
  }
  if (!['customer', 'technician', 'dealer'].includes(role)) {
    return NextResponse.json({ success: false, error: 'This role cannot leave a review' }, { status: 403 });
  }
  if (!rating || rating < 1 || rating > 5) {
    return NextResponse.json({ success: false, error: 'Rating must be between 1 and 5' }, { status: 400 });
  }

  try {
    const [jcRows]: any = await pool.query(
      `SELECT jc.status, jc.dealer_id, jc.technician_id, v.customer_id
       FROM job_cards jc JOIN vehicles v ON jc.vehicle_id = v.vehicle_id
       WHERE jc.job_card_id = ?`,
      [jobCardId]
    );
    if (jcRows.length === 0) {
      return NextResponse.json({ success: false, error: 'Job card not found' }, { status: 404 });
    }
    const jc = jcRows[0];

    if (jc.status !== 'delivered') {
      return NextResponse.json({ success: false, error: 'You can only review after the job is delivered' }, { status: 400 });
    }

    // Access control per role — each role reviews a different party:
    //   customer   -> reviews the service overall
    //   technician -> reviews the customer
    //   dealer     -> reviews the technician who worked the job
    if (role === 'customer' && jc.customer_id !== customerId) {
      return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 });
    }
    if (role === 'technician' && jc.technician_id !== technicianId) {
      return NextResponse.json({ success: false, error: 'This job is not assigned to you' }, { status: 403 });
    }
    if (role === 'dealer' && jc.dealer_id !== dealerId) {
      return NextResponse.json({ success: false, error: 'This job does not belong to your dealership' }, { status: 403 });
    }

    await pool.query(
      `INSERT INTO job_card_reviews (job_card_id, customer_id, reviewer_role, rating, review_text)
       VALUES (?, ?, ?, ?, ?)`,
      [jobCardId, role === 'customer' ? customerId : null, role, rating, reviewText || null]
    );

    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error.code === 'ER_DUP_ENTRY') {
      return NextResponse.json({ success: false, error: 'You already reviewed this job' }, { status: 409 });
    }
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
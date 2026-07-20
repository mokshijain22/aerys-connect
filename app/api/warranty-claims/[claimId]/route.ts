import { pool } from '../../../lib/db';
import { NextResponse } from 'next/server';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ claimId: string }> }
) {
  try {
    const { claimId } = await params;
    const [rows]: any = await pool.query(
      `SELECT
        wc.claim_id, wc.claim_number, wc.component, wc.warranty_status_at_claim,
        wc.status, wc.submitted_at, wc.resolved_at, wc.remarks, wc.approved_cost, wc.is_flagged,
        v.chassis_number, c.full_name, c.phone,
        d.dealer_name
      FROM warranty_claims wc
      JOIN job_cards jc ON wc.job_card_id = jc.job_card_id
      JOIN vehicles v ON wc.vehicle_id = v.vehicle_id
      JOIN customers c ON v.customer_id = c.customer_id
      JOIN dealers d ON jc.dealer_id = d.dealer_id
      WHERE wc.claim_number = ?`,
      [claimId]
    );

    if (rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Claim not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: rows[0] });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
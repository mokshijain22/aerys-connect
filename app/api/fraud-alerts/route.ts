import { pool } from '@/app/lib/db';
import { NextResponse } from 'next/server';
import { auth } from '@/auth';

// GET: consolidated view of everything the platform's existing fraud/duplicate
// checks have already flagged — flagged warranty claims (checkForDuplicateOrFraud)
// and flagged job-card completions (checkFakeCompletion). Nothing new is
// detected here; this just surfaces what's already been marked so a dealer or
// admin has one place to review it, instead of stumbling onto it per-record.
export async function GET() {
  const session = await auth();
  const role = (session?.user as any)?.role || '';
  const sessionDealerId = (session?.user as any)?.dealer_id || null;

  if (!session?.user) {
    return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
  }
  if (role !== 'dealer' && role !== 'super_admin') {
    return NextResponse.json({ success: false, error: 'Not authorized' }, { status: 403 });
  }

  try {
    let claimsQuery = `
      SELECT wc.claim_id, wc.claim_number, wc.component, wc.remarks, wc.submitted_at,
             v.chassis_number, d.dealer_name, d.dealer_id
      FROM warranty_claims wc
      JOIN vehicles v ON wc.vehicle_id = v.vehicle_id
      JOIN job_cards jc ON wc.job_card_id = jc.job_card_id
      JOIN dealers d ON jc.dealer_id = d.dealer_id
      WHERE wc.is_flagged = 1
    `;
    const claimsParams: any[] = [];
    if (role === 'dealer') {
      claimsQuery += ` AND jc.dealer_id = ?`;
      claimsParams.push(sessionDealerId || -1);
    }
    claimsQuery += ` ORDER BY wc.submitted_at DESC`;

    let completionsQuery = `
      SELECT jc.job_card_id, jc.completion_flag_reason, jc.updated_at,
             v.chassis_number, d.dealer_name, d.dealer_id
      FROM job_cards jc
      JOIN vehicles v ON jc.vehicle_id = v.vehicle_id
      JOIN dealers d ON jc.dealer_id = d.dealer_id
      WHERE jc.completion_flagged = 1
    `;
    const completionsParams: any[] = [];
    if (role === 'dealer') {
      completionsQuery += ` AND jc.dealer_id = ?`;
      completionsParams.push(sessionDealerId || -1);
    }
    completionsQuery += ` ORDER BY jc.updated_at DESC`;

    const [claimRows]: any = await pool.query(claimsQuery, claimsParams);
    const [completionRows]: any = await pool.query(completionsQuery, completionsParams);

    const claimAlerts = claimRows.map((r: any) => ({
      type: 'warranty_claim',
      id: r.claim_number,
      chassisNumber: r.chassis_number,
      dealerName: r.dealer_name,
      dealerId: r.dealer_id,
      reason: r.remarks?.match(/\[SYSTEM FLAG: (.+?)\]/)?.[1] ?? 'Flagged for review',
      detail: r.component,
      date: r.submitted_at,
      linkHref: `/warranty-claims/${r.claim_number}`,
    }));

    const completionAlerts = completionRows.map((r: any) => ({
      type: 'job_completion',
      id: `JC-${r.job_card_id}`,
      chassisNumber: r.chassis_number,
      dealerName: r.dealer_name,
      dealerId: r.dealer_id,
      reason: r.completion_flag_reason ?? 'Flagged for review',
      detail: 'Job completion',
      date: r.updated_at,
      linkHref: `/jobcards/${r.job_card_id}`,
    }));

    const data = [...claimAlerts, ...completionAlerts].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
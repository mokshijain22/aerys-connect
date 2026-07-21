import { NextResponse } from 'next/server';
import { pool } from '@/app/lib/db';
import { auth } from '@/auth';

// Auto reorder suggestion:
// - Only looks at parts that are currently at/below their min stock alert level
// - Suggested reorder quantity = 30 days of usage (avg daily usage over the
//   last 30 days x 30), minus what's already in stock, floored so it's never
//   less than enough to get back above the min stock alert
// - Parts with no usage history in the last 30 days fall back to
//   (min_stock_alert x 2) - current quantity, so slow movers still get a
//   sensible top-up suggestion instead of being skipped
export async function GET(request: Request) {
  try {
    const session = await auth();
    const role = (session?.user as any)?.role || '';
    const sessionDealerId = (session?.user as any)?.dealer_id || null;

    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    let dealerId = searchParams.get('dealer') || '';

    if (role === 'dealer') {
      dealerId = sessionDealerId ? String(sessionDealerId) : '-1';
    }

    let query = `
      SELECT
        ds.dealer_id, ds.part_id, ds.quantity, ds.min_stock_alert,
        sp.part_name, sp.part_code, sp.category,
        d.dealer_name,
        COALESCE(usage.total_used_30d, 0) AS total_used_30d
      FROM dealer_stock ds
      JOIN spare_parts sp ON ds.part_id = sp.part_id
      JOIN dealers d ON ds.dealer_id = d.dealer_id
      LEFT JOIN (
        SELECT jc.dealer_id, jcp.part_id, SUM(jcp.quantity) AS total_used_30d
        FROM job_card_parts_used jcp
        JOIN job_cards jc ON jcp.job_card_id = jc.job_card_id
        WHERE jc.registered_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
        GROUP BY jc.dealer_id, jcp.part_id
      ) usage ON usage.dealer_id = ds.dealer_id AND usage.part_id = ds.part_id
      WHERE ds.quantity <= ds.min_stock_alert
    `;
    const params: any[] = [];

    if (dealerId) {
      query += ` AND ds.dealer_id = ?`;
      params.push(dealerId);
    }

    query += ` ORDER BY (ds.min_stock_alert - ds.quantity) DESC`;

    const [rows]: any = await pool.query(query, params);

    const suggestions = rows.map((r: any) => {
      const avgDailyUsage = r.total_used_30d / 30;
      const usageBasedQty = Math.ceil(avgDailyUsage * 30) - r.quantity;
      const fallbackQty = r.min_stock_alert * 2 - r.quantity;
      const suggestedQty = Math.max(
        r.total_used_30d > 0 ? usageBasedQty : fallbackQty,
        r.min_stock_alert - r.quantity,
        1
      );
      return {
        dealer_id: r.dealer_id,
        dealer_name: r.dealer_name,
        part_id: r.part_id,
        part_name: r.part_name,
        part_code: r.part_code,
        category: r.category,
        quantity: r.quantity,
        min_stock_alert: r.min_stock_alert,
        used_last_30d: r.total_used_30d,
        suggested_reorder_qty: suggestedQty,
      };
    });

    return NextResponse.json({ success: true, data: suggestions });
  } catch (error: any) {
    console.error('Error fetching reorder suggestions:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
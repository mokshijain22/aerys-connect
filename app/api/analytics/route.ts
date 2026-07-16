import { NextResponse } from 'next/server';
import { pool } from '@/app/lib/db';

function prefixCategory(partCode: string) {
  const prefix = partCode.split('-')[0].toUpperCase();
  const map: Record<string, string> = {
    BAT: 'Battery', MOT: 'Motor', CON: 'Controller',
    CHG: 'Charging', BRA: 'Braking', SUS: 'Suspension',
    TYR: 'Tyres', LGT: 'Lighting',
  };
  return map[prefix] || 'Others';
}

async function rangeStats(from: string, to: string) {
  const dateParams = [`${from} 00:00:00`, `${to} 23:59:59`];

  const [[vehicleCount]]: any = await pool.query(`SELECT COUNT(*) AS total FROM vehicles`);
  const [[jobCount]]: any = await pool.query(
    `SELECT COUNT(*) AS total FROM job_cards WHERE registered_at BETWEEN ? AND ?`, dateParams
  );
  const [[claimCount]]: any = await pool.query(
    `SELECT COUNT(*) AS total FROM warranty_claims WHERE submitted_at BETWEEN ? AND ?`, dateParams
  );
  const [[completedCount]]: any = await pool.query(
    `SELECT COUNT(*) AS total FROM job_cards
     WHERE status IN ('completed','delivered') AND registered_at BETWEEN ? AND ?`, dateParams
  );
  const [[resolutionRow]]: any = await pool.query(
    `SELECT AVG(TIMESTAMPDIFF(HOUR, registered_at, service_completed_at)) / 24 AS avg_days
     FROM job_cards WHERE service_completed_at IS NOT NULL AND registered_at BETWEEN ? AND ?`, dateParams
  );
  const [[revenueRow]]: any = await pool.query(
    `SELECT SUM(jcpu.quantity * sp.unit_price) AS total
     FROM job_card_parts_used jcpu
     JOIN spare_parts sp ON jcpu.part_id = sp.part_id
     JOIN job_cards jc ON jcpu.job_card_id = jc.job_card_id
     WHERE jc.registered_at BETWEEN ? AND ?`, dateParams
  );

  return {
    totalVehicles: vehicleCount.total,
    totalJobs: jobCount.total,
    warrantyClaims: claimCount.total,
    completedJobs: completedCount.total,
    avgResolutionDays: resolutionRow.avg_days ? Number(Number(resolutionRow.avg_days).toFixed(1)) : 0,
    revenue: revenueRow.total ? Number(revenueRow.total) : 0,
  };
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const from = searchParams.get('from') || new Date().toISOString().slice(0, 10);
    const to = searchParams.get('to') || new Date().toISOString().slice(0, 10);

    // Current period vs previous period (same length, immediately before)
    const fromDate = new Date(from);
    const toDate = new Date(to);
    const days = Math.max(1, Math.round((toDate.getTime() - fromDate.getTime()) / 86400000) + 1);
    const prevTo = new Date(fromDate.getTime() - 86400000);
    const prevFrom = new Date(prevTo.getTime() - (days - 1) * 86400000);
    const prevFromStr = prevFrom.toISOString().slice(0, 10);
    const prevToStr = prevTo.toISOString().slice(0, 10);

    const current = await rangeStats(from, to);
    const previous = await rangeStats(prevFromStr, prevToStr);

    // Jobs trend (last 7 days) - total vs completed
    const [trendRows]: any = await pool.query(`
      SELECT DATE(registered_at) AS day,
             COUNT(*) AS total_jobs,
             SUM(CASE WHEN status IN ('completed','delivered') THEN 1 ELSE 0 END) AS completed_jobs
      FROM job_cards
      WHERE registered_at >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)
      GROUP BY DATE(registered_at)
      ORDER BY day ASC
    `);

    // Jobs by status
    const [statusRows]: any = await pool.query(
      `SELECT status, COUNT(*) AS count FROM job_cards WHERE registered_at BETWEEN ? AND ? GROUP BY status`,
      [`${from} 00:00:00`, `${to} 23:59:59`]
    );
    const statusMap: Record<string, number> = { Completed: 0, 'In Progress': 0, Pending: 0, Cancelled: 0, 'On Hold': 0 };
    for (const row of statusRows) {
      if (['completed', 'delivered'].includes(row.status)) statusMap.Completed += row.count;
      else if (['in_progress', 'technician_assigned'].includes(row.status)) statusMap['In Progress'] += row.count;
      else if (row.status === 'acknowledged') statusMap['On Hold'] += row.count;
      else if (row.status === 'registered') statusMap.Pending += row.count;
      else if (row.status === 'cancelled') statusMap.Cancelled += row.count;
    }

    // Top issue categories by job_cards.service_type (paid vs warranty)
    const [serviceTypeRawRows]: any = await pool.query(
      `SELECT service_type, COUNT(*) AS count
       FROM job_cards
       WHERE service_type IS NOT NULL AND registered_at BETWEEN ? AND ?
       GROUP BY service_type
       ORDER BY count DESC`,
      [`${from} 00:00:00`, `${to} 23:59:59`]
    );
    const topIssueCategories = serviceTypeRawRows.map((r: any) => ({ label: r.service_type, count: r.count }));

    // Jobs by service type (via parts used, part_code prefix)
    const [partRows]: any = await pool.query(`
      SELECT sp.part_code, COUNT(*) AS count
      FROM job_card_parts_used jcpu
      JOIN spare_parts sp ON jcpu.part_id = sp.part_id
      JOIN job_cards jc ON jcpu.job_card_id = jc.job_card_id
      WHERE jc.registered_at BETWEEN ? AND ?
      GROUP BY jcpu.part_id
    `, [`${from} 00:00:00`, `${to} 23:59:59`]);
    const categoryMap: Record<string, number> = {};
    for (const row of partRows) {
      const cat = prefixCategory(row.part_code);
      categoryMap[cat] = (categoryMap[cat] || 0) + row.count;
    }
    const serviceTypeData = Object.entries(categoryMap)
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Revenue trend (last 7 days)
    const [revenueTrendRows]: any = await pool.query(`
      SELECT DATE(jc.registered_at) AS day, SUM(jcpu.quantity * sp.unit_price) AS revenue
      FROM job_card_parts_used jcpu
      JOIN spare_parts sp ON jcpu.part_id = sp.part_id
      JOIN job_cards jc ON jcpu.job_card_id = jc.job_card_id
      WHERE jc.registered_at >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)
      GROUP BY DATE(jc.registered_at)
      ORDER BY day ASC
    `);

    // Top performing dealers by revenue (parts cost) in range
    const [dealerRevenueRows]: any = await pool.query(`
      SELECT d.dealer_id, d.dealer_name, SUM(jcpu.quantity * sp.unit_price) AS revenue
      FROM job_card_parts_used jcpu
      JOIN spare_parts sp ON jcpu.part_id = sp.part_id
      JOIN job_cards jc ON jcpu.job_card_id = jc.job_card_id
      JOIN dealers d ON jc.dealer_id = d.dealer_id
      WHERE jc.registered_at BETWEEN ? AND ?
      GROUP BY d.dealer_id
      ORDER BY revenue DESC
      LIMIT 5
    `, [`${from} 00:00:00`, `${to} 23:59:59`]);

    const payloadBase = {
      current, changes: {}, previous,
      jobsTrend: trendRows.map((r: any) => ({ day: r.day, totalJobs: r.total_jobs, completedJobs: r.completed_jobs })),
      jobsByStatus: statusMap,
      jobsByServiceType: serviceTypeData,
      topIssueCategories,
      revenueTrend: revenueTrendRows.map((r: any) => ({ day: r.day, revenue: r.revenue || 0 })),
      topDealers: dealerRevenueRows.map((r: any) => ({ id: r.dealer_id, name: r.dealer_name, revenue: r.revenue || 0 })),
    };

    if (new URL(request.url).searchParams.get('format') === 'csv') {
      const lines: string[] = [];
      lines.push('AERYS Service Connect - Analytics Export');
      lines.push(`Date Range,${from} to ${to}`);
      lines.push('');
      lines.push('Metric,Current,Previous');
      lines.push(`Total Vehicles,${current.totalVehicles},${previous.totalVehicles}`);
      lines.push(`Total Jobs,${current.totalJobs},${previous.totalJobs}`);
      lines.push(`Warranty Claims,${current.warrantyClaims},${previous.warrantyClaims}`);
      lines.push(`Avg Resolution Days,${current.avgResolutionDays},${previous.avgResolutionDays}`);
      lines.push(`Completed Jobs,${current.completedJobs},${previous.completedJobs}`);
      lines.push(`Revenue,${current.revenue},${previous.revenue}`);
      lines.push('');
      lines.push('Jobs by Status');
      lines.push('Status,Count');
      for (const [s, c] of Object.entries(statusMap)) lines.push(`${s},${c}`);
      lines.push('');
      lines.push('Top Issue Categories');
      lines.push('Category,Count');
      for (const c of topIssueCategories) lines.push(`${c.label},${c.count}`);
      const csv = lines.join('\n');
      return new NextResponse(csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="aerys-analytics_${from}_to_${to}.csv"`,
        },
      });
    }

    function pctChange(curr: number, prev: number) {
      if (prev === 0) return curr > 0 ? 100 : 0;
      return Number((((curr - prev) / prev) * 100).toFixed(2));
    }

    return NextResponse.json({
      success: true,
      ...payloadBase,
      changes: {
        totalVehicles: pctChange(current.totalVehicles, previous.totalVehicles),
        totalJobs: pctChange(current.totalJobs, previous.totalJobs),
        warrantyClaims: pctChange(current.warrantyClaims, previous.warrantyClaims),
        avgResolutionDays: Number((current.avgResolutionDays - previous.avgResolutionDays).toFixed(1)),
        completedJobs: pctChange(current.completedJobs, previous.completedJobs),
        revenue: pctChange(current.revenue, previous.revenue),
      },
    });
  } catch (error: any) {
    console.error('Error fetching analytics:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
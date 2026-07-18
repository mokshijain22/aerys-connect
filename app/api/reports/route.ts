import { pool } from '@/app/lib/db';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    const format = searchParams.get('format'); // 'csv' triggers export

    const dateFilter = from && to ? 'AND jc.registered_at BETWEEN ? AND ?' : '';
    const dateParams = from && to ? [`${from} 00:00:00`, `${to} 23:59:59`] : [];

    // Totals
    const [[vehicleCount]]: any = await pool.query(
      `SELECT COUNT(*) AS total FROM vehicles`
    );
    const [[jobCount]]: any = await pool.query(
      `SELECT COUNT(*) AS total FROM job_cards jc WHERE 1=1 ${dateFilter}`,
      dateParams
    );
    const [[claimCount]]: any = await pool.query(
      `SELECT COUNT(*) AS total FROM warranty_claims wc
       JOIN job_cards jc ON wc.job_card_id = jc.job_card_id
       WHERE 1=1 ${dateFilter}`,
      dateParams
    );
    const [[completedCount]]: any = await pool.query(
      `SELECT COUNT(*) AS total FROM job_cards jc
       WHERE status IN ('completed','delivered') ${dateFilter}`,
      dateParams
    );

    // Avg resolution time (days) for completed/delivered jobs
    const [[resolutionRow]]: any = await pool.query(
      `SELECT AVG(TIMESTAMPDIFF(HOUR, jc.registered_at, jc.service_completed_at)) / 24 AS avg_days
       FROM job_cards jc
       WHERE jc.service_completed_at IS NOT NULL ${dateFilter}`,
      dateParams
    );

    // Jobs trend - last 7 days
    const [trendRows]: any = await pool.query(
      `SELECT DATE(registered_at) AS day, COUNT(*) AS jobs
       FROM job_cards
       WHERE registered_at >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)
       GROUP BY DATE(registered_at)
       ORDER BY day ASC`
    );

    // Jobs by status - mapped into the 4 mockup buckets
    const [statusRows]: any = await pool.query(
      `SELECT status, COUNT(*) AS count FROM job_cards jc WHERE 1=1 ${dateFilter} GROUP BY status`,
      dateParams
    );
    const statusMap: Record<string, number> = {
      Completed: 0, 'In Progress': 0, Pending: 0, Cancelled: 0,
    };
    for (const row of statusRows) {
      if (['completed', 'delivered'].includes(row.status)) statusMap.Completed += row.count;
      else if (['in_progress', 'technician_assigned', 'acknowledged'].includes(row.status)) statusMap['In Progress'] += row.count;
      else if (row.status === 'registered') statusMap.Pending += row.count;
      else if (row.status === 'cancelled') statusMap.Cancelled += row.count;
    }

    // Top issue categories - using service_type as the category
    const [categoryRows]: any = await pool.query(
      `SELECT service_type, COUNT(*) AS count
       FROM job_cards jc
       WHERE service_type IS NOT NULL ${dateFilter}
       GROUP BY service_type
       ORDER BY count DESC
       LIMIT 5`,
      dateParams
    );

    const payload = {
      totalVehicles: vehicleCount.total,
      totalJobs: jobCount.total,
      warrantyClaims: claimCount.total,
      avgResolutionDays: resolutionRow.avg_days ? Number(Number(resolutionRow.avg_days).toFixed(1)) : 0,
      completedJobs: completedCount.total,
      completedPercent: jobCount.total ? Math.round((completedCount.total / jobCount.total) * 100) : 0,
      jobsTrend: trendRows.map((r: any) => ({ day: r.day, jobs: r.jobs })),
      jobsByStatus: statusMap,
      topIssueCategories: categoryRows.map((r: any) => ({ label: r.service_type, count: r.count })),
    };

    // --- CSV export branch ---
    if (format === 'csv') {
      const csv = buildCsv(payload, from, to);
      const filename = `aerys-report_${from || 'all'}_to_${to || 'all'}.csv`;
      return new NextResponse(csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${filename}"`,
        },
      });
    }

    return NextResponse.json({ success: true, data: payload });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

function csvEscape(value: any): string {
  const str = String(value ?? '');
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function buildCsv(data: any, from: string | null, to: string | null): string {
  const lines: string[] = [];

  lines.push('AERYS Service Connect - Report Export');
  lines.push(`Date Range,${from || 'N/A'} to ${to || 'N/A'}`);
  lines.push('');

  lines.push('Summary');
  lines.push('Metric,Value');
  lines.push(`Total Vehicles,${data.totalVehicles}`);
  lines.push(`Total Jobs,${data.totalJobs}`);
  lines.push(`Warranty Claims,${data.warrantyClaims}`);
  lines.push(`Avg. Resolution Days,${data.avgResolutionDays}`);
  lines.push(`Completed Jobs,${data.completedJobs}`);
  lines.push(`Completed Percent,${data.completedPercent}%`);
  lines.push('');

  lines.push('Jobs Trend (last 7 days)');
  lines.push('Date,Jobs');
  for (const t of data.jobsTrend) {
    lines.push(`${csvEscape(t.day)},${t.jobs}`);
  }
  lines.push('');

  lines.push('Jobs by Status');
  lines.push('Status,Count');
  for (const [status, count] of Object.entries(data.jobsByStatus)) {
    lines.push(`${csvEscape(status)},${count}`);
  }
  lines.push('');

  lines.push('Top Issue Categories');
  lines.push('Category,Count');
  for (const c of data.topIssueCategories) {
    lines.push(`${csvEscape(c.label)},${c.count}`);
  }

  return lines.join('\n');
}
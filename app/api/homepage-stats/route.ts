import { NextResponse } from 'next/server';
import { pool } from '@/app/lib/db';
import { auth } from '@/auth';

export async function GET() {
  try {
    const session = await auth();
    const role = (session?.user as any)?.role || '';
    const dealerId = (session?.user as any)?.dealer_id || null;
    const customerId = (session?.user as any)?.customer_id || null;
    const technicianId = (session?.user as any)?.technician_id || null;

    const isDealer = role === 'dealer';
    const isCustomer = role === 'customer';
    const isTechnician = role === 'technician';

    let vehicleFilter = '';
    let jobFilter = '';
    const vParams: any[] = [];
    const jParams: any[] = [];

    if (isDealer) {
      vehicleFilter = ' AND dealer_id = ?';
      vParams.push(dealerId || -1);
      jobFilter = ' AND dealer_id = ?';
      jParams.push(dealerId || -1);
    } else if (isCustomer) {
      vehicleFilter = ' AND customer_id = ?';
      vParams.push(customerId || -1);
      jobFilter = ' AND vehicle_id IN (SELECT vehicle_id FROM vehicles WHERE customer_id = ?)';
      jParams.push(customerId || -1);
    } else if (isTechnician) {
      vehicleFilter = ' AND 1=0';
      jobFilter = ' AND technician_id = ?';
      jParams.push(technicianId || -1);
    }

    const [[totalVehicles]]: any = await pool.query(
      `SELECT COUNT(*) AS total FROM vehicles WHERE deleted_at IS NULL${vehicleFilter}`,
      vParams
    );

    const [[activeJobs]]: any = await pool.query(
      `SELECT COUNT(*) AS total FROM job_cards
       WHERE status NOT IN ('delivered','cancelled') AND deleted_at IS NULL${jobFilter}`,
      jParams
    );

    const [[pendingJobs]]: any = await pool.query(
      `SELECT COUNT(*) AS total FROM job_cards
       WHERE status IN ('registered','acknowledged') AND deleted_at IS NULL${jobFilter}`,
      jParams
    );

    const [[slaBreached]]: any = await pool.query(
      `SELECT COUNT(*) AS total FROM job_cards
       WHERE technician_assigned_at IS NULL
         AND status IN ('registered','acknowledged')
         AND registered_at < (NOW() - INTERVAL 48 HOUR)
         AND deleted_at IS NULL${jobFilter}`,
      jParams
    );

    const [[completedToday]]: any = await pool.query(
      `SELECT COUNT(*) AS total FROM job_cards
       WHERE status = 'completed'
         AND DATE(service_completed_at) = CURDATE()
         AND deleted_at IS NULL${jobFilter}`,
      jParams
    );

    const [[jobsToday]]: any = await pool.query(
      `SELECT COUNT(*) AS total FROM job_cards WHERE DATE(registered_at) = CURDATE() AND deleted_at IS NULL${jobFilter}`,
      jParams
    );

    const [[deliveriesToday]]: any = await pool.query(
      `SELECT COUNT(*) AS total FROM job_cards WHERE status = 'delivered' AND DATE(delivered_at) = CURDATE() AND deleted_at IS NULL${jobFilter}`,
      jParams
    );

    const [statusRows]: any = await pool.query(
      `SELECT status, COUNT(*) AS total FROM job_cards
       WHERE deleted_at IS NULL${jobFilter}
       GROUP BY status`,
      jParams
    );
    const statusBreakdown = statusRows.reduce((acc: any, row: any) => {
      acc[row.status] = row.total;
      return acc;
    }, {});

    const claimScope = isDealer
      ? ' AND jc.dealer_id = ?'
      : isCustomer
      ? ' AND jc.vehicle_id IN (SELECT vehicle_id FROM vehicles WHERE customer_id = ?)'
      : isTechnician
      ? ' AND jc.technician_id = ?'
      : '';
    const claimParams = isDealer ? [dealerId || -1] : isCustomer ? [customerId || -1] : isTechnician ? [technicianId || -1] : [];

    const [[pendingClaims]]: any = await pool.query(
      `SELECT COUNT(*) AS total FROM warranty_claims wc
       JOIN job_cards jc ON wc.job_card_id = jc.job_card_id
       WHERE wc.status IN ('submitted','dealer_approved')
         AND wc.deleted_at IS NULL
         AND jc.deleted_at IS NULL${claimScope}`,
      claimParams
    );

    const [recentVehicles]: any = await pool.query(
      `SELECT 'vehicle' AS type, chassis_number AS ref, created_at AS ts FROM vehicles
       WHERE deleted_at IS NULL${vehicleFilter} ORDER BY created_at DESC LIMIT 5`,
      vParams
    );
    const [recentJobs]: any = await pool.query(
      `SELECT 'job_card' AS type, job_card_id AS ref, registered_at AS ts FROM job_cards
       WHERE deleted_at IS NULL${jobFilter} ORDER BY registered_at DESC LIMIT 5`,
      jParams
    );
    const [recentClaims]: any = await pool.query(
      `SELECT 'warranty_claim' AS type, wc.claim_number AS ref, wc.submitted_at AS ts
       FROM warranty_claims wc
       JOIN job_cards jc ON wc.job_card_id = jc.job_card_id
       WHERE wc.deleted_at IS NULL AND jc.deleted_at IS NULL${claimScope}
       ORDER BY wc.submitted_at DESC LIMIT 5`,
      claimParams
    );

    const recentActivity = [...recentVehicles, ...recentJobs, ...recentClaims]
      .sort((a: any, b: any) => new Date(b.ts).getTime() - new Date(a.ts).getTime())
      .slice(0, 5);

    let dealerLeaderboard: any[] = [];
    if (role === 'super_admin') {
      const [rows]: any = await pool.query(`
        SELECT d.dealer_name, COUNT(jc.job_card_id) AS jobs
        FROM dealers d
        LEFT JOIN job_cards jc ON jc.dealer_id = d.dealer_id AND jc.deleted_at IS NULL
        WHERE d.deleted_at IS NULL
        GROUP BY d.dealer_id
        ORDER BY jobs DESC
        LIMIT 5
      `);
      dealerLeaderboard = rows;
    }

    return NextResponse.json({
      success: true,
      data: {
        totalVehicles: totalVehicles.total,
        activeJobs: activeJobs.total,
        pendingJobs: pendingJobs.total,
        slaBreached: slaBreached.total,
        completedToday: completedToday.total,
        jobsToday: jobsToday.total,
        deliveriesToday: deliveriesToday.total,
        warrantyClaimsUnderReview: pendingClaims.total,
        statusBreakdown,
        recentActivity,
        dealerLeaderboard,
      },
    });
  } catch (error: any) {
    console.error('Error fetching homepage stats:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
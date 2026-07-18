import { pool } from '../../../lib/db';
import { NextResponse } from 'next/server';
import { auth } from '@/auth';

// GET: full Pan-India rollup. Only super_admin should see the whole country;
// dealers/others don't get a country-wide view (their access is scoped
// elsewhere), so this endpoint is admin-only.
export async function GET() {
  const session = await auth();
  const role = (session?.user as any)?.role || '';

  if (!session?.user) {
    return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
  }
  if (role !== 'super_admin') {
    return NextResponse.json({ success: false, error: 'Not authorized' }, { status: 403 });
  }

  try {
    // Dealers with their full location chain + rollup counts in one shot.
    const [dealerRows]: any = await pool.query(`
      SELECT
        s.state_id, s.state_name,
        dist.district_id, dist.district_name,
        c.city_id, c.city_name,
        d.dealer_id, d.dealer_name, d.address, d.phone, d.is_approved,
        (SELECT COUNT(*) FROM technicians t WHERE t.dealer_id = d.dealer_id AND t.is_active = 1 AND t.deleted_at IS NULL) AS active_technicians,
        (SELECT COUNT(*) FROM job_cards jc WHERE jc.dealer_id = d.dealer_id AND jc.status NOT IN ('delivered', 'rejected_by_dealer')) AS pending_jobs,
        (SELECT COUNT(*) FROM job_cards jc WHERE jc.dealer_id = d.dealer_id AND jc.escalated = 1 AND jc.status NOT IN ('delivered', 'completed')) AS sla_breaches
      FROM dealers d
      JOIN cities c ON d.city_id = c.city_id
      JOIN districts dist ON c.district_id = dist.district_id
      JOIN states s ON dist.state_id = s.state_id
      WHERE d.deleted_at IS NULL
      ORDER BY s.state_name, dist.district_name, c.city_name, d.dealer_name
    `);

    // Build the nested tree: state -> district -> city -> dealers[]
    const stateMap = new Map<number, any>();

    for (const r of dealerRows) {
      if (!stateMap.has(r.state_id)) {
        stateMap.set(r.state_id, {
          stateId: r.state_id,
          stateName: r.state_name,
          totalDealers: 0,
          activeDealers: 0,
          totalTechnicians: 0,
          pendingJobs: 0,
          slaBreaches: 0,
          districts: new Map<number, any>(),
        });
      }
      const state = stateMap.get(r.state_id);

      if (!state.districts.has(r.district_id)) {
        state.districts.set(r.district_id, {
          districtId: r.district_id,
          districtName: r.district_name,
          cities: new Map<number, any>(),
        });
      }
      const district = state.districts.get(r.district_id);

      if (!district.cities.has(r.city_id)) {
        district.cities.set(r.city_id, {
          cityId: r.city_id,
          cityName: r.city_name,
          dealers: [] as any[],
        });
      }
      const city = district.cities.get(r.city_id);

      city.dealers.push({
        dealerId: r.dealer_id,
        dealerName: r.dealer_name,
        address: r.address,
        phone: r.phone,
        isApproved: !!r.is_approved,
        activeTechnicians: r.active_technicians,
        pendingJobs: r.pending_jobs,
        slaBreaches: r.sla_breaches,
      });

      state.totalDealers += 1;
      if (r.is_approved) state.activeDealers += 1;
      state.totalTechnicians += r.active_technicians;
      state.pendingJobs += r.pending_jobs;
      state.slaBreaches += r.sla_breaches;
    }

    // Serialize Maps -> arrays
    const states = Array.from(stateMap.values()).map((s) => ({
      ...s,
      districts: Array.from(s.districts.values()).map((dist: any) => ({
        ...dist,
        cities: Array.from(dist.cities.values()),
      })),
    }));

    states.sort((a, b) => b.pendingJobs - a.pendingJobs);

    const summary = {
      totalStates: states.length,
      totalDealers: states.reduce((sum, s) => sum + s.totalDealers, 0),
      totalActiveDealers: states.reduce((sum, s) => sum + s.activeDealers, 0),
      totalTechnicians: states.reduce((sum, s) => sum + s.totalTechnicians, 0),
      totalPendingJobs: states.reduce((sum, s) => sum + s.pendingJobs, 0),
      totalSlaBreaches: states.reduce((sum, s) => sum + s.slaBreaches, 0),
    };

    const highComplaintAreas = [...states]
      .filter((s) => s.pendingJobs > 0)
      .sort((a, b) => b.slaBreaches - a.slaBreaches || b.pendingJobs - a.pendingJobs)
      .slice(0, 5)
      .map((s) => ({ stateName: s.stateName, pendingJobs: s.pendingJobs, slaBreaches: s.slaBreaches }));

    return NextResponse.json({ success: true, summary, highComplaintAreas, states });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
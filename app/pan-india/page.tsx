'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ResponsiveLayout } from '@/app/components/ResponsiveLayout';
import { NAV_ITEMS } from '@/app/lib/nav-items';

const VIOLET = '#6C5CE7';
const VIOLET_DIM = 'rgba(108,92,231,0.10)';
const VIOLET_LIGHT = '#8B7CF8';
const GOOD = '#34C759';
const WARN = '#E24B4A';
const AMBER = '#F5A623';
const MUTED = '#6B6B7E';
const INK = '#15152A';
const BORDER = 'rgba(108,92,231,0.10)';
const CARD_SHADOW = '0 1px 2px rgba(20,10,50,0.04), 0 8px 24px -12px rgba(20,10,50,0.08)';

const NAV = NAV_ITEMS.map((item) => ({ ...item, active: false }));

type Dealer = {
  dealerId: number; dealerName: string; address: string | null; phone: string | null;
  isApproved: boolean; activeTechnicians: number; pendingJobs: number; slaBreaches: number;
};
type City = { cityId: number; cityName: string; dealers: Dealer[] };
type District = { districtId: number; districtName: string; cities: City[] };
type State = {
  stateId: number; stateName: string; totalDealers: number; activeDealers: number;
  totalTechnicians: number; pendingJobs: number; slaBreaches: number; districts: District[];
};

function KpiCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-[16px] p-5 bg-white border" style={{ borderColor: BORDER, boxShadow: CARD_SHADOW }}>
      <p className="text-xs font-medium mb-1.5" style={{ color: MUTED }}>{label}</p>
      <p className="text-2xl font-extrabold tabular-nums" style={{ color }}>{value}</p>
    </div>
  );
}

export default function PanIndiaPage() {
  const [summary, setSummary] = useState<any>(null);
  const [highComplaintAreas, setHighComplaintAreas] = useState<any[]>([]);
  const [states, setStates] = useState<State[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [openState, setOpenState] = useState<number | null>(null);
  const [openDistrict, setOpenDistrict] = useState<number | null>(null);

  useEffect(() => {
    fetch('/api/pan-india/overview')
      .then((res) => res.json())
      .then((json) => {
        if (json.success) {
          setSummary(json.summary);
          setHighComplaintAreas(json.highComplaintAreas);
          setStates(json.states);
        } else {
          setError(json.error || 'Failed to load');
        }
      })
      .catch(() => setError('Network error'))
      .finally(() => setLoading(false));
  }, []);

  const filteredStates = states.filter((s) =>
    !search || s.stateName.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <ResponsiveLayout navItems={NAV}>
      <div className="page-bg -m-4 md:-m-6 p-4 md:p-6" style={{ backgroundColor: '#FAFAFF' }}>
        <div className="flex items-center gap-1.5 text-xs mb-4" style={{ color: MUTED }}>
          <Link href="/" className="hover:underline">Home</Link> <span>›</span>
          <span className="font-semibold" style={{ color: VIOLET }}>Pan India</span>
        </div>

        <div className="rounded-[20px] p-7 mb-6" style={{ background: `linear-gradient(135deg, ${VIOLET_DIM}, rgba(245,166,35,0.05))`, border: `1px solid ${BORDER}`, boxShadow: CARD_SHADOW }}>
          <h1 className="text-[26px] font-extrabold tracking-tight" style={{ color: INK }}>Pan India Overview</h1>
          <p className="text-sm mt-2" style={{ color: MUTED }}>Country → State → District → City → Dealer → Technician</p>
        </div>

        {loading && <p className="text-sm" style={{ color: MUTED }}>Loading…</p>}
        {error && <p className="text-sm" style={{ color: WARN }}>{error}</p>}

        {summary && (
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4 mb-6">
            <KpiCard label="States Covered" value={summary.totalStates} color={INK} />
            <KpiCard label="Total Dealers" value={summary.totalDealers} color={INK} />
            <KpiCard label="Active Dealers" value={summary.totalActiveDealers} color={GOOD} />
            <KpiCard label="Technicians" value={summary.totalTechnicians} color={VIOLET} />
            <KpiCard label="Pending Jobs" value={summary.totalPendingJobs} color={AMBER} />
            <KpiCard label="SLA Breaches" value={summary.totalSlaBreaches} color={WARN} />
          </div>
        )}

        {highComplaintAreas.length > 0 && (
          <div className="rounded-[20px] p-6 bg-white border mb-6" style={{ borderColor: BORDER, boxShadow: CARD_SHADOW }}>
            <p className="text-[15px] font-bold mb-4" style={{ color: INK }}>High complaint areas</p>
            <div className="space-y-3">
              {highComplaintAreas.map((a, i) => (
                <div key={a.stateName} className="flex items-center gap-4">
                  <span
                    className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 text-white"
                    style={{ backgroundColor: i === 0 ? WARN : i === 1 ? AMBER : VIOLET }}
                  >
                    {i + 1}
                  </span>
                  <p className="text-sm font-semibold flex-1" style={{ color: INK }}>{a.stateName}</p>
                  <span className="text-xs" style={{ color: MUTED }}>{a.pendingJobs} pending</span>
                  {a.slaBreaches > 0 && (
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: 'rgba(226,75,74,0.1)', color: WARN }}>
                      {a.slaBreaches} SLA breach{a.slaBreaches > 1 ? 'es' : ''}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="rounded-[20px] bg-white border overflow-hidden" style={{ borderColor: BORDER, boxShadow: CARD_SHADOW }}>
          <div className="p-6 pb-4 flex items-center justify-between flex-wrap gap-3">
            <p className="text-[15px] font-bold" style={{ color: INK }}>State-wise breakdown</p>
            <input
              placeholder="Search state..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="rounded-full px-4 py-2 text-sm outline-none w-56"
              style={{ border: `1px solid ${BORDER}` }}
            />
          </div>

          <div className="divide-y" style={{ borderColor: BORDER }}>
            {filteredStates.map((s) => {
              const isOpen = openState === s.stateId;
              return (
                <div key={s.stateId}>
                  <button
                    onClick={() => { setOpenState(isOpen ? null : s.stateId); setOpenDistrict(null); }}
                    className="w-full flex items-center justify-between gap-3 px-6 py-4 text-left hover:bg-[#FAFAFF] transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-sm transition-transform" style={{ color: VIOLET, transform: isOpen ? 'rotate(90deg)' : 'none' }}>▶</span>
                      <p className="text-sm font-semibold" style={{ color: INK }}>{s.stateName}</p>
                    </div>
                    <div className="flex items-center gap-4 text-xs" style={{ color: MUTED }}>
                      <span>{s.totalDealers} dealers</span>
                      <span>{s.totalTechnicians} technicians</span>
                      {s.pendingJobs > 0 && (
                        <span className="font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: VIOLET_DIM, color: VIOLET }}>
                          {s.pendingJobs} pending
                        </span>
                      )}
                      {s.slaBreaches > 0 && (
                        <span className="font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: 'rgba(226,75,74,0.1)', color: WARN }}>
                          {s.slaBreaches} SLA
                        </span>
                      )}
                    </div>
                  </button>

                  {isOpen && (
                    <div className="pb-3 pl-12 pr-6">
                      {s.districts.map((dist) => {
                        const distOpen = openDistrict === dist.districtId;
                        return (
                          <div key={dist.districtId} className="mb-1">
                            <button
                              onClick={() => setOpenDistrict(distOpen ? null : dist.districtId)}
                              className="w-full flex items-center gap-2 py-2 text-left"
                            >
                              <span className="text-xs" style={{ color: VIOLET_LIGHT, transform: distOpen ? 'rotate(90deg)' : 'none', display: 'inline-block' }}>▶</span>
                              <p className="text-sm font-medium" style={{ color: INK }}>{dist.districtName}</p>
                            </button>

                            {distOpen && (
                              <div className="pl-6 space-y-3 pb-2">
                                {dist.cities.map((city) => (
                                  <div key={city.cityId}>
                                    <p className="text-xs font-semibold mb-1.5" style={{ color: MUTED }}>{city.cityName}</p>
                                    <div className="space-y-1.5">
                                      {city.dealers.map((d) => (
                                        <div key={d.dealerId} className="flex items-center justify-between gap-3 rounded-xl px-3 py-2" style={{ backgroundColor: VIOLET_DIM }}>
                                          <div className="min-w-0">
                                            <p className="text-xs font-semibold truncate" style={{ color: INK }}>{d.dealerName}</p>
                                            <p className="text-[10px] truncate" style={{ color: MUTED }}>{d.address || d.phone || '—'}</p>
                                          </div>
                                          <div className="flex items-center gap-2 shrink-0 text-[10px]" style={{ color: MUTED }}>
                                            <span
                                              className="w-1.5 h-1.5 rounded-full"
                                              style={{ backgroundColor: d.isApproved ? GOOD : WARN }}
                                            />
                                            {d.activeTechnicians} tech
                                            {d.pendingJobs > 0 && (
                                              <span className="font-semibold px-1.5 py-0.5 rounded-full" style={{ backgroundColor: '#fff', color: VIOLET }}>
                                                {d.pendingJobs}
                                              </span>
                                            )}
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
            {filteredStates.length === 0 && !loading && (
              <p className="px-6 py-8 text-center text-sm" style={{ color: MUTED }}>No states match your search.</p>
            )}
          </div>
        </div>
      </div>
    </ResponsiveLayout>
  );
}
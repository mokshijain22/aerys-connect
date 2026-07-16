'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ResponsiveLayout } from '@/app/components/ResponsiveLayout';
import { NAV_ITEMS } from '@/app/lib/nav-items';

const VIOLET = '#6C5CE7';
const VIOLET_LIGHT = '#8B7CF8';
const VIOLET_DIM = 'rgba(108,92,231,0.10)';
const BORDER = 'rgba(30,20,60,0.07)';
const MUTED = '#6B7280';
const INK = '#1A1A2E';
const GREEN = '#22C55E';
const RED = '#EF4444';
const ORANGE = '#F5A623';
const BLUE = '#3B82F6';
const CARD_SHADOW = '0 1px 2px rgba(20,10,50,0.04), 0 8px 24px -12px rgba(20,10,50,0.08)';
const CARD_SHADOW_HOVER = '0 4px 12px rgba(20,10,50,0.06), 0 16px 36px -12px rgba(108,92,231,0.18)';

const NAV = NAV_ITEMS.map((item) => ({ ...item, active: item.href === '/analytics' }));


type AnalyticsSummary = {
  totalVehicles: number;
  totalJobs: number;
  warrantyClaims: number;
  completedJobs: number;
  avgResolutionDays: number;
  revenue: number;
  avgCustomerRating: number | null;
  customerRatingCount: number;
  avgTechnicianRating: number | null;
  technicianRatingCount: number;
};

type AnalyticsData = {
  current: AnalyticsSummary;
  previous: AnalyticsSummary;
  changes: Record<string, number>;
  jobsTrend: { day: string; totalJobs: number; completedJobs: number }[];
  jobsByStatus: Record<string, number>;
  jobsByServiceType: { label: string; count: number }[];
  revenueTrend: { day: string; revenue: number }[];
  topDealers: { id: number; name: string; revenue: number; avgRating: number | null }[];
  topTechnicians: { id: number; name: string; avgRating: number | null; ratingCount: number }[];
  topIssueCategories: { label: string; count: number }[];
};

const STATUS_COLORS: Record<string, string> = {
  Completed: GREEN, 'In Progress': BLUE, Pending: ORANGE, Cancelled: RED, 'On Hold': VIOLET_LIGHT,
};

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [exporting, setExporting] = useState(false);
  const today = new Date().toISOString().slice(0, 10);
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);

  async function exportCsv() {
    setExporting(true);
    try {
      const res = await fetch(`/api/analytics?from=${from}&to=${to}&format=csv`);
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `aerys-analytics_${from}_to_${to}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      alert('Failed to export. Please try again.');
    } finally {
      setExporting(false);
    }
  }

  const fetchAnalytics = async () => {
   const res = await fetch(`/api/analytics?from=${from}&to=${to}`);
   const json = await res.json();
   if (json.success) setData(json);
  };

  useEffect(() => {
   const load = async () => {
     const res = await fetch(`/api/analytics?from=${from}&to=${to}`);
     const json = await res.json();
     if (json.success) setData(json);
   };
   void load();
  }, [from, to]);

  function formatLakh(value: number) {
    return `₹${(value / 100000).toFixed(2)} L`;
  }
  function changeLabel(v: number, suffix = '%', lowerIsBetter = false) {
    const up = v >= 0;
    const isGood = lowerIsBetter ? !up : up;
    return <span style={{ color: isGood ? GREEN : RED }}>{up ? '↑' : '↓'} {Math.abs(v)}{suffix} vs last period</span>;
  }

  const inputStyle = { border: `1px solid ${BORDER}`, backgroundColor: '#fff', color: INK };
  const statusTotal = data ? Object.values(data.jobsByStatus).reduce((a, b) => a + b, 0) : 0;
  const maxServiceType = data ? Math.max(...data.jobsByServiceType.map((s) => s.count), 1) : 1;
  const maxRevenue = data ? Math.max(...data.revenueTrend.map((r) => r.revenue), 1) : 1;

  return (
    <>
      <style jsx global>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(14px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .fade-up { opacity: 0; animation: fadeUp 0.5s ease forwards; }
        .page-bg {
          background-color: #FAFAFF;
          background-image:
            radial-gradient(circle at 15% 10%, rgba(108,92,231,0.07), transparent 40%),
            radial-gradient(circle at 90% 25%, rgba(245,166,35,0.05), transparent 35%);
        }
        .focus-glow:focus { border-color: ${VIOLET_LIGHT} !important; box-shadow: 0 0 0 3px ${VIOLET_DIM}; }
      `}</style>
    <ResponsiveLayout navItems={NAV}>
      <div className="page-bg -m-4 md:-m-6 p-4 md:p-6">

        <div className="flex items-center gap-1.5 text-xs mb-4 fade-up" style={{ color: MUTED }}>
          <Link href="/" className="hover:underline">Home</Link> <span>›</span>
          <span className="font-semibold" style={{ color: VIOLET }}>Analytics</span>
        </div>
        <div className="rounded-[20px] p-7 mb-6 fade-up" style={{ background: `linear-gradient(135deg, ${VIOLET_DIM}, rgba(245,166,35,0.05))`, border: `1px solid ${BORDER}`, boxShadow: CARD_SHADOW }}>
          <h1 className="text-[28px] font-extrabold tracking-tight" style={{ color: INK }}>Analytics</h1>
          <p className="text-sm mt-2" style={{ color: MUTED }}>Real-time insights and performance overview of your EV service operations.</p>
        </div>

        {/* Filters */}
        <div className="rounded-[20px] p-5 bg-white border flex flex-col lg:flex-row lg:items-end lg:justify-between mb-6 gap-4 fade-up" style={{ borderColor: BORDER, boxShadow: CARD_SHADOW }}>
          <div className="flex flex-col sm:flex-row sm:items-end gap-4">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: INK }}>From</label>
              <input type="date" value={from} onChange={(e) => setFrom(e.target.value)}
                className="focus-glow rounded-xl px-4 py-2.5 text-sm outline-none transition-all duration-150" style={inputStyle} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: INK }}>To</label>
              <input type="date" value={to} onChange={(e) => setTo(e.target.value)}
                className="focus-glow rounded-xl px-4 py-2.5 text-sm outline-none transition-all duration-150" style={inputStyle} />
            </div>
            <button onClick={fetchAnalytics}
              className="text-sm font-semibold text-white px-5 py-2.5 rounded-xl transition-all duration-200 hover:-translate-y-0.5"
              style={{ background: `linear-gradient(135deg, ${VIOLET_LIGHT}, ${VIOLET})`, boxShadow: `0 6px 16px -6px ${VIOLET}66` }}>
              Apply
            </button>
          </div>
          <button onClick={exportCsv} disabled={exporting}
            className="text-sm font-semibold px-5 py-2.5 rounded-xl disabled:opacity-50 transition-all duration-200 hover:-translate-y-0.5"
            style={{ border: `1px solid ${BORDER}`, color: INK, backgroundColor: '#fff' }}>
            {exporting ? 'Exporting...' : 'Export CSV'}
          </button>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 mb-6">
          {data && [
            { label: 'Total Vehicles', value: data.current.totalVehicles, change: data.changes.totalVehicles, icon: '🛵' },
            { label: 'Total Jobs', value: data.current.totalJobs, change: data.changes.totalJobs, icon: '🔧' },
            { label: 'Warranty Claims', value: data.current.warrantyClaims, change: data.changes.warrantyClaims, icon: '🛡️', lowerIsBetter: true },
            { label: 'Avg. Resolution Time', value: `${data.current.avgResolutionDays} Days`, change: data.changes.avgResolutionDays, icon: '⏱️', suffix: ' days', lowerIsBetter: true },
            { label: 'Completed Jobs', value: data.current.completedJobs, change: data.changes.completedJobs, icon: '✅' },
            { label: 'Revenue (parts)', value: formatLakh(data.current.revenue), change: data.changes.revenue, icon: '₹' },
            {
              label: 'Avg Customer Rating',
              value: data.current.avgCustomerRating ? `${data.current.avgCustomerRating} ★` : '—',
              change: 0,
              icon: '⭐',
              noChange: data.current.customerRatingCount === 0,
              sub: `${data.current.customerRatingCount} review${data.current.customerRatingCount === 1 ? '' : 's'}`,
            },
            {
              label: 'Avg Technician Rating',
              value: data.current.avgTechnicianRating ? `${data.current.avgTechnicianRating} ★` : '—',
              change: 0,
              icon: '🔧',
              noChange: data.current.technicianRatingCount === 0,
              sub: `${data.current.technicianRatingCount} review${data.current.technicianRatingCount === 1 ? '' : 's'}`,
            },
          ].map((s: any) => (
            <div key={s.label} className="group rounded-[20px] p-6 bg-white border overflow-hidden transition-all duration-200 fade-up" style={{ borderColor: BORDER, boxShadow: CARD_SHADOW, background: `linear-gradient(160deg, #fff 65%, ${VIOLET}0d 100%)` }}
              onMouseEnter={(e) => { e.currentTarget.style.boxShadow = CARD_SHADOW_HOVER; e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.borderColor = `${VIOLET}55`; }}
              onMouseLeave={(e) => { e.currentTarget.style.boxShadow = CARD_SHADOW; e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.borderColor = BORDER; }}
            >
              <span className="w-10 h-10 rounded-2xl flex items-center justify-center mb-3 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3" style={{ background: `linear-gradient(135deg, ${VIOLET_LIGHT}CC, ${VIOLET})`, boxShadow: `0 6px 16px -6px ${VIOLET}66` }}>{s.icon}</span>
              <p className="text-xs font-medium mb-1" style={{ color: MUTED }}>{s.label}</p>
              <p className="text-[28px] font-extrabold tabular-nums tracking-tight mb-1" style={{ color: INK }}>{s.value}</p>
              <p className="text-xs">
                {s.noChange !== undefined
                  ? <span style={{ color: MUTED }}>{s.sub}</span>
                  : changeLabel(s.change, s.suffix || '%', (s as any).lowerIsBetter)}
              </p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 mb-6">
          {/* Jobs trend */}
          <div className="xl:col-span-2 rounded-[20px] p-6 bg-white border fade-up" style={{ borderColor: BORDER, boxShadow: CARD_SHADOW }}>
            <p className="font-bold text-[15px] mb-5" style={{ color: INK }}>Jobs Trend Over Time (last 7 days)</p>
            {data && (
              <div className="flex items-end gap-3 h-40">
                {data.jobsTrend.map((t) => (
                  <div key={t.day} className="flex-1 flex flex-col items-center gap-1 justify-end h-full">
                    <div className="w-full flex flex-col justify-end gap-0.5" style={{ height: '100%' }}>
                      <div className="w-full rounded-t-lg transition-all duration-700 hover:opacity-80" style={{
                        height: `${(t.totalJobs / Math.max(...data.jobsTrend.map(x => x.totalJobs), 1)) * 100}%`,
                        background: `linear-gradient(180deg, ${VIOLET_LIGHT}, ${VIOLET})`,
                      }} title={`Total: ${t.totalJobs}`} />
                    </div>
                    <span className="text-[10px]" style={{ color: MUTED }}>
                      {new Date(t.day).toLocaleDateString('en-US', { day: '2-digit', month: 'short' })}
                    </span>
                  </div>
                ))}
              </div>
            )}
            <p className="text-[10px] mt-2" style={{ color: MUTED }}>Bar height = total jobs registered that day</p>
          </div>

          {/* Jobs by status */}
          <div className="rounded-[20px] p-6 bg-white border fade-up" style={{ borderColor: BORDER, boxShadow: CARD_SHADOW }}>
            <p className="font-bold text-[15px] mb-5" style={{ color: INK }}>Jobs by Status</p>
            {data && Object.entries(data.jobsByStatus).map(([label, count]) => (
              <div key={label} className="mb-3">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: STATUS_COLORS[label] }} />
                    <span className="text-xs" style={{ color: MUTED }}>{label}</span>
                  </div>
                  <span className="text-xs font-semibold" style={{ color: INK }}>
                    {count} ({statusTotal ? Math.round((count / statusTotal) * 100) : 0}%)
                  </span>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: `${STATUS_COLORS[label]}1A` }}>
                  <div className="h-full rounded-full transition-all duration-700" style={{ width: `${statusTotal ? (count / statusTotal) * 100 : 0}%`, backgroundColor: STATUS_COLORS[label] }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 mb-6">
          {/* Performance overview table */}
          <div className="rounded-[20px] p-6 bg-white border fade-up" style={{ borderColor: BORDER, boxShadow: CARD_SHADOW }}>
            <p className="font-bold text-[15px] mb-5" style={{ color: INK }}>Performance Overview</p>
            {data && (
              <div className="overflow-x-auto">
              <table className="w-full text-xs min-w-[640px]">
                <thead>
                  <tr className="text-left" style={{ color: MUTED }}>
                    <th className="py-2 font-medium">Metric</th>
                    <th className="py-2 font-medium">Current</th>
                    <th className="py-2 font-medium">Previous</th>
                    <th className="py-2 font-medium">Change</th>
                  </tr>
                </thead>
                <tbody>
                  {([
                    ['Total Vehicles', data.current.totalVehicles, data.previous.totalVehicles, data.changes.totalVehicles],
                    ['Total Jobs', data.current.totalJobs, data.previous.totalJobs, data.changes.totalJobs],
                    ['Completed Jobs', data.current.completedJobs, data.previous.completedJobs, data.changes.completedJobs],
                    ['Warranty Claims', data.current.warrantyClaims, data.previous.warrantyClaims, data.changes.warrantyClaims],
                    ['Avg. Resolution', `${data.current.avgResolutionDays}d`, `${data.previous.avgResolutionDays}d`, data.changes.avgResolutionDays],
                    ['Revenue', formatLakh(data.current.revenue), formatLakh(data.previous.revenue), data.changes.revenue],
                  ] as Array<[string, number | string, number | string, number]>).map((row) => (
                    <tr key={row[0]} className="border-t transition-colors duration-150 hover:bg-[rgba(108,92,231,0.04)]" style={{ borderColor: BORDER }}>
                      <td className="py-2.5" style={{ color: INK, fontWeight: 600 }}>{row[0]}</td>
                      <td className="py-2.5" style={{ color: MUTED }}>{row[1]}</td>
                      <td className="py-2.5" style={{ color: MUTED }}>{row[2]}</td>
                      <td className="py-2.5 font-semibold" style={{ color: (['Warranty Claims', 'Avg. Resolution'].includes(row[0]) ? row[3] < 0 : row[3] >= 0) ? GREEN : RED }}>
                        {row[3] >= 0 ? '↑' : '↓'} {Math.abs(row[3])}{typeof row[3] === 'number' && Math.abs(row[3]) < 10 && row[0].includes('Resolution') ? 'd' : '%'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            )}
          </div>

          {/* Revenue trend */}
          <div className="rounded-[20px] p-6 bg-white border fade-up" style={{ borderColor: BORDER, boxShadow: CARD_SHADOW }}>
            <p className="font-bold text-[15px] mb-5" style={{ color: INK }}>Revenue Trend (parts, last 7 days)</p>
            {data && (
              <div className="flex items-end gap-2 h-32">
                {data.revenueTrend.map((r) => (
                  <div key={r.day} className="flex-1 flex flex-col items-center gap-1 justify-end h-full">
                    <div className="w-full rounded-t-lg transition-all duration-700 hover:opacity-80" style={{
                      height: `${(r.revenue / maxRevenue) * 100}%`,
                      background: `linear-gradient(180deg, ${VIOLET_LIGHT}, ${VIOLET})`,
                      minHeight: r.revenue > 0 ? 4 : 0,
                    }} title={formatLakh(r.revenue)} />
                    <span className="text-[9px]" style={{ color: MUTED }}>
                      {new Date(r.day).toLocaleDateString('en-US', { day: '2-digit', month: 'short' })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Top dealers */}
          <div className="rounded-[20px] p-6 bg-white border fade-up" style={{ borderColor: BORDER, boxShadow: CARD_SHADOW }}>
            <p className="font-bold text-[15px] mb-5" style={{ color: INK }}>Top Performing Dealers (by parts revenue)</p>
            {data?.topDealers.length === 0 && <p className="text-xs" style={{ color: MUTED }}>No data for this range.</p>}
            {data?.topDealers.map((d, i) => {
              const rankColor = i === 0 ? ORANGE : i === 1 ? MUTED : i === 2 ? '#B08D57' : VIOLET;
              return (
                <div key={d.id} className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white" style={{ background: `linear-gradient(135deg, ${rankColor}, ${rankColor}CC)`, boxShadow: `0 3px 8px -2px ${rankColor}66` }}>{i + 1}</span>
                    <span className="text-xs" style={{ color: INK }}>{d.name}</span>
                    {d.avgRating !== null && (
                      <span className="text-[10px] font-semibold" style={{ color: '#F5A623' }}>{d.avgRating} ★</span>
                    )}
                  </div>
                  <span className="text-xs font-semibold" style={{ color: INK }}>{formatLakh(d.revenue)}</span>
                </div>
              );
            })}
            <Link href="/dealers" className="text-xs font-semibold transition-transform inline-flex items-center gap-1 hover:gap-1.5" style={{ color: VIOLET }}>View All Dealers →</Link>
          </div>
        </div>

        {/* Top technicians by rating */}
        <div className="grid grid-cols-1 gap-4 mb-6">
          <div className="rounded-[20px] p-6 bg-white border fade-up" style={{ borderColor: BORDER, boxShadow: CARD_SHADOW }}>
            <p className="font-bold text-[15px] mb-5" style={{ color: INK }}>Top Performing Technicians (by dealer rating)</p>
            {data?.topTechnicians.length === 0 && <p className="text-xs" style={{ color: MUTED }}>No rated technicians for this range.</p>}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
              {data?.topTechnicians.map((t, i) => {
                const rankColor = i === 0 ? ORANGE : i === 1 ? MUTED : i === 2 ? '#B08D57' : VIOLET;
                return (
                  <div key={t.id} className="rounded-2xl p-4 border" style={{ borderColor: BORDER }}>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0" style={{ background: `linear-gradient(135deg, ${rankColor}, ${rankColor}CC)`, boxShadow: `0 3px 8px -2px ${rankColor}66` }}>{i + 1}</span>
                      <span className="text-xs font-semibold truncate" style={{ color: INK }}>{t.name}</span>
                    </div>
                    <p className="text-lg font-extrabold" style={{ color: INK }}>
                      {t.avgRating ?? '—'} <span className="text-xs font-normal" style={{ color: '#F5A623' }}>★</span>
                    </p>
                    <p className="text-[10px]" style={{ color: MUTED }}>{t.ratingCount} review{t.ratingCount === 1 ? '' : 's'}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Top issue categories (paid vs warranty) */}
        <div className="rounded-[20px] p-6 bg-white border mb-6 fade-up" style={{ borderColor: BORDER, boxShadow: CARD_SHADOW }}>
          <p className="font-bold text-[15px] mb-5" style={{ color: INK }}>Top Issue Categories (by service type)</p>
          {data?.topIssueCategories.length === 0 && <p className="text-sm" style={{ color: MUTED }}>No data for this range.</p>}
          {data?.topIssueCategories.map((c) => {
            const max = Math.max(...(data?.topIssueCategories.map((x) => x.count) ?? [1]), 1);
            return (
              <div key={c.label} className="mb-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs" style={{ color: MUTED }}>{c.label}</span>
                  <span className="text-xs font-semibold" style={{ color: INK }}>{c.count}</span>
                </div>
                <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: VIOLET_DIM }}>
                  <div className="h-full rounded-full transition-all duration-700" style={{ width: `${(c.count / max) * 100}%`, background: `linear-gradient(90deg, ${VIOLET_LIGHT}, ${VIOLET})` }} />
                </div>
              </div>
            );
          })}
        </div>

        {/* Jobs by service type */}
        <div className="rounded-[20px] p-6 bg-white border fade-up" style={{ borderColor: BORDER, boxShadow: CARD_SHADOW }}>
          <p className="font-bold text-[15px] mb-5" style={{ color: INK }}>Jobs by Service Type (from parts used)</p>
          {data?.jobsByServiceType.length === 0 && <p className="text-sm" style={{ color: MUTED }}>No data for this range.</p>}
          <div className="flex items-end gap-3 sm:gap-6 h-40 overflow-x-auto">
            {data?.jobsByServiceType.map((s) => (
              <div key={s.label} className="flex flex-col items-center gap-2 flex-1 min-w-[90px]">
                <span className="text-sm font-bold" style={{ color: INK }}>{s.count}</span>
                <div className="w-full rounded-t-lg transition-all duration-700 hover:opacity-80" style={{
                  height: `${(s.count / maxServiceType) * 100}%`,
                  background: `linear-gradient(180deg, ${VIOLET_LIGHT}, ${VIOLET})`, minHeight: 4,
                }} />
                <span className="text-xs" style={{ color: MUTED }}>{s.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </ResponsiveLayout>
    </>
  );
}
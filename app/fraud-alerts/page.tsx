'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { ResponsiveLayout } from '@/app/components/ResponsiveLayout';
import { NAV_ITEMS } from '@/app/lib/nav-items';

const VIOLET = '#6C5CE7';
const VIOLET_LIGHT = '#8B7CF8';
const VIOLET_DIM = 'rgba(108,92,231,0.10)';
const BORDER = 'rgba(30,20,60,0.07)';
const MUTED = '#6B7280';
const INK = '#1A1A2E';
const RED = '#E24B4A';
const CARD_SHADOW = '0 1px 2px rgba(20,10,50,0.04), 0 8px 24px -12px rgba(20,10,50,0.08)';

type Alert = {
  type: 'warranty_claim' | 'job_completion';
  id: string;
  chassisNumber: string;
  dealerName: string;
  reason: string;
  detail: string;
  date: string;
  linkHref: string;
};

const typeLabel: Record<Alert['type'], string> = {
  warranty_claim: 'Warranty claim',
  job_completion: 'Job completion',
};

const NAV = NAV_ITEMS.map((item) => ({ ...item, active: item.href === '/fraud-alerts' }));

export default function FraudAlertsPage() {
  const { data: session } = useSession();
  const role = (session?.user as any)?.role || '';
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<'All' | Alert['type']>('All');

  useEffect(() => {
    fetch('/api/fraud-alerts')
      .then((res) => res.json())
      .then((json) => { if (json.success) setAlerts(json.data); })
      .finally(() => setLoading(false));
  }, []);

  const filtered = alerts.filter((a) => typeFilter === 'All' || a.type === typeFilter);
  const inputStyle = { border: `1px solid ${BORDER}`, backgroundColor: '#fff', color: INK };

  return (
    <>
      <style jsx global>{`
        .page-bg {
          background-color: #FAFAFF;
          background-image:
            radial-gradient(circle at 15% 10%, rgba(226,75,74,0.06), transparent 40%),
            radial-gradient(circle at 90% 25%, rgba(245,166,35,0.05), transparent 35%);
        }
      `}</style>
      <ResponsiveLayout navItems={NAV}>
        <div className="page-bg -m-4 md:-m-6 p-4 md:p-6">
          <div className="flex items-center gap-1.5 text-xs mb-4" style={{ color: MUTED }}>
            <Link href="/" className="hover:underline">Home</Link> <span>›</span>
            <span className="font-semibold" style={{ color: VIOLET }}>Fraud Alerts</span>
          </div>

          <div className="rounded-[20px] p-7 mb-6" style={{ background: `linear-gradient(135deg, rgba(226,75,74,0.08), rgba(255,255,255,0.4))`, border: `1px solid ${BORDER}`, boxShadow: CARD_SHADOW }}>
            <h1 className="text-[28px] font-extrabold tracking-tight" style={{ color: INK }}>Fraud &amp; duplicate alerts</h1>
            <p className="text-sm mt-2" style={{ color: MUTED }}>
              Warranty claims and job completions automatically flagged by the system for review.
            </p>
          </div>

          <div className="rounded-[20px] p-5 bg-white border mb-6 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center" style={{ borderColor: BORDER, boxShadow: CARD_SHADOW }}>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as any)}
              className="rounded-xl px-4 py-2.5 text-sm outline-none w-full sm:w-auto"
              style={inputStyle}
            >
              <option value="All">All types</option>
              <option value="warranty_claim">Warranty claims</option>
              <option value="job_completion">Job completions</option>
            </select>
            <span className="text-xs sm:ml-auto" style={{ color: MUTED }}>
              {filtered.length} flagged {filtered.length === 1 ? 'item' : 'items'}
            </span>
          </div>

          <div className="rounded-[20px] bg-white border overflow-hidden" style={{ borderColor: BORDER, boxShadow: CARD_SHADOW }}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left" style={{ color: MUTED }}>
                    {['Type', 'Reference', 'Chassis No.', 'Dealer', 'Reason', 'Date'].map((h) => (
                      <th key={h} className="px-5 py-2 font-medium text-xs">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((a) => (
                    <tr key={`${a.type}-${a.id}`} className="border-t hover:bg-[rgba(226,75,74,0.03)]" style={{ borderColor: BORDER }}>
                      <td className="px-5 py-3.5">
                        <span className="inline-flex items-center text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: VIOLET_DIM, color: VIOLET }}>
                          {typeLabel[a.type]}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <a href={a.linkHref} className="font-semibold" style={{ color: VIOLET }}>{a.id}</a>
                      </td>
                      <td className="px-5 py-3.5" style={{ color: MUTED }}>{a.chassisNumber}</td>
                      <td className="px-5 py-3.5" style={{ color: MUTED }}>{a.dealerName}</td>
                      <td className="px-5 py-3.5" style={{ color: RED }}>⚠ {a.reason}</td>
                      <td className="px-5 py-3.5" style={{ color: MUTED }}>
                        {new Date(a.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </td>
                    </tr>
                  ))}
                  {loading && (
                    <tr><td colSpan={6} className="px-5 py-8 text-center text-sm" style={{ color: MUTED }}>Loading alerts...</td></tr>
                  )}
                  {!loading && filtered.length === 0 && (
                    <tr><td colSpan={6} className="px-5 py-8 text-center text-sm" style={{ color: MUTED }}>No flagged items — nothing needs review right now.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </ResponsiveLayout>
    </>
  );
}
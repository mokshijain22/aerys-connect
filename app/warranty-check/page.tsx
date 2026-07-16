'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { ResponsiveLayout } from '@/app/components/ResponsiveLayout';
import { NAV_ITEMS } from '@/app/lib/nav-items';

const VIOLET = '#6C5CE7';
const VIOLET_LIGHT = '#8B7CF8';
const VIOLET_DIM = 'rgba(108,92,231,0.10)';
const BORDER = 'rgba(30,20,60,0.07)';
const MUTED = '#6B7280';
const INK = '#1A1A2E';

const NAV = NAV_ITEMS.map((item) => ({ ...item, active: item.href === '/warranty-check' }));

const statusColor = (status: string) => {
  if (status === 'company_approved') return '#34C759';
  if (status === 'rejected') return '#E24B4A';
  return '#F0A500';
};

export default function WarrantyCheckPage() {
  const { data: session, status } = useSession();
  const role = (session?.user as any)?.role || '';

  const [chassisNumber, setChassisNumber] = useState('');
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const isAuthorized = role === 'dealer' || role === 'super_admin';

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chassisNumber.trim()) return;
    setLoading(true);
    setError('');
    setData(null);
    try {
      const res = await fetch(`/api/vehicle-warranty?chassisNumber=${encodeURIComponent(chassisNumber.trim())}`);
      const json = await res.json();
      if (json.success) setData(json.data);
      else setError(json.error || 'Vehicle not found');
    } catch {
      setError('Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = {
    border: `1px solid ${BORDER}`,
    backgroundColor: '#fff',
    color: INK,
  };

  if (status === 'loading') {
    return (
      <ResponsiveLayout navItems={NAV}>
        <p className="text-sm" style={{ color: MUTED }}>Loading...</p>
      </ResponsiveLayout>
    );
  }

  if (!isAuthorized) {
    return (
      <ResponsiveLayout navItems={NAV}>
        <div className="rounded-2xl bg-white border p-6" style={{ borderColor: BORDER }}>
          <p className="text-sm" style={{ color: '#E24B4A' }}>You don't have access to this page.</p>
        </div>
      </ResponsiveLayout>
    );
  }

  return (
    <ResponsiveLayout navItems={NAV}>
      <div style={{ fontFamily: 'Inter, sans-serif' }}>
        <div className="rounded-2xl p-6 mb-6" style={{ background: `linear-gradient(135deg, ${VIOLET_DIM}, rgba(255,255,255,0.4))` }}>
          <h1 className="text-2xl font-bold" style={{ color: INK }}>Smart warranty check</h1>
          <p className="text-sm mt-1" style={{ color: MUTED }}>Scan or enter a chassis number to check warranty status and claim eligibility</p>
        </div>

        <form onSubmit={handleSearch} className="flex gap-3 mb-6">
          <input
            value={chassisNumber}
            onChange={(e) => setChassisNumber(e.target.value)}
            placeholder="Enter chassis number"
            className="flex-1 rounded-xl px-4 py-2.5 text-sm outline-none"
            style={inputStyle}
          />
          <button
            type="submit"
            className="px-6 py-2.5 rounded-xl text-sm font-medium text-white"
            style={{ background: `linear-gradient(135deg, ${VIOLET_LIGHT}, ${VIOLET})` }}
          >
            {loading ? 'Checking...' : 'Check warranty'}
          </button>
        </form>

        {error && <p className="text-sm mb-4" style={{ color: '#E24B4A' }}>{error}</p>}

        {data && (
          <>
            {/* Warranty status cards */}
            <div className="rounded-2xl bg-white border p-6 mb-6" style={{ borderColor: BORDER }}>
              <p className="font-semibold mb-4" style={{ color: INK }}>Warranty status — {data.chassisNumber}</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {Object.entries(data.warranty).map(([component, info]: any) => (
                  <div key={component} className="rounded-xl p-4" style={{ backgroundColor: '#F7F7FB' }}>
                    <p className="text-xs capitalize mb-1" style={{ color: MUTED }}>{component}</p>
                    <p className="text-sm font-semibold mb-1" style={{ color: info.active ? '#34C759' : '#E24B4A' }}>
                      {info.active ? 'Active' : 'Expired'}
                    </p>
                    <p className="text-xs" style={{ color: MUTED }}>Until {info.end}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Eligibility */}
            <div className="rounded-2xl bg-white border p-6 mb-6" style={{ borderColor: BORDER }}>
              <p className="font-semibold mb-4" style={{ color: INK }}>Claim eligibility & required documents</p>
              <div className="space-y-4">
                {Object.entries(data.eligibility).map(([component, info]: any) => (
                  <div key={component} className="rounded-xl p-4" style={{ backgroundColor: '#F7F7FB' }}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium capitalize" style={{ color: INK }}>{component}</span>
                      <span className="text-xs font-semibold" style={{ color: info.eligible ? '#34C759' : '#E24B4A' }}>
                        {info.eligible ? 'Eligible' : 'Not eligible'}
                      </span>
                    </div>
                    <p className="text-xs mb-2" style={{ color: MUTED }}>{info.reason}</p>
                    <p className="text-xs font-medium mb-1" style={{ color: INK }}>Required documents:</p>
                    <ul className="text-xs list-disc list-inside" style={{ color: MUTED }}>
                      {info.requiredDocuments.map((doc: string) => <li key={doc}>{doc}</li>)}
                    </ul>
                  </div>
                ))}
              </div>
            </div>

            {/* Previous claims */}
            <div className="rounded-2xl bg-white border overflow-hidden" style={{ borderColor: BORDER }}>
              <p className="font-semibold p-6 pb-3" style={{ color: INK }}>Previous claims</p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left" style={{ color: MUTED }}>
                      {['Claim #', 'Component', 'Status', 'Submitted', 'Resolved'].map((h) => (
                        <th key={h} className="px-5 py-2 font-medium text-xs">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.previousClaims.map((c: any) => (
                      <tr key={c.claim_id} className="border-t" style={{ borderColor: BORDER }}>
                        <td className="px-5 py-3" style={{ color: INK }}>{c.claim_number}</td>
                        <td className="px-5 py-3 capitalize" style={{ color: MUTED }}>{c.component}</td>
                        <td className="px-5 py-3">
                          <span className="text-xs font-semibold" style={{ color: statusColor(c.status) }}>
                            {c.status.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="px-5 py-3" style={{ color: MUTED }}>{new Date(c.submitted_at).toLocaleDateString()}</td>
                        <td className="px-5 py-3" style={{ color: MUTED }}>{c.resolved_at ? new Date(c.resolved_at).toLocaleDateString() : '—'}</td>
                      </tr>
                    ))}
                    {data.previousClaims.length === 0 && (
                      <tr><td colSpan={5} className="px-5 py-8 text-center text-sm" style={{ color: MUTED }}>No previous claims for this vehicle.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </ResponsiveLayout>
  );
}
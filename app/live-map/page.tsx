'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ResponsiveLayout } from '@/app/components/ResponsiveLayout';
import { NAV_ITEMS } from '@/app/lib/nav-items';

const VIOLET = '#6C5CE7';
const VIOLET_DIM = 'rgba(108,92,231,0.10)';
const GOOD = '#34C759';
const WARN = '#E24B4A';
const MUTED = '#6B6B7E';
const INK = '#15152A';
const BORDER = 'rgba(108,92,231,0.10)';
const CARD_SHADOW = '0 1px 2px rgba(20,10,50,0.04), 0 8px 24px -12px rgba(20,10,50,0.08)';

const NAV = NAV_ITEMS.map((item) => ({ ...item, active: false }));

type Entry = {
  jobCardId: number;
  status: string;
  technicianId: number;
  technicianName: string;
  technicianPhone: string;
  customerName: string;
  chassisNumber: string;
  latitude: number | null;
  longitude: number | null;
  accuracyMeters: number | null;
  secondsAgo: number | null;
  isStale: boolean | null;
};

export default function LiveMapPage() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    try {
      const res = await fetch('/api/technicians/active-locations');
      const json = await res.json();
      if (json.success) {
        setEntries(json.data);
        setError('');
      } else {
        setError(json.error || 'Failed to load');
      }
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const interval = setInterval(load, 20000);
    return () => clearInterval(interval);
  }, []);

  const fmtAgo = (secs: number) => {
    if (secs < 60) return `${secs}s ago`;
    return `${Math.round(secs / 60)}m ago`;
  };

  return (
    <ResponsiveLayout navItems={NAV}>
      <div className="page-bg -m-4 md:-m-6 p-4 md:p-6" style={{ backgroundColor: '#FAFAFF' }}>
        <div className="flex items-center gap-1.5 text-xs mb-4" style={{ color: MUTED }}>
          <Link href="/" className="hover:underline">Home</Link> <span>›</span>
          <span className="font-semibold" style={{ color: VIOLET }}>Live Map</span>
        </div>

        <div className="rounded-[20px] p-7 mb-6" style={{ background: `linear-gradient(135deg, ${VIOLET_DIM}, rgba(245,166,35,0.05))`, border: `1px solid ${BORDER}`, boxShadow: CARD_SHADOW }}>
          <h1 className="text-[26px] font-extrabold tracking-tight" style={{ color: INK }}>Live Technician Map</h1>
          <p className="text-sm mt-2" style={{ color: MUTED }}>Real-time locations of technicians on active jobs</p>
        </div>

        {error && <p className="text-sm mb-4" style={{ color: WARN }}>{error}</p>}
        {loading && <p className="text-sm" style={{ color: MUTED }}>Loading…</p>}

        {!loading && entries.length === 0 && (
          <div className="rounded-[20px] p-10 bg-white border text-center" style={{ borderColor: BORDER, boxShadow: CARD_SHADOW }}>
            <p className="text-sm" style={{ color: MUTED }}>No technicians are currently on an active job.</p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {entries.map((e) => (
            <div key={e.jobCardId} className="rounded-[20px] bg-white border overflow-hidden" style={{ borderColor: BORDER, boxShadow: CARD_SHADOW }}>
              {e.latitude != null && e.longitude != null ? (
                <iframe
                  title={`map-${e.jobCardId}`}
                  className="w-full h-40 border-0"
                  loading="lazy"
                  src={`https://www.google.com/maps?q=${e.latitude},${e.longitude}&z=14&output=embed`}
                />
              ) : (
                <div className="w-full h-40 flex items-center justify-center" style={{ backgroundColor: VIOLET_DIM }}>
                  <p className="text-xs" style={{ color: MUTED }}>No location shared yet</p>
                </div>
              )}
              <div className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-bold" style={{ color: INK }}>{e.technicianName}</p>
                  {e.secondsAgo !== null && (
                    <span
                      className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                      style={{
                        backgroundColor: e.isStale ? 'rgba(226,75,74,0.1)' : 'rgba(52,199,89,0.1)',
                        color: e.isStale ? WARN : GOOD,
                      }}
                    >
                      {e.isStale ? 'Stale' : 'Live'}
                    </span>
                  )}
                </div>
                <p className="text-xs mb-1" style={{ color: MUTED }}>{e.technicianPhone}</p>
                <p className="text-xs mb-1" style={{ color: MUTED }}>Job #{e.jobCardId} · {e.customerName} · {e.chassisNumber}</p>
                <p className="text-xs mb-3" style={{ color: MUTED }}>
                  {e.status === 'in_progress' ? 'In progress' : 'Assigned'}
                  {e.secondsAgo !== null && ` · updated ${fmtAgo(e.secondsAgo)}`}
                </p>
                <div className="flex gap-2">
                  <Link href={`/jobcards/${e.jobCardId}`} className="text-xs font-semibold px-3 py-1.5 rounded-lg border" style={{ borderColor: VIOLET, color: VIOLET }}>
                    View job →
                  </Link>
                  {e.latitude != null && (
                    <a
                      href={`https://www.google.com/maps/dir/?api=1&destination=${e.latitude},${e.longitude}`}
                      target="_blank" rel="noopener noreferrer"
                      className="text-xs font-semibold px-3 py-1.5 rounded-lg text-white" style={{ backgroundColor: VIOLET }}
                    >
                      Navigate
                    </a>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </ResponsiveLayout>
  );
}
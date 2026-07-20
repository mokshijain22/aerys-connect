'use client';

import { useEffect, useState } from 'react';

const VIOLET = '#6C5CE7';
const VIOLET_DIM = 'rgba(108,92,231,0.10)';
const GOOD = '#34C759';
const WARN = '#E24B4A';
const MUTED = '#6B6B7E';
const INK = '#15152A';
const BORDER = 'rgba(108,92,231,0.10)';

type LocationData = {
  latitude: number;
  longitude: number;
  accuracyMeters: number | null;
  updatedAt: string;
  secondsAgo: number;
  isStale: boolean;
  technicianName: string;
  technicianPhone: string;
  distanceKm: number | null;
  etaMinutes: number | null;
  hasDestination: boolean;
  destLatitude: number | null;
  destLongitude: number | null;
};

/**
 * Drop into the dealer's or customer's job card detail view.
 * - Polls /api/technicians/location every 15s while the job is active.
 * - If viewed by the customer and no destination has been captured yet,
 *   silently asks the browser for the customer's own location once and
 *   saves it as the job's destination, enabling distance/ETA.
 *
 * Usage:
 *   <LiveLocationPanel jobCardId={jc.job_card_id} active={['technician_assigned','in_progress'].includes(jc.status)} role={role} />
 */
export function LiveLocationPanel({ jobCardId, active, role }: { jobCardId: number; active: boolean; role?: string }) {
  const [data, setData] = useState<LocationData | null>(null);
  const [message, setMessage] = useState<string>('');
  const [loading, setLoading] = useState(true);

  // One-time: if this is the customer and destination isn't set yet, capture it.
  // Waits for the first poll to know whether a destination already exists —
  // otherwise this would silently overwrite a correct address every time the
  // customer opens the tracking view from a different location.
  useEffect(() => {
    if (!active || role !== 'customer') return;
    if (!data) return; // wait for first poll to know hasDestination
    if (data.hasDestination) return; // already set — don't overwrite
    if (!('geolocation' in navigator)) return;

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        fetch('/api/technicians/location', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jobCardId,
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
          }),
        }).catch(() => {});
      },
      () => {}, // silently ignore denial — ETA just won't show
      { enableHighAccuracy: false, maximumAge: 600000, timeout: 10000 }
    );
  }, [active, role, jobCardId, data]);

  useEffect(() => {
    if (!active) return;

    let cancelled = false;

    const poll = async () => {
      try {
        const res = await fetch(`/api/technicians/location?jobCardId=${jobCardId}`);
        const json = await res.json();
        if (cancelled) return;
        if (json.success) {
          setData(json.data);
          setMessage(json.data ? '' : json.message || '');
        } else {
          setMessage(json.error || 'Could not load location');
        }
      } catch {
        if (!cancelled) setMessage('Network error loading location');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    poll();
    const interval = setInterval(poll, 15000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [jobCardId, active]);

  if (!active) return null;

  const fmtAgo = (secs: number) => {
    if (secs < 60) return `${secs}s ago`;
    const mins = Math.round(secs / 60);
    return `${mins}m ago`;
  };

  const fmtEta = (mins: number) => {
    if (mins < 60) return `~${mins} min`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `~${h}h ${m}m`;
  };

  return (
    <div className="rounded-2xl p-5 bg-white border" style={{ borderColor: BORDER }}>
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-bold" style={{ color: INK }}>Technician location</p>
        {data && (
          <span
            className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
            style={{
              backgroundColor: data.isStale ? 'rgba(226,75,74,0.1)' : 'rgba(52,199,89,0.1)',
              color: data.isStale ? WARN : GOOD,
            }}
          >
            {data.isStale ? 'Signal lost' : 'Live'}
          </span>
        )}
      </div>

      {loading && <p className="text-xs" style={{ color: MUTED }}>Loading location…</p>}

      {!loading && !data && (
        <p className="text-xs" style={{ color: MUTED }}>{message || 'Location not available yet.'}</p>
      )}

      {data && (
        <div className="space-y-3">
          <div className="rounded-xl overflow-hidden border" style={{ borderColor: BORDER }}>
            <iframe
              title="technician-live-map"
              className="w-full h-48 border-0"
              loading="lazy"
              src={
                data.hasDestination && data.destLatitude != null
                  ? `https://www.google.com/maps?saddr=${data.latitude},${data.longitude}&daddr=${data.destLatitude},${data.destLongitude}&output=embed`
                  : `https://www.google.com/maps?q=${data.latitude},${data.longitude}&z=15&output=embed`
              }
            />
          </div>
          <div className="flex items-center gap-3">
            <span className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-xs font-bold" style={{ backgroundColor: VIOLET_DIM, color: VIOLET }}>
              {data.technicianName?.slice(0, 2).toUpperCase()}
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate" style={{ color: INK }}>{data.technicianName}</p>
              <p className="text-xs" style={{ color: MUTED }}>{data.technicianPhone}</p>
            </div>
          </div>

          {data.distanceKm !== null && data.etaMinutes !== null && (
            <div className="flex items-center gap-4 rounded-xl p-3" style={{ backgroundColor: VIOLET_DIM }}>
              <div>
                <p className="text-[10px]" style={{ color: MUTED }}>Distance</p>
                <p className="text-sm font-bold" style={{ color: VIOLET }}>{data.distanceKm} km</p>
              </div>
              <div className="w-px h-8" style={{ backgroundColor: BORDER }} />
              <div>
                <p className="text-[10px]" style={{ color: MUTED }}>Estimated arrival</p>
                <p className="text-sm font-bold" style={{ color: VIOLET }}>{fmtEta(data.etaMinutes)}</p>
              </div>
            </div>
          )}

          <div className="text-xs" style={{ color: MUTED }}>
            Last updated {fmtAgo(data.secondsAgo)}
            {data.accuracyMeters != null && ` · accuracy ±${Math.round(data.accuracyMeters)}m`}
          </div>

          <a
            href={`https://www.google.com/maps/dir/?api=1&destination=${data.latitude},${data.longitude}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl"
            style={{ backgroundColor: VIOLET, color: '#fff' }}
          >
            Open route navigation →
          </a>

          {data.isStale && (
            <p className="text-[11px]" style={{ color: WARN }}>
              No update in a while — the technician's device may have lost signal or GPS sharing was turned off.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
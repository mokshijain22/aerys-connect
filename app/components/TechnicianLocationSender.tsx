'use client';

import { useEffect, useRef, useState } from 'react';

const VIOLET = '#6C5CE7';
const GOOD = '#34C759';
const WARN = '#E24B4A';
const MUTED = '#6B6B7E';

/**
 * Drop this into the technician's job card detail/list view.
 * While `active` is true (e.g. job status is 'technician_assigned' or
 * 'in_progress'), it watches the device's GPS and pushes updates to
 * /api/technicians/location every ~20s (or on significant movement).
 *
 * Usage:
 *   <TechnicianLocationSender jobCardId={jobCard.job_card_id} active={['technician_assigned','in_progress'].includes(jobCard.status)} />
 */
export function TechnicianLocationSender({ jobCardId, active }: { jobCardId: number; active: boolean }) {
  const [status, setStatus] = useState<'idle' | 'sharing' | 'denied' | 'error'>('idle');
  const [lastSentAt, setLastSentAt] = useState<Date | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const lastSendRef = useRef<number>(0);
  const MIN_INTERVAL_MS = 15000; // don't spam the API more than once per 15s

  useEffect(() => {
    if (!active) {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      setStatus('idle');
      return;
    }

    if (!('geolocation' in navigator)) {
      setStatus('error');
      return;
    }

    const send = async (lat: number, lng: number, accuracy: number) => {
      const now = Date.now();
      if (now - lastSendRef.current < MIN_INTERVAL_MS) return;
      lastSendRef.current = now;
      try {
        const res = await fetch('/api/technicians/location', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ latitude: lat, longitude: lng, accuracy, jobCardId }),
        });
        if (res.ok) {
          setStatus('sharing');
          setLastSentAt(new Date());
        } else {
          setStatus('error');
        }
      } catch {
        setStatus('error');
      }
    };

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        send(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy);
      },
      (err) => {
        setStatus(err.code === err.PERMISSION_DENIED ? 'denied' : 'error');
      },
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 20000 }
    );

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [active, jobCardId]);

  if (!active) return null;

  const dotColor = status === 'sharing' ? GOOD : status === 'denied' || status === 'error' ? WARN : MUTED;
  const label =
    status === 'sharing'
      ? `Sharing live location${lastSentAt ? ` · updated ${lastSentAt.toLocaleTimeString()}` : ''}`
      : status === 'denied'
      ? 'Location permission denied — enable it to share your position'
      : status === 'error'
      ? 'Could not get location — check GPS/network'
      : 'Starting location sharing…';

  return (
    <div
      className="flex items-center gap-2 text-xs rounded-xl px-3 py-2"
      style={{ backgroundColor: 'rgba(108,92,231,0.06)', color: MUTED }}
    >
      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: dotColor }} />
      {label}
    </div>
  );
}
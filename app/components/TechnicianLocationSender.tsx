'use client';

import { useEffect, useRef, useState } from 'react';

const GOOD = '#34C759';
const WARN = '#E24B4A';
const MUTED = '#6B6B7E';

/**
 * Rapido/Uber-style: technician ke liye active job (technician_assigned ya
 * in_progress) khud dhoondhta hai aur uska GPS auto-share karta hai —
 * chahe technician app me kisi bhi page pe ho. Isliye ise sirf ek baar,
 * globally (ResponsiveLayout me) mount karo.
 */
export function TechnicianLocationSender({ minimal = false }: { minimal?: boolean }) {
  const [status, setStatus] = useState<'idle' | 'sharing' | 'denied' | 'error'>('idle');
  const [lastSentAt, setLastSentAt] = useState<Date | null>(null);
  const [activeJobCardId, setActiveJobCardId] = useState<number | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const lastSendRef = useRef<number>(0);
  const MIN_INTERVAL_MS = 15000;

  useEffect(() => {
    let cancelled = false;
    async function findActiveJob() {
      try {
        const res = await fetch('/api/jobcards');
        const json = await res.json();
        if (cancelled || !json.success) return;
        const active = (json.data || []).find((jc: any) =>
          ['technician_assigned', 'in_progress'].includes(jc.status)
        );
        setActiveJobCardId(active ? active.job_card_id : null);
      } catch {
        // network hiccup — agla poll try karega
      }
    }
    findActiveJob();
    const interval = setInterval(findActiveJob, 30000);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  useEffect(() => {
    if (!activeJobCardId) {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
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
          body: JSON.stringify({ latitude: lat, longitude: lng, accuracy, jobCardId: activeJobCardId }),
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
      (pos) => send(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy),
      (err) => setStatus(err.code === err.PERMISSION_DENIED ? 'denied' : 'error'),
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 20000 }
    );

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [activeJobCardId]);

  if (!activeJobCardId) return null;

  const dotColor = status === 'sharing' ? GOOD : status === 'denied' || status === 'error' ? WARN : MUTED;

  if (minimal) {
    return (
      <span className="inline-flex items-center gap-1.5 text-[10px]" style={{ color: MUTED }}>
        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: dotColor }} />
        {status === 'sharing' ? 'Live' : 'GPS'}
      </span>
    );
  }

  const label =
    status === 'sharing'
      ? `Sharing live location for Job #${activeJobCardId}${lastSentAt ? ` · updated ${lastSentAt.toLocaleTimeString()}` : ''}`
      : status === 'denied'
      ? 'Location permission off — Job #' + activeJobCardId + ' ke liye enable karo'
      : status === 'error'
      ? 'GPS/network issue — location share nahi ho pa rahi'
      : `Job #${activeJobCardId} ke liye location sharing shuru ho rahi hai…`;

  return (
    <div className="flex items-center gap-2 text-xs rounded-xl px-3 py-2" style={{ backgroundColor: 'rgba(108,92,231,0.06)', color: MUTED }}>
      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: dotColor }} />
      {label}
    </div>
  );
}
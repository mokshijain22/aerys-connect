'use client';

import { useEffect, useRef, useState } from 'react';
import { useSession } from 'next-auth/react';

const RED = '#E24B4A';
const MUTED = '#6B7280';

const REASON_LABEL: Record<string, string> = {
  accident: 'Accident',
  safety_threat: 'Safety threat',
  medical: 'Medical emergency',
  vehicle_breakdown: 'Vehicle breakdown',
  harassment: 'Harassment / abuse',
  other: 'Emergency',
};

type Alert = {
  sos_id: number;
  raised_by_role: string;
  raiser_name: string;
  raiser_phone: string;
  reason: string;
  note: string | null;
  latitude: number | null;
  longitude: number | null;
  job_card_id: number | null;
  created_at: string;
};

export function SOSAlertsBanner() {
  const { data: session } = useSession();
  const role = (session?.user as any)?.role || '';
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [resolving, setResolving] = useState<number | null>(null);
  const seenIdsRef = useRef<Set<number>>(new Set());
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (role !== 'dealer' && role !== 'super_admin') return;

    let cancelled = false;
    const poll = async () => {
      try {
        const res = await fetch('/api/sos');
        const json = await res.json();
        if (cancelled || !json.success) return;

        const incoming: Alert[] = json.data;
        const newOnes = incoming.filter((a) => !seenIdsRef.current.has(a.sos_id));
        if (newOnes.length > 0 && seenIdsRef.current.size > 0) {
          audioRef.current?.play().catch(() => {});
        }
        incoming.forEach((a) => seenIdsRef.current.add(a.sos_id));
        setAlerts(incoming);
      } catch {}
    };

    poll();
    const interval = setInterval(poll, 10000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [role]);

  async function resolve(sosId: number) {
    setResolving(sosId);
    try {
      await fetch('/api/sos', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sosId }),
      });
      setAlerts((prev) => prev.filter((a) => a.sos_id !== sosId));
    } finally {
      setResolving(null);
    }
  }

  if ((role !== 'dealer' && role !== 'super_admin') || alerts.length === 0) return null;

  return (
    <div className="sticky top-0 z-30 mb-3">
      {/* short beep, base64 so no external file needed */}
      <audio ref={audioRef} src="data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4LjIwLjEwMAAAAAAAAAAAAAAA//uQxAAAAAAAAAAAAAAAAAAAAAAASW5mbwAAAA8AAAADAAABIADAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDA//////////////////////////////////////////8AAAA5TEFNRTMuMTAwBK8AAAAAAAAAABUgJAUHQQAB4AAAASD" />
      {alerts.map((a) => (
        <div key={a.sos_id} className="flex flex-col sm:flex-row sm:items-center gap-3 px-5 py-3 mb-2 rounded-2xl"
          style={{ backgroundColor: RED, color: '#fff' }}>
          <div className="flex items-center gap-2.5 shrink-0">
            <span className="w-2.5 h-2.5 rounded-full bg-white" style={{ animation: 'sosBlink 1s ease-in-out infinite' }} />
            <span className="text-xs font-bold uppercase tracking-wide">SOS · {REASON_LABEL[a.reason] || 'Emergency'}</span>
          </div>
          <div className="flex-1 min-w-0 text-sm">
            <span className="font-semibold">{a.raiser_name}</span>{' '}
            <span className="opacity-90">({a.raised_by_role}) · {a.raiser_phone}</span>
            {a.note && <span className="opacity-90"> — {a.note}</span>}
            {a.job_card_id && <span className="opacity-90"> · Job #{a.job_card_id}</span>}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {a.latitude != null && a.longitude != null && (
              <a href={`https://www.google.com/maps/dir/?api=1&destination=${a.latitude},${a.longitude}`}
                target="_blank" rel="noopener noreferrer"
                className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-white" style={{ color: RED }}>
                📍 Locate
              </a>
            )}
            <a href={`tel:${a.raiser_phone}`} className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-white" style={{ color: RED }}>
              📞 Call
            </a>
            <button onClick={() => resolve(a.sos_id)} disabled={resolving === a.sos_id}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-white disabled:opacity-60">
              {resolving === a.sos_id ? 'Resolving...' : 'Resolve'}
            </button>
          </div>
        </div>
      ))}
      <style jsx>{`
        @keyframes sosBlink { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
      `}</style>
    </div>
  );
}
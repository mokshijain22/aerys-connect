'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';

const RED = '#E24B4A';
const MUTED = '#6B7280';
const INK = '#1A1A2E';
const BORDER = 'rgba(30,20,60,0.08)';

const REASONS = [
  { value: 'accident', label: 'Accident' },
  { value: 'safety_threat', label: 'Safety threat / unsafe location' },
  { value: 'medical', label: 'Medical emergency' },
  { value: 'vehicle_breakdown', label: 'Vehicle breakdown, stranded' },
  { value: 'harassment', label: 'Harassment / abuse' },
  { value: 'other', label: 'Other emergency' },
];

export function SOSButton({ jobCardId }: { jobCardId?: number }) {
  const { data: session } = useSession();
  const role = (session?.user as any)?.role || '';

  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  if (role !== 'technician' && role !== 'customer') return null;

  function resetAndClose() {
    setOpen(false);
    setReason('');
    setNote('');
    setError('');
    setSent(false);
  }

  async function handleSend() {
    if (!reason) {
      setError('Please select a reason');
      return;
    }
    setSubmitting(true);
    setError('');

    let latitude: number | undefined;
    let longitude: number | undefined;

    try {
      if ('geolocation' in navigator) {
        await new Promise<void>((resolve) => {
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              latitude = pos.coords.latitude;
              longitude = pos.coords.longitude;
              resolve();
            },
            () => resolve(),
            { enableHighAccuracy: true, timeout: 6000 }
          );
        });
      }

      const res = await fetch('/api/sos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason, note, latitude, longitude, jobCardId }),
      });
      const json = await res.json();
      if (!json.success) {
        setError(json.error || 'Failed to send SOS. Please call your dealer directly.');
        return;
      }
      setSent(true);
    } catch {
      setError('Network error — please call your dealer directly if this is urgent.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(true)}
        title="Emergency SOS — press only in a real emergency"
        className="fixed bottom-6 right-6 z-40 w-14 h-14 rounded-full flex items-center justify-center text-white font-bold shadow-lg"
        style={{ backgroundColor: RED, boxShadow: '0 6px 20px -4px rgba(226,75,74,0.6)', animation: 'sosPulse 1.8s ease-in-out infinite' }}
      >
        SOS
        <style jsx>{`
          @keyframes sosPulse {
            0%, 100% { box-shadow: 0 0 0 0 rgba(226,75,74,0.5); }
            50% { box-shadow: 0 0 0 12px rgba(226,75,74,0); }
          }
        `}</style>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm" style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}>
          <div className="bg-white rounded-[20px] p-6 w-full max-w-sm" style={{ boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
            {!sent ? (
              <>
                <p className="text-xs font-bold uppercase tracking-wide mb-1" style={{ color: RED }}>Emergency SOS</p>
                <p className="text-sm mb-4" style={{ color: MUTED }}>
                  Press only if this is a real emergency. Your dealer will be alerted immediately with your location.
                </p>

                <label className="block text-xs font-medium mb-1.5" style={{ color: INK }}>What's the emergency? *</label>
                <div className="space-y-1.5 mb-4">
                  {REASONS.map((r) => (
                    <label
                      key={r.value}
                      className="flex items-center gap-2.5 rounded-xl p-2.5 border cursor-pointer text-sm"
                      style={{ borderColor: reason === r.value ? RED : BORDER, color: INK }}
                    >
                      <input type="radio" checked={reason === r.value} onChange={() => setReason(r.value)} />
                      {r.label}
                    </label>
                  ))}
                </div>

                <label className="block text-xs font-medium mb-1.5" style={{ color: INK }}>Additional details (optional)</label>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value.slice(0, 300))}
                  rows={2}
                  placeholder="Any extra info that could help..."
                  className="w-full rounded-xl px-3 py-2 text-sm outline-none resize-none mb-3"
                  style={{ border: `1px solid ${BORDER}` }}
                />

                {error && <p className="text-xs mb-3" style={{ color: RED }}>{error}</p>}

                <div className="flex gap-3">
                  <button onClick={resetAndClose} disabled={submitting}
                    className="flex-1 text-sm font-medium px-4 py-2.5 rounded-xl border" style={{ borderColor: BORDER, color: MUTED }}>
                    Cancel
                  </button>
                  <button onClick={handleSend} disabled={submitting || !reason}
                    className="flex-1 text-sm font-bold text-white px-4 py-2.5 rounded-xl disabled:opacity-50"
                    style={{ backgroundColor: RED }}>
                    {submitting ? 'Sending...' : 'Send SOS'}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="rounded-xl p-4 mb-4 text-center" style={{ backgroundColor: 'rgba(52,199,89,0.1)' }}>
                  <p className="text-sm font-semibold" style={{ color: '#34C759' }}>SOS sent ✓</p>
                  <p className="text-xs mt-1" style={{ color: MUTED }}>Your dealer has been alerted with your location and reason.</p>
                </div>
                <button onClick={resetAndClose} className="w-full text-sm font-semibold px-4 py-2.5 rounded-xl" style={{ backgroundColor: RED, color: '#fff' }}>
                  Close
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
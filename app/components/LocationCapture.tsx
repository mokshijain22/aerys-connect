'use client';
import { useState } from 'react';

const VIOLET = '#6C5CE7';
const BORDER = 'rgba(30,20,60,0.07)';
const MUTED = '#6B7280';
const INK = '#1A1A2E';
const GREEN = '#34C759';
const RED = '#E24B4A';

export type LocationValue = {
  latitude: number | null;
  longitude: number | null;
  addressText: string;
  source: 'gps' | 'manual' | null;
};

export function LocationCapture({ value, onChange }: { value: LocationValue; onChange: (v: LocationValue) => void }) {
  const [mode, setMode] = useState<'choose' | 'manual'>(value.source === 'manual' ? 'manual' : 'choose');
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState('');

  const shareCurrentLocation = () => {
    if (!('geolocation' in navigator)) {
      setError('Location is not supported on this device/browser');
      return;
    }
    setLocating(true);
    setError('');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        onChange({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          addressText: value.addressText,
          source: 'gps',
        });
        setLocating(false);
      },
      (err) => {
        setError(
          err.code === err.PERMISSION_DENIED
            ? 'Location permission denied — please enter your address manually'
            : 'Could not fetch your location — please enter it manually'
        );
        setLocating(false);
        setMode('manual');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  };

  return (
    <div>
      <label className="block text-xs font-medium mb-1.5" style={{ color: INK }}>Service location *</label>

      {value.source === 'gps' && value.latitude != null && (
        <div className="rounded-xl p-3 mb-2 flex items-center justify-between" style={{ backgroundColor: 'rgba(52,199,89,0.08)' }}>
          <span className="text-xs" style={{ color: GREEN }}>
            📍 Current location shared ({value.latitude.toFixed(5)}, {value.longitude!.toFixed(5)})
          </span>
          <button
            type="button"
            onClick={() => { onChange({ latitude: null, longitude: null, addressText: '', source: null }); setMode('choose'); }}
            className="text-xs font-medium"
            style={{ color: MUTED }}
          >
            Change
          </button>
        </div>
      )}

      {value.source !== 'gps' && (
        <>
          <div className="flex gap-2 mb-2">
            <button
              type="button"
              onClick={shareCurrentLocation}
              disabled={locating}
              className="flex-1 text-xs font-semibold px-3 py-2.5 rounded-xl border disabled:opacity-60"
              style={{ borderColor: VIOLET, color: VIOLET, backgroundColor: '#fff' }}
            >
              {locating ? 'Getting location…' : '📍 Share current location'}
            </button>
            <button
              type="button"
              onClick={() => setMode('manual')}
              className="flex-1 text-xs font-semibold px-3 py-2.5 rounded-xl border"
              style={mode === 'manual' ? { backgroundColor: VIOLET, borderColor: VIOLET, color: '#fff' } : { borderColor: BORDER, color: INK }}
            >
              ✍️ Enter address manually
            </button>
          </div>
          {mode === 'manual' && (
            <textarea
              value={value.addressText}
              onChange={(e) => onChange({ ...value, addressText: e.target.value, source: 'manual' })}
              placeholder="House no., street, landmark, city, pincode..."
              rows={2}
              className="w-full rounded-xl px-4 py-2.5 text-sm outline-none resize-none"
              style={{ border: `1px solid ${BORDER}` }}
            />
          )}
          {error && <p className="text-xs mt-1.5" style={{ color: RED }}>{error}</p>}
        </>
      )}
      <p className="text-[10px] mt-1.5" style={{ color: MUTED }}>
        Isse technician aapko dhoondhne aur live distance/ETA dikhane me help milegi.
      </p>
    </div>
  );
}
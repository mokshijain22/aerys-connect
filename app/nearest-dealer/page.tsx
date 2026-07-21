'use client';

import { useState } from 'react';

const VIOLET = '#6C5CE7';
const BORDER = 'rgba(30,20,60,0.07)';
const MUTED = '#6B7280';
const INK = '#1A1A2E';

type Dealer = {
  dealerId: number;
  dealerName: string;
  phone: string;
  address: string;
  cityName: string;
  distanceKm: number;
};

export default function NearestDealerPage() {
  const [dealers, setDealers] = useState<Dealer[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const findNearest = () => {
    if (!('geolocation' in navigator)) {
      setError('Location is not supported on this device/browser');
      return;
    }
    setLoading(true);
    setError('');
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const res = await fetch(`/api/dealers/nearest?lat=${pos.coords.latitude}&lng=${pos.coords.longitude}`);
          const json = await res.json();
          if (json.success) setDealers(json.data);
          else setError(json.error || 'Could not find nearby service centres');
        } catch {
          setError('Could not find nearby service centres');
        } finally {
          setLoading(false);
        }
      },
      () => {
        setError('Location permission denied — please enable location and try again');
        setLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  };

  return (
    <div className="max-w-lg mx-auto p-6">
      <h1 className="text-xl font-bold mb-1" style={{ color: INK }}>Find Nearest Service Centre</h1>
      <p className="text-sm mb-4" style={{ color: MUTED }}>Share your location to see the closest AERYS dealers.</p>

      <button onClick={findNearest} disabled={loading}
        className="text-sm font-semibold text-white px-5 py-2.5 rounded-xl disabled:opacity-50"
        style={{ backgroundColor: VIOLET }}>
        {loading ? 'Locating…' : '📍 Use my current location'}
      </button>

      {error && <p className="text-xs mt-3" style={{ color: '#E24B4A' }}>{error}</p>}

      {dealers && (
        <div className="mt-5 flex flex-col gap-3">
          {dealers.length === 0 && <p className="text-sm" style={{ color: MUTED }}>No service centres found nearby.</p>}
          {dealers.map((d) => (
            <div key={d.dealerId} className="rounded-xl p-4" style={{ border: `1px solid ${BORDER}` }}>
              <div className="flex items-center justify-between">
                <p className="font-semibold text-sm" style={{ color: INK }}>{d.dealerName}</p>
                <span className="text-xs font-semibold" style={{ color: VIOLET }}>{d.distanceKm} km</span>
              </div>
              <p className="text-xs mt-1" style={{ color: MUTED }}>{d.address}, {d.cityName}</p>
              <p className="text-xs mt-1" style={{ color: MUTED }}>{d.phone}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
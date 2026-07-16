'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

const VIOLET = '#6C5CE7';
const INK = '#1A1A2E';
const MUTED = '#6B7280';
const BORDER = 'rgba(30,20,60,0.07)';

const badgeColor = (status: string) =>
  status === 'Active' ? '#34C759' : status === 'Expired' ? '#E24B4A' : MUTED;

export default function PublicVehiclePage() {
  const { chassisNumber } = useParams<{ chassisNumber: string }>();
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/vehicles/public/${chassisNumber}`)
      .then((res) => res.json())
      .then((json) => {
        if (json.success) setData(json.data);
        else setError(json.error || 'Vehicle not found');
      })
      .catch(() => setError('Something went wrong'))
      .finally(() => setLoading(false));
  }, [chassisNumber]);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-sm" style={{ color: MUTED }}>Loading...</div>;
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-sm" style={{ color: '#E24B4A' }}>{error}</p>
      </div>
    );
  }

  return (
    <div className="h-screen overflow-y-auto flex items-center justify-center p-4" style={{ fontFamily: 'Inter, sans-serif', background: '#F7F7FB' }}>
      <div className="w-full max-w-md rounded-2xl bg-white border p-6" style={{ borderColor: BORDER }}>
        <p className="text-xs font-medium mb-1" style={{ color: VIOLET }}>AERYS SERVICE CONNECT</p>
        <h1 className="text-xl font-bold mb-4" style={{ color: INK }}>{data.model}</h1>

        <div className="grid grid-cols-2 gap-4 text-sm mb-5">
          <div>
            <p className="text-xs" style={{ color: MUTED }}>Chassis number</p>
            <p style={{ color: INK }}>{data.chassisNumber}</p>
          </div>
          <div>
            <p className="text-xs" style={{ color: MUTED }}>Colour</p>
            <p style={{ color: INK }}>{data.colour}</p>
          </div>
          <div>
            <p className="text-xs" style={{ color: MUTED }}>Purchase date</p>
            <p style={{ color: INK }}>{data.purchaseDate}</p>
          </div>
          <div>
            <p className="text-xs" style={{ color: MUTED }}>Dealer</p>
            <p style={{ color: INK }}>{data.dealer}</p>
          </div>
        </div>

        <p className="text-xs font-medium mb-2" style={{ color: INK }}>Warranty status</p>
        <div className="space-y-2">
          {Object.entries(data.warranty).map(([part, status]: any) => (
            <div key={part} className="flex items-center justify-between rounded-xl px-4 py-2.5" style={{ backgroundColor: '#F7F7FB' }}>
              <span className="text-sm capitalize" style={{ color: INK }}>{part}</span>
              <span className="text-xs font-semibold" style={{ color: badgeColor(status) }}>{status}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
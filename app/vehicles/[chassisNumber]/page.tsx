'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';

const VIOLET = '#6C5CE7';
const VIOLET_LIGHT = '#8B7CF8';
const VIOLET_DIM = 'rgba(108,92,231,0.10)';
const BORDER = 'rgba(30,20,60,0.07)';
const MUTED = '#6B7280';
const INK = '#1A1A2E';
const RED = '#E24B4A';
const GREEN = '#34C759';

const badgeColor = (status: string) =>
  status === 'Active' ? '#34C759' : status === 'Expired' ? '#E24B4A' : MUTED;

export default function PublicVehiclePage() {
  const { chassisNumber } = useParams<{ chassisNumber: string }>();
  const router = useRouter();
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
        <p className="text-sm" style={{ color: RED }}>{error}</p>
      </div>
    );
  }

  function bookService() {
    router.push(`/jobcards?chassisNumber=${encodeURIComponent(chassisNumber)}`);
  }

  function callDealer() {
    if (data.dealerPhone) window.location.href = `tel:${data.dealerPhone}`;
  }

  function getDirections() {
    if (data.dealerAddress) {
      window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(data.dealerAddress)}`, '_blank');
    }
  }

  function printQr() {
    window.open(`/vehicles/${chassisNumber}/qr-print`, '_blank');
  }

  return (
    <div className="h-screen overflow-y-auto flex items-center justify-center p-4" style={{ fontFamily: 'Inter, sans-serif', background: '#F7F7FB' }}>
      <div className="w-full max-w-md rounded-2xl bg-white border p-6" style={{ borderColor: BORDER }}>
        <p className="text-xs font-medium mb-1" style={{ color: VIOLET }}>AERYS SERVICE CONNECT</p>
        <h1 className="text-xl font-bold mb-4" style={{ color: INK }}>{data.model}</h1>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm mb-5">
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
        <div className="space-y-2 mb-6">
          {Object.entries(data.warranty).map(([part, status]: any) => (
            <div key={part} className="flex items-center justify-between rounded-xl px-4 py-2.5" style={{ backgroundColor: '#F7F7FB' }}>
              <span className="text-sm capitalize" style={{ color: INK }}>{part}</span>
              <span className="text-xs font-semibold" style={{ color: badgeColor(status) }}>{status}</span>
            </div>
          ))}
        </div>

        {/* Service history */}
        <p className="text-xs font-medium mb-2" style={{ color: INK }}>Recent service history</p>
        {data.serviceHistory.length === 0 ? (
          <p className="text-xs mb-6" style={{ color: MUTED }}>No service records yet.</p>
        ) : (
          <div className="space-y-2 mb-6">
            {data.serviceHistory.map((h: any) => (
              <div key={h.jobCardId} className="flex items-center justify-between rounded-xl px-4 py-2.5" style={{ backgroundColor: '#F7F7FB' }}>
                <div>
                  <p className="text-xs font-semibold" style={{ color: INK }}>#{h.jobCardId} — {h.status}</p>
                  <p className="text-[11px]" style={{ color: MUTED }}>
                    {new Date(h.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Action buttons */}
        <div className="grid grid-cols-2 gap-2.5">
          <button onClick={bookService}
            className="text-xs font-semibold text-white px-4 py-2.5 rounded-xl"
            style={{ background: `linear-gradient(135deg, ${VIOLET_LIGHT}, ${VIOLET})` }}>
            📋 Book a service
          </button>
          <button onClick={callDealer} disabled={!data.dealerPhone}
            className="text-xs font-semibold px-4 py-2.5 rounded-xl border disabled:opacity-40"
            style={{ borderColor: RED, color: RED }}>
            🆘 Emergency call
          </button>
          <button onClick={getDirections} disabled={!data.dealerAddress}
            className="text-xs font-semibold px-4 py-2.5 rounded-xl border disabled:opacity-40"
            style={{ borderColor: BORDER, color: INK }}>
            📍 Directions
          </button>
          <button onClick={printQr}
            className="text-xs font-semibold px-4 py-2.5 rounded-xl border"
            style={{ borderColor: BORDER, color: INK }}>
            🖨️ Print QR
          </button>
        </div>
      </div>
    </div>
  );
}
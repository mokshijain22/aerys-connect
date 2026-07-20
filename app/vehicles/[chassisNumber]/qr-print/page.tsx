'use client';

import { useParams } from 'next/navigation';
import { useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';

export default function QrPrintPage() {
  const { chassisNumber } = useParams<{ chassisNumber: string }>();
  const url = typeof window !== 'undefined' ? `${window.location.origin}/vehicles/${chassisNumber}` : '';

  useEffect(() => {
    // auto-open print dialog once the QR has rendered
    const timer = setTimeout(() => window.print(), 400);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', fontFamily: 'Inter, sans-serif' }}>
      <p style={{ fontSize: 12, fontWeight: 600, color: '#6C5CE7', marginBottom: 4 }}>AERYS SERVICE CONNECT</p>
      {url && <QRCodeSVG value={url} size={220} />}
      <p style={{ fontSize: 14, fontWeight: 700, marginTop: 12 }}>{chassisNumber}</p>
      <p style={{ fontSize: 11, color: '#6B7280', marginTop: 4 }}>Scan for service history &amp; warranty status</p>

      <style jsx global>{`
        @media print {
          @page { size: 80mm 100mm; margin: 4mm; }
        }
      `}</style>
    </div>
  );
}
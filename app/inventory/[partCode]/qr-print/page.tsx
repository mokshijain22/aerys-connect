'use client';

import { useParams } from 'next/navigation';
import { useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';

export default function PartQrPrintPage() {
  const { partCode } = useParams<{ partCode: string }>();

  useEffect(() => {
    const timer = setTimeout(() => window.print(), 400);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', fontFamily: 'Inter, sans-serif' }}>
      <p style={{ fontSize: 12, fontWeight: 600, color: '#6C5CE7', marginBottom: 4 }}>AERYS SERVICE CONNECT</p>
      {partCode && <QRCodeSVG value={partCode} size={180} />}
      <p style={{ fontSize: 14, fontWeight: 700, marginTop: 12 }}>{partCode}</p>
      <p style={{ fontSize: 11, color: '#6B7280', marginTop: 4 }}>Scan to look up stock &amp; details</p>

      <style jsx global>{`
        @media print {
          @page { size: 60mm 80mm; margin: 3mm; }
        }
      `}</style>
    </div>
  );
}
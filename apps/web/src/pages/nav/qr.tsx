import { useEffect, useState } from 'react';

interface Destination {
  id: string;
  label: string;
  lat: number;
  lon: number;
}

interface QrData {
  qr_data_url: string;
  destination_label: string;
  destination_id: string;
}

export default function QrNavPage() {
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [qrMap, setQrMap] = useState<Record<string, string>>({});

  useEffect(() => {
    fetch('/api/v1/qr/destinations')
      .then((r) => r.json())
      .then((res) => {
        if (res.success) setDestinations(res.data);
      });
  }, []);

  useEffect(() => {
    if (destinations.length === 0) return;
    destinations.forEach((d) => {
      fetch(`/api/v1/qr/${d.id}`)
        .then((r) => r.json())
        .then((res) => {
          if (res.success) {
            const data = res.data as QrData;
            setQrMap((prev) => ({ ...prev, [d.id]: data.qr_data_url }));
          }
        });
    });
  }, [destinations]);

  return (
    <div style={{
      minHeight: '100vh', width: '100vw',
      background: 'var(--bg, #0a0a1a)', color: '#fff',
      fontFamily: "'Poppins', sans-serif",
      padding: '24px',
      boxSizing: 'border-box',
    }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 8px' }}>QR Codes</h1>
      <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', margin: '0 0 24px' }}>
        Scan a code to navigate to your destination.
      </p>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
        gap: 16,
      }}>
        {destinations.map((d) => (
          <div key={d.id} style={{
            background: 'rgba(13,13,24,0.92)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 12, padding: 20,
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
          }}>
            <div style={{ fontSize: 14, fontWeight: 600 }}>{d.label}</div>
            {qrMap[d.id] ? (
              <img
                src={qrMap[d.id]}
                alt={`QR for ${d.label}`}
                style={{ width: 160, height: 160, borderRadius: 8 }}
              />
            ) : (
              <div style={{ width: 160, height: 160, borderRadius: 8, background: 'rgba(255,255,255,0.04)' }} />
            )}
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>
              Scan to navigate
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

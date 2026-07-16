'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { useSession } from 'next-auth/react';
import { ResponsiveLayout } from '@/app/components/ResponsiveLayout';
import { NAV_ITEMS } from '@/app/lib/nav-items';
import { QRCodeSVG } from 'qrcode.react';
import Link from 'next/link';

const VIOLET = '#6C5CE7';
const VIOLET_LIGHT = '#8B7CF8';
const VIOLET_DIM = 'rgba(108,92,231,0.10)';
const BORDER = 'rgba(30,20,60,0.07)';
const MUTED = '#6B7280';
const INK = '#1A1A2E';
const CARD_SHADOW = '0 1px 2px rgba(20,10,50,0.04), 0 8px 24px -12px rgba(20,10,50,0.08)';
const CARD_SHADOW_HOVER = '0 4px 12px rgba(20,10,50,0.06), 0 16px 36px -12px rgba(108,92,231,0.18)';

const NAV = NAV_ITEMS.map((item) => ({ ...item, active: item.href === '/vehicles' }));

export default function VehiclesPage() {
  const { data: session } = useSession();
  const role = (session?.user as any)?.role || '';
  const [form, setForm] = useState({
    customerName: '', customerPhone: '', customerAddress: '',
    dealerId: '', modelId: '', colour: '', purchaseDate: '',
    chassisNumber: '', motorNumber: '', batterySerialNumber: '', chargerSerialNumber: ''
  });
  const [message, setMessage] = useState('');
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [dealers, setDealers] = useState<any[]>([]);
  const [models, setModels] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [origin, setOrigin] = useState('');

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const loadVehicles = async () => {
    const res = await fetch('/api/vehicles');
    const json = await res.json();
    setVehicles(json.data || []);
  };
  const loadDealers = async () => {
    const res = await fetch('/api/dealers');
    const json = await res.json();
    const dealerList = json.data || [];
    setDealers(dealerList);
    if (role === 'dealer' && (session?.user as any)?.dealer_id) {
      setForm((prev) => ({ ...prev, dealerId: String((session?.user as any).dealer_id) }));
    } else if (dealerList.length > 0) {
      setForm((prev) => ({ ...prev, dealerId: String(dealerList[0].dealer_id) }));
    }
  };
  const loadModels = async () => {
    const res = await fetch('/api/vehicle-models');
    const json = await res.json();
    const modelList = json.data || [];
    setModels(modelList);
    if (modelList.length > 0) setForm((prev) => ({ ...prev, modelId: String(modelList[0].model_id) }));
  };

  useEffect(() => { loadVehicles(); loadModels(); }, []);
  useEffect(() => { loadDealers(); }, [session]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [e.target.name]: e.target.value });
  const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('Saving...');
    const res = await fetch('/api/vehicles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    const json = await res.json();
    if (json.success) {
      setMessage('Vehicle registered successfully!');
      loadVehicles();
    } else {
      setMessage('Error: ' + json.error);
    }
  };

  const filtered = vehicles.filter((v) =>
    v.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    v.chassis_number?.toLowerCase().includes(search.toLowerCase()) ||
    v.phone?.includes(search)
  );

  const inputStyle = {
    border: `1px solid ${BORDER}`,
    backgroundColor: '#FAFAFF',
    color: INK,
    transition: 'box-shadow 0.2s, border-color 0.2s',
  };
  const inputFocus = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) => {
    e.currentTarget.style.borderColor = VIOLET_LIGHT;
    e.currentTarget.style.boxShadow = `0 0 0 3px ${VIOLET}22`;
    e.currentTarget.style.backgroundColor = '#fff';
  };
  const inputBlur = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) => {
    e.currentTarget.style.borderColor = BORDER;
    e.currentTarget.style.boxShadow = 'none';
    e.currentTarget.style.backgroundColor = '#FAFAFF';
  };

  return (
    <>
      <style jsx global>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(14px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .fade-up { opacity: 0; animation: fadeUp 0.5s ease forwards; }
        .page-bg {
          background-color: #FAFAFF;
          background-image:
            radial-gradient(circle at 15% 10%, rgba(108,92,231,0.07), transparent 40%),
            radial-gradient(circle at 90% 25%, rgba(245,166,35,0.05), transparent 35%);
        }
      `}</style>
    <ResponsiveLayout navItems={NAV}>
      <div className="page-bg -m-4 md:-m-6 p-4 md:p-6" style={{ fontFamily: 'Inter, sans-serif' }}>

        {/* Breadcrumb */}
        <div className="flex items-center gap-1.5 text-xs mb-4 fade-up" style={{ color: MUTED }}>
          <Link href="/" className="hover:underline">Home</Link> <span>›</span> <span>Vehicle Registration</span> <span>›</span>
          <span className="font-semibold" style={{ color: VIOLET }}>Register a vehicle</span>
        </div>

        {/* Hero */}
        <div
          className="rounded-[24px] p-8 mb-8 relative overflow-hidden fade-up"
          style={{
            background: 'rgba(255,255,255,0.6)',
            backdropFilter: 'blur(16px)',
            border: `1px solid ${BORDER}`,
            boxShadow: CARD_SHADOW,
          }}
        >
          <div
            className="pointer-events-none absolute -top-20 -right-20 w-72 h-72 rounded-full opacity-30 blur-2xl"
            style={{ background: `radial-gradient(circle, ${VIOLET_LIGHT}, transparent 70%)` }}
          />
          <h1 className="relative text-[28px] font-extrabold tracking-tight" style={{ color: INK }}>{role === 'customer' ? 'My vehicles' : 'Register a vehicle'}</h1>
          <p className="relative text-sm mt-2" style={{ color: MUTED }}>{role === 'customer' ? 'View your registered vehicles' : 'Add a new vehicle to your fleet database'}</p>
          </div>

        {/* Stepper */}
        {role !== 'customer' && (
        <div className="flex items-center mb-8 fade-up overflow-x-auto">
          {[
            { n: 1, label: 'Vehicle Information', sub: 'In progress', active: true },
            { n: 2, label: 'Battery & Motor', sub: 'Pending', active: false },
            { n: 3, label: 'Additional Details', sub: 'Pending', active: false },
            { n: 4, label: 'Review & Submit', sub: 'Pending', active: false },
          ].map((s, i, arr) => (
            <div key={s.n} className="flex items-center shrink-0">
              <div className="flex items-center gap-3">
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0 transition-all"
                  style={
                    s.active
                      ? { background: `linear-gradient(135deg, ${VIOLET_LIGHT}, ${VIOLET})`, color: '#fff', boxShadow: `0 6px 16px -6px ${VIOLET}88` }
                      : { backgroundColor: '#fff', color: MUTED, border: `1.5px solid ${BORDER}` }
                  }
                >
                  {s.n}
                </div>
                <div className="hidden sm:block">
                  <p className="text-xs font-semibold" style={{ color: s.active ? VIOLET : INK }}>{s.label}</p>
                  <p className="text-[11px]" style={{ color: MUTED }}>{s.sub}</p>
                </div>
              </div>
              {i < arr.length - 1 && (
                <div className="w-10 sm:w-16 h-px mx-3" style={{ backgroundColor: BORDER }} />
              )}
            </div>
          ))}
        </div>
        )}

        <div className="flex flex-col lg:flex-row gap-6 items-start">
        <div className="flex-1 min-w-0">
        {/* Form card */}
        {role !== 'customer' && (
        <div className="rounded-[20px] p-7 bg-white border mb-8 fade-up" style={{ borderColor: BORDER, boxShadow: CARD_SHADOW }}>
          <div className="flex items-center gap-3 mb-6">
            <span
              className="w-10 h-10 rounded-2xl flex items-center justify-center text-lg"
              style={{ background: `linear-gradient(135deg, ${VIOLET_LIGHT}, ${VIOLET})`, boxShadow: `0 6px 16px -6px ${VIOLET}66` }}
            >
              🚗
            </span>
            <p className="font-bold text-[15px]" style={{ color: INK }}>Vehicle information</p>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: INK }}>Customer name *</label>
                <input name="customerName" placeholder="Enter customer name" onChange={handleChange} required
                  className="w-full rounded-2xl px-4 py-3 text-sm outline-none" style={inputStyle} onFocus={inputFocus} onBlur={inputBlur} />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: INK }}>Customer phone *</label>
                <input name="customerPhone" placeholder="Enter 10-digit phone number" onChange={handleChange} required
                  className="w-full rounded-2xl px-4 py-3 text-sm outline-none" style={inputStyle} onFocus={inputFocus} onBlur={inputBlur} />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: INK }}>Customer address</label>
                <input name="customerAddress" placeholder="Enter complete address" onChange={handleChange}
                  className="w-full rounded-2xl px-4 py-3 text-sm outline-none" style={inputStyle} onFocus={inputFocus} onBlur={inputBlur} />
              </div>

              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: INK }}>Dealer *</label>
                {role === 'dealer' ? (
                  <input
                    disabled
                    value={dealers.find((d) => String(d.dealer_id) === String(form.dealerId))?.dealer_name || 'Your dealership'}
                    className="w-full rounded-2xl px-4 py-3 text-sm outline-none opacity-70 cursor-not-allowed"
                    style={inputStyle}
                  />
                ) : (
                  <select name="dealerId" value={form.dealerId} onChange={handleSelectChange} required
                    className="w-full rounded-2xl px-4 py-3 text-sm outline-none" style={inputStyle} onFocus={inputFocus} onBlur={inputBlur}>
                    {dealers.map((d) => <option key={d.dealer_id} value={d.dealer_id}>{d.dealer_name}</option>)}
                  </select>
                )}
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: INK }}>Vehicle model *</label>
                <select name="modelId" value={form.modelId} onChange={handleSelectChange} required
                  className="w-full rounded-2xl px-4 py-3 text-sm outline-none" style={inputStyle} onFocus={inputFocus} onBlur={inputBlur}>
                  {models.map((m) => <option key={m.model_id} value={m.model_id}>{m.model_name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: INK }}>Vehicle colour *</label>
                <input name="colour" placeholder="Select colour" onChange={handleChange}
                  className="w-full rounded-2xl px-4 py-3 text-sm outline-none" style={inputStyle} onFocus={inputFocus} onBlur={inputBlur} />
              </div>

              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: INK }}>Purchase date *</label>
                <input name="purchaseDate" type="date" onChange={handleChange} required
                  className="w-full rounded-2xl px-4 py-3 text-sm outline-none" style={inputStyle} onFocus={inputFocus} onBlur={inputBlur} />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: INK }}>Chassis number *</label>
                <input name="chassisNumber" placeholder="Enter chassis number" onChange={handleChange} required
                  className="w-full rounded-2xl px-4 py-3 text-sm outline-none" style={inputStyle} onFocus={inputFocus} onBlur={inputBlur} />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: INK }}>Motor number *</label>
                <input name="motorNumber" placeholder="Enter motor number" onChange={handleChange} required
                  className="w-full rounded-2xl px-4 py-3 text-sm outline-none" style={inputStyle} onFocus={inputFocus} onBlur={inputBlur} />
              </div>

              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: INK }}>Battery serial number *</label>
                <input name="batterySerialNumber" placeholder="Enter battery serial number" onChange={handleChange} required
                  className="w-full rounded-2xl px-4 py-3 text-sm outline-none" style={inputStyle} onFocus={inputFocus} onBlur={inputBlur} />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: INK }}>Charger serial number</label>
                <input name="chargerSerialNumber" placeholder="Enter charger serial number (if any)" onChange={handleChange}
                  className="w-full rounded-2xl px-4 py-3 text-sm outline-none" style={inputStyle} onFocus={inputFocus} onBlur={inputBlur} />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button type="button" onClick={() => setForm({ ...form, customerName: '', customerPhone: '', customerAddress: '', colour: '', purchaseDate: '', chassisNumber: '', motorNumber: '', batterySerialNumber: '', chargerSerialNumber: '' })}
                className="px-5 py-2.5 rounded-xl text-sm font-medium border" style={{ borderColor: BORDER, color: INK }}>
                Reset
              </button>
              <button type="submit"
                className="px-6 py-3 rounded-2xl text-sm font-semibold text-white transition-transform hover:-translate-y-0.5"
                style={{ background: `linear-gradient(135deg, ${VIOLET_LIGHT}, ${VIOLET})`, boxShadow: `0 10px 24px -8px ${VIOLET}66` }}>
                Register vehicle →
              </button>
            </div>
            {message && <p className="text-sm mt-3" style={{ color: message.startsWith('Error') ? '#E24B4A' : '#34C759' }}>{message}</p>}
          </form>
        </div>
        )}

        {/* Table */}
        <div className="rounded-[20px] bg-white border overflow-hidden fade-up" style={{ borderColor: BORDER, boxShadow: CARD_SHADOW }}>
          <div className="flex items-start sm:items-center justify-between gap-3 p-5 pb-3 flex-col sm:flex-row">
            <p className="font-semibold" style={{ color: INK }}>Registered vehicles</p>
            <input
              placeholder="Search by customer, chassis or phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="rounded-xl px-4 py-2 text-sm outline-none w-full sm:w-72"
              style={inputStyle}
            />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left" style={{ color: MUTED }}>
                  {['Customer', 'Phone', 'Chassis No.', 'Colour', 'Purchase date', 'Vehicle model', 'Dealer', 'QR Code'].map((h) => (
                    <th key={h} className="px-5 py-2 font-medium text-xs">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((v) => (
                  <tr key={v.vehicle_id} className="border-t transition-colors hover:bg-[#FAFAFF]" style={{ borderColor: BORDER }}>
                    <td className="px-5 py-3 flex items-center gap-2">
                      <span className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-semibold" style={{ backgroundColor: VIOLET_DIM, color: VIOLET }}>
                        {v.full_name?.slice(0, 2).toUpperCase()}
                      </span>
                      {v.full_name}
                    </td>
                    <td className="px-5 py-3" style={{ color: MUTED }}>{v.phone}</td>
                    <td className="px-5 py-3" style={{ color: MUTED }}>{v.chassis_number}</td>
                    <td className="px-5 py-3" style={{ color: MUTED }}>{v.colour}</td>
                    <td className="px-5 py-3" style={{ color: MUTED }}>{v.purchase_date}</td>
                    <td className="px-5 py-3" style={{ color: MUTED }}>{v.model_name ?? '—'}</td>
                    <td className="px-5 py-3" style={{ color: MUTED }}>{v.dealer_name ?? '—'}</td>
                    <td className="px-5 py-3">
                      {origin && (
                        
                          <a href={`/vehicles/${v.chassis_number}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Open public vehicle profile"
                        >
                          <QRCodeSVG value={`${origin}/vehicles/${v.chassis_number}`} size={36} />
                        </a>
                      )}
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={8} className="px-5 py-8 text-center text-sm" style={{ color: MUTED }}>No vehicles found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="px-5 py-3 text-xs" style={{ color: MUTED }}>
            Showing {filtered.length} of {vehicles.length} entries
          </div>
        </div>
        </div>

        {/* Vehicle preview sidebar */}
        {role !== 'customer' && (
        <div className="w-full lg:w-[300px] shrink-0 lg:sticky lg:top-24 space-y-5 fade-up">
          <div className="rounded-[20px] p-6 bg-white border overflow-hidden relative" style={{ borderColor: BORDER, boxShadow: CARD_SHADOW }}>
            <div
              className="pointer-events-none absolute -top-10 -right-10 w-40 h-40 rounded-full opacity-30 blur-2xl"
              style={{ background: `radial-gradient(circle, ${VIOLET_LIGHT}, transparent 70%)` }}
            />
            <p className="relative text-sm font-bold mb-4" style={{ color: INK }}>Vehicle preview</p>
            <div
              className="relative rounded-2xl p-5 mb-4 flex items-center justify-center"
              style={{ background: `radial-gradient(circle at 50% 40%, ${VIOLET_DIM}, transparent 75%)`, minHeight: 200 }}
            >
              <Image src="/hero-scooter.png" alt="" width={200} height={200} className="object-contain w-full h-auto drop-shadow-lg" />
            </div>
            <p className="relative text-sm font-bold text-center" style={{ color: VIOLET }}>
              {models.find((m) => String(m.model_id) === String(form.modelId))?.model_name ?? 'AERYS X1'}
            </p>
            <p className="relative text-xs text-center mb-5" style={{ color: MUTED }}>Electric Scooter</p>

            <div className="relative pt-4 border-t" style={{ borderColor: BORDER }}>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold" style={{ color: INK }}>Registration progress</p>
                <span className="text-xs font-bold" style={{ color: VIOLET }}>25%</span>
              </div>
              <p className="text-[11px] mb-2" style={{ color: MUTED }}>Step 1 of 4 completed</p>
              <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: VIOLET_DIM }}>
                <div className="h-full rounded-full transition-all duration-700" style={{ width: '25%', background: `linear-gradient(90deg, ${VIOLET_LIGHT}, ${VIOLET})` }} />
              </div>
            </div>
          </div>

          <div className="rounded-[20px] p-6 bg-white border" style={{ borderColor: BORDER, boxShadow: CARD_SHADOW }}>
            <p className="text-sm font-bold mb-4" style={{ color: INK }}>Highlights</p>
            <div className="space-y-4">
              {[
                { label: 'Dealer', sub: dealers.find((d) => String(d.dealer_id) === String(form.dealerId))?.dealer_name ?? 'AERYS Mumbai Service Center', icon: '🏢' },
                { label: 'Warranty', sub: '3 Years Standard Warranty', icon: '🛡️' },
                { label: 'Support', sub: '24x7 Customer Support', icon: '🎧' },
              ].map((h) => (
                <div key={h.label} className="flex items-start gap-3 transition-transform hover:translate-x-0.5">
                  <span className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-sm" style={{ backgroundColor: VIOLET_DIM }}>{h.icon}</span>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold" style={{ color: INK }}>{h.label}</p>
                    <p className="text-[11px] truncate" style={{ color: MUTED }}>{h.sub}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[20px] p-5" style={{ background: `linear-gradient(135deg, ${VIOLET_DIM}, rgba(245,166,35,0.06))`, border: `1px solid ${BORDER}` }}>
            <p className="text-xs font-bold mb-1.5" style={{ color: VIOLET }}>Why register your vehicle?</p>
            <p className="text-[11px] leading-relaxed" style={{ color: MUTED }}>
              Registering helps us provide better support, warranty services and ensures your vehicle is always protected.
            </p>
          </div>
        </div>
        )}
        </div>
      </div>
    </ResponsiveLayout>
    </>
  );
}
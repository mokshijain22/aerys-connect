'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { useSession } from 'next-auth/react';
import { ResponsiveLayout } from '@/app/components/ResponsiveLayout';
import { NAV_ITEMS } from '@/app/lib/nav-items';
import Link from 'next/link';

const VIOLET = '#6C5CE7';
const VIOLET_LIGHT = '#8B7CF8';
const VIOLET_DIM = 'rgba(108,92,231,0.10)';
const BORDER = 'rgba(30,20,60,0.07)';
const MUTED = '#6B7280';
const INK = '#1A1A2E';
const RED = '#E24B4A';
const GREEN = '#34C759';
const CARD_SHADOW = '0 1px 2px rgba(20,10,50,0.04), 0 8px 24px -12px rgba(20,10,50,0.08)';
const CARD_SHADOW_HOVER = '0 4px 12px rgba(20,10,50,0.06), 0 16px 36px -12px rgba(108,92,231,0.18)';

const STATUS_FLOW = ['registered', 'acknowledged', 'technician_assigned', 'in_progress', 'completed', 'delivered'];
const STATUS_LABEL: Record<string, string> = {
  registered: 'Registered',
  acknowledged: 'Acknowledged',
  rejected_by_dealer: 'Rejected',
  technician_assigned: 'Technician assigned',
  in_progress: 'In progress',
  completed: 'Completed',
  delivered: 'Delivered',
};
const STATUS_COLOR: Record<string, string> = {
  registered: '#34C759',
  acknowledged: VIOLET,
  rejected_by_dealer: RED,
  technician_assigned: VIOLET,
  in_progress: '#0C447C',
  completed: '#34C759',
  delivered: MUTED,
};

const PART_CATEGORIES = ['Battery', 'Motor', 'Charger', 'Brakes', 'Electrical', 'Body', 'Tyres', 'Other'];
const SYMPTOM_TYPES = [
  'Not working / No power',
  'Making unusual noise',
  'Leaking / Overheating',
  'Physical damage',
  'Reduced performance (range/speed)',
  'Other',
];

const NAV = NAV_ITEMS.map((item) => ({ ...item, active: item.href === '/jobcards' }));

function formatElapsed(minutes: number) {
  const d = Math.floor(minutes / 1440);
  const h = Math.floor((minutes % 1440) / 60);
  const m = minutes % 60;
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export default function JobCardsPage() {
  const { data: session } = useSession();
  const role = (session?.user as any)?.role || '';

  const [form, setForm] = useState({ chassisNumber: '', complaintText: '', serviceType: 'paid', partCategory: '', symptomType: '' });
  const [photos, setPhotos] = useState<File[]>([]);
  const [message, setMessage] = useState('');
  const [jobCards, setJobCards] = useState<any[]>([]);
  const [technicians, setTechnicians] = useState<any[]>([]);
  const [selectedTech, setSelectedTech] = useState<Record<number, string>>({});
  const [warranty, setWarranty] = useState<any>(null);
  const [warrantyError, setWarrantyError] = useState('');
  const [search, setSearch] = useState('');
  const [actionMessage, setActionMessage] = useState('');

  const loadJobCards = async () => {
    const res = await fetch('/api/jobcards');
    const json = await res.json();
    setJobCards(json.data || []);
  };

  const loadTechnicians = async () => {
    if (role !== 'dealer' && role !== 'super_admin') return;
    const res = await fetch('/api/technicians');
    const json = await res.json();
    setTechnicians(json.data || []);
  };

  useEffect(() => { loadJobCards(); }, []);
  useEffect(() => { loadTechnicians(); }, [role]);

  useEffect(() => {
    if (!form.chassisNumber) {
      setWarranty(null);
      setWarrantyError('');
      return;
    }
    const timer = setTimeout(async () => {
      const res = await fetch(`/api/vehicle-warranty?chassisNumber=${encodeURIComponent(form.chassisNumber)}`);
      const json = await res.json();
      if (json.success) {
        setWarranty(json.data);
        setWarrantyError('');
      } else {
        setWarranty(null);
        setWarrantyError(json.error);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [form.chassisNumber]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const combined = [...photos, ...files].slice(0, 5);
    setPhotos(combined);
    e.target.value = '';
  };

  const removePhoto = (index: number) => {
    setPhotos(photos.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('Saving...');
    const res = await fetch('/api/jobcards', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    const json = await res.json();
    if (json.success) {
      if (photos.length > 0 && json.jobCardId) {
        for (const photo of photos) {
          const fd = new FormData();
          fd.append('file', photo);
          fd.append('stage', 'complaint');
          await fetch(`/api/jobcards/${json.jobCardId}/attachments`, {
            method: 'POST',
            body: fd,
          });
        }
      }
      setMessage('Job card created!');
      setForm({ chassisNumber: '', complaintText: '', serviceType: 'paid', partCategory: '', symptomType: '' });
      setPhotos([]);
      setWarranty(null);
      loadJobCards();
    } else {
      setMessage('Error: ' + json.error);
    }
  };

  const advanceStatus = async (jobCardId: number, currentStatus: string) => {
    const currentIndex = STATUS_FLOW.indexOf(currentStatus);
    const newStatus = STATUS_FLOW[currentIndex + 1];
    if (!newStatus) return;
    await fetch('/api/jobcards', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobCardId, newStatus }),
    });
    loadJobCards();
  };

  const dealerAccept = async (jobCardId: number) => {
    await fetch('/api/jobcards', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobCardId, newStatus: 'acknowledged' }),
    });
    loadJobCards();
  };

  const dealerReject = async (jobCardId: number) => {
    const reason = prompt('Rejection reason:');
    if (!reason) return;
    const res = await fetch('/api/jobcards', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobCardId, newStatus: 'rejected_by_dealer', rejectionReason: reason }),
    });
    const json = await res.json();
    if (!json.success) setActionMessage('Error: ' + json.error);
    loadJobCards();
  };

  const assignTechnician = async (jobCardId: number) => {
    const technicianId = selectedTech[jobCardId];
    if (!technicianId) {
      setActionMessage('Please select a technician first');
      return;
    }
    const res = await fetch('/api/jobcards/assign-technician', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobCardId, technicianId: Number(technicianId) }),
    });
    const json = await res.json();
    if (!json.success) setActionMessage('Error: ' + json.error);
    loadJobCards();
  };

  const technicianRespond = async (jobCardId: number, action: 'accept' | 'reject') => {
    let rejectionReason;
    if (action === 'reject') {
      rejectionReason = prompt('Rejection reason:');
      if (!rejectionReason) return;
    }
    const res = await fetch('/api/jobcards/technician-response', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobCardId, action, rejectionReason }),
    });
    const json = await res.json();
    if (json.success && json.message) {
      setActionMessage(json.message);
    } else if (!json.success) {
      setActionMessage('Error: ' + json.error);
    }
    loadJobCards();
  };

  const filtered = jobCards.filter((jc) =>
    jc.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    jc.chassis_number?.toLowerCase().includes(search.toLowerCase()) ||
    jc.complaint_text?.toLowerCase().includes(search.toLowerCase())
  );

  const inputStyle = { border: `1px solid ${BORDER}`, backgroundColor: '#FAFAFF', color: INK, transition: 'box-shadow 0.2s, border-color 0.2s' };
  const inputFocus = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    e.currentTarget.style.borderColor = VIOLET_LIGHT;
    e.currentTarget.style.boxShadow = `0 0 0 3px ${VIOLET}22`;
    e.currentTarget.style.backgroundColor = '#fff';
  };
  const inputBlurH = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    e.currentTarget.style.borderColor = BORDER;
    e.currentTarget.style.boxShadow = 'none';
    e.currentTarget.style.backgroundColor = '#FAFAFF';
  };

  const renderActions = (jc: any) => {
    // Dealer / admin actions
    if (role === 'dealer' || role === 'super_admin') {
      if (jc.status === 'registered') {
        return (
          <div className="flex gap-2">
            <button onClick={() => dealerAccept(jc.job_card_id)}
              className="text-xs font-medium px-3 py-1.5 rounded-lg text-white" style={{ backgroundColor: GREEN }}>
              Accept
            </button>
            <button onClick={() => dealerReject(jc.job_card_id)}
              className="text-xs font-medium px-3 py-1.5 rounded-lg text-white" style={{ backgroundColor: RED }}>
              Reject
            </button>
          </div>
        );
      }
      if (jc.status === 'acknowledged') {
        return (
          <div className="flex gap-2 items-center">
            <select
              value={selectedTech[jc.job_card_id] || ''}
              onChange={(e) => setSelectedTech({ ...selectedTech, [jc.job_card_id]: e.target.value })}
              className="text-xs rounded-lg px-2 py-1.5 outline-none" style={inputStyle}>
              <option value="">Select technician</option>
              {technicians.map((t) => (
                <option key={t.technician_id} value={t.technician_id}>{t.full_name}</option>
              ))}
            </select>
            <button onClick={() => assignTechnician(jc.job_card_id)}
              className="text-xs font-medium px-3 py-1.5 rounded-lg border" style={{ borderColor: VIOLET, color: VIOLET }}>
              Assign
            </button>
          </div>
        );
      }
      if (jc.status === 'technician_assigned') {
        return <span className="text-xs" style={{ color: MUTED }}>Waiting for technician response...</span>;
      }
      if (jc.status === 'rejected_by_dealer') {
        return <span className="text-xs" style={{ color: RED }}>{jc.dealer_rejection_reason}</span>;
      }
      if (jc.status === 'completed') {
        return (
          <button onClick={() => advanceStatus(jc.job_card_id, jc.status)}
            className="text-xs font-medium px-3 py-1.5 rounded-lg border"
            style={{ borderColor: VIOLET, color: VIOLET }}>
            Move to: Delivered →
          </button>
        );
      }
      if (jc.status === 'delivered') {
        return (
          <a href={`/api/jobcards/${jc.job_card_id}/invoice`} target="_blank" rel="noopener noreferrer"
            className="text-xs font-medium px-3 py-1.5 rounded-lg border" style={{ borderColor: GREEN, color: GREEN }}>
            📄 Invoice
          </a>
        );
      }
      // completed/in_progress -> normal advance (e.g. mark delivered)
      const nextIndex = STATUS_FLOW.indexOf(jc.status) + 1;
      const nextStatus = STATUS_FLOW[nextIndex];
      if (nextStatus) {
        return (
          <button onClick={() => advanceStatus(jc.job_card_id, jc.status)}
            className="text-xs font-medium px-3 py-1.5 rounded-lg border"
            style={{ borderColor: VIOLET, color: VIOLET }}>
            Move to: {STATUS_LABEL[nextStatus]} →
          </button>
        );
      }
      return null;
    }

    // Technician actions
    if (role === 'technician') {
      if (jc.status === 'technician_assigned') {
        return (
          <div className="flex gap-2">
            <button onClick={() => technicianRespond(jc.job_card_id, 'accept')}
              className="text-xs font-medium px-3 py-1.5 rounded-lg text-white" style={{ backgroundColor: GREEN }}>
              Accept
            </button>
            <button onClick={() => technicianRespond(jc.job_card_id, 'reject')}
              className="text-xs font-medium px-3 py-1.5 rounded-lg text-white" style={{ backgroundColor: RED }}>
              Reject
            </button>
          </div>
        );
      }
      if (jc.status === 'in_progress' || jc.status === 'completed') {
        const nextIndex = STATUS_FLOW.indexOf(jc.status) + 1;
        const nextStatus = STATUS_FLOW[nextIndex];
        if (nextStatus === 'delivered') return null; // technicians can't mark delivered
        if (nextStatus) {
          return (
            <button onClick={() => advanceStatus(jc.job_card_id, jc.status)}
              className="text-xs font-medium px-3 py-1.5 rounded-lg border"
              style={{ borderColor: VIOLET, color: VIOLET }}>
              Move to: {STATUS_LABEL[nextStatus]} →
            </button>
          );
        }
      }
      return null;
    }
    // customer / other roles: read-only
    if (jc.status === 'rejected_by_dealer') {
      return <span className="text-xs" style={{ color: RED }}>{jc.dealer_rejection_reason}</span>;
    }
    return null;
  };


  return (
    <>
      <style jsx global>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(14px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes floatY {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }
        .fade-up { opacity: 0; animation: fadeUp 0.5s ease forwards; }
        .float-icon { animation: floatY 3.5s ease-in-out infinite; }
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
          <Link href="/" className="hover:underline">Home</Link> <span>›</span>
          <span className="font-semibold" style={{ color: VIOLET }}>Job Cards / Complaints</span>
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
          <h1 className="relative text-[28px] font-extrabold tracking-tight" style={{ color: INK }}>Job cards / complaints</h1>
          <p className="relative text-sm mt-2" style={{ color: MUTED }}>Track, manage and resolve customer complaints & service jobs</p>
          <div className="absolute right-8 top-6 hidden md:block w-32 opacity-90 float-icon">
            <Image src="/hero-scooter.png" alt="" width={220} height={220} className="object-contain w-full h-auto" />
          </div>
        </div>

        {actionMessage && (
          <div className="rounded-2xl p-4 mb-6 text-sm fade-up" style={{ backgroundColor: VIOLET_DIM, color: VIOLET, border: `1px solid ${BORDER}` }}>
            {actionMessage}
            <button onClick={() => setActionMessage('')} className="ml-3 text-xs underline">dismiss</button>
          </div>
        )}

        {/* Stat cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
          {[
            { label: 'Total Job Cards', value: jobCards.length, icon: '📋' },
            { label: 'Registered', value: jobCards.filter((jc) => jc.status === 'registered').length, icon: '🆕' },
            { label: 'In Progress', value: jobCards.filter((jc) => ['acknowledged', 'technician_assigned', 'in_progress'].includes(jc.status)).length, icon: '🔧' },
            { label: 'Completed', value: jobCards.filter((jc) => ['completed', 'delivered'].includes(jc.status)).length, icon: '✅' },
            { label: 'SLA Breaches', value: jobCards.filter((jc) => jc.escalated === 1 && jc.status !== 'delivered' && jc.status !== 'completed').length, icon: '⚠️' },
          ].map((s, idx) => {
            const isWarn = s.label === 'SLA Breaches' && s.value > 0;
            return (
              <div
                key={s.label}
                className="group rounded-[20px] p-6 border transition-all duration-200 fade-up"
                style={{
                  borderColor: BORDER,
                  boxShadow: CARD_SHADOW,
                  animationDelay: `${idx * 70}ms`,
                  background: idx % 2 === 0 ? '#fff' : `linear-gradient(160deg, #fff 60%, ${VIOLET_DIM} 100%)`,
                }}
                onMouseEnter={(e) => { e.currentTarget.style.boxShadow = CARD_SHADOW_HOVER; e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.borderColor = isWarn ? RED : VIOLET_LIGHT; }}
                onMouseLeave={(e) => { e.currentTarget.style.boxShadow = CARD_SHADOW; e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.borderColor = BORDER; }}
              >
                <span
                  className="w-11 h-11 rounded-2xl flex items-center justify-center mb-3 text-lg transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3"
                  style={{
                    background: isWarn ? `linear-gradient(135deg, #F08A8A, ${RED})` : `linear-gradient(135deg, ${VIOLET_LIGHT}, ${VIOLET})`,
                    boxShadow: `0 6px 16px -6px ${isWarn ? RED : VIOLET}66`,
                  }}
                >
                  {s.icon}
                </span>
                <p className="text-xs font-medium mb-1.5" style={{ color: MUTED }}>{s.label}</p>
                <p className="text-[26px] font-extrabold tabular-nums tracking-tight mb-3" style={{ color: isWarn ? RED : INK }}>{s.value}</p>
                <div className="h-1 rounded-full overflow-hidden" style={{ backgroundColor: isWarn ? 'rgba(226,75,74,0.12)' : VIOLET_DIM }}>
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{ width: jobCards.length ? `${Math.min(100, (s.value / Math.max(jobCards.length, 1)) * 100)}%` : '0%', background: isWarn ? RED : `linear-gradient(90deg, ${VIOLET_LIGHT}, ${VIOLET})` }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* Create form */}
        <div className="rounded-[20px] p-7 bg-white border mb-8 fade-up" style={{ borderColor: BORDER, boxShadow: CARD_SHADOW }}>
          <div className="flex items-center gap-3 mb-6">
            <span
              className="w-10 h-10 rounded-2xl flex items-center justify-center text-lg"
              style={{ background: `linear-gradient(135deg, ${VIOLET_LIGHT}, ${VIOLET})`, boxShadow: `0 6px 16px -6px ${VIOLET}66` }}
            >
              📋
            </span>
            <p className="font-bold text-[15px]" style={{ color: INK }}>Create job card / log a complaint</p>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: INK }}>Vehicle (chassis number) *</label>
                <input name="chassisNumber" placeholder="Enter chassis number" value={form.chassisNumber} onChange={handleChange} required
                  className="w-full rounded-2xl px-4 py-3 text-sm outline-none" style={inputStyle} onFocus={inputFocus} onBlur={inputBlurH} />
                {warrantyError && <p className="text-xs mt-1.5" style={{ color: RED }}>{warrantyError}</p>}
                {warranty && (
                  <div className="mt-2 rounded-xl p-3 text-xs space-y-1" style={{ backgroundColor: VIOLET_DIM }}>
                    <p style={{ color: warranty.battery_in_warranty ? GREEN : RED }}>
                      Battery: {warranty.battery_in_warranty ? 'In warranty' : 'Expired'} (until {warranty.battery_warranty_end})
                    </p>
                    <p style={{ color: warranty.motor_in_warranty ? GREEN : RED }}>
                      Motor: {warranty.motor_in_warranty ? 'In warranty' : 'Expired'} (until {warranty.motor_warranty_end})
                    </p>
                    <p style={{ color: warranty.charger_in_warranty ? GREEN : RED }}>
                      Charger: {warranty.charger_in_warranty ? 'In warranty' : 'Expired'} (until {warranty.charger_warranty_end})
                    </p>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: INK }}>Describe the complaint *</label>
                <textarea name="complaintText" placeholder="Describe issue / complaint in detail..." value={form.complaintText} onChange={handleChange} required
                  rows={4} maxLength={500}
                  className="w-full rounded-2xl px-4 py-3 text-sm outline-none resize-none" style={inputStyle} onFocus={inputFocus} onBlur={inputBlurH} />
                <p className="text-[10px] text-right mt-1" style={{ color: MUTED }}>{form.complaintText.length} / 500</p>
              </div>

              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: INK }}>Paid service</label>
                <select name="serviceType" value={form.serviceType} onChange={handleChange}
                  className="w-full rounded-2xl px-4 py-3 text-sm outline-none" style={inputStyle} onFocus={inputFocus} onBlur={inputBlurH}>
                  <option value="paid">Paid service</option>
                  <option value="warranty">Warranty claim</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: INK }}>Which part (optional)</label>
                <select name="partCategory" value={form.partCategory} onChange={handleChange}
                  className="w-full rounded-2xl px-4 py-3 text-sm outline-none" style={inputStyle} onFocus={inputFocus} onBlur={inputBlurH}>
                  <option value="">Not sure / Other</option>
                  {PART_CATEGORIES.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: INK }}>What's the problem (optional)</label>
                <select name="symptomType" value={form.symptomType} onChange={handleChange}
                  className="w-full rounded-2xl px-4 py-3 text-sm outline-none" style={inputStyle} onFocus={inputFocus} onBlur={inputBlurH}>
                  <option value="">Select symptom</option>
                  {SYMPTOM_TYPES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              <div className="md:col-span-3">
                <label className="block text-xs font-medium mb-1.5" style={{ color: INK }}>Photos (optional, max 5)</label>
                <input type="file" accept="image/*" multiple onChange={handlePhotoSelect} disabled={photos.length >= 5}
                  className="w-full rounded-2xl px-4 py-3 text-sm outline-none" style={inputStyle} />
                {photos.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {photos.map((p, i) => (
                      <span key={i} className="text-xs px-3 py-1.5 rounded-full flex items-center gap-2" style={{ backgroundColor: VIOLET_DIM, color: VIOLET }}>
                        {p.name.slice(0, 20)}
                        <button type="button" onClick={() => removePhoto(i)} style={{ color: RED }}>✕</button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button type="button" onClick={() => { setForm({ chassisNumber: '', complaintText: '', serviceType: 'paid', partCategory: '', symptomType: '' }); setPhotos([]); }}
                className="px-5 py-2.5 rounded-xl text-sm font-medium border" style={{ borderColor: BORDER, color: INK }}>
                Reset
              </button>
              <button type="submit"
                className="px-6 py-3 rounded-2xl text-sm font-semibold text-white transition-transform hover:-translate-y-0.5"
                style={{ background: `linear-gradient(135deg, ${VIOLET_LIGHT}, ${VIOLET})`, boxShadow: `0 10px 24px -8px ${VIOLET}66` }}>
                Create job card →
              </button>
            </div>
            {message && <p className="text-sm mt-3" style={{ color: message.startsWith('Error') ? RED : GREEN }}>{message}</p>}
          </form>
        </div>

        {/* Table */}
        <div className="rounded-[20px] bg-white border overflow-hidden fade-up" style={{ borderColor: BORDER, boxShadow: CARD_SHADOW }}>
          <div className="flex items-start sm:items-center justify-between gap-3 p-6 pb-4 flex-col sm:flex-row">
            <p className="font-bold text-[15px]" style={{ color: INK }}>All job cards</p>
            <div className="relative w-full sm:w-72">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={MUTED} strokeWidth="2" className="absolute left-3.5 top-1/2 -translate-y-1/2">
                <circle cx="11" cy="11" r="7" />
                <path d="M21 21l-4.3-4.3" />
              </svg>
              <input
                placeholder="Search job cards..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="rounded-full pl-9 pr-4 py-2.5 text-sm outline-none w-full"
                style={inputStyle}
                onFocus={inputFocus} onBlur={inputBlurH}
              />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left" style={{ color: MUTED }}>
                  {['Customer', 'Chassis No.', 'Complaint', 'Type', 'Status', 'Time elapsed', 'Action', 'Details'].map((h) => (
                    <th key={h} className="px-5 py-2 font-medium text-xs">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((jc) => {
                  const isOverSla = jc.escalated === 1 && jc.status !== 'delivered' && jc.status !== 'completed';
                  return (
                    <tr key={jc.job_card_id} className="border-t transition-colors hover:bg-[#FAFAFF]" style={{ borderColor: BORDER, backgroundColor: isOverSla ? 'rgba(226,75,74,0.04)' : 'transparent' }}>
                      <td className="px-5 py-3 flex items-center gap-2">
                        <span className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-semibold" style={{ backgroundColor: VIOLET_DIM, color: VIOLET }}>
                          {jc.full_name?.slice(0, 2).toUpperCase()}
                        </span>
                        {jc.full_name}
                      </td>
                      <td className="px-5 py-3" style={{ color: MUTED }}>{jc.chassis_number}</td>
                      <td className="px-5 py-3" style={{ color: MUTED }}>{jc.complaint_text}</td>
                      <td className="px-5 py-3">
                        <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ backgroundColor: VIOLET_DIM, color: VIOLET }}>
                          {jc.service_type === 'paid' ? 'Paid' : 'Warranty'}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <span
                          className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full"
                          style={{ backgroundColor: `${STATUS_COLOR[jc.status]}18`, color: STATUS_COLOR[jc.status] }}
                        >
                          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: STATUS_COLOR[jc.status] }} />
                          {STATUS_LABEL[jc.status] ?? jc.status}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <p style={{ color: isOverSla ? RED : INK }} className="text-xs font-medium">{formatElapsed(jc.minutes_elapsed)}</p>
                        {isOverSla && <p className="text-[10px] font-semibold" style={{ color: RED }}>⚠ SLA breach</p>}
                      </td>
                      <td className="px-5 py-3">
                        {renderActions(jc)}
                      </td>
                      <td className="px-5 py-3">
                        <a href={`/jobcards/${jc.job_card_id}`} className="text-xs font-semibold" style={{ color: VIOLET }}>
                          View details →
                        </a>
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr><td colSpan={8} className="px-5 py-8 text-center text-sm" style={{ color: MUTED }}>No job cards found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="px-5 py-3 text-xs" style={{ color: MUTED }}>
            Showing {filtered.length} of {jobCards.length} entries
          </div>
        </div>
      </div>
    </ResponsiveLayout>
    </>
  );
}
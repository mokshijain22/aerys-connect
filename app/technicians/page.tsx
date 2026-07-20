'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { ResponsiveLayout } from '@/app/components/ResponsiveLayout';
import { NAV_ITEMS } from '@/app/lib/nav-items';

const VIOLET = '#6C5CE7';
const VIOLET_LIGHT = '#8B7CF8';
const VIOLET_DIM = 'rgba(108,92,231,0.10)';
const BORDER = 'rgba(30,20,60,0.07)';
const MUTED = '#6B7280';
const INK = '#1A1A2E';
const GREEN = '#22C55E';
const RED = '#EF4444';
const CARD_SHADOW = '0 1px 2px rgba(20,10,50,0.04), 0 8px 24px -12px rgba(20,10,50,0.08)';
const CARD_SHADOW_HOVER = '0 4px 12px rgba(20,10,50,0.06), 0 16px 36px -12px rgba(108,92,231,0.18)';

const NAV = NAV_ITEMS.map((item) => ({ ...item, active: item.href === '/technicians' }));

type Technician = {
  technician_id: number;
  user_id: number;
  dealer_id: number;
  is_active: number;
  created_at: string;
  full_name: string;
  phone: string;
  email: string | null;
  dealer_name: string;
};

export default function TechniciansPage() {
  const { data: session } = useSession();
  const role = (session?.user as any)?.role || '';
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [form, setForm] = useState({ full_name: '', phone: '', email: '', password: '', dealerId: '' });
  const [dealerList, setDealerList] = useState<{ dealer_id: number; dealer_name: string; city_name: string }[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [page, setPage] = useState(1);
  const perPage = 6;

  useEffect(() => {
    fetchTechnicians();
    if (role === 'super_admin') fetchDealerList();
  }, [role]);

  async function fetchDealerList() {
    try {
      const res = await fetch('/api/dealers');
      const json = await res.json();
      if (json.success) setDealerList(json.dealerList || []);
    } catch {}
  }

  async function fetchTechnicians() {
    setLoading(true);
    try {
      const res = await fetch('/api/technicians');
      const json = await res.json();
      if (json.success) setTechnicians(json.data);
    } finally {
      setLoading(false);
    }
  }

  async function handleAddTechnician(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const body: any = { full_name: form.full_name, phone: form.phone, email: form.email, password: form.password };
      if (role === 'super_admin') body.dealer_id = form.dealerId ? Number(form.dealerId) : undefined;

      const res = await fetch('/api/technicians', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (json.success) {
        setShowAddModal(false);
        setForm({ full_name: '', phone: '', email: '', password: '', dealerId: '' });
        fetchTechnicians();
      } else {
        alert(json.error || 'Failed to add technician');
      }
    } catch (err) {
      console.error(err);
      alert('Failed to add technician');
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleActive(t: Technician) {
    try {
      const res = await fetch(`/api/technicians/${t.technician_id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !t.is_active }),
      });
      const json = await res.json();
      if (json.success) fetchTechnicians();
      else alert(json.error || 'Failed to update');
    } catch (err) {
      console.error(err);
    }
  }

  const filtered = technicians.filter((t) => {
    const matchesSearch = search
      ? t.full_name.toLowerCase().includes(search.toLowerCase()) || t.phone.includes(search)
      : true;
    const matchesStatus = statusFilter
      ? (statusFilter === 'active' ? t.is_active === 1 : t.is_active === 0)
      : true;
    return matchesSearch && matchesStatus;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const paged = filtered.slice((page - 1) * perPage, page * perPage);
  const inputStyle = { border: `1px solid ${BORDER}`, backgroundColor: '#fff', color: INK };
  const stats = {
    total: technicians.length,
    active: technicians.filter((t) => t.is_active === 1).length,
  };
  const activePercent = stats.total ? Math.round((stats.active / stats.total) * 100 * 10) / 10 : 0;

  const sidebarFooter = (
    <div className="rounded-2xl p-4" style={{ background: `linear-gradient(135deg, ${VIOLET_DIM}, rgba(245,166,35,0.06))`, border: `1px solid ${BORDER}` }}>
      <p className="text-sm font-semibold mb-1" style={{ color: VIOLET }}>AERYS AI</p>
      <p className="text-xs mb-3" style={{ color: MUTED }}>Your smart assistant for technicians & operations.</p>
      <button className="w-full text-sm font-medium text-white rounded-xl py-2" style={{ background: `linear-gradient(135deg, ${VIOLET_LIGHT}, ${VIOLET})` }}>
        Start Chat →
      </button>
    </div>
  );

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
        .focus-glow:focus { border-color: ${VIOLET_LIGHT} !important; box-shadow: 0 0 0 3px ${VIOLET_DIM}; }
      `}</style>
      <ResponsiveLayout navItems={NAV} sidebarFooter={sidebarFooter}>
        <div className="page-bg -m-4 md:-m-6 p-4 md:p-6">
          <div className="flex items-center gap-1.5 text-xs mb-4 fade-up" style={{ color: MUTED }}>
            <Link href="/" className="hover:underline">Home</Link> <span>›</span>
            <span className="font-semibold" style={{ color: VIOLET }}>Technicians</span>
          </div>

          <div className="rounded-[20px] p-7 mb-6 relative overflow-hidden fade-up flex flex-col sm:flex-row sm:items-center sm:justify-between" style={{ background: `linear-gradient(135deg, ${VIOLET_DIM}, rgba(245,166,35,0.05))`, border: `1px solid ${BORDER}`, boxShadow: CARD_SHADOW }}>
            <h1 className="text-[28px] sm:text-[32px] font-extrabold tracking-tight" style={{ color: INK }}>Technicians</h1>
            <button onClick={() => setShowAddModal(true)}
              className="text-sm font-semibold text-white px-5 py-2.5 rounded-xl mt-4 sm:mt-0 transition-all duration-200 hover:-translate-y-0.5"
              style={{ background: `linear-gradient(135deg, ${VIOLET_LIGHT}, ${VIOLET})`, boxShadow: `0 6px 16px -6px ${VIOLET}66` }}>
              + Add Technician
            </button>
          </div>

          {/* Stat cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-6">
            <div className="group rounded-[20px] p-6 bg-white border overflow-hidden transition-all duration-200 fade-up" style={{ borderColor: BORDER, boxShadow: CARD_SHADOW, background: `linear-gradient(160deg, #fff 65%, ${VIOLET}0d 100%)` }}
              onMouseEnter={(e) => { e.currentTarget.style.boxShadow = CARD_SHADOW_HOVER; e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.borderColor = `${VIOLET}55`; }}
              onMouseLeave={(e) => { e.currentTarget.style.boxShadow = CARD_SHADOW; e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.borderColor = BORDER; }}
            >
              <span className="w-10 h-10 rounded-2xl flex items-center justify-center mb-3 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3" style={{ background: `linear-gradient(135deg, ${VIOLET_LIGHT}CC, ${VIOLET})`, boxShadow: `0 6px 16px -6px ${VIOLET}66` }}>🔧</span>
              <p className="text-xs font-medium mb-1" style={{ color: MUTED }}>Total Technicians</p>
              <p className="text-[28px] font-extrabold tabular-nums tracking-tight" style={{ color: INK }}>{stats.total}</p>
            </div>
            <div className="group rounded-[20px] p-6 bg-white border overflow-hidden transition-all duration-200 fade-up" style={{ borderColor: BORDER, boxShadow: CARD_SHADOW, background: `linear-gradient(160deg, #fff 65%, ${GREEN}0d 100%)` }}
              onMouseEnter={(e) => { e.currentTarget.style.boxShadow = CARD_SHADOW_HOVER; e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.borderColor = `${GREEN}55`; }}
              onMouseLeave={(e) => { e.currentTarget.style.boxShadow = CARD_SHADOW; e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.borderColor = BORDER; }}
            >
              <span className="w-10 h-10 rounded-2xl flex items-center justify-center mb-3 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3" style={{ background: `linear-gradient(135deg, ${GREEN}CC, ${GREEN})`, boxShadow: `0 6px 16px -6px ${GREEN}66` }}>✅</span>
              <p className="text-xs font-medium mb-1" style={{ color: MUTED }}>Active Technicians</p>
              <p className="text-[28px] font-extrabold tabular-nums tracking-tight mb-2" style={{ color: INK }}>{stats.active}</p>
              <div className="h-1 rounded-full overflow-hidden" style={{ backgroundColor: `${GREEN}1A` }}>
                <div className="h-full rounded-full transition-all duration-700" style={{ width: `${activePercent}%`, background: `linear-gradient(90deg, ${GREEN}CC, ${GREEN})` }} />
              </div>
              <p className="text-xs mt-1.5" style={{ color: MUTED }}>{activePercent}% of total</p>
            </div>
          </div>

          {/* Filters */}
          <div className="rounded-[20px] p-5 bg-white border mb-4 flex items-center gap-3 flex-col sm:flex-row fade-up" style={{ borderColor: BORDER, boxShadow: CARD_SHADOW }}>
            <input
              placeholder="Search by name or phone..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="focus-glow rounded-xl px-4 py-2.5 text-sm outline-none w-full sm:flex-1 sm:min-w-[240px] transition-all duration-150"
              style={inputStyle}
            />
            <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
              className="focus-glow rounded-xl px-4 py-2.5 text-sm outline-none w-full sm:w-auto transition-all duration-150" style={inputStyle}>
              <option value="">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>

          {/* Table */}
          <div className="rounded-[20px] bg-white border overflow-hidden fade-up" style={{ borderColor: BORDER, boxShadow: CARD_SHADOW }}>
            <div className="p-6 pb-3">
              <p className="font-bold text-[15px]" style={{ color: INK }}>All Technicians</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left" style={{ color: MUTED }}>
                    {['Name', 'Phone', 'Email', ...(role === 'super_admin' ? ['Dealer'] : []), 'Status', 'Joined', 'Actions'].map((h) => (
                      <th key={h} className="px-5 py-2 font-medium text-xs">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {paged.map((t) => (
                    <tr key={t.technician_id} className="border-t transition-colors duration-150 hover:bg-[rgba(108,92,231,0.04)]" style={{ borderColor: BORDER }}>
                      <td className="px-5 py-3.5 font-semibold" style={{ color: INK }}>{t.full_name}</td>
                      <td className="px-5 py-3.5" style={{ color: MUTED }}>{t.phone}</td>
                      <td className="px-5 py-3.5" style={{ color: MUTED }}>{t.email || '-'}</td>
                      {role === 'super_admin' && (
                        <td className="px-5 py-3.5" style={{ color: MUTED }}>{t.dealer_name}</td>
                      )}
                      <td className="px-5 py-3.5">
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full"
                          style={t.is_active
                            ? { backgroundColor: 'rgba(34,197,94,0.1)', color: GREEN }
                            : { backgroundColor: 'rgba(239,68,68,0.1)', color: RED }}>
                          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: t.is_active ? GREEN : RED }} />
                          {t.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-5 py-3.5" style={{ color: MUTED }}>
                        {new Date(t.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </td>
                      <td className="px-5 py-3.5">
                        <button onClick={() => toggleActive(t)}
                          className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
                          style={t.is_active
                            ? { backgroundColor: 'rgba(239,68,68,0.08)', color: RED }
                            : { backgroundColor: 'rgba(34,197,94,0.08)', color: GREEN }}>
                          {t.is_active ? 'Deactivate' : 'Activate'}
                        </button>
                      </td>
                    </tr>
                  ))}
                  {loading && (
                    <tr><td colSpan={7} className="px-5 py-8 text-center text-sm" style={{ color: MUTED }}>Loading technicians...</td></tr>
                  )}
                  {!loading && paged.length === 0 && (
                    <tr><td colSpan={7} className="px-5 py-8 text-center text-sm" style={{ color: MUTED }}>No technicians match your search.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between px-5 py-3 text-xs flex-col sm:flex-row gap-3" style={{ color: MUTED }}>
              <span>Showing {paged.length ? (page - 1) * perPage + 1 : 0} to {Math.min(page * perPage, filtered.length)} of {filtered.length} technicians</span>
              <div className="flex items-center gap-1.5">
                <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
                  className="w-8 h-8 rounded-lg border flex items-center justify-center disabled:opacity-40 transition-colors hover:bg-[rgba(108,92,231,0.06)]" style={{ borderColor: BORDER }}>‹</button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).slice(0, 5).map((n) => (
                  <button key={n} onClick={() => setPage(n)}
                    className="w-8 h-8 rounded-lg text-xs font-semibold flex items-center justify-center transition-all"
                    style={n === page ? { background: `linear-gradient(135deg, ${VIOLET_LIGHT}, ${VIOLET})`, color: '#fff', boxShadow: `0 4px 10px -3px ${VIOLET}66` } : { border: `1px solid ${BORDER}`, color: INK }}>
                    {n}
                  </button>
                ))}
                <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                  className="w-8 h-8 rounded-lg border flex items-center justify-center disabled:opacity-40 transition-colors hover:bg-[rgba(108,92,231,0.06)]" style={{ borderColor: BORDER }}>›</button>
              </div>
            </div>
          </div>

          {showAddModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}>
              <div className="bg-white rounded-[20px] p-7 w-full max-w-md" style={{ boxShadow: CARD_SHADOW_HOVER }}>
                <div className="flex items-center justify-between mb-4">
                  <p className="font-bold text-lg" style={{ color: INK }}>Add Technician</p>
                  <button onClick={() => setShowAddModal(false)} style={{ color: MUTED }}>✕</button>
                </div>
                <form onSubmit={handleAddTechnician} className="flex flex-col gap-3">
                  {role === 'super_admin' && (
                    <div>
                      <label className="block text-xs font-medium mb-1.5" style={{ color: INK }}>Dealer / Service Centre *</label>
                      <select required value={form.dealerId}
                        onChange={(e) => setForm({ ...form, dealerId: e.target.value })}
                        className="focus-glow rounded-xl px-4 py-2.5 text-sm outline-none w-full transition-all duration-150"
                        style={{ border: `1px solid ${BORDER}` }}>
                        <option value="">Select dealer / service centre</option>
                        {dealerList.map((d) => (
                          <option key={d.dealer_id} value={d.dealer_id}>{d.dealer_name} — {d.city_name}</option>
                        ))}
                      </select>
                    </div>
                  )}
                  <div>
                    <label className="block text-xs font-medium mb-1.5" style={{ color: INK }}>Full Name *</label>
                    <input required value={form.full_name}
                      onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                      className="focus-glow rounded-xl px-4 py-2.5 text-sm outline-none w-full transition-all duration-150"
                      style={{ border: `1px solid ${BORDER}` }} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1.5" style={{ color: INK }}>Phone *</label>
                    <input required value={form.phone}
                      onChange={(e) => setForm({ ...form, phone: e.target.value })}
                      className="focus-glow rounded-xl px-4 py-2.5 text-sm outline-none w-full transition-all duration-150"
                      style={{ border: `1px solid ${BORDER}` }} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1.5" style={{ color: INK }}>Email</label>
                    <input type="email" value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      className="focus-glow rounded-xl px-4 py-2.5 text-sm outline-none w-full transition-all duration-150"
                      style={{ border: `1px solid ${BORDER}` }} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1.5" style={{ color: INK }}>Password *</label>
                    <input required type="password" value={form.password}
                      onChange={(e) => setForm({ ...form, password: e.target.value })}
                      className="focus-glow rounded-xl px-4 py-2.5 text-sm outline-none w-full transition-all duration-150"
                      style={{ border: `1px solid ${BORDER}` }} />
                  </div>
                  <button type="submit" disabled={submitting}
                    className="text-sm font-semibold text-white px-5 py-2.5 rounded-xl mt-2 disabled:opacity-50 transition-all duration-200 hover:-translate-y-0.5"
                    style={{ background: `linear-gradient(135deg, ${VIOLET_LIGHT}, ${VIOLET})`, boxShadow: `0 6px 16px -6px ${VIOLET}66` }}>
                    {submitting ? 'Adding...' : 'Add Technician'}
                  </button>
                </form>
              </div>
            </div>
          )}
        </div>
      </ResponsiveLayout>
    </>
  );
}
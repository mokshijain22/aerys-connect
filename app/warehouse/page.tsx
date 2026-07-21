'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ResponsiveLayout } from '@/app/components/ResponsiveLayout';
import { NAV_ITEMS } from '@/app/lib/nav-items';

const VIOLET = '#6C5CE7';
const VIOLET_LIGHT = '#8B7CF8';
const VIOLET_DIM = 'rgba(108,92,231,0.10)';
const BORDER = 'rgba(30,20,60,0.07)';
const MUTED = '#6B7280';
const INK = '#1A1A2E';
const GREEN = '#22C55E';
const ORANGE = '#F5A623';
const BLUE = '#3B82F6';
const CARD_SHADOW = '0 1px 2px rgba(20,10,50,0.04), 0 8px 24px -12px rgba(20,10,50,0.08)';
const CARD_SHADOW_HOVER = '0 4px 12px rgba(20,10,50,0.06), 0 16px 36px -12px rgba(108,92,231,0.18)';

const NAV = NAV_ITEMS.map((item) => ({ ...item, active: item.href === '/warehouse' }));

type WarehouseRow = {
  part_id: number;
  quantity: number;
  part_name: string;
  part_code: string;
  category: string | null;
  unit_price: number;
};

type Dispatch = {
  dispatch_id: number;
  part_id: number;
  dealer_id: number;
  quantity: number;
  status: 'created' | 'in_transit' | 'received';
  created_at: string;
  dispatched_at: string | null;
  received_at: string | null;
  part_name: string;
  part_code: string;
  dealer_name: string;
};

const statusColors: Record<string, { bg: string; text: string; label: string }> = {
  created: { bg: 'rgba(107,114,128,0.12)', text: MUTED, label: 'Created' },
  in_transit: { bg: 'rgba(59,130,246,0.12)', text: BLUE, label: 'In Transit' },
  received: { bg: 'rgba(34,197,94,0.1)', text: GREEN, label: 'Received' },
};

export default function WarehousePage() {
  const [rows, setRows] = useState<WarehouseRow[]>([]);
  const [stats, setStats] = useState({ totalParts: 0, totalUnits: 0, totalValue: 0, pendingDispatches: 0 });
  const [dealers, setDealers] = useState<{ dealer_id: number; dealer_name: string }[]>([]);
  const [parts, setParts] = useState<{ part_id: number; part_name: string; part_code: string; category: string | null; unit_price: number }[]>([]);
  const [dispatches, setDispatches] = useState<Dispatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showStockModal, setShowStockModal] = useState(false);
  const [stockSubmitting, setStockSubmitting] = useState(false);
  const [stockForm, setStockForm] = useState({ partId: '', quantity: '' });
  const [showDispatchModal, setShowDispatchModal] = useState(false);
  const [dispatchSubmitting, setDispatchSubmitting] = useState(false);
  const [dispatchForm, setDispatchForm] = useState({ partId: '', dealerId: '', quantity: '' });
  const [actioningId, setActioningId] = useState<number | null>(null);

  useEffect(() => {
    fetchWarehouse();
  }, [search]);

  async function fetchWarehouse() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      const res = await fetch(`/api/warehouse?${params}`);
      const json = await res.json();
      if (json.success) {
        setRows(json.data);
        setStats(json.stats);
        setDealers(json.dealers);
        setParts(json.parts);
        setDispatches(json.dispatches);
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleAddStock(e: React.FormEvent) {
    e.preventDefault();
    setStockSubmitting(true);
    try {
      const res = await fetch('/api/warehouse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ partId: stockForm.partId, quantity: Number(stockForm.quantity) }),
      });
      const json = await res.json();
      if (json.success) {
        setShowStockModal(false);
        setStockForm({ partId: '', quantity: '' });
        fetchWarehouse();
      } else {
        alert(json.error || 'Failed to add stock');
      }
    } finally {
      setStockSubmitting(false);
    }
  }

  async function handleCreateDispatch(e: React.FormEvent) {
    e.preventDefault();
    setDispatchSubmitting(true);
    try {
      const res = await fetch('/api/warehouse/dispatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          partId: dispatchForm.partId,
          dealerId: dispatchForm.dealerId,
          quantity: Number(dispatchForm.quantity),
        }),
      });
      const json = await res.json();
      if (json.success) {
        setShowDispatchModal(false);
        setDispatchForm({ partId: '', dealerId: '', quantity: '' });
        fetchWarehouse();
      } else {
        alert(json.error || 'Failed to create dispatch');
      }
    } finally {
      setDispatchSubmitting(false);
    }
  }

  async function advanceDispatch(dispatchId: number, status: 'in_transit' | 'received') {
    setActioningId(dispatchId);
    try {
      const res = await fetch('/api/warehouse/dispatch', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dispatchId, status }),
      });
      const json = await res.json();
      if (json.success) {
        fetchWarehouse();
      } else {
        alert(json.error || 'Failed to update dispatch');
      }
    } finally {
      setActioningId(null);
    }
  }

  const inputStyle = { border: `1px solid ${BORDER}`, backgroundColor: '#fff', color: INK };

  function formatLakh(value: number) {
    return `₹${(value / 100000).toFixed(2)} L`;
  }

  const sidebarFooter = (
    <div className="rounded-2xl p-4" style={{ background: `linear-gradient(135deg, ${VIOLET_DIM}, rgba(245,166,35,0.06))`, border: `1px solid ${BORDER}` }}>
      <p className="text-sm font-semibold mb-1" style={{ color: VIOLET }}>AERYS AI</p>
      <p className="text-xs mb-3" style={{ color: MUTED }}>Your smart assistant for warehouse and dispatch insights.</p>
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
            <span className="font-semibold" style={{ color: VIOLET }}>Warehouse</span>
          </div>

          <div className="rounded-[20px] p-7 mb-6 relative overflow-hidden fade-up" style={{ background: `linear-gradient(135deg, ${VIOLET_DIM}, rgba(245,166,35,0.05))`, border: `1px solid ${BORDER}`, boxShadow: CARD_SHADOW }}>
            <h1 className="text-[28px] font-extrabold tracking-tight" style={{ color: INK }}>Warehouse</h1>
            <p className="text-sm mt-2 max-w-lg" style={{ color: MUTED }}>Central stock and dispatch tracking from warehouse to dealers</p>
            <div className="flex flex-col sm:flex-row gap-2.5 mt-4 sm:mt-0 sm:absolute sm:top-7 sm:right-7">
              <button onClick={() => setShowDispatchModal(true)}
                className="text-sm font-semibold text-white px-5 py-2.5 rounded-xl transition-all duration-200 hover:-translate-y-0.5"
                style={{ background: `linear-gradient(135deg, ${VIOLET_LIGHT}, ${VIOLET})`, boxShadow: `0 6px 16px -6px ${VIOLET}66` }}>
                Create Dispatch
              </button>
              <button onClick={() => setShowStockModal(true)}
                className="text-sm font-semibold px-5 py-2.5 rounded-xl transition-all duration-200 hover:-translate-y-0.5"
                style={{ backgroundColor: '#fff', color: VIOLET, border: `1px solid ${VIOLET}55` }}>
                + Add Warehouse Stock
              </button>
            </div>
          </div>

          {/* Stat cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {[
              { label: 'Distinct Parts', value: stats.totalParts, icon: '📦', accent: VIOLET },
              { label: 'Total Units', value: stats.totalUnits, icon: '🧮', accent: BLUE },
              { label: 'Total Value', value: formatLakh(stats.totalValue), icon: '💰', accent: GREEN },
              { label: 'Pending Dispatches', value: stats.pendingDispatches, icon: '🚚', accent: ORANGE },
            ].map((s) => (
              <div key={s.label} className="group rounded-[20px] p-5 bg-white border overflow-hidden transition-all duration-200 fade-up" style={{ borderColor: BORDER, boxShadow: CARD_SHADOW, background: `linear-gradient(160deg, #fff 65%, ${s.accent}0d 100%)` }}
                onMouseEnter={(e) => { e.currentTarget.style.boxShadow = CARD_SHADOW_HOVER; e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.borderColor = `${s.accent}55`; }}
                onMouseLeave={(e) => { e.currentTarget.style.boxShadow = CARD_SHADOW; e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.borderColor = BORDER; }}
              >
                <span className="w-10 h-10 rounded-2xl flex items-center justify-center mb-3 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3" style={{ background: `linear-gradient(135deg, ${s.accent}CC, ${s.accent})`, boxShadow: `0 6px 16px -6px ${s.accent}66` }}>{s.icon}</span>
                <p className="text-xs font-medium mb-1" style={{ color: MUTED }}>{s.label}</p>
                <p className="text-xl font-extrabold tabular-nums tracking-tight" style={{ color: INK }}>{s.value}</p>
              </div>
            ))}
          </div>

          {/* Search */}
          <div className="rounded-[20px] p-5 bg-white border mb-4 fade-up" style={{ borderColor: BORDER, boxShadow: CARD_SHADOW }}>
            <input
              placeholder="Search warehouse stock by part name or code..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="focus-glow rounded-xl px-4 py-2.5 text-sm outline-none w-full transition-all duration-150"
              style={inputStyle}
            />
          </div>

          {/* Warehouse stock table */}
          <div className="rounded-[20px] bg-white border overflow-hidden fade-up mb-6" style={{ borderColor: BORDER, boxShadow: CARD_SHADOW }}>
            <div className="p-6 pb-3">
              <p className="font-bold text-[15px]" style={{ color: INK }}>Warehouse Stock</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left" style={{ color: MUTED }}>
                    {['Part Code', 'Part Name', 'Category', 'Quantity', 'Unit Price', 'Value'].map((h) => (
                      <th key={h} className="px-5 py-2 font-medium text-xs whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.part_id} className="border-t transition-colors duration-150 hover:bg-[rgba(108,92,231,0.04)]" style={{ borderColor: BORDER }}>
                      <td className="px-5 py-3.5 font-semibold whitespace-nowrap" style={{ color: VIOLET }}>{r.part_code}</td>
                      <td className="px-5 py-3.5 whitespace-nowrap" style={{ color: INK }}>{r.part_name}</td>
                      <td className="px-5 py-3.5 whitespace-nowrap" style={{ color: MUTED }}>{r.category || '—'}</td>
                      <td className="px-5 py-3.5 whitespace-nowrap" style={{ color: MUTED }}>{r.quantity} units</td>
                      <td className="px-5 py-3.5 whitespace-nowrap" style={{ color: MUTED }}>₹{Number(r.unit_price).toLocaleString('en-IN')}</td>
                      <td className="px-5 py-3.5 font-semibold whitespace-nowrap" style={{ color: INK }}>₹{(r.quantity * r.unit_price).toLocaleString('en-IN')}</td>
                    </tr>
                  ))}
                  {loading && (
                    <tr><td colSpan={6} className="px-5 py-8 text-center text-sm" style={{ color: MUTED }}>Loading...</td></tr>
                  )}
                  {!loading && rows.length === 0 && (
                    <tr><td colSpan={6} className="px-5 py-8 text-center text-sm" style={{ color: MUTED }}>No warehouse stock yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Dispatches */}
          <div className="rounded-[20px] bg-white border overflow-hidden fade-up" style={{ borderColor: BORDER, boxShadow: CARD_SHADOW }}>
            <div className="p-6 pb-3">
              <p className="font-bold text-[15px]" style={{ color: INK }}>Dispatches</p>
              <p className="text-xs mt-0.5" style={{ color: MUTED }}>Track parts as they move from warehouse to dealers</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left" style={{ color: MUTED }}>
                    {['Part', 'Dealer', 'Quantity', 'Status', 'Created', 'Action'].map((h) => (
                      <th key={h} className="px-5 py-2 font-medium text-xs whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {dispatches.map((d) => {
                    const sc = statusColors[d.status];
                    return (
                      <tr key={d.dispatch_id} className="border-t transition-colors duration-150 hover:bg-[rgba(108,92,231,0.04)]" style={{ borderColor: BORDER }}>
                        <td className="px-5 py-3.5 whitespace-nowrap" style={{ color: INK }}>{d.part_name} <span style={{ color: MUTED }}>({d.part_code})</span></td>
                        <td className="px-5 py-3.5 whitespace-nowrap" style={{ color: MUTED }}>{d.dealer_name}</td>
                        <td className="px-5 py-3.5 whitespace-nowrap" style={{ color: MUTED }}>{d.quantity} units</td>
                        <td className="px-5 py-3.5 whitespace-nowrap">
                          <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full" style={{ backgroundColor: sc.bg, color: sc.text }}>
                            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: sc.text }} />
                            {sc.label}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 whitespace-nowrap" style={{ color: MUTED }}>{new Date(d.created_at).toLocaleDateString('en-IN')}</td>
                        <td className="px-5 py-3.5 whitespace-nowrap">
                          {d.status === 'created' && (
                            <button onClick={() => advanceDispatch(d.dispatch_id, 'in_transit')} disabled={actioningId === d.dispatch_id}
                              className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                              style={{ backgroundColor: 'rgba(59,130,246,0.12)', color: BLUE }}>
                              {actioningId === d.dispatch_id ? 'Updating...' : 'Mark In Transit'}
                            </button>
                          )}
                          {d.status === 'in_transit' && (
                            <button onClick={() => advanceDispatch(d.dispatch_id, 'received')} disabled={actioningId === d.dispatch_id}
                              className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                              style={{ backgroundColor: 'rgba(34,197,94,0.1)', color: GREEN }}>
                              {actioningId === d.dispatch_id ? 'Updating...' : 'Mark Received'}
                            </button>
                          )}
                          {d.status === 'received' && (
                            <span className="text-xs" style={{ color: MUTED }}>
                              {d.received_at ? new Date(d.received_at).toLocaleDateString('en-IN') : '—'}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {!loading && dispatches.length === 0 && (
                    <tr><td colSpan={6} className="px-5 py-8 text-center text-sm" style={{ color: MUTED }}>No dispatches yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {showStockModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}>
              <div className="bg-white rounded-[20px] p-7 w-full max-w-md max-h-[90vh] overflow-y-auto" style={{ boxShadow: CARD_SHADOW_HOVER }}>
                <div className="flex items-center justify-between mb-4">
                  <p className="font-bold text-lg" style={{ color: INK }}>Add Warehouse Stock</p>
                  <button onClick={() => setShowStockModal(false)} style={{ color: MUTED }}>✕</button>
                </div>
                <form onSubmit={handleAddStock} className="flex flex-col gap-3">
                  <div>
                    <label className="block text-xs font-medium mb-1.5" style={{ color: INK }}>Part *</label>
                    <select required value={stockForm.partId}
                      onChange={(e) => setStockForm({ ...stockForm, partId: e.target.value })}
                      className="focus-glow rounded-xl px-4 py-2.5 text-sm outline-none w-full transition-all duration-150"
                      style={{ border: `1px solid ${BORDER}` }}>
                      <option value="">Select a part</option>
                      {parts.map((p) => (
                        <option key={p.part_id} value={p.part_id}>{p.part_name} ({p.part_code})</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1.5" style={{ color: INK }}>Quantity *</label>
                    <input required type="number" min="1" value={stockForm.quantity}
                      onChange={(e) => setStockForm({ ...stockForm, quantity: e.target.value })}
                      className="focus-glow rounded-xl px-4 py-2.5 text-sm outline-none w-full transition-all duration-150"
                      style={{ border: `1px solid ${BORDER}` }} />
                  </div>
                  <button type="submit" disabled={stockSubmitting}
                    className="text-sm font-semibold text-white px-5 py-2.5 rounded-xl mt-2 disabled:opacity-50 transition-all duration-200 hover:-translate-y-0.5"
                    style={{ background: `linear-gradient(135deg, ${VIOLET_LIGHT}, ${VIOLET})`, boxShadow: `0 6px 16px -6px ${VIOLET}66` }}>
                    {stockSubmitting ? 'Adding...' : 'Add Stock'}
                  </button>
                </form>
              </div>
            </div>
          )}

          {showDispatchModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}>
              <div className="bg-white rounded-[20px] p-7 w-full max-w-md max-h-[90vh] overflow-y-auto" style={{ boxShadow: CARD_SHADOW_HOVER }}>
                <div className="flex items-center justify-between mb-4">
                  <p className="font-bold text-lg" style={{ color: INK }}>Create Dispatch</p>
                  <button onClick={() => setShowDispatchModal(false)} style={{ color: MUTED }}>✕</button>
                </div>
                <form onSubmit={handleCreateDispatch} className="flex flex-col gap-3">
                  <div>
                    <label className="block text-xs font-medium mb-1.5" style={{ color: INK }}>Part *</label>
                    <select required value={dispatchForm.partId}
                      onChange={(e) => setDispatchForm({ ...dispatchForm, partId: e.target.value })}
                      className="focus-glow rounded-xl px-4 py-2.5 text-sm outline-none w-full transition-all duration-150"
                      style={{ border: `1px solid ${BORDER}` }}>
                      <option value="">Select a part</option>
                      {parts.map((p) => (
                        <option key={p.part_id} value={p.part_id}>{p.part_name} ({p.part_code})</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1.5" style={{ color: INK }}>Dealer *</label>
                    <select required value={dispatchForm.dealerId}
                      onChange={(e) => setDispatchForm({ ...dispatchForm, dealerId: e.target.value })}
                      className="focus-glow rounded-xl px-4 py-2.5 text-sm outline-none w-full transition-all duration-150"
                      style={{ border: `1px solid ${BORDER}` }}>
                      <option value="">Select a dealer</option>
                      {dealers.map((d) => (
                        <option key={d.dealer_id} value={d.dealer_id}>{d.dealer_name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1.5" style={{ color: INK }}>Quantity *</label>
                    <input required type="number" min="1" value={dispatchForm.quantity}
                      onChange={(e) => setDispatchForm({ ...dispatchForm, quantity: e.target.value })}
                      className="focus-glow rounded-xl px-4 py-2.5 text-sm outline-none w-full transition-all duration-150"
                      style={{ border: `1px solid ${BORDER}` }} />
                  </div>
                  <button type="submit" disabled={dispatchSubmitting}
                    className="text-sm font-semibold text-white px-5 py-2.5 rounded-xl mt-2 disabled:opacity-50 transition-all duration-200 hover:-translate-y-0.5"
                    style={{ background: `linear-gradient(135deg, ${VIOLET_LIGHT}, ${VIOLET})`, boxShadow: `0 6px 16px -6px ${VIOLET}66` }}>
                    {dispatchSubmitting ? 'Creating...' : 'Create Dispatch'}
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
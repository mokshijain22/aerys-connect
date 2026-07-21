'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { ResponsiveLayout } from '@/app/components/ResponsiveLayout';
import { NAV_ITEMS } from '@/app/lib/nav-items';

const VIOLET = '#6C5CE7';
const VIOLET_LIGHT = '#8B7CF8';
const VIOLET_DIM = 'rgba(108,92,231,0.10)';
const BG = '#F8F8FC';
const BORDER = 'rgba(30,20,60,0.07)';
const MUTED = '#6B7280';
const INK = '#1A1A2E';
const GREEN = '#22C55E';
const ORANGE = '#F5A623';
const RED = '#EF4444';
const CARD_SHADOW = '0 1px 2px rgba(20,10,50,0.04), 0 8px 24px -12px rgba(20,10,50,0.08)';
const CARD_SHADOW_HOVER = '0 4px 12px rgba(20,10,50,0.06), 0 16px 36px -12px rgba(108,92,231,0.18)';

const NAV = NAV_ITEMS.map((item) => ({ ...item, active: item.href === '/inventory' }));

type StockRow = {
  dealer_id: number;
  part_id: number;
  quantity: number;
  min_stock_alert: number;
  part_name: string;
  part_code: string;
  category: string | null;
  unit_price: number;
  dealer_name: string;
};

function statusOf(row: StockRow) {
  if (row.quantity === 0) return 'Out of Stock';
  if (row.quantity <= row.min_stock_alert) return 'Low Stock';
  return 'In Stock';
}
const statusColors: Record<string, { bg: string; text: string }> = {
  'In Stock': { bg: 'rgba(34,197,94,0.1)', text: GREEN },
  'Low Stock': { bg: 'rgba(245,166,35,0.12)', text: ORANGE },
  'Out of Stock': { bg: 'rgba(239,68,68,0.1)', text: RED },
};

export default function InventoryPage() {
  const [rows, setRows] = useState<StockRow[]>([]);
  const [stats, setStats] = useState({ totalItems: 0, inStock: 0, lowStock: 0, outOfStock: 0, totalValue: 0 });
  const [dealers, setDealers] = useState<{ dealer_id: number; dealer_name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [dealerFilter, setDealerFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [categories, setCategories] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const perPage = 8;
  const [showAddModal, setShowAddModal] = useState(false);
  const [parts, setParts] = useState<{ part_id: number; part_name: string; part_code: string; category: string | null; unit_price: number }[]>([]);
  const [fastMoving, setFastMoving] = useState<{ part_id: number; part_name: string; part_code: string; category: string | null; total_quantity_used: number; jobs_used_in: number }[]>([]);
  const [fastMovingLoading, setFastMovingLoading] = useState(true);
  const [reorderSuggestions, setReorderSuggestions] = useState<{ dealer_id: number; dealer_name: string; part_id: number; part_name: string; part_code: string; category: string | null; quantity: number; min_stock_alert: number; used_last_30d: number; suggested_reorder_qty: number }[]>([]);
  const [reorderLoading, setReorderLoading] = useState(true);
  const [mode, setMode] = useState<'existing' | 'new'>('existing');
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    partId: '', dealerId: '', quantity: '', minStockAlert: '',
    partName: '', partCode: '', unitPrice: '', category: '',
  });
  useEffect(() => {
    fetchInventory();
  }, [search, statusFilter, dealerFilter, categoryFilter]);

  useEffect(() => {
    fetchFastMoving();
    fetchReorderSuggestions();
  }, [dealerFilter]);

  async function fetchFastMoving() {
    setFastMovingLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('days', '30');
      params.set('limit', '5');
      if (dealerFilter) params.set('dealer', dealerFilter);
      const res = await fetch(`/api/inventory/fast-moving?${params}`);
      const json = await res.json();
      if (json.success) {
        setFastMoving(json.data);
      }
    } finally {
      setFastMovingLoading(false);
    }
  }

  async function fetchReorderSuggestions() {
    setReorderLoading(true);
    try {
      const params = new URLSearchParams();
      if (dealerFilter) params.set('dealer', dealerFilter);
      const res = await fetch(`/api/inventory/reorder-suggestions?${params}`);
      const json = await res.json();
      if (json.success) {
        setReorderSuggestions(json.data);
      }
    } finally {
      setReorderLoading(false);
    }
  }

  async function fetchInventory() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (statusFilter) params.set('status', statusFilter);
      if (dealerFilter) params.set('dealer', dealerFilter);
      if (categoryFilter) params.set('category', categoryFilter);
      const res = await fetch(`/api/inventory?${params}`);
      const json = await res.json();
      if (json.success) {
        setRows(json.data);
        setStats(json.stats);
        setDealers(json.dealers);
        setParts(json.parts);
        setCategories(json.categories || []);
      }
    } finally {
      setLoading(false);
    }
  }
  async function handleAddItem(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const body: any = {
        mode,
        dealerId: form.dealerId,
        quantity: Number(form.quantity),
        minStockAlert: Number(form.minStockAlert) || 0,
      };
      if (mode === 'existing') {
        body.partId = form.partId;
      } else {
        body.partName = form.partName;
        body.partCode = form.partCode;
        body.unitPrice = Number(form.unitPrice);
        body.category = form.category;
      }
      const res = await fetch('/api/inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (json.success) {
        setShowAddModal(false);
        setForm({ partId: '', dealerId: '', quantity: '', minStockAlert: '', partName: '', partCode: '', unitPrice: '', category: '' });
        setMode('existing');
        fetchInventory();
      } else {
        alert(json.error || 'Failed to add item');
      }
    } catch (err) {
      console.error(err);
      alert('Failed to add item');
    } finally {
      setSubmitting(false);
    }
  }

  const totalPages = Math.max(1, Math.ceil(rows.length / perPage));
  const paged = rows.slice((page - 1) * perPage, page * perPage);
  const inputStyle = { border: `1px solid ${BORDER}`, backgroundColor: '#fff', color: INK };

  function formatLakh(value: number) {
    return `₹${(value / 100000).toFixed(2)} L`;
  }

  const sidebarFooter = (
    <div className="rounded-2xl p-4" style={{ background: `linear-gradient(135deg, ${VIOLET_DIM}, rgba(245,166,35,0.06))`, border: `1px solid ${BORDER}` }}>
      <p className="text-sm font-semibold mb-1" style={{ color: VIOLET }}>AERYS AI</p>
      <p className="text-xs mb-3" style={{ color: MUTED }}>Your smart assistant for inventory insights and operations.</p>
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
        <span className="font-semibold" style={{ color: VIOLET }}>Inventory</span>
      </div>
      <div className="rounded-[20px] p-7 mb-6 relative overflow-hidden fade-up" style={{ background: `linear-gradient(135deg, ${VIOLET_DIM}, rgba(245,166,35,0.05))`, border: `1px solid ${BORDER}`, boxShadow: CARD_SHADOW }}>
        <h1 className="text-[28px] font-extrabold tracking-tight" style={{ color: INK }}>Inventory</h1>
        <p className="text-sm mt-2" style={{ color: MUTED }}>Track and manage parts and stock levels across dealers</p>
        <button onClick={() => setShowAddModal(true)}
          className="text-sm font-semibold text-white px-5 py-2.5 rounded-xl absolute top-7 right-7 transition-all duration-200 hover:-translate-y-0.5"
          style={{ background: `linear-gradient(135deg, ${VIOLET_LIGHT}, ${VIOLET})`, boxShadow: `0 6px 16px -6px ${VIOLET}66` }}>
          + Add Item
        </button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        {[
          { label: 'Total Stock Rows', value: stats.totalItems, icon: '📦', accent: VIOLET },
          { label: 'In Stock', value: stats.inStock, icon: '✅', accent: GREEN },
          { label: 'Low Stock', value: stats.lowStock, icon: '⚠️', accent: ORANGE },
          { label: 'Out of Stock', value: stats.outOfStock, icon: '❌', accent: RED },
          { label: 'Total Value', value: formatLakh(stats.totalValue), icon: '💰', accent: VIOLET },
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

      {/* Filters */}
      <div className="rounded-[20px] p-5 bg-white border mb-4 flex items-center gap-3 flex-col sm:flex-row fade-up" style={{ borderColor: BORDER, boxShadow: CARD_SHADOW }}>
        <input
          placeholder="Search by part name or code..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="focus-glow rounded-xl px-4 py-2.5 text-sm outline-none w-full sm:flex-1 sm:min-w-[240px] transition-all duration-150"
          style={inputStyle}
        />
        <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="focus-glow rounded-xl px-4 py-2.5 text-sm outline-none w-full sm:w-auto transition-all duration-150" style={inputStyle}>
          <option value="">All Status</option>
          <option value="in_stock">In Stock</option>
          <option value="low_stock">Low Stock</option>
          <option value="out_of_stock">Out of Stock</option>
        </select>
        <select value={dealerFilter} onChange={(e) => { setDealerFilter(e.target.value); setPage(1); }}
          className="focus-glow rounded-xl px-4 py-2.5 text-sm outline-none w-full sm:w-auto transition-all duration-150" style={inputStyle}>
          <option value="">All Dealers</option>
          {dealers.map((d) => <option key={d.dealer_id} value={d.dealer_id}>{d.dealer_name}</option>)}
        </select>
        <select value={categoryFilter} onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }}
          className="focus-glow rounded-xl px-4 py-2.5 text-sm outline-none w-full sm:w-auto transition-all duration-150" style={inputStyle}>
          <option value="">All Categories</option>
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {/* Fast-Moving Parts */}
      <div className="rounded-[20px] bg-white border overflow-hidden fade-up mb-4" style={{ borderColor: BORDER, boxShadow: CARD_SHADOW }}>
        <div className="p-6 pb-3 flex items-center justify-between">
          <div>
            <p className="font-bold text-[15px]" style={{ color: INK }}>Fast-Moving Parts</p>
            <p className="text-xs mt-0.5" style={{ color: MUTED }}>Top parts by usage in the last 30 days</p>
          </div>
        </div>
        <div className="overflow-x-auto pb-2">
          {fastMovingLoading ? (
            <p className="px-6 pb-5 text-sm" style={{ color: MUTED }}>Loading...</p>
          ) : fastMoving.length === 0 ? (
            <p className="px-6 pb-5 text-sm" style={{ color: MUTED }}>No parts usage recorded in the last 30 days.</p>
          ) : (
            <div className="flex gap-3 px-6 pb-5 overflow-x-auto">
              {fastMoving.map((p, i) => (
                <div key={p.part_id} className="flex-shrink-0 w-52 rounded-2xl p-4 border" style={{ borderColor: BORDER, background: `linear-gradient(160deg, #fff 65%, ${VIOLET}0d 100%)` }}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: VIOLET_DIM, color: VIOLET }}>#{i + 1}</span>
                    <span className="text-[11px]" style={{ color: MUTED }}>{p.category || '—'}</span>
                  </div>
                  <p className="text-sm font-semibold truncate" style={{ color: INK }}>{p.part_name}</p>
                  <p className="text-[11px] mb-2" style={{ color: MUTED }}>{p.part_code}</p>
                  <p className="text-xl font-extrabold tabular-nums" style={{ color: VIOLET }}>{p.total_quantity_used}</p>
                  <p className="text-[11px]" style={{ color: MUTED }}>units used · {p.jobs_used_in} jobs</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Reorder Suggestions */}
      <div className="rounded-[20px] bg-white border overflow-hidden fade-up mb-4" style={{ borderColor: BORDER, boxShadow: CARD_SHADOW }}>
        <div className="p-6 pb-3 flex items-center justify-between">
          <div>
            <p className="font-bold text-[15px]" style={{ color: INK }}>Reorder Suggestions</p>
            <p className="text-xs mt-0.5" style={{ color: MUTED }}>Parts at or below min stock, with quantity suggested from 30-day usage</p>
          </div>
        </div>
        <div className="overflow-x-auto pb-2">
          {reorderLoading ? (
            <p className="px-6 pb-5 text-sm" style={{ color: MUTED }}>Loading...</p>
          ) : reorderSuggestions.length === 0 ? (
            <p className="px-6 pb-5 text-sm" style={{ color: MUTED }}>Nothing to reorder — all stock is above minimum levels.</p>
          ) : (
            <div className="flex gap-3 px-6 pb-5 overflow-x-auto">
              {reorderSuggestions.map((p) => (
                <div key={`${p.dealer_id}-${p.part_id}`} className="flex-shrink-0 w-56 rounded-2xl p-4 border" style={{ borderColor: BORDER, background: `linear-gradient(160deg, #fff 65%, ${ORANGE}0d 100%)` }}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: 'rgba(245,166,35,0.12)', color: ORANGE }}>
                      {p.quantity === 0 ? 'Out of stock' : 'Low stock'}
                    </span>
                    <span className="text-[11px]" style={{ color: MUTED }}>{p.category || '—'}</span>
                  </div>
                  <p className="text-sm font-semibold truncate" style={{ color: INK }}>{p.part_name}</p>
                  <p className="text-[11px] mb-2" style={{ color: MUTED }}>{p.part_code} · {p.dealer_name}</p>
                  <p className="text-[11px]" style={{ color: MUTED }}>Current: {p.quantity} · Min: {p.min_stock_alert}</p>
                  <p className="text-xl font-extrabold tabular-nums mt-1" style={{ color: ORANGE }}>+{p.suggested_reorder_qty}</p>
                  <p className="text-[11px]" style={{ color: MUTED }}>suggested reorder qty</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="rounded-[20px] bg-white border overflow-hidden fade-up" style={{ borderColor: BORDER, boxShadow: CARD_SHADOW }}>
        <div className="p-6 pb-3">
          <p className="font-bold text-[15px]" style={{ color: INK }}>All Inventory Items</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left" style={{ color: MUTED }}>
                {['Part Code', 'Part Name', 'Category', 'Dealer', 'Stock', 'Status', 'Unit Price', 'Value'].map((h) => (
                  <th key={h} className="px-5 py-2 font-medium text-xs">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paged.map((r) => {
                const status = statusOf(r);
                return (
                  <tr key={`${r.dealer_id}-${r.part_id}`} className="border-t transition-colors duration-150 hover:bg-[rgba(108,92,231,0.04)]" style={{ borderColor: BORDER }}>
                    <td className="px-5 py-3.5 font-semibold" style={{ color: VIOLET }}>{r.part_code}</td>
                    <td className="px-5 py-3.5" style={{ color: INK }}>{r.part_name}</td>
                    <td className="px-5 py-3.5" style={{ color: MUTED }}>{r.category || '—'}</td>
                    <td className="px-5 py-3.5" style={{ color: MUTED }}>{r.dealer_name}</td>
                    <td className="px-5 py-3.5" style={{ color: MUTED }}>{r.quantity} units</td>
                    <td className="px-5 py-3.5">
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full"
                        style={{ backgroundColor: statusColors[status].bg, color: statusColors[status].text }}>
                        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: statusColors[status].text }} />
                        {status}
                      </span>
                    </td>
                    <td className="px-5 py-3.5" style={{ color: MUTED }}>₹{Number(r.unit_price).toLocaleString('en-IN')}</td>
                    <td className="px-5 py-3.5 font-semibold" style={{ color: INK }}>₹{(r.quantity * r.unit_price).toLocaleString('en-IN')}</td>
                  </tr>
                );
              })}
              {loading && (
                <tr><td colSpan={7} className="px-5 py-8 text-center text-sm" style={{ color: MUTED }}>Loading...</td></tr>
              )}
              {!loading && paged.length === 0 && (
                <tr><td colSpan={7} className="px-5 py-8 text-center text-sm" style={{ color: MUTED }}>No items match your search.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between px-5 py-3 text-xs flex-col sm:flex-row gap-3" style={{ color: MUTED }}>
          <span>Showing {paged.length ? (page - 1) * perPage + 1 : 0} to {Math.min(page * perPage, rows.length)} of {rows.length} items</span>
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
          <div className="bg-white rounded-[20px] p-7 w-full max-w-md max-h-[90vh] overflow-y-auto" style={{ boxShadow: CARD_SHADOW_HOVER }}>
            <div className="flex items-center justify-between mb-4">
              <p className="font-bold text-lg" style={{ color: INK }}>Add Item</p>
              <button onClick={() => setShowAddModal(false)} style={{ color: MUTED }}>✕</button>
            </div>

            <div className="flex gap-2 mb-4">
              <button type="button" onClick={() => setMode('existing')}
                className="flex-1 text-sm font-semibold py-2 rounded-xl transition-all"
                style={mode === 'existing' ? { background: `linear-gradient(135deg, ${VIOLET_LIGHT}, ${VIOLET})`, color: '#fff', boxShadow: `0 4px 10px -3px ${VIOLET}66` } : { border: `1px solid ${BORDER}`, color: INK }}>
                Existing Part
              </button>
              <button type="button" onClick={() => setMode('new')}
                className="flex-1 text-sm font-semibold py-2 rounded-xl transition-all"
                style={mode === 'new' ? { background: `linear-gradient(135deg, ${VIOLET_LIGHT}, ${VIOLET})`, color: '#fff', boxShadow: `0 4px 10px -3px ${VIOLET}66` } : { border: `1px solid ${BORDER}`, color: INK }}>
                New Part
              </button>
            </div>

            <form onSubmit={handleAddItem} className="flex flex-col gap-3">
              {mode === 'existing' ? (
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: INK }}>Part *</label>
                  <select required value={form.partId}
                    onChange={(e) => setForm({ ...form, partId: e.target.value })}
                    className="focus-glow rounded-xl px-4 py-2.5 text-sm outline-none w-full transition-all duration-150"
                    style={{ border: `1px solid ${BORDER}` }}>
                    <option value="">Select a part</option>
                    {parts.map((p) => (
                      <option key={p.part_id} value={p.part_id}>{p.part_name} ({p.part_code})</option>
                    ))}
                  </select>
                </div>
              ) : (
                <>
                  <div>
                    <label className="block text-xs font-medium mb-1.5" style={{ color: INK }}>Part Name *</label>
                    <input required value={form.partName}
                      onChange={(e) => setForm({ ...form, partName: e.target.value })}
                      className="focus-glow rounded-xl px-4 py-2.5 text-sm outline-none w-full transition-all duration-150"
                      style={{ border: `1px solid ${BORDER}` }} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1.5" style={{ color: INK }}>Part Code *</label>
                    <input required value={form.partCode}
                      onChange={(e) => setForm({ ...form, partCode: e.target.value })}
                      className="focus-glow rounded-xl px-4 py-2.5 text-sm outline-none w-full transition-all duration-150"
                      style={{ border: `1px solid ${BORDER}` }} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1.5" style={{ color: INK }}>Unit Price (₹) *</label>
                    <input required type="number" min="0" step="0.01" value={form.unitPrice}
                      onChange={(e) => setForm({ ...form, unitPrice: e.target.value })}
                      className="focus-glow rounded-xl px-4 py-2.5 text-sm outline-none w-full transition-all duration-150"
                      style={{ border: `1px solid ${BORDER}` }} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1.5" style={{ color: INK }}>Category</label>
                    <select value={form.category}
                      onChange={(e) => setForm({ ...form, category: e.target.value })}
                      className="focus-glow rounded-xl px-4 py-2.5 text-sm outline-none w-full transition-all duration-150"
                      style={{ border: `1px solid ${BORDER}` }}>
                      <option value="">Select a category</option>
                      {categories.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                </>
              )}

              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: INK }}>Dealer *</label>
                <select required value={form.dealerId}
                  onChange={(e) => setForm({ ...form, dealerId: e.target.value })}
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
                <input required type="number" min="0" value={form.quantity}
                  onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                  className="focus-glow rounded-xl px-4 py-2.5 text-sm outline-none w-full transition-all duration-150"
                  style={{ border: `1px solid ${BORDER}` }} />
              </div>

              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: INK }}>Min Stock Alert</label>
                <input type="number" min="0" value={form.minStockAlert}
                  onChange={(e) => setForm({ ...form, minStockAlert: e.target.value })}
                  placeholder="5"
                  className="focus-glow rounded-xl px-4 py-2.5 text-sm outline-none w-full transition-all duration-150"
                  style={{ border: `1px solid ${BORDER}` }} />
              </div>

              <button type="submit" disabled={submitting}
                className="text-sm font-semibold text-white px-5 py-2.5 rounded-xl mt-2 disabled:opacity-50 transition-all duration-200 hover:-translate-y-0.5"
                style={{ background: `linear-gradient(135deg, ${VIOLET_LIGHT}, ${VIOLET})`, boxShadow: `0 6px 16px -6px ${VIOLET}66` }}>
                {submitting ? 'Adding...' : 'Add Item'}
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
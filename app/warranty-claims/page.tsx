'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useSession } from 'next-auth/react';
import { ResponsiveLayout } from '@/app/components/ResponsiveLayout';
import { NAV_ITEMS } from '@/app/lib/nav-items';
import { ROLE_ACCESS } from '@/app/lib/role-access';

const VIOLET = '#6C5CE7';
const VIOLET_LIGHT = '#8B7CF8';
const VIOLET_DIM = 'rgba(108,92,231,0.10)';
const BG = '#F8F8FC';
const BORDER = 'rgba(30,20,60,0.07)';
const MUTED = '#6B7280';
const INK = '#1A1A2E';
const GREEN = '#34C759';
const AMBER = '#F5A623';
const RED = '#E24B4A';
const CARD_SHADOW = '0 1px 2px rgba(20,10,50,0.04), 0 8px 24px -12px rgba(20,10,50,0.08)';
const CARD_SHADOW_HOVER = '0 4px 12px rgba(20,10,50,0.06), 0 16px 36px -12px rgba(108,92,231,0.18)';

type Claim = {
  id: string;
  chassis: string;
  component: string;
  dealer: string;
  status: string;
  date: string;
  submittedRaw: string;
  updatedRaw: string | null;
};

const statusLabelMap: Record<string, string> = {
  submitted: 'Submitted',
  dealer_approved: 'Under review',
  company_approved: 'Approved',
  rejected: 'Rejected',
};

function mapApiClaim(row: any): Claim {
  const isResolved = row.resolved_at && row.status === 'company_approved';
  return {
    id: row.claim_number,
    chassis: row.chassis_number,
    component: row.component.charAt(0).toUpperCase() + row.component.slice(1),
    dealer: row.dealer_name,
    status: isResolved ? 'Resolved' : (statusLabelMap[row.status] ?? row.status),
    date: new Date(row.submitted_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
    submittedRaw: row.submitted_at,
    updatedRaw: row.resolved_at,
  };
}

const statusStyles: Record<string, { bg: string; text: string; dot: string }> = {
  Submitted: { bg: 'rgba(107,114,128,0.10)', text: MUTED, dot: MUTED },
  'Under review': { bg: 'rgba(245,166,35,0.12)', text: '#8A5A0B', dot: AMBER },
  Approved: { bg: 'rgba(52,199,89,0.12)', text: '#1E7A3C', dot: GREEN },
  Rejected: { bg: 'rgba(226,75,74,0.12)', text: '#A32D2D', dot: RED },
  Resolved: { bg: 'rgba(108,92,231,0.12)', text: VIOLET, dot: VIOLET },
};

const LIFECYCLE = [
  { n: 1, label: 'Submitted', sub: 'Claim received' },
  { n: 2, label: 'Under review', sub: 'Verification in progress' },
  { n: 3, label: 'Approved', sub: 'Claim approved' },
  { n: 4, label: 'Resolved', sub: 'Claim completed' },
];

const NAV = NAV_ITEMS.map((item) => ({ ...item, active: item.href === '/warranty-claims' }));

export default function WarrantyClaimsPage() {
  const { data: session, status } = useSession();
  const [claims, setClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [page, setPage] = useState(1);
  const perPage = 5;

  const [showModal, setShowModal] = useState(false);
  const [formChassis, setFormChassis] = useState('');
  const [formComponent, setFormComponent] = useState('battery');
  const [formRemarks, setFormRemarks] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const name = session?.user?.name || '';
  const role = (session?.user as any)?.role || '';

  function loadClaims() {
    setLoading(true);
    fetch('/api/warranty-claims')
      .then((res) => res.json())
      .then((json) => { if (json.success) setClaims(json.data.map(mapApiClaim)); })
      .finally(() => setLoading(false));
  }

  useEffect(() => { loadClaims(); }, []);

  async function handleSubmitClaim(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setFormError('');
    try {
      const res = await fetch('/api/warranty-claims', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chassisNumber: formChassis, component: formComponent, remarks: formRemarks }),
      });
      const json = await res.json();
      if (!json.success) { setFormError(json.error || 'Something went wrong'); return; }
      setShowModal(false);
      setFormChassis(''); setFormComponent('battery'); setFormRemarks('');
      loadClaims();
    } catch (err) {
      setFormError('Network error — check your connection and try again');
    } finally {
      setSubmitting(false);
    }
  }

  const filtered = claims.filter((c) => {
    const matchesSearch = c.chassis.toLowerCase().includes(search.toLowerCase()) || c.id.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'All' || c.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const paged = filtered.slice((page - 1) * perPage, page * perPage);
  const recent = claims.slice(0, 2);

  const lifecycleStepIndex = (status: string) => {
    if (status === 'Submitted') return 1;
    if (status === 'Under review') return 2;
    if (status === 'Approved') return 3;
    if (status === 'Resolved') return 4;
    return 0;
  };

  const inputStyle = { border: `1px solid ${BORDER}`, backgroundColor: '#fff', color: INK };

  const sidebarFooter = (
    <div className="rounded-2xl p-4" style={{ background: `linear-gradient(135deg, ${VIOLET_DIM}, rgba(245,166,35,0.06))`, border: `1px solid ${BORDER}` }}>
      <p className="text-sm font-semibold mb-1" style={{ color: VIOLET }}>AERYS AI</p>
      <p className="text-xs mb-3" style={{ color: MUTED }}>Your smart assistant for fleet, jobs & warranty claims.</p>
      <button className="w-full text-sm font-medium text-white rounded-xl py-2" style={{ background: `linear-gradient(135deg, ${VIOLET_LIGHT}, ${VIOLET})` }}>
        Start chat →
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
        <span className="font-semibold" style={{ color: VIOLET }}>Warranty Claims</span>
      </div>
      <div className="rounded-[20px] p-7 mb-6 relative overflow-hidden fade-up" style={{ background: `linear-gradient(135deg, ${VIOLET_DIM}, rgba(255,255,255,0.4))`, border: `1px solid ${BORDER}`, boxShadow: CARD_SHADOW }}>
        <h1 className="text-[28px] font-extrabold tracking-tight" style={{ color: INK }}>Warranty claims</h1>
        <p className="text-sm mt-2" style={{ color: MUTED }}>Track and manage warranty claims efficiently</p>
        <div className="absolute right-6 top-2 hidden md:block w-40 opacity-90">
          <Image src="/hero-scooter.png" alt="" width={300} height={300} className="object-contain w-full h-auto" />
        </div>
      </div>

      {/* Search + filter bar */}
      <div className="rounded-[20px] p-5 bg-white border mb-6 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center fade-up" style={{ borderColor: BORDER, boxShadow: CARD_SHADOW }}>
        <input
          type="text"
          placeholder="Search by chassis number or claim ID"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="focus-glow flex-1 rounded-xl px-4 py-2.5 text-sm outline-none transition-all duration-150"
          style={inputStyle}
        />
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="focus-glow rounded-xl px-4 py-2.5 text-sm outline-none w-full sm:w-auto transition-all duration-150"
          style={inputStyle}
        >
          <option>All</option>
          <option>Submitted</option>
          <option>Under review</option>
          <option>Approved</option>
          <option>Rejected</option>
          <option>Resolved</option>
        </select>
        {role !== 'customer' && (
        <button
          onClick={() => setShowModal(true)}
          className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white whitespace-nowrap transition-all duration-200 hover:-translate-y-0.5"
          style={{ background: `linear-gradient(135deg, ${VIOLET_LIGHT}, ${VIOLET})`, boxShadow: `0 6px 16px -6px ${VIOLET}66` }}
        >
          + New claim
        </button>
        )}
      </div>

      {/* Lifecycle */}
      <div className="rounded-[20px] p-7 bg-white border mb-6 fade-up" style={{ borderColor: BORDER, boxShadow: CARD_SHADOW }}>
        <p className="text-xs font-semibold uppercase tracking-wide mb-5" style={{ color: VIOLET }}>Claim lifecycle</p>
        <div className="flex flex-col sm:flex-row items-start sm:items-center">
          {LIFECYCLE.map((step, i) => (
            <div key={step.n} className="flex items-center w-full sm:flex-1 last:w-auto mb-4 sm:mb-0">
              <div className="flex flex-col items-center min-w-fit">
                <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white transition-transform hover:scale-110" style={{ background: `linear-gradient(135deg, ${VIOLET_LIGHT}, ${VIOLET})`, boxShadow: `0 4px 10px -3px ${VIOLET}66` }}>
                  {step.n}
                </div>
                <p className="text-xs font-medium mt-2 whitespace-nowrap" style={{ color: INK }}>{step.label}</p>
                <p className="text-[10px] whitespace-nowrap" style={{ color: MUTED }}>{step.sub}</p>
              </div>
              {i < LIFECYCLE.length - 1 && <div className="hidden sm:flex flex-1 h-px mx-2" style={{ backgroundColor: BORDER }} />}
            </div>
          ))}
        </div>
      </div>

      {/* Recent claim cards */}
      {recent.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {recent.map((claim) => (
            <div key={claim.id} className="group rounded-[20px] p-6 bg-white border transition-all duration-200 fade-up" style={{ borderColor: BORDER, boxShadow: CARD_SHADOW }}
              onMouseEnter={(e) => { e.currentTarget.style.boxShadow = CARD_SHADOW_HOVER; e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.borderColor = `${VIOLET}33`; }}
              onMouseLeave={(e) => { e.currentTarget.style.boxShadow = CARD_SHADOW; e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.borderColor = BORDER; }}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <span className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3" style={{ background: `linear-gradient(135deg, ${VIOLET_LIGHT}CC, ${VIOLET})`, boxShadow: `0 6px 16px -6px ${VIOLET}66` }}>🛡️</span>
                  <p className="font-bold" style={{ color: INK }}>{claim.id}</p>
                </div>
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full"
                  style={{ backgroundColor: statusStyles[claim.status]?.bg, color: statusStyles[claim.status]?.text }}>
                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: statusStyles[claim.status]?.dot }} />
                  {claim.status}
                </span>
              </div>
              <p className="text-xs mb-1" style={{ color: MUTED }}>Chassis: <span style={{ color: INK }}>{claim.chassis}</span></p>
              <p className="text-xs mb-1" style={{ color: MUTED }}>Component: <span style={{ color: INK }}>{claim.component}</span></p>
              <p className="text-xs mb-4" style={{ color: MUTED }}>Dealer: <span style={{ color: INK }}>{claim.dealer}</span></p>
              <div className="flex items-center justify-between pt-3 border-t" style={{ borderColor: BORDER }}>
                <span className="text-xs" style={{ color: MUTED }}>{claim.date}</span>
                <a href={`/warranty-claims/${claim.id}`} className="text-xs font-semibold transition-transform inline-flex items-center gap-1 hover:gap-1.5" style={{ color: VIOLET }}>View details →</a>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Table */}
      <div className="rounded-[20px] bg-white border overflow-hidden fade-up" style={{ borderColor: BORDER, boxShadow: CARD_SHADOW }}>
        <div className="flex items-center justify-between p-6 pb-3 flex-col sm:flex-row gap-3">
          <p className="font-bold text-[15px]" style={{ color: INK }}>All warranty claims</p>
          <input
            placeholder="Search claims..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="focus-glow rounded-xl px-4 py-2 text-sm outline-none w-full sm:w-64 transition-all duration-150"
            style={inputStyle}
          />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left" style={{ color: MUTED }}>
                {['Claim ID', 'Chassis No.', 'Component', 'Dealer', 'Status', 'Submitted on'].map((h) => (
                  <th key={h} className="px-5 py-2 font-medium text-xs">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paged.map((c) => (
                <tr key={c.id} className="border-t transition-colors duration-150 hover:bg-[rgba(108,92,231,0.04)]" style={{ borderColor: BORDER }}>
                  <td className="px-5 py-3.5">
                    <a href={`/warranty-claims/${c.id}`} className="font-semibold" style={{ color: VIOLET }}>{c.id}</a>
                  </td>
                  <td className="px-5 py-3.5" style={{ color: MUTED }}>{c.chassis}</td>
                  <td className="px-5 py-3.5" style={{ color: MUTED }}>{c.component}</td>
                  <td className="px-5 py-3.5" style={{ color: MUTED }}>{c.dealer}</td>
                  <td className="px-5 py-3.5">
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full" style={{ backgroundColor: statusStyles[c.status]?.bg, color: statusStyles[c.status]?.text }}>
                      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: statusStyles[c.status]?.dot }} />
                      {c.status}
                    </span>
                  </td>
                  <td className="px-5 py-3.5" style={{ color: MUTED }}>{c.date}</td>
                </tr>
              ))}
              {loading && (
                <tr><td colSpan={6} className="px-5 py-8 text-center text-sm" style={{ color: MUTED }}>Loading claims...</td></tr>
              )}
              {!loading && paged.length === 0 && (
                <tr><td colSpan={6} className="px-5 py-8 text-center text-sm" style={{ color: MUTED }}>No claims match your search.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between px-5 py-3 text-xs flex-col sm:flex-row gap-3" style={{ color: MUTED }}>
          <span>Showing {paged.length ? (page - 1) * perPage + 1 : 0} to {Math.min(page * perPage, filtered.length)} of {filtered.length} entries</span>
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

      {showModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-[20px] p-7 w-full max-w-md" style={{ boxShadow: CARD_SHADOW_HOVER }}>
            <h2 className="text-lg font-bold mb-4" style={{ color: INK }}>File a new warranty claim</h2>
            <form onSubmit={handleSubmitClaim} className="space-y-4">
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: INK }}>Chassis number</label>
                <input type="text" required value={formChassis} onChange={(e) => setFormChassis(e.target.value)}
                  placeholder="e.g. AERX1PN00123" className="focus-glow w-full rounded-xl px-4 py-2.5 text-sm outline-none transition-all duration-150" style={inputStyle} />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: INK }}>Component</label>
                <select value={formComponent} onChange={(e) => setFormComponent(e.target.value)}
                  className="focus-glow w-full rounded-xl px-4 py-2.5 text-sm outline-none transition-all duration-150" style={inputStyle}>
                  <option value="battery">Battery</option>
                  <option value="motor">Motor</option>
                  <option value="charger">Charger</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: INK }}>Remarks</label>
                <textarea value={formRemarks} onChange={(e) => setFormRemarks(e.target.value)}
                  placeholder="Describe the issue" rows={3} className="focus-glow w-full rounded-xl px-4 py-2.5 text-sm outline-none resize-none transition-all duration-150" style={inputStyle} />
              </div>
              {formError && <p className="text-sm" style={{ color: RED }}>{formError}</p>}
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="text-sm font-medium px-4 py-2 rounded-xl" style={{ color: MUTED }}>
                  Cancel
                </button>
                <button type="submit" disabled={submitting}
                  className="text-sm font-semibold text-white px-5 py-2 rounded-xl disabled:opacity-50 transition-all duration-200 hover:-translate-y-0.5"
                  style={{ background: `linear-gradient(135deg, ${VIOLET_LIGHT}, ${VIOLET})`, boxShadow: `0 6px 16px -6px ${VIOLET}66` }}>
                  {submitting ? 'Submitting...' : 'Submit claim'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      </div>
    </ResponsiveLayout>
    </>
  );
}
'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import { useSession } from 'next-auth/react';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { ResponsiveLayout } from '@/app/components/ResponsiveLayout';
import { NAV_ITEMS } from '@/app/lib/nav-items';
import { FiTruck, FiClipboard, FiShield, FiBarChart2 } from 'react-icons/fi';

const VIOLET = '#6C5CE7';
const VIOLET_LIGHT = '#8B7CF8';
const VIOLET_DIM = 'rgba(108,92,231,0.10)';
const AMBER = '#F5A623';
const AMBER_DIM = 'rgba(245,166,35,0.10)';
const BORDER = 'rgba(30,20,60,0.07)';
const MUTED = '#6B7280';
const INK = '#1A1A2E';
const GOOD = '#34C759';
const WARN = '#E24B4A';
const CARD_SHADOW = '0 1px 2px rgba(20,10,50,0.04), 0 8px 24px -12px rgba(20,10,50,0.08)';
const CARD_SHADOW_HOVER = '0 4px 12px rgba(20,10,50,0.06), 0 16px 36px -12px rgba(108,92,231,0.18)';

const STATUS_LABEL: Record<string, string> = {
  registered: 'Registered',
  acknowledged: 'Acknowledged',
  rejected_by_dealer: 'Rejected by dealer',
  technician_assigned: 'Technician assigned',
  in_progress: 'In progress',
  completed: 'Completed',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

const ACTIVITY_LABEL: Record<string, string> = {
  vehicle: 'Vehicle registered',
  job_card: 'Job card created',
  warranty_claim: 'Warranty claim submitted',
};

const STAT_REACT_ICONS: Record<string, React.ComponentType<{ size?: number; color?: string }>> = {
  '/vehicles': FiTruck,
  '/jobcards': FiClipboard,
  '/warranty-claims': FiShield,
  '/dashboard': FiBarChart2,
};

const QUICK_ACTION_ICONS: Record<string, string> = {
  '/vehicles': 'M3 13l1.5-4.5A2 2 0 016.4 7h11.2a2 2 0 011.9 1.5L21 13M2.5 13h19v6h-19zM7 19v1M17 19v1M6 16h.01M18 16h.01',
  '/jobcards': 'M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8zM14 2v6h6M9 13h6M9 17h6M9 9h1',
  '/warranty-claims': 'M12 2l8 3v6c0 5-3.5 9-8 11-4.5-2-8-6-8-11V5z',
};

const ACTIVITY_ICONS: Record<string, { icon: string; color: string; bg: string }> = {
  vehicle: { icon: 'M3 13l1.5-4.5A2 2 0 016.4 7h11.2a2 2 0 011.9 1.5L21 13M2.5 13h19v6h-19z', color: VIOLET, bg: VIOLET_DIM },
  job_card: { icon: 'M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8zM14 2v6h6', color: AMBER, bg: AMBER_DIM },
  warranty_claim: { icon: 'M12 2l8 3v6c0 5-3.5 9-8 11-4.5-2-8-6-8-11V5z', color: GOOD, bg: 'rgba(52,199,89,0.1)' },
};

const OPS_ICONS = {
  jobs: 'M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8zM14 2v6h6M9 13h6M9 17h6M9 9h1',
  warranty: 'M12 2l8 3v6c0 5-3.5 9-8 11-4.5-2-8-6-8-11V5z',
  delivered: 'M3 13l1.5-4.5A2 2 0 016.4 7h11.2a2 2 0 011.9 1.5L21 13M2.5 13h19v6h-19zM7 19v1M17 19v1M6 16h.01M18 16h.01',
  active: 'M12 8v4l3 3M12 22a10 10 0 100-20 10 10 0 000 20z',
};

const NAV = NAV_ITEMS.map((item) => ({ ...item, active: item.href === '/' }));

function Sparkline({ color, seed = 1 }: { color: string; seed?: number }) {
  const pts = [4, 8, 5, 10, 7, 12, 9].map((v, i) => `${i * 8},${16 - ((v * seed) % 13)}`).join(' ');
  return (
    <svg width="56" height="18" viewBox="0 0 48 18" fill="none" className="opacity-70">
      <polyline points={pts} stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}

function timeAgo(ts: string) {
  const diffMs = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return new Date(ts).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}

function StatChip({ label, value, style }: { label: string; value: string; style?: React.CSSProperties }) {
  return (
    <div
      className="absolute rounded-2xl backdrop-blur-xl px-3.5 py-2.5 pointer-events-none"
      style={{ backgroundColor: 'rgba(255,255,255,0.14)', border: '1px solid rgba(255,255,255,0.22)', minWidth: 128, ...style }}
    >
      <p className="text-[9px] uppercase tracking-wide text-white/70">{label}</p>
      <p className="text-sm font-semibold text-white">{value}</p>
    </div>
  );
}

function ScooterPanel() {
  const dragRotateY = useMotionValue(0);
  const dragRotateX = useMotionValue(0);
  const springRotY = useSpring(dragRotateY, { stiffness: 140, damping: 18 });
  const springRotX = useSpring(dragRotateX, { stiffness: 140, damping: 18 });

  const px = useMotionValue(0);
  const py = useMotionValue(0);
  const parallaxX = useSpring(px, { stiffness: 60, damping: 20 });
  const parallaxY = useSpring(py, { stiffness: 60, damping: 20 });
  const translateX = useTransform(parallaxX, [-100, 100], [-10, 10]);
  const translateY = useTransform(parallaxY, [-100, 100], [-8, 8]);

  const dragging = useRef(false);
  const lastPointer = useRef({ x: 0, y: 0 });

  function handlePointerDown(e: React.PointerEvent) {
    dragging.current = true;
    lastPointer.current = { x: e.clientX, y: e.clientY };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }

  function handlePointerMove(e: React.MouseEvent) {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const relX = e.clientX - rect.left - rect.width / 2;
    const relY = e.clientY - rect.top - rect.height / 2;
    px.set(relX / 3);
    py.set(relY / 3);

    if (dragging.current) {
      const dx = e.clientX - lastPointer.current.x;
      const dy = e.clientY - lastPointer.current.y;
      dragRotateY.set(dragRotateY.get() + dx * 0.4);
      dragRotateX.set(Math.max(-15, Math.min(15, dragRotateX.get() - dy * 0.3)));
      lastPointer.current = { x: e.clientX, y: e.clientY };
    }
  }

  function handlePointerUp() {
    dragging.current = false;
  }

  return (
    <div
      className="relative rounded-2xl mb-8 overflow-hidden select-none fade-up"
      style={{ background: `linear-gradient(135deg, #241E52 0%, #4A3DA8 45%, ${VIOLET} 100%)`, cursor: 'grab' }}
      onMouseMove={handlePointerMove}
      onMouseLeave={() => { px.set(0); py.set(0); }}
    >
      <div className="pointer-events-none absolute inset-0 opacity-40" style={{ background: 'radial-gradient(65% 65% at 82% 0%, rgba(255,255,255,0.22), transparent 70%)' }} />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.05]"
        style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.8) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.8) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />

      <div className="relative z-10 flex items-start justify-between px-6 sm:px-8 pt-7">
        <div>
          <span
            className="text-[10px] tracking-[0.2em] uppercase px-2.5 py-1 rounded-full text-white/85"
            style={{ backgroundColor: 'rgba(255,255,255,0.14)', border: '1px solid rgba(255,255,255,0.2)' }}
          >
            Now Servicing
          </span>
          <h2 className="text-white mt-3 text-3xl sm:text-4xl font-extrabold tracking-tight">AERYS X1</h2>
          <div className="flex items-center gap-2.5 mt-3">
            <span className="text-xs px-2.5 py-1 rounded-full text-white flex items-center gap-1.5" style={{ backgroundColor: 'rgba(255,255,255,0.16)' }}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: GOOD }} />
              Warranty Active
            </span>
            <span className="text-xs text-white/70">Chassis #AX1-20481</span>
          </div>
        </div>
        <p className="text-[11px] text-white/60 hidden sm:block">Drag to rotate</p>
      </div>

      <motion.div
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        style={{ x: translateX, y: translateY, rotateY: springRotY, rotateX: springRotX, transformStyle: 'preserve-3d', touchAction: 'none' }}
        animate={{ y: [0, -8, 0] }}
        transition={{ duration: 4.5, repeat: Infinity, ease: 'easeInOut' }}
        className="relative z-10 mx-auto w-full max-w-[700px] h-[320px] sm:h-[380px] flex items-center justify-center"
      >
        <Image
          src="/hero-scooter.png"
          alt="AERYS X1"
          fill
          className="object-contain pointer-events-none drop-shadow-[0_30px_40px_rgba(0,0,0,0.4)]"
          priority
        />
      </motion.div>

      <StatChip label="Range" value="563 km" style={{ top: '38%', left: '3%' }} />
      <StatChip label="Battery Health" value="93%" style={{ top: '30%', right: '2%' }} />
      <StatChip label="Pack Temp" value="34°C" style={{ bottom: '14%', right: '3%' }} />
      <StatChip label="Tyre Pressure" value="2.6 bar" style={{ bottom: '10%', left: '2%' }} />

      <div className="h-4" />
    </div>
  );
}

export default function Home() {
  const { data: session, status } = useSession();
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const role = (session?.user as any)?.role || '';
  const name = session?.user?.name || 'there';

  useEffect(() => {
    fetch('/api/homepage-stats')
      .then((res) => res.json())
      .then((json) => { if (json.success) setStats(json.data); })
      .finally(() => setLoading(false));
  }, []);

  const sidebarFooter = (
    <div className="rounded-2xl p-4" style={{ background: `linear-gradient(135deg, ${VIOLET_DIM}, rgba(245,166,35,0.06))`, border: `1px solid ${BORDER}`, boxShadow: '0 8px 20px -12px rgba(108,92,231,0.35)' }}>
      <p className="text-sm font-semibold mb-1" style={{ color: VIOLET }}>AERYS AI</p>
      <p className="text-xs mb-3" style={{ color: MUTED }}>Ask anything about your fleet, jobs, or claims.</p>
      <button className="w-full text-sm font-medium text-white rounded-xl py-2" style={{ background: `linear-gradient(135deg, ${VIOLET_LIGHT}, ${VIOLET})` }}>
        Start chat →
      </button>
    </div>
  );

  const statusEntries = stats?.statusBreakdown ? Object.entries(stats.statusBreakdown) : [];

  return (
    <>
      <style jsx global>{`
        .page-bg {
          background-color: #FAFAFF;
          background-image:
            radial-gradient(circle at 15% 10%, rgba(108,92,231,0.07), transparent 40%),
            radial-gradient(circle at 90% 25%, rgba(245,166,35,0.05), transparent 35%),
            radial-gradient(circle at 50% 90%, rgba(108,92,231,0.05), transparent 40%);
        }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(14px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes floatY {
          0%, 100% { transform: translateY(-50%) scale(1); }
          50% { transform: translateY(calc(-50% - 6px)) scale(1.05); }
        }
        .fade-up { opacity: 0; animation: fadeUp 0.5s ease forwards; }
        .float-icon { animation: floatY 3.5s ease-in-out infinite; }
      `}</style>
      <ResponsiveLayout navItems={NAV} sidebarFooter={sidebarFooter}>
        <div className="page-bg -m-4 md:-m-6 p-4 md:p-6">

          {/* Welcome header */}
          <div className="mb-6 fade-up">
            <h1 className="text-[28px] font-extrabold tracking-tight" style={{ color: INK }}>
              Welcome back, {name} 👋
            </h1>
            <p className="text-sm mt-2" style={{ color: MUTED }}>Here&apos;s what&apos;s happening with your fleet today.</p>
          </div>

          {status === 'unauthenticated' && (
            <p className="mb-6"><Link href="/login" style={{ color: VIOLET }}>Log in</Link></p>
          )}

          {/* Scooter panel */}
          <ScooterPanel />

          {/* Stat cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4 mb-6">
            {[
              ...(role === 'technician'
                ? [{ label: 'Assigned Jobs', value: stats?.activeJobs, icon: 'M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z M14 2v6h6', accent: VIOLET }]
                : [{ label: 'Total Vehicles', value: stats?.totalVehicles, icon: 'M3 13l1.5-4.5A2 2 0 016.4 7h11.2a2 2 0 011.9 1.5L21 13M2.5 13h19v6h-19z', accent: VIOLET },
                   { label: 'Active Jobs', value: stats?.activeJobs, icon: 'M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z M14 2v6h6', accent: VIOLET }]),
              { label: 'Pending Jobs', value: stats?.pendingJobs, icon: 'M12 8v4l3 3M12 22a10 10 0 100-20 10 10 0 000 20z', accent: AMBER },
              { label: 'SLA Breaches', value: stats?.slaBreached, warn: true, icon: 'M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0zM12 9v4M12 17h.01' },
              { label: 'Completed Today', value: stats?.completedToday, icon: 'M20 6L9 17l-5-5', accent: GOOD },
            ].map((c) => {
              const isWarnActive = c.warn && (c.value ?? 0) > 0;
              const accentColor = isWarnActive ? WARN : (c.accent ?? VIOLET);
              return (
                <div
                  key={c.label}
                  className="group relative rounded-[20px] p-6 border overflow-hidden transition-all duration-200 fade-up"
                  style={{ borderColor: BORDER, boxShadow: CARD_SHADOW, background: `linear-gradient(160deg, #fff 65%, ${accentColor}0d 100%)` }}
                  onMouseEnter={(e) => { e.currentTarget.style.boxShadow = CARD_SHADOW_HOVER; e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.borderColor = `${accentColor}55`; }}
                  onMouseLeave={(e) => { e.currentTarget.style.boxShadow = CARD_SHADOW; e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.borderColor = BORDER; }}
                >
                  <div className="relative flex items-center justify-between mb-4">
                    <p className="text-xs font-medium" style={{ color: MUTED }}>{c.label}</p>
                    <span
                      className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3"
                      style={{ background: `linear-gradient(135deg, ${accentColor}CC, ${accentColor})`, boxShadow: `0 6px 16px -6px ${accentColor}66` }}
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                        <path d={c.icon} />
                      </svg>
                    </span>
                  </div>
                  <p className="relative text-[28px] font-extrabold tabular-nums tracking-tight mb-3" style={{ color: isWarnActive ? WARN : INK }}>
                    {loading ? '—' : (c.value ?? 0)}
                  </p>
                  <div className="relative h-1 rounded-full overflow-hidden" style={{ backgroundColor: `${accentColor}1A` }}>
                    <div className="h-full rounded-full transition-all duration-700" style={{ width: loading ? '0%' : '58%', background: `linear-gradient(90deg, ${accentColor}CC, ${accentColor})` }} />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Today's operations / Recent activity / Quick actions */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
            <div className="rounded-[20px] p-7 bg-white border" style={{ borderColor: BORDER, boxShadow: CARD_SHADOW }}>
              <p className="text-[15px] font-bold mb-5" style={{ color: INK }}>Today&apos;s operations</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl p-3 fade-up transition-transform duration-200 hover:-translate-y-1" style={{ backgroundColor: VIOLET_DIM, animationDelay: '0ms' }}>
                  <div className="flex items-end justify-between mb-1.5">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={VIOLET} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={OPS_ICONS.jobs} /></svg>
                    <Sparkline color={VIOLET} seed={1} />
                  </div>
                  <p className="text-xl font-bold" style={{ color: INK }}>{stats?.jobsToday ?? '—'}</p>
                  <p className="text-[11px]" style={{ color: MUTED }}>Jobs registered today</p>
                </div>
                <div className="rounded-xl p-3 fade-up transition-transform duration-200 hover:-translate-y-1" style={{ backgroundColor: AMBER_DIM, animationDelay: '80ms' }}>
                  <div className="flex items-end justify-between mb-1.5">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={AMBER} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={OPS_ICONS.warranty} /></svg>
                    <Sparkline color={AMBER} seed={2} />
                  </div>
                  <p className="text-xl font-bold" style={{ color: INK }}>{stats?.warrantyClaimsUnderReview ?? '—'}</p>
                  <p className="text-[11px]" style={{ color: MUTED }}>Warranty requests</p>
                </div>
                <div className="rounded-xl p-3 fade-up transition-transform duration-200 hover:-translate-y-1" style={{ backgroundColor: 'rgba(52,199,89,0.08)', animationDelay: '160ms' }}>
                  <div className="flex items-end justify-between mb-1.5">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={GOOD} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={OPS_ICONS.delivered} /></svg>
                    <Sparkline color={GOOD} seed={3} />
                  </div>
                  <p className="text-xl font-bold" style={{ color: INK }}>{stats?.deliveriesToday ?? '—'}</p>
                  <p className="text-[11px]" style={{ color: MUTED }}>Delivered today</p>
                </div>
                <div className="rounded-xl p-3 fade-up transition-transform duration-200 hover:-translate-y-1" style={{ backgroundColor: VIOLET_DIM, animationDelay: '240ms' }}>
                  <div className="flex items-end justify-between mb-1.5">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={VIOLET} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={OPS_ICONS.active} /></svg>
                    <Sparkline color={VIOLET} seed={4} />
                  </div>
                  <p className="text-xl font-bold" style={{ color: INK }}>{stats?.activeJobs ?? '—'}</p>
                  <p className="text-[11px]" style={{ color: MUTED }}>Active jobs</p>
                </div>
              </div>
            </div>

            <div className="rounded-[20px] p-7 bg-white border" style={{ borderColor: BORDER, boxShadow: CARD_SHADOW }}>
              <p className="text-[15px] font-bold mb-5" style={{ color: INK }}>Recent activity</p>
              <div className="relative">
                {stats?.recentActivity?.length ? (
                  <>
                    <div className="absolute left-4 top-2 bottom-2 w-px" style={{ backgroundColor: BORDER }} />
                    <div className="space-y-5">
                      {stats.recentActivity.map((a: any, i: number) => {
                        const meta = ACTIVITY_ICONS[a.type] ?? ACTIVITY_ICONS.job_card;
                        return (
                          <div key={i} className="relative flex items-start gap-3 text-xs fade-up pl-0" style={{ animationDelay: `${i * 90}ms` }}>
                            <span
                              className="relative z-10 w-8 h-8 rounded-full flex items-center justify-center shrink-0 border-2 border-white transition-transform hover:scale-110"
                              style={{ backgroundColor: meta.bg, boxShadow: `0 0 0 1px ${BORDER}` }}
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={meta.color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                                <path d={meta.icon} />
                              </svg>
                            </span>
                            <div className="flex-1 min-w-0 pt-1">
                              <div className="flex items-center justify-between gap-2">
                                <p className="font-semibold truncate" style={{ color: INK }}>{ACTIVITY_LABEL[a.type] ?? 'Activity'}</p>
                                <span className="shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: meta.bg, color: meta.color }}>
                                  {timeAgo(a.ts)}
                                </span>
                              </div>
                              <p className="truncate mt-0.5" style={{ color: MUTED }}>{a.ref}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                ) : <p className="text-xs" style={{ color: MUTED }}>No recent activity.</p>}
              </div>
            </div>

            <div className="rounded-[20px] p-7 bg-white border" style={{ borderColor: BORDER, boxShadow: CARD_SHADOW }}>
              <p className="text-[15px] font-bold mb-5" style={{ color: INK }}>Quick actions</p>
              <div className="space-y-3">
                {[
                  ...(role === 'customer'
                    ? [{ label: 'View my vehicles', desc: 'See all vehicles under your name', href: '/vehicles' }]
                    : role === 'technician'
                    ? [{ label: 'View my jobs', desc: 'See jobs assigned to you', href: '/jobcards' }]
                    : [{ label: 'Register new vehicle', desc: 'Add a vehicle to the fleet', href: '/vehicles' }]),
                  { label: 'Create job card', desc: 'Log a new service task', href: '/jobcards' },
                  ...(role === 'technician' ? [] : [{ label: 'Add complaint', desc: 'Record a customer complaint', href: '/jobcards' }]),
                  { label: 'New warranty claim', desc: 'File a claim for review', href: '/warranty-claims' },
                ].map((a, idx2) => (
                  <Link key={a.label} href={a.href}
                    className="group relative flex items-center gap-3 p-4 rounded-2xl transition-all duration-200 hover:-translate-y-0.5 fade-up overflow-hidden"
                    style={{ background: `linear-gradient(135deg, #fff 55%, ${VIOLET_DIM} 140%)`, border: `1px solid ${BORDER}`, animationDelay: `${idx2 * 90}ms` }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = VIOLET_LIGHT; e.currentTarget.style.boxShadow = `0 10px 24px -12px ${VIOLET}55`; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = BORDER; e.currentTarget.style.boxShadow = 'none'; }}
                  >
                    <span
                      className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-110 group-hover:rotate-3"
                      style={{ background: `linear-gradient(135deg, ${VIOLET_LIGHT}, ${VIOLET})`, boxShadow: `0 6px 14px -6px ${VIOLET}66` }}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d={QUICK_ACTION_ICONS[a.href] ?? QUICK_ACTION_ICONS['/jobcards']} />
                      </svg>
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold truncate" style={{ color: INK }}>{a.label}</p>
                      <p className="text-[11px] truncate" style={{ color: MUTED }}>{a.desc}</p>
                    </div>
                    <span className="text-sm transition-transform group-hover:translate-x-1 shrink-0" style={{ color: VIOLET }}>→</span>
                  </Link>
                ))}
              </div>
            </div>
          </div>

          {/* Status breakdown + Dealer leaderboard (admin/dealer only) */}
          {(role === 'super_admin' || role === 'dealer') && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-8">
              <div className="rounded-[20px] p-7 bg-white border fade-up" style={{ borderColor: BORDER, boxShadow: CARD_SHADOW }}>
                <p className="text-[15px] font-bold mb-5" style={{ color: INK }}>Job card status breakdown</p>
                {statusEntries.length === 0 && !loading && (
                  <p className="text-xs" style={{ color: MUTED }}>No job cards yet.</p>
                )}
                <div className="space-y-3">
                  {statusEntries.map(([status, count]: any) => {
                    const max = Math.max(...statusEntries.map(([, c]: any) => c), 1);
                    return (
                      <div key={status}>
                        <div className="flex items-center justify-between text-sm mb-1">
                          <span style={{ color: MUTED }}>{STATUS_LABEL[status] ?? status}</span>
                          <span className="font-semibold" style={{ color: INK }}>{count}</span>
                        </div>
                        <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: VIOLET_DIM }}>
                          <div className="h-full rounded-full transition-all duration-700" style={{ width: `${(Number(count) / max) * 100}%`, background: `linear-gradient(90deg, ${VIOLET_LIGHT}, ${VIOLET})` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {role === 'super_admin' && stats?.dealerLeaderboard?.length > 0 && (
                <div className="rounded-[20px] p-7 bg-white border fade-up" style={{ borderColor: BORDER, boxShadow: CARD_SHADOW }}>
                  <p className="text-[15px] font-bold mb-5" style={{ color: INK }}>Dealer leaderboard</p>
                  <div className="space-y-4">
                    {stats.dealerLeaderboard.map((d: any, i: number) => {
                      const max = Math.max(...stats.dealerLeaderboard.map((x: any) => x.jobs), 1);
                      const rankColor = i === 0 ? AMBER : i === 1 ? MUTED : i === 2 ? '#B08D57' : VIOLET;
                      return (
                        <div key={d.dealer_name} className="flex items-center gap-4 p-3 rounded-2xl transition-all duration-200 hover:-translate-y-0.5" style={{ border: `1px solid ${BORDER}` }}>
                          <span
                            className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0 text-white"
                            style={{ background: `linear-gradient(135deg, ${rankColor}, ${rankColor}CC)`, boxShadow: `0 4px 10px -3px ${rankColor}88` }}
                          >
                            {i + 1}
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="text-sm font-semibold truncate" style={{ color: INK }}>{d.dealer_name}</span>
                              <span className="text-xs font-bold shrink-0" style={{ color: VIOLET }}>{d.jobs} jobs</span>
                            </div>
                            <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: VIOLET_DIM }}>
                              <div className="h-full rounded-full transition-all duration-700" style={{ width: `${(d.jobs / max) * 100}%`, background: `linear-gradient(90deg, ${VIOLET_LIGHT}, ${VIOLET})` }} />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Announcements */}
          <div className="rounded-[20px] p-7 bg-white border" style={{ borderColor: BORDER, boxShadow: CARD_SHADOW }}>
            <p className="text-[15px] font-bold mb-5" style={{ color: INK }}>Announcements</p>
            <div className="flex flex-wrap gap-6">
              {[
                { text: 'System maintenance scheduled 16 July, 12:00 AM' },
                { text: 'Job card module has a new bulk-update feature' },
                { text: 'Training session for service advisors on 18 July' },
              ].map((a, i) => (
                <div key={i} className="flex items-start gap-2 text-xs" style={{ color: MUTED }}>
                  <span className="w-1.5 h-1.5 rounded-full mt-1 shrink-0" style={{ backgroundColor: VIOLET }} />
                  {a.text}
                </div>
              ))}
            </div>
          </div>

        </div>
      </ResponsiveLayout>
    </>
  );
}
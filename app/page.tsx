'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { ResponsiveLayout } from '@/app/components/ResponsiveLayout';
import { NAV_ITEMS } from '@/app/lib/nav-items';
import { CountUp } from '@/app/components/CountUp';
import { DonutChart } from '@/app/components/DonutChart';
import { SparkLine } from '@/app/components/SparkLine';
import { useLanguage } from '@/app/lib/LanguageContext';

const VIOLET = '#6C5CE7';
const VIOLET_LIGHT = '#8B7CF8';
const LAV = '#EDE9FF';
const LAV_PALE = '#F7F5FF';
const VIOLET_DIM = 'rgba(108,92,231,0.10)';
const AMBER = '#F5A623';
const AMBER_DIM = 'rgba(245,166,35,0.10)';
const BORDER = 'rgba(108,92,231,0.10)';
const MUTED = '#6B6B7E';
const INK = '#15152A';
const GOOD = '#34C759';
const WARN = '#E24B4A';
const CARD_SHADOW = '0 1px 2px rgba(20,10,50,0.04), 0 8px 24px -12px rgba(20,10,50,0.08)';
const CARD_SHADOW_HOVER = '0 4px 12px rgba(20,10,50,0.06), 0 16px 36px -12px rgba(108,92,231,0.18)';

const ACTIVITY_LABEL_KEY: Record<string, 'activityVehicle' | 'activityJobCard' | 'activityWarrantyClaim'> = {
  vehicle: 'activityVehicle',
  job_card: 'activityJobCard',
  warranty_claim: 'activityWarrantyClaim',
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

const NAV = NAV_ITEMS.map((item) => ({ ...item, active: item.href === '/', label: item.href === '/' ? 'Dashboard' : item.label }));

function timeAgo(ts: string) {
  const diffMs = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return new Date(ts).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}

/* ---------------- Fleet Performance line chart ---------------- */
function FleetPerformanceChart({ trend }: { trend: { day: string; jobs?: number; totalJobs?: number }[] }) {
  const raw = (trend?.length ? trend : Array.from({ length: 7 }).map((_, i) => ({ day: String(i), jobs: 0 }))).map((d: any) => ({
    day: d.day,
    value: d.totalJobs ?? d.jobs ?? 0,
  }));
  // Deterministic "last month" comparison series (70-90% of this month's values, seeded by index)
  const lastMonth = raw.map((d, i) => Math.max(0, Math.round(d.value * (0.65 + ((i * 37) % 30) / 100))));

  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const max = Math.max(...raw.map((d) => d.value), ...lastMonth, 1);
  const w = 500, h = 160, padTop = 16, padBottom = 28;
  const usableH = h - padTop - padBottom;
  const step = w / (raw.length - 1 || 1);

  const yOf = (v: number) => h - padBottom - (v / max) * usableH;
  const pathThis = raw.map((d, i) => `${i === 0 ? 'M' : 'L'} ${i * step},${yOf(d.value)}`).join(' ');
  const pathLast = lastMonth.map((v, i) => `${i === 0 ? 'M' : 'L'} ${i * step},${yOf(v)}`).join(' ');

  const fmtDate = (day: string) => {
    const d = new Date(day);
    if (isNaN(d.getTime())) return day;
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
  };

  return (
    <div className="relative">
      <div className="flex items-center gap-4 mb-2 text-[11px]">
        <span className="flex items-center gap-1.5" style={{ color: MUTED }}>
          <span className="inline-block w-3 h-0.5 rounded-full" style={{ backgroundColor: VIOLET }} /> This Month
        </span>
        <span className="flex items-center gap-1.5" style={{ color: MUTED }}>
          <span className="inline-block w-3 h-0.5 rounded-full" style={{ backgroundColor: VIOLET_LIGHT, opacity: 0.6, borderTop: `1.5px dashed ${VIOLET_LIGHT}`, backgroundColor: 'transparent' }} /> Last Month
        </span>
      </div>
      <svg
        width="100%"
        height={h}
        viewBox={`0 0 ${w} ${h}`}
        preserveAspectRatio="none"
        onMouseLeave={() => setHoverIdx(null)}
      >
        {/* last month dashed */}
        <motion.path
          d={pathLast}
          fill="none"
          stroke={VIOLET_LIGHT}
          strokeWidth="2"
          strokeDasharray="6 5"
          strokeLinecap="round"
          initial={{ pathLength: 0 }}
          whileInView={{ pathLength: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 1.4, ease: 'easeOut' }}
        />
        {/* this month solid */}
        <motion.path
          d={pathThis}
          fill="none"
          stroke={VIOLET}
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{ pathLength: 0 }}
          whileInView={{ pathLength: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 1.4, ease: 'easeOut', delay: 0.1 }}
        />

        {raw.map((d, i) => (
          <g key={i}>
            {/* invisible hover hit area */}
            <rect
              x={i * step - step / 2}
              y={0}
              width={step}
              height={h}
              fill="transparent"
              onMouseEnter={() => setHoverIdx(i)}
            />
            <motion.circle
              cx={i * step}
              cy={yOf(d.value)}
              r={hoverIdx === i ? 6 : 4}
              fill={VIOLET}
              stroke="#fff"
              strokeWidth={hoverIdx === i ? 2 : 0}
              initial={{ scale: 0 }}
              whileInView={{ scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.8 + i * 0.08, duration: 0.3 }}
              style={{ transition: 'r 150ms ease' }}
            />
            {hoverIdx === i && (
              <line x1={i * step} y1={yOf(d.value)} x2={i * step} y2={h - padBottom} stroke={VIOLET} strokeWidth="1" strokeDasharray="3 3" opacity={0.4} />
            )}
          </g>
        ))}

        {raw.map((d, i) => (
          (i === 0 || i === raw.length - 1 || i % Math.ceil(raw.length / 5) === 0) && (
            <text key={`lbl-${i}`} x={i * step} y={h - 6} fontSize="9" textAnchor="middle" fill={MUTED}>
              {fmtDate(d.day)}
            </text>
          )
        ))}
      </svg>

      {hoverIdx !== null && (
        <div
          className="absolute pointer-events-none rounded-lg px-2.5 py-1.5 text-[11px] font-semibold shadow-lg"
          style={{
            left: `${(hoverIdx * step / w) * 100}%`,
            top: 0,
            transform: 'translate(-50%, -110%)',
            backgroundColor: INK,
            color: '#fff',
            whiteSpace: 'nowrap',
          }}
        >
          {fmtDate(raw[hoverIdx].day)} · {raw[hoverIdx].value}
        </div>
      )}
    </div>
  );
}

/* ---------------- Service Centers mini map ---------------- */
function ServiceCentersMap({ centers, names }: { centers: number; names?: string[] }) {
  const pins = [
    { top: '30%', left: '22%' },
    { top: '55%', left: '48%' },
    { top: '25%', left: '70%' },
  ];
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const labels = names?.length ? names : ['Main Service Center', 'North Hub', 'East Depot'];

  return (
    <div className="relative rounded-xl h-32 mb-3 overflow-hidden" style={{ backgroundColor: LAV_PALE }}>
      {/* faint street-like lines */}
      <svg className="absolute inset-0 w-full h-full opacity-[0.35]" preserveAspectRatio="none">
        <line x1="0" y1="35%" x2="100%" y2="20%" stroke={VIOLET} strokeWidth="1" />
        <line x1="0" y1="70%" x2="100%" y2="80%" stroke={VIOLET} strokeWidth="1" />
        <line x1="20%" y1="0" x2="35%" y2="100%" stroke={VIOLET} strokeWidth="1" />
        <line x1="65%" y1="0" x2="55%" y2="100%" stroke={VIOLET} strokeWidth="1" />
      </svg>
      <div className="absolute inset-0 opacity-30" style={{
        backgroundImage: 'radial-gradient(rgba(108,92,231,0.25) 1px, transparent 1px)', backgroundSize: '14px 14px',
      }} />
      {pins.map((p, i) => (
        <motion.div
          key={i}
          className="absolute -translate-x-1/2 -translate-y-full cursor-pointer"
          style={{ top: p.top, left: p.left }}
          initial={{ opacity: 0, y: -8, scale: 0.7 }}
          whileInView={{ opacity: 1, y: 0, scale: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.3 + i * 0.15, type: 'spring', stiffness: 300, damping: 15 }}
          onMouseEnter={() => setHoverIdx(i)}
          onMouseLeave={() => setHoverIdx(null)}
          whileHover={{ scale: 1.15 }}
        >
          <svg width="22" height="28" viewBox="0 0 24 30" fill="none">
            <path d="M12 0C5.4 0 0 5.4 0 12c0 9 12 18 12 18s12-9 12-18c0-6.6-5.4-12-12-12z" fill={VIOLET} />
            <circle cx="12" cy="12" r="4.5" fill="#fff" />
          </svg>
          {hoverIdx === i && (
            <div
              className="absolute left-1/2 -translate-x-1/2 -top-8 rounded-lg px-2 py-1 text-[10px] font-semibold whitespace-nowrap shadow-lg"
              style={{ backgroundColor: INK, color: '#fff' }}
            >
              {labels[i] ?? `Center ${i + 1}`}
            </div>
          )}
        </motion.div>
      ))}
    </div>
  );
}

/* ---------------- AI Assistant waveform ---------------- */
function AIWaveform() {
  return (
    <div className="flex items-end gap-0.5 h-8">
      {Array.from({ length: 28 }).map((_, i) => (
        <motion.span
          key={i}
          className="flex-1 rounded-full"
          style={{ backgroundColor: VIOLET_LIGHT, minHeight: 4 }}
          animate={{ height: [6, 10 + (i % 5) * 4, 6] }}
          transition={{ duration: 1.2 + (i % 3) * 0.3, repeat: Infinity, delay: i * 0.04 }}
        />
      ))}
    </div>
  );
}

/* ---------------- Hero with scroll-driven scooter ---------------- */
function AerysHero({ name, welcomeLabel }: { name: string; welcomeLabel: string }) {
  const { scrollY } = useScroll();
  const scooterScale = useTransform(scrollY, [0, 260], [1.08, 1]);
  const scooterY = useTransform(scrollY, [0, 260], [0, -6]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
      className="relative rounded-[24px] overflow-hidden mb-3.5 mt-1 flex items-center"
      style={{
        background: 'linear-gradient(120deg, #EEE9FF 0%, #E2DAFF 50%, #F2EFFF 100%)',
        height: 360,
      }}
    >
      <div className="absolute inset-0 opacity-[0.04]" style={{
        backgroundImage: 'radial-gradient(#6C5CE7 1px, transparent 1px)', backgroundSize: '22px 22px',
      }} />
      <motion.div
        className="absolute w-[440px] h-[440px] rounded-full"
        style={{ background: `radial-gradient(circle, ${VIOLET_LIGHT}55, transparent 70%)`, right: '12%', top: '-14%' }}
        animate={{ opacity: [0.5, 0.8, 0.5] }}
        transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
      />
      <div
        className="absolute w-[300px] h-[300px] rounded-full"
        style={{ background: `radial-gradient(circle, ${VIOLET}33, transparent 70%)`, left: '2%', bottom: '-16%' }}
      />
      <div
        className="absolute w-[220px] h-[220px] rounded-full"
        style={{ background: `radial-gradient(circle, ${VIOLET_LIGHT}44, transparent 70%)`, right: '38%', bottom: '-12%' }}
      />

      <div className="relative w-full flex flex-col lg:flex-row items-center justify-between px-8 sm:px-12 gap-4">
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15, duration: 0.6 }}>
          <p className="text-xs font-bold tracking-[0.15em] mb-3" style={{ color: VIOLET }}>{welcomeLabel}, {name.toUpperCase()}</p>
          <h1 className="text-2xl sm:text-[30px] font-extrabold leading-tight" style={{ color: INK }}>Here is the</h1>
          <h1 className="text-4xl sm:text-[50px] font-extrabold leading-none mb-5" style={{ color: INK }}>FUTURE</h1>
          <div className="flex items-center gap-4">
            <button className="px-6 py-2.5 rounded-xl text-sm font-semibold border-2 transition-transform hover:-translate-y-0.5" style={{ borderColor: VIOLET, color: VIOLET, backgroundColor: '#fff' }}>
              Pre-order
            </button>
            <button className="flex items-center gap-2 text-sm font-medium" style={{ color: INK }}>
              <span className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: '#fff', color: VIOLET }}>▶</span>
              Watch Video
            </button>
          </div>
          <div className="flex gap-1.5 mt-6">
            <span className="w-6 h-1.5 rounded-full" style={{ backgroundColor: VIOLET }} />
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: `${VIOLET}44` }} />
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: `${VIOLET}44` }} />
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 1.08 }}
          animate={{ opacity: 1 }}
          style={{ scale: scooterScale, y: scooterY }}
          transition={{ opacity: { delay: 0.2, duration: 0.8 } }}
          className="relative w-[300px] sm:w-[420px] shrink-0 self-end"
        >
          <motion.div
            animate={{ y: [0, -8, 0] }}
            transition={{ duration: 4.5, repeat: Infinity, ease: 'easeInOut' }}
          >
            <Image
              src="/hero-scooter.png"
              alt="AERYS scooter"
              width={600}
              height={600}
              className="object-contain w-full h-auto drop-shadow-2xl"
              priority
            />
          </motion.div>
          <div
            className="mx-auto rounded-full"
            style={{ width: '55%', height: 16, background: 'radial-gradient(ellipse, rgba(21,21,42,0.20), transparent 70%)', marginTop: -12 }}
          />
        </motion.div>

        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3, duration: 0.6 }} className="text-right lg:text-left">
          <h2 className="text-3xl font-extrabold" style={{ color: INK }}>EV-12</h2>
          <p className="text-sm mt-1" style={{ color: MUTED }}>Next Generation</p>
          <p className="text-sm mb-4" style={{ color: MUTED }}>Electric Mobility</p>
          <div className="inline-flex items-center gap-2.5 px-4 py-2.5 rounded-2xl" style={{ backgroundColor: '#fff' }}>
            <span className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: LAV, color: VIOLET }}>⚡</span>
            <div className="text-left">
              <p className="text-xs font-semibold" style={{ color: INK }}>Eco Friendly</p>
              <p className="text-[10px]" style={{ color: MUTED }}>Zero Emission</p>
            </div>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}

export default function Home() {
  const { data: session, status } = useSession();
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const role = (session?.user as any)?.role || '';
  const name = session?.user?.name || 'there';
  const { t } = useLanguage();

  useEffect(() => {
    fetch('/api/homepage-stats')
      .then((res) => res.json())
      .then((json) => { if (json.success) setStats(json.data); })
      .finally(() => setLoading(false));
  }, []);

  const sidebarFooter = (
    <div className="rounded-2xl p-4" style={{ background: `linear-gradient(135deg, ${LAV_PALE}, ${LAV})`, border: `1px solid ${BORDER}` }}>
      <p className="text-sm font-semibold mb-1" style={{ color: VIOLET }}>{t('aiAssistant')}</p>
      <p className="text-xs mb-3" style={{ color: MUTED }}>{t('aiAssistantDesc')}</p>
      <button className="w-full text-sm font-medium text-white rounded-xl py-2 flex items-center justify-center gap-1.5" style={{ background: `linear-gradient(135deg, ${VIOLET_LIGHT}, ${VIOLET})` }}>
        Start a chat →
      </button>
    </div>
  );

  return (
    <>
      <style jsx global>{`
        .page-bg {
          background-color: #FAFAFF;
          background-image:
            radial-gradient(circle at 15% 10%, rgba(108,92,231,0.06), transparent 40%),
            radial-gradient(circle at 90% 25%, rgba(108,92,231,0.04), transparent 35%);
        }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(14px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .fade-up { opacity: 0; animation: fadeUp 0.5s ease forwards; }
      `}</style>
      <ResponsiveLayout navItems={NAV} sidebarFooter={sidebarFooter}>
        <div className="page-bg -m-4 md:-m-6 p-4 md:p-6">

          {status === 'unauthenticated' && (
            <p className="mb-4"><Link href="/login" style={{ color: VIOLET }}>Log in</Link></p>
          )}

          <AerysHero name={name} welcomeLabel={t('welcomeBack')} />

          {/* 5 KPI cards */}
          <motion.div
            className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4 mb-5"
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: '-60px' }}
            variants={{ hidden: {}, show: { transition: { staggerChildren: 0.1 } } }}
          >
            {[
              { label: t('totalVehicles'), value: stats?.totalVehicles, icon: 'M3 13l1.5-4.5A2 2 0 016.4 7h11.2a2 2 0 011.9 1.5L21 13M2.5 13h19v6h-19z' },
              { label: t('activeJobs'), value: stats?.activeJobs, icon: 'M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z M14 2v6h6' },
              { label: t('pendingJobs'), value: stats?.pendingJobs, icon: 'M12 8v4l3 3M12 22a10 10 0 100-20 10 10 0 000 20z' },
              { label: t('slaBreaches'), value: stats?.slaBreached, icon: 'M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0zM12 9v4M12 17h.01' },
              { label: t('completedToday'), value: stats?.completedToday, icon: 'M20 6L9 17l-5-5' },
            ].map((c) => (
              <motion.div
                key={c.label}
                variants={{ hidden: { opacity: 0, y: 25, scale: 0.97 }, show: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] } } }}
                className="group relative rounded-[16px] p-5 border overflow-hidden transition-all duration-200"
                style={{ borderColor: BORDER, boxShadow: CARD_SHADOW, backgroundColor: '#fff' }}
                onMouseEnter={(e) => { e.currentTarget.style.boxShadow = CARD_SHADOW_HOVER; e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.borderColor = `${VIOLET}55`; }}
                onMouseLeave={(e) => { e.currentTarget.style.boxShadow = CARD_SHADOW; e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.borderColor = BORDER; }}
              >
                <span className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 mb-3 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-6" style={{ backgroundColor: LAV }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke={VIOLET} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                    <path d={c.icon} />
                  </svg>
                </span>
                <p className="text-xs font-medium mb-1" style={{ color: MUTED }}>{c.label}</p>
                <p className="text-2xl font-extrabold tabular-nums tracking-tight mb-2" style={{ color: INK }}>
                  {loading ? '—' : <CountUp value={c.value ?? 0} />}
                </p>
                <SparkLine color={VIOLET} />
              </motion.div>
            ))}
          </motion.div>

          {/* Fleet Overview | Recent Activity | Quick Actions */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-5">
            <div className="rounded-[16px] p-6 bg-white border fade-up" style={{ borderColor: BORDER, boxShadow: CARD_SHADOW }}>
              <p className="text-[15px] font-bold mb-4" style={{ color: INK }}>{t('vehicleOverview')}</p>
              <div className="flex items-center gap-6 flex-wrap">
                <DonutChart
                  total={stats?.totalVehicles ?? 0}
                  active={stats?.activeJobs ?? 0}
                  inService={Math.max((stats?.totalVehicles ?? 0) - (stats?.activeJobs ?? 0) - (stats?.pendingJobs ?? 0), 0)}
                  inactive={stats?.pendingJobs ?? 0}
                />
                <div className="space-y-3 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: VIOLET }} />
                    <span style={{ color: MUTED }}>{t('active')}</span>
                    <span className="font-semibold ml-2" style={{ color: INK }}>{stats?.activeJobs ?? 0}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: VIOLET_LIGHT }} />
                    <span style={{ color: MUTED }}>{t('inService')}</span>
                    <span className="font-semibold ml-2" style={{ color: INK }}>{Math.max((stats?.totalVehicles ?? 0) - (stats?.activeJobs ?? 0) - (stats?.pendingJobs ?? 0), 0)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: '#D9D3FF' }} />
                    <span style={{ color: MUTED }}>{t('inactive')}</span>
                    <span className="font-semibold ml-2" style={{ color: INK }}>{stats?.pendingJobs ?? 0}</span>
                  </div>
                </div>
              </div>
              <Link href="/vehicles" className="text-xs font-semibold mt-5 inline-flex items-center gap-1" style={{ color: VIOLET }}>{t('viewFullReport')}</Link>
            </div>

            <div className="rounded-[16px] p-6 bg-white border fade-up" style={{ borderColor: BORDER, boxShadow: CARD_SHADOW }}>
              <p className="text-[15px] font-bold mb-4" style={{ color: INK }}>{t('recentActivity')}</p>
              <div className="relative">
                {stats?.recentActivity?.length ? (
                  <div className="space-y-4">
                    {stats.recentActivity.slice(0, 5).map((a: any, i: number) => {
                      const meta = ACTIVITY_ICONS[a.type] ?? ACTIVITY_ICONS.job_card;
                      const labelKey = ACTIVITY_LABEL_KEY[a.type];
                      return (
                        <motion.div
                          key={i}
                          initial={{ opacity: 0, x: -10 }}
                          whileInView={{ opacity: 1, x: 0 }}
                          viewport={{ once: true }}
                          transition={{ delay: i * 0.08, duration: 0.4 }}
                          className="flex items-center gap-3 text-xs"
                        >
                          <span className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: meta.bg }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={meta.color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                              <path d={meta.icon} />
                            </svg>
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold truncate" style={{ color: INK }}>{labelKey ? t(labelKey) : 'Activity'}</p>
                            <p className="truncate" style={{ color: MUTED }}>{a.ref}</p>
                          </div>
                          <span className="shrink-0" style={{ color: MUTED }}>{timeAgo(a.ts)}</span>
                        </motion.div>
                      );
                    })}
                  </div>
                ) : <p className="text-xs" style={{ color: MUTED }}>{t('noRecentActivity')}</p>}
              </div>
            </div>

            <div className="rounded-[16px] p-6 bg-white border fade-up" style={{ borderColor: BORDER, boxShadow: CARD_SHADOW }}>
              <p className="text-[15px] font-bold mb-4" style={{ color: INK }}>{t('quickActions')}</p>
              <div className="space-y-3">
                {[
                  ...(role === 'customer'
                    ? [{ label: t('viewMyVehicles'), desc: t('viewMyVehiclesDesc'), href: '/vehicles' }]
                    : role === 'technician'
                    ? [{ label: t('viewMyJobs'), desc: t('viewMyJobsDesc'), href: '/jobcards' }]
                    : [{ label: t('registerNewVehicle'), desc: t('registerNewVehicleDesc'), href: '/vehicles' }]),
                  { label: t('createJobCard'), desc: t('createJobCardDesc'), href: '/jobcards' },
                  ...(role === 'technician' ? [] : [{ label: t('addComplaint'), desc: t('addComplaintDesc'), href: '/jobcards' }]),
                  { label: t('newWarrantyClaim'), desc: t('newWarrantyClaimDesc'), href: '/warranty-claims' },
                ].map((a, idx2) => (
                  <Link key={a.label} href={a.href}
                    className="group relative flex items-center gap-3 p-3.5 rounded-xl transition-all duration-200 overflow-hidden"
                    style={{ backgroundColor: LAV_PALE }}
                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = LAV; }}
                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = LAV_PALE; }}
                  >
                    <span className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 transition-transform group-hover:scale-105" style={{ backgroundColor: '#fff' }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={VIOLET} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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

          {/* Fleet Performance | Service Centers | AI Assistant */}
          <div className="grid grid-cols-1 xl:grid-cols-[1.4fr_1fr_0.9fr] gap-4 mb-5">
            <div className="rounded-[16px] p-6 bg-white border fade-up" style={{ borderColor: BORDER, boxShadow: CARD_SHADOW }}>
              <p className="text-[15px] font-bold mb-4" style={{ color: INK }}>{t('vehiclePerformance')}</p>
              <FleetPerformanceChart trend={stats?.jobsToday !== undefined ? (stats?.jobsTrend ?? []) : []} />
            </div>

            <div className="rounded-[16px] p-6 bg-white border fade-up" style={{ borderColor: BORDER, boxShadow: CARD_SHADOW }}>
              <p className="text-[15px] font-bold mb-4" style={{ color: INK }}>{t('serviceCenters')}</p>
              <ServiceCentersMap centers={stats?.dealerLeaderboard?.length ?? 0} />
              <div className="flex items-center justify-between text-sm">
                <div>
                  <p className="text-xl font-extrabold" style={{ color: INK }}><CountUp value={stats?.dealerLeaderboard?.length ?? 0} /></p>
                  <p className="text-[10px]" style={{ color: MUTED }}>{t('totalCenters')}</p>
                </div>
                <div>
                  <p className="text-xl font-extrabold" style={{ color: INK }}><CountUp value={stats?.activeJobs ?? 0} /></p>
                  <p className="text-[10px]" style={{ color: MUTED }}>{t('activeToday')}</p>
                </div>
              </div>
            </div>

            <div className="rounded-[16px] p-6 fade-up" style={{ backgroundColor: LAV, boxShadow: CARD_SHADOW }}>
              <p className="text-[15px] font-bold mb-2" style={{ color: VIOLET }}>{t('aiAssistant')}</p>
              <p className="text-xs mb-4" style={{ color: MUTED }}>{t('aiAssistantDesc')}</p>
              <AIWaveform />
            </div>
          </div>

          {/* Dealer leaderboard (below primary layout) */}
          {(role === 'super_admin' || role === 'dealer') && stats?.dealerLeaderboard?.length > 0 && (
            <div className="rounded-[16px] p-6 bg-white border fade-up mb-4" style={{ borderColor: BORDER, boxShadow: CARD_SHADOW }}>
              <p className="text-[15px] font-bold mb-4" style={{ color: INK }}>{t('dealerLeaderboard')}</p>
              <div className="space-y-4">
                {stats.dealerLeaderboard.map((d: any, i: number) => {
                  const max = Math.max(...stats.dealerLeaderboard.map((x: any) => x.jobs), 1);
                  const rankColor = i === 0 ? AMBER : i === 1 ? MUTED : i === 2 ? '#B08D57' : VIOLET;
                  return (
                    <div
                      key={d.dealer_name}
                      className="flex items-center gap-4 p-3 rounded-2xl transition-all duration-200 hover:-translate-y-0.5"
                      style={{ border: `1px solid ${BORDER}` }}
                      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = LAV_PALE; }}
                      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                    >
                      <span className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0 text-white" style={{ background: `linear-gradient(135deg, ${rankColor}, ${rankColor}CC)` }}>
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

          {/* Announcements */}
          <div className="rounded-[16px] p-6 bg-white border mb-4" style={{ borderColor: BORDER, boxShadow: CARD_SHADOW }}>
            <p className="text-[15px] font-bold mb-4" style={{ color: INK }}>{t('announcements')}</p>
            <div className="flex flex-wrap gap-6">
              {[
                { text: t('announcement1') },
                { text: t('announcement2') },
                { text: t('announcement3') },
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
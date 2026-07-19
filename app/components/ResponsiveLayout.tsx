'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import { ROLE_ACCESS } from '@/app/lib/role-access';
import { useLanguage } from '@/app/lib/LanguageContext';
import { TechnicianLocationSender } from '@/app/components/TechnicianLocationSender';
import { SOSButton } from '@/app/components/SOSButton';
import { SOSAlertsBanner } from '@/app/components/SOSAlertsBanner';

const VIOLET = '#6C5CE7';
const VIOLET_LIGHT = '#8B7CF8';
const VIOLET_DIM = 'rgba(108,92,231,0.10)';
const BORDER = 'rgba(30,20,60,0.07)';
const MUTED = '#6B7280';
const INK = '#1A1A2E';
const CARD_SHADOW = '0 1px 2px rgba(20,10,50,0.04), 0 8px 24px -12px rgba(20,10,50,0.08)';

const NAV_ICONS: Record<string, string> = {
  '/': 'M3 11.5L12 4l9 7.5M5 10v10h5v-6h4v6h5V10',
  '/vehicles': 'M3 13l1.5-4.5A2 2 0 016.4 7h11.2a2 2 0 011.9 1.5L21 13M2.5 13h19v6h-19zM7 19v1M17 19v1M6 16h.01M18 16h.01',
  '/jobcards': 'M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8zM14 2v6h6M9 13h6M9 17h6M9 9h1',
  '/dashboard': 'M4 19h16M6 19V9m6 10V5m6 14v-7',
  '/warranty-claims': 'M12 2l8 3v6c0 5-3.5 9-8 11-4.5-2-8-6-8-11V5z',
  '/dealers': 'M3 21h18M5 21V9l7-5 7 5v12M9 21v-6h6v6',
  '/technicians': 'M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM22 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75',
  '/inventory': 'M3 7l9-4 9 4-9 4-9-4zM3 7v10l9 4 9-4V7M12 11v10',
  '/analytics': 'M4 19V5m5 14V9m5 10V3m5 16v-8',
  '/settings': 'M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.7 1.7 0 00.34 1.87l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.7 1.7 0 00-1.87-.34 1.7 1.7 0 00-1.03 1.56V21a2 2 0 11-4 0v-.09A1.7 1.7 0 008 19.35a1.7 1.7 0 00-1.87.34l-.06.06a2 2 0 11-2.83-2.83l.06-.06A1.7 1.7 0 003.65 15 1.7 1.7 0 002.09 14H2a2 2 0 110-4h.09A1.7 1.7 0 003.65 9a1.7 1.7 0 00-.34-1.87l-.06-.06a2 2 0 112.83-2.83l.06.06A1.7 1.7 0 007 4.65 1.7 1.7 0 008.03 3.1V3a2 2 0 114 0v.09c0 .69.4 1.32 1.03 1.56.6.24 1.3.12 1.87-.34l.06-.06a2 2 0 112.83 2.83l-.06.06A1.7 1.7 0 0015.35 9c.24.6.87 1 1.56 1H21a2 2 0 110 4h-.09c-.69 0-1.32.4-1.56 1.03z',
};

export interface NavItem {
  label: string;
  href: string;
  active?: boolean;
}

interface ResponsiveLayoutProps {
  navItems: NavItem[];
  children: React.ReactNode;
  sidebarFooter?: React.ReactNode;
}

export function ResponsiveLayout({ navItems, children, sidebarFooter }: ResponsiveLayoutProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [isMailOpen, setIsMailOpen] = useState(false);
  const [isUserOpen, setIsUserOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const mailRef = useRef<HTMLDivElement>(null);
  const userRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const { data: session } = useSession();
  const user = session?.user as { role?: string; name?: string } | undefined;
  const role = user?.role || '';
  const { lang, setLang, t } = useLanguage();

  const allowedNav = navItems.filter((item) =>
    ROLE_ACCESS[role]?.some((p) => (p === '/' ? item.href === '/' : item.href.startsWith(p)))
  );

  const closeSidebar = () => setIsSidebarOpen(false);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setIsNotifOpen(false);
      if (mailRef.current && !mailRef.current.contains(e.target as Node)) setIsMailOpen(false);
      if (userRef.current && !userRef.current.contains(e.target as Node)) setIsUserOpen(false);
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setIsSearchFocused(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const searchResults = searchQuery.trim()
    ? allowedNav.filter((item) => item.label.toLowerCase().includes(searchQuery.trim().toLowerCase()))
    : [];

  function goToResult(href: string) {
    router.push(href);
    setSearchQuery('');
    setIsSearchFocused(false);
  }

  const NOTIFICATIONS = [
    { title: 'Low stock alert', body: 'Battery pack running low at Bhopal Central', time: '10m ago' },
    { title: 'New warranty claim', body: 'Claim #WC-1042 submitted for review', time: '1h ago' },
    { title: 'Job card completed', body: 'JC-2291 marked as resolved', time: '3h ago' },
  ];
  const MESSAGES = [
    { from: 'Ravi (Dealer - Indore)', body: 'Need approval on part order #4521', time: '25m ago' },
    { from: 'System', body: 'Weekly performance report is ready', time: '2h ago' },
    { from: 'Priya (Support)', body: 'Customer follow-up needed on JC-2287', time: '5h ago' },
    { from: 'System', body: 'Dealer onboarding request pending', time: '1d ago' },
    { from: 'Amit (Technician)', body: 'Uploaded photos for warranty claim', time: '1d ago' },
  ];

  return (
    <div className="flex h-screen bg-white overflow-hidden">
      {/* Mobile hamburger button */}
      <button
        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
        className="fixed md:hidden top-4 left-4 z-40 p-2 rounded-lg hover:bg-gray-100"
        style={{ color: VIOLET }}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 6h18M3 12h18M3 18h18" />
        </svg>
      </button>

      {/* Mobile overlay */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 md:hidden z-20"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed md:relative md:z-auto
          left-0 top-0 h-screen w-[260px]
          border-r flex flex-col px-3.5 py-6
          bg-white overflow-y-auto
          transition-transform duration-300 ease-in-out
          z-30
          ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}
        style={{ borderColor: BORDER, boxShadow: '2px 0 16px -8px rgba(20,10,50,0.05)' }}
      >
        {/* Logo/Header */}
        <div className="flex items-center justify-between mb-5 px-2">
          <Link href="/" onClick={closeSidebar} className="flex items-center justify-center flex-1 h-14 overflow-hidden">
            <img src="/aerys-logo.png" alt="AERYS" className="h-14 w-auto object-contain scale-[2.2] origin-center" />
          </Link>
          
          {/* Close button for mobile */}
          <button
            onClick={() => setIsSidebarOpen(false)}
            className="md:hidden p-1 hover:bg-gray-100 rounded"
            style={{ color: VIOLET }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1.5">
          {allowedNav.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              onClick={closeSidebar}
              className="group flex items-center gap-2.5 px-3 py-2 rounded-xl text-[13px] relative transition-all duration-200"
              style={
                item.active
                  ? { backgroundColor: '#F0EDFF', color: VIOLET, fontWeight: 700 }
                  : { color: MUTED }
              }
              onMouseEnter={(e) => { if (!item.active) { e.currentTarget.style.backgroundColor = VIOLET_DIM; e.currentTarget.style.color = VIOLET; e.currentTarget.style.transform = 'translateX(2px)'; } }}
              onMouseLeave={(e) => { if (!item.active) { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = MUTED; e.currentTarget.style.transform = 'translateX(0)'; } }}
            >
              {item.active && (
                <span
                  className="absolute -left-3.5 top-1/2 -translate-y-1/2 w-1 h-6 rounded-full transition-all duration-300"
                  style={{ backgroundColor: VIOLET }}
                />
              )}
              <svg
                width="18" height="18" viewBox="0 0 24 24" fill="none"
                stroke={item.active ? VIOLET : 'currentColor'} strokeWidth="1.8"
                strokeLinecap="round" strokeLinejoin="round" className="shrink-0 transition-transform duration-200 group-hover:scale-110"
              >
                <path d={NAV_ICONS[item.href] ?? NAV_ICONS['/settings']} />
              </svg>
              {(item as any).key ? t((item as any).key) : item.label}
            </Link>
          ))}
        </nav>

        <div className="px-2 mb-2">
          <div className="flex rounded-xl overflow-hidden border" style={{ borderColor: BORDER }}>
            <button
              onClick={() => setLang('en')}
              className="flex-1 text-xs font-semibold py-1.5 transition-colors"
              style={lang === 'en' ? { backgroundColor: VIOLET, color: '#fff' } : { color: MUTED }}
            >
              EN
            </button>
            <button
              onClick={() => setLang('hi')}
              className="flex-1 text-xs font-semibold py-1.5 transition-colors"
              style={lang === 'hi' ? { backgroundColor: VIOLET, color: '#fff' } : { color: MUTED }}
            >
              हिं
            </button>
          </div>
        </div>

        {role === 'technician' && (
          <div className="px-2 mb-2">
            <TechnicianLocationSender />
          </div>
        )}

        {/* Sidebar footer content */}
        {sidebarFooter && <div className="mt-4">{sidebarFooter}</div>}

        {/* Admin profile block */}
        <div className="mt-4 pt-4 border-t" style={{ borderColor: BORDER }}>
          <div className="flex items-center gap-2.5 px-2 py-2 rounded-xl">
            <span
              className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold text-white shrink-0"
              style={{ background: `linear-gradient(135deg, ${VIOLET_LIGHT}, ${VIOLET})` }}
            >
              {(user?.name || 'A').charAt(0).toUpperCase()}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate" style={{ color: INK }}>{user?.name || 'Admin User'}</p>
              <p className="text-[11px] truncate capitalize" style={{ color: MUTED }}>{(role || 'super_admin').replace('_', ' ')}</p>
            </div>
            <button
              onClick={() => { signOut({ redirectTo: '/login' }); closeSidebar(); }}
              title="Sign out"
              className="shrink-0 w-7 h-7 rounded-lg flex items-center justify-center transition-colors hover:bg-[rgba(226,75,74,0.08)]"
              style={{ color: MUTED }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" />
              </svg>
            </button>
          </div>
        </div>
      </aside>

      {/* Main content area */}
      <main className="flex-1 min-w-0 overflow-auto pt-20 md:pt-0 flex flex-col">
        {/* Top bar */}
        <div
          className="hidden md:flex items-center justify-between gap-4 px-6 sticky top-0 z-10 mx-7 mt-4 rounded-2xl"
          style={{
            height: 68,
            background: '#fff',
            border: 'none',
            boxShadow: '0 2px 10px -4px rgba(20,10,50,0.08)',
          }}
        >
          <div className="relative" style={{ flex: '0 0 350px', maxWidth: 350 }} ref={searchRef}>
            <svg
              width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={MUTED} strokeWidth="2"
              className="absolute left-4 top-1/2 -translate-y-1/2"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="M21 21l-4.3-4.3" />
            </svg>
            <input
              placeholder="Search anything..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setIsSearchFocused(true)}
              onKeyDown={(e) => { if (e.key === 'Enter' && searchResults.length > 0) goToResult(searchResults[0].href); }}
              className="w-full rounded-full pl-11 pr-14 py-2.5 text-sm outline-none border transition-all focus:shadow-sm"
              style={{ borderColor: BORDER, color: INK, backgroundColor: '#fff' }}
            />
            {!searchQuery && (
              <span
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-semibold px-1.5 py-0.5 rounded-md"
                style={{ backgroundColor: VIOLET_DIM, color: VIOLET }}
              >
                ⌘K
              </span>
            )}
            {isSearchFocused && searchQuery.trim() && (
              <div
                className="absolute left-0 right-0 top-full mt-2 rounded-2xl border bg-white overflow-hidden z-20"
                style={{ borderColor: BORDER, boxShadow: CARD_SHADOW }}
              >
                {searchResults.length > 0 ? (
                  searchResults.map((item) => (
                    <button
                      key={item.href}
                      onClick={() => goToResult(item.href)}
                      className="w-full text-left px-4 py-2.5 text-sm transition-colors hover:bg-[rgba(108,92,231,0.06)]"
                      style={{ color: INK }}
                    >
                      {item.label}
                    </button>
                  ))
                ) : (
                  <p className="px-4 py-3 text-sm" style={{ color: MUTED }}>No pages match "{searchQuery}"</p>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center gap-5 shrink-0 ml-auto">
            <div className="relative" ref={notifRef}>
              <button
                onClick={() => { setIsNotifOpen((v) => !v); setIsMailOpen(false); setIsUserOpen(false); }}
                className="relative w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200 hover:-translate-y-0.5"
                style={{ color: MUTED, backgroundColor: VIOLET_DIM, border: `1px solid ${BORDER}` }}
                onMouseEnter={(e) => { e.currentTarget.style.boxShadow = `0 6px 16px -6px ${VIOLET}55`; }}
                onMouseLeave={(e) => { e.currentTarget.style.boxShadow = 'none'; }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={VIOLET} strokeWidth="1.8">
                  <path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0" />
                </svg>
                <span
                  className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full text-[9px] text-white flex items-center justify-center font-semibold"
                  style={{ backgroundColor: '#E24B4A' }}
                >
                  {NOTIFICATIONS.length}
                </span>
              </button>
              {isNotifOpen && (
                <div
                  className="absolute right-0 top-full mt-2 w-80 rounded-2xl border bg-white overflow-hidden z-20"
                  style={{ borderColor: BORDER, boxShadow: CARD_SHADOW }}
                >
                  <div className="px-4 py-3 border-b" style={{ borderColor: BORDER }}>
                    <p className="text-sm font-semibold" style={{ color: INK }}>Notifications</p>
                  </div>
                  {NOTIFICATIONS.map((n, i) => (
                    <div key={i} className="px-4 py-3 border-b last:border-b-0 transition-colors hover:bg-[rgba(108,92,231,0.04)]" style={{ borderColor: BORDER }}>
                      <div className="flex items-center justify-between mb-0.5">
                        <p className="text-sm font-semibold" style={{ color: INK }}>{n.title}</p>
                        <span className="text-[10px]" style={{ color: MUTED }}>{n.time}</span>
                      </div>
                      <p className="text-xs" style={{ color: MUTED }}>{n.body}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="relative" ref={mailRef}>
              <button
                onClick={() => { setIsMailOpen((v) => !v); setIsNotifOpen(false); setIsUserOpen(false); }}
                className="relative w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200 hover:-translate-y-0.5"
                style={{ color: MUTED, backgroundColor: VIOLET_DIM, border: `1px solid ${BORDER}` }}
                onMouseEnter={(e) => { e.currentTarget.style.boxShadow = `0 6px 16px -6px ${VIOLET}55`; }}
                onMouseLeave={(e) => { e.currentTarget.style.boxShadow = 'none'; }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={VIOLET} strokeWidth="1.8">
                  <rect x="2" y="4" width="20" height="16" rx="2" />
                  <path d="M2 6l10 7 10-7" />
                </svg>
                <span
                  className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full text-[9px] text-white flex items-center justify-center font-semibold"
                  style={{ backgroundColor: '#E24B4A' }}
                >
                  {MESSAGES.length}
                </span>
              </button>
              {isMailOpen && (
                <div
                  className="absolute right-0 top-full mt-2 w-80 rounded-2xl border bg-white overflow-hidden z-20 max-h-96 overflow-y-auto"
                  style={{ borderColor: BORDER, boxShadow: CARD_SHADOW }}
                >
                  <div className="px-4 py-3 border-b sticky top-0 bg-white" style={{ borderColor: BORDER }}>
                    <p className="text-sm font-semibold" style={{ color: INK }}>Messages</p>
                  </div>
                  {MESSAGES.map((m, i) => (
                    <div key={i} className="px-4 py-3 border-b last:border-b-0 transition-colors hover:bg-[rgba(108,92,231,0.04)]" style={{ borderColor: BORDER }}>
                      <div className="flex items-center justify-between mb-0.5">
                        <p className="text-sm font-semibold" style={{ color: INK }}>{m.from}</p>
                        <span className="text-[10px]" style={{ color: MUTED }}>{m.time}</span>
                      </div>
                      <p className="text-xs" style={{ color: MUTED }}>{m.body}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="relative" ref={userRef}>
              <div
                onClick={() => { setIsUserOpen((v) => !v); setIsNotifOpen(false); setIsMailOpen(false); }}
                className="flex items-center gap-2.5 pl-2 pr-3 py-1.5 rounded-full transition-all duration-200 cursor-pointer hover:-translate-y-0.5"
                style={{ backgroundColor: VIOLET_DIM, border: `1px solid ${BORDER}` }}
              >
                <span
                  className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold text-white"
                  style={{ background: `linear-gradient(135deg, ${VIOLET_LIGHT}, ${VIOLET})`, boxShadow: `0 4px 10px -3px ${VIOLET}88` }}
                >
                  {(user?.name || 'A').charAt(0).toUpperCase()}
                </span>
                <div className="leading-tight">
                  <p className="text-sm font-semibold" style={{ color: INK }}>{user?.name || 'Admin User'}</p>
                  <p className="text-[11px]" style={{ color: MUTED }}>{role || 'super_admin'}</p>
                </div>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={MUTED} strokeWidth="2" style={{ transform: isUserOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </div>
              {isUserOpen && (
                <div
                  className="absolute right-0 top-full mt-2 w-52 rounded-2xl border bg-white overflow-hidden z-20"
                  style={{ borderColor: BORDER, boxShadow: CARD_SHADOW }}
                >
                  <Link href="/settings" onClick={() => setIsUserOpen(false)} className="block px-4 py-2.5 text-sm transition-colors hover:bg-[rgba(108,92,231,0.06)]" style={{ color: INK }}>
                    Account settings
                  </Link>
                  <button
                    onClick={() => signOut({ redirectTo: '/login' })}
                    className="w-full text-left px-4 py-2.5 text-sm transition-colors hover:bg-[rgba(226,75,74,0.06)]"
                    style={{ color: '#E24B4A' }}
                  >
                    Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="px-4 md:px-6 pb-4 pt-4 md:pt-6 flex-1">
          {(role === 'dealer' || role === 'super_admin') && <SOSAlertsBanner />}
          {children}
        </div>
        {(role === 'technician' || role === 'customer') && <SOSButton />}
      </main>
    </div>
  );
}

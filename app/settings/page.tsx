'use client';

import { useState, useEffect } from 'react';
import { ResponsiveLayout } from '@/app/components/ResponsiveLayout';
import { NAV_ITEMS } from '@/app/lib/nav-items';
import Link from 'next/link';

const VIOLET = '#6C5CE7';
const VIOLET_LIGHT = '#8B7CF8';
const VIOLET_DIM = 'rgba(108,92,231,0.10)';
const CARD_SHADOW = '0 1px 2px rgba(20,10,50,0.04), 0 8px 24px -12px rgba(20,10,50,0.08)';
const CARD_SHADOW_HOVER = '0 4px 12px rgba(20,10,50,0.06), 0 16px 36px -12px rgba(108,92,231,0.18)';
const BORDER = 'rgba(30,20,60,0.07)';
const MUTED = '#6B7280';
const INK = '#1A1A2E';
const GREEN = '#22C55E';
const RED = '#EF4444';

const NAV = NAV_ITEMS.map((item) => ({ ...item, active: item.href === '/settings' }));

type User = {
  user_id: number;
  full_name: string;
  phone: string;
  email: string | null;
  role: 'super_admin' | 'dealer' | 'technician' | 'customer';
  is_active: number;
  created_at: string;
};

const TABS = ['General', 'Users & Roles', 'Notifications', 'Security', 'Integrations', 'System'];
const ROLE_OPTIONS = ['super_admin', 'dealer', 'technician', 'customer'];

export default function SettingsPage() {
  const [tab, setTab] = useState('General');
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwSubmitting, setPwSubmitting] = useState(false);
  const [pwMessage, setPwMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (tab === 'Users & Roles') fetchUsers();
  }, [tab, search]);

  async function fetchUsers() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      const res = await fetch(`/api/users?${params}`);
      const json = await res.json();
      if (json.success) setUsers(json.data);
    } finally {
      setLoading(false);
    }
  }

  async function toggleActive(u: User) {
    await fetch('/api/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: u.user_id, isActive: u.is_active ? 0 : 1 }),
    });
    fetchUsers();
  }

  async function changeRole(u: User, newRole: string) {
    await fetch('/api/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: u.user_id, role: newRole }),
    });
    fetchUsers();
  }
  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setPwMessage(null);

    if (newPassword !== confirmPassword) {
      setPwMessage({ type: 'error', text: 'New password and confirmation do not match' });
      return;
    }

    setPwSubmitting(true);
    try {
      const res = await fetch('/api/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const json = await res.json();

      if (json.success) {
        setPwMessage({ type: 'success', text: 'Password updated successfully' });
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        setPwMessage({ type: 'error', text: json.error || 'Failed to update password' });
      }
    } catch (err) {
      setPwMessage({ type: 'error', text: 'Network error — try again' });
    } finally {
      setPwSubmitting(false);
    }
  }

  const inputStyle = { border: `1px solid ${BORDER}`, backgroundColor: '#fff', color: INK };
  const disabledInputStyle = { ...inputStyle, backgroundColor: '#F5F5F8', color: MUTED };

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
    <ResponsiveLayout navItems={NAV}>
      <div className="page-bg -m-4 md:-m-6 p-4 md:p-6">

        <div className="flex items-center gap-1.5 text-xs mb-4 fade-up" style={{ color: MUTED }}>
          <Link href="/" className="hover:underline">Home</Link> <span>›</span>
          <span className="font-semibold" style={{ color: VIOLET }}>Settings</span>
        </div>
        <div className="rounded-[20px] p-7 mb-6 fade-up" style={{ background: `linear-gradient(135deg, ${VIOLET_DIM}, rgba(245,166,35,0.05))`, border: `1px solid ${BORDER}`, boxShadow: CARD_SHADOW }}>
          <h1 className="text-[28px] font-extrabold tracking-tight" style={{ color: INK }}>Settings</h1>
          <p className="text-sm mt-2" style={{ color: MUTED }}>Manage your account, preferences and system configuration</p>
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap gap-3 sm:gap-6 border-b mb-6 fade-up" style={{ borderColor: BORDER }}>
          {TABS.map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className="pb-3 text-sm font-semibold transition-colors duration-150"
              style={{
                color: tab === t ? VIOLET : MUTED,
                borderBottom: tab === t ? `2px solid ${VIOLET}` : '2px solid transparent',
              }}>
              {t}
            </button>
          ))}
        </div>

        {tab === 'General' && (
          <div className="space-y-4">
            <div className="rounded-[20px] p-7 bg-white border fade-up" style={{ borderColor: BORDER, boxShadow: CARD_SHADOW }}>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                <p className="font-bold text-[15px]" style={{ color: INK }}>Company Profile</p>
                <span className="text-xs px-3 py-1 rounded-full" style={{ backgroundColor: 'rgba(245,166,35,0.12)', color: '#B7791F' }}>
                  Not connected — display only
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {['Company Name', 'Email', 'Phone', 'Address', 'City', 'State'].map((label) => (
                  <div key={label}>
                    <label className="block text-xs font-medium mb-1.5" style={{ color: INK }}>{label}</label>
                    <input disabled placeholder={label} className="w-full rounded-xl px-4 py-2.5 text-sm outline-none" style={disabledInputStyle} />
                  </div>
                ))}
              </div>
              <p className="text-xs mt-3" style={{ color: MUTED }}>
                These fields aren&apos;t backed by a database table yet — nothing typed here will save. Ask to add a company_settings table to make this real.
              </p>
            </div>
          </div>
        )}

        {tab === 'Users & Roles' && (
          <div className="rounded-[20px] bg-white border overflow-hidden fade-up" style={{ borderColor: BORDER, boxShadow: CARD_SHADOW }}>
            <div className="flex items-start sm:items-center justify-between gap-3 p-6 pb-3 flex-col sm:flex-row">
              <p className="font-bold text-[15px]" style={{ color: INK }}>All Users</p>
              <input
                placeholder="Search by name, email, or phone..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="focus-glow rounded-xl px-4 py-2 text-sm outline-none w-full sm:w-72 transition-all duration-150"
                style={inputStyle}
              />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left" style={{ color: MUTED }}>
                    {['Name', 'Phone', 'Email', 'Role', 'Status', 'Joined'].map((h) => (
                      <th key={h} className="px-5 py-2 font-medium text-xs">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.user_id} className="border-t transition-colors duration-150 hover:bg-[rgba(108,92,231,0.04)]" style={{ borderColor: BORDER }}>
                      <td className="px-5 py-3.5 font-semibold" style={{ color: INK }}>{u.full_name}</td>
                      <td className="px-5 py-3.5" style={{ color: MUTED }}>{u.phone}</td>
                      <td className="px-5 py-3.5" style={{ color: MUTED }}>{u.email || '-'}</td>
                      <td className="px-5 py-3.5">
                        <select value={u.role} onChange={(e) => changeRole(u, e.target.value)}
                          className="focus-glow text-xs rounded-lg px-2 py-1 outline-none transition-all duration-150" style={inputStyle}>
                          {ROLE_OPTIONS.map((r) => <option key={r} value={r}>{r.replace('_', ' ')}</option>)}
                        </select>
                      </td>
                      <td className="px-5 py-3.5">
                        <button onClick={() => toggleActive(u)}
                          className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full transition-transform hover:scale-105"
                          style={u.is_active
                            ? { backgroundColor: 'rgba(34,197,94,0.1)', color: GREEN }
                            : { backgroundColor: 'rgba(239,68,68,0.1)', color: RED }}>
                          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: u.is_active ? GREEN : RED }} />
                          {u.is_active ? 'Active' : 'Inactive'}
                        </button>
                      </td>
                      <td className="px-5 py-3.5" style={{ color: MUTED }}>
                        {new Date(u.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </td>
                    </tr>
                  ))}
                  {loading && (
                    <tr><td colSpan={6} className="px-5 py-8 text-center text-sm" style={{ color: MUTED }}>Loading users...</td></tr>
                  )}
                  {!loading && users.length === 0 && (
                    <tr><td colSpan={6} className="px-5 py-8 text-center text-sm" style={{ color: MUTED }}>No users found.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === 'Security' && (
          <div className="rounded-[20px] p-7 bg-white border max-w-md fade-up" style={{ borderColor: BORDER, boxShadow: CARD_SHADOW }}>
            <p className="font-bold text-[15px] mb-5" style={{ color: INK }}>Change Password</p>
            <form onSubmit={handleChangePassword} className="flex flex-col gap-3">
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: INK }}>Current Password *</label>
                <input required type="password" value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="focus-glow w-full rounded-xl px-4 py-2.5 text-sm outline-none transition-all duration-150"
                  style={inputStyle} />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: INK }}>New Password *</label>
                <input required type="password" minLength={8} value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="focus-glow w-full rounded-xl px-4 py-2.5 text-sm outline-none transition-all duration-150"
                  style={inputStyle} />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: INK }}>Confirm New Password *</label>
                <input required type="password" minLength={8} value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="focus-glow w-full rounded-xl px-4 py-2.5 text-sm outline-none transition-all duration-150"
                  style={inputStyle} />
              </div>

              {pwMessage && (
                <p className="text-xs font-medium" style={{ color: pwMessage.type === 'success' ? GREEN : RED }}>
                  {pwMessage.text}
                </p>
              )}

              <button type="submit" disabled={pwSubmitting}
                className="text-sm font-semibold text-white px-5 py-2.5 rounded-xl mt-1 disabled:opacity-50 transition-all duration-200 hover:-translate-y-0.5"
                style={{ background: `linear-gradient(135deg, ${VIOLET_LIGHT}, ${VIOLET})`, boxShadow: `0 6px 16px -6px ${VIOLET}66` }}>
                {pwSubmitting ? 'Updating...' : 'Update Password'}
              </button>
            </form>
          </div>
        )}

        {['Notifications', 'Integrations', 'System'].includes(tab) && (
          <div className="rounded-[20px] p-10 bg-white border text-center fade-up" style={{ borderColor: BORDER, boxShadow: CARD_SHADOW }}>
            <p className="font-bold mb-2" style={{ color: INK }}>{tab}</p>
            <p className="text-sm" style={{ color: MUTED }}>
              Nothing backs this tab yet — no notifications, integrations, or system-log tables exist in your DB.
              Tell me what you actually need here and I&apos;ll design the schema for it.
            </p>
          </div>
        )}
      </div>
    </ResponsiveLayout>
    </>
  );
}
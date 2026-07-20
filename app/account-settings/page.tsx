'use client';

import { useState, useEffect } from 'react';
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
const GREEN = '#22C55E';
const RED = '#EF4444';
const CARD_SHADOW = '0 1px 2px rgba(20,10,50,0.04), 0 8px 24px -12px rgba(20,10,50,0.08)';

const NAV = NAV_ITEMS.map((item) => ({ ...item, active: item.href === '/account-settings' }));

const ROLE_LABEL: Record<string, string> = {
  super_admin: 'Super Admin',
  dealer: 'Dealer',
  technician: 'Technician',
  customer: 'Customer',
};

export default function AccountSettingsPage() {
  const { data: session } = useSession();
  const role = (session?.user as any)?.role || '';

  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [form, setForm] = useState({ fullName: '', phone: '', email: '', dealerName: '', address: '' });

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwSubmitting, setPwSubmitting] = useState(false);
  const [pwMessage, setPwMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    fetchProfile();
  }, []);

  async function fetchProfile() {
    setLoading(true);
    try {
      const res = await fetch('/api/account');
      const json = await res.json();
      if (json.success) {
        setProfile(json.data);
        setForm({
          fullName: json.data.full_name || '',
          phone: json.data.phone || '',
          email: json.data.email || '',
          dealerName: json.data.dealer_name || '',
          address: json.data.address || '',
        });
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    setSaving(true);
    try {
      const res = await fetch('/api/account', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (json.success) {
        setMessage({ type: 'success', text: 'Profile updated successfully' });
        fetchProfile();
      } else {
        setMessage({ type: 'error', text: json.error || 'Failed to save' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Network error — try again' });
    } finally {
      setSaving(false);
    }
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
        setCurrentPassword(''); setNewPassword(''); setConfirmPassword('');
      } else {
        setPwMessage({ type: 'error', text: json.error || 'Failed to update password' });
      }
    } catch {
      setPwMessage({ type: 'error', text: 'Network error — try again' });
    } finally {
      setPwSubmitting(false);
    }
  }

  const inputStyle = { border: `1px solid ${BORDER}`, backgroundColor: '#fff', color: INK };

  return (
    <ResponsiveLayout navItems={NAV}>
      <div className="page-bg -m-4 md:-m-6 p-4 md:p-6">
        <div className="flex items-center gap-1.5 text-xs mb-4" style={{ color: MUTED }}>
          <Link href="/" className="hover:underline">Home</Link> <span>›</span>
          <span className="font-semibold" style={{ color: VIOLET }}>Account Settings</span>
        </div>

        <div className="rounded-[20px] p-7 mb-6" style={{ background: `linear-gradient(135deg, ${VIOLET_DIM}, rgba(245,166,35,0.05))`, border: `1px solid ${BORDER}`, boxShadow: CARD_SHADOW }}>
          <h1 className="text-[28px] font-extrabold tracking-tight" style={{ color: INK }}>Account Settings</h1>
          <p className="text-sm mt-2" style={{ color: MUTED }}>
            {ROLE_LABEL[role] || role} · Manage your personal details and password
          </p>
        </div>

        {loading ? (
          <p className="text-sm" style={{ color: MUTED }}>Loading...</p>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Profile card */}
            <form onSubmit={handleSave} className="rounded-[20px] p-7 bg-white border" style={{ borderColor: BORDER, boxShadow: CARD_SHADOW }}>
              <p className="font-bold text-[15px] mb-5" style={{ color: INK }}>My Details</p>

              <div className="flex flex-col gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: INK }}>Full Name *</label>
                  <input required value={form.fullName} onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
                    className="w-full rounded-xl px-4 py-2.5 text-sm outline-none" style={inputStyle} />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: INK }}>Phone *</label>
                  <input required value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                    className="w-full rounded-xl px-4 py-2.5 text-sm outline-none" style={inputStyle} />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: INK }}>Email</label>
                  <input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                    className="w-full rounded-xl px-4 py-2.5 text-sm outline-none" style={inputStyle} />
                </div>

                {role === 'dealer' && (
                  <>
                    <div>
                      <label className="block text-xs font-medium mb-1.5" style={{ color: INK }}>Dealer / Business Name</label>
                      <input value={form.dealerName} onChange={(e) => setForm((f) => ({ ...f, dealerName: e.target.value }))}
                        className="w-full rounded-xl px-4 py-2.5 text-sm outline-none" style={inputStyle} />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1.5" style={{ color: INK }}>Address</label>
                      <input value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                        className="w-full rounded-xl px-4 py-2.5 text-sm outline-none" style={inputStyle} />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1.5" style={{ color: INK }}>City</label>
                      <input disabled value={profile?.city_name || ''} className="w-full rounded-xl px-4 py-2.5 text-sm outline-none" style={{ ...inputStyle, backgroundColor: '#F5F5F8', color: MUTED }} />
                    </div>
                  </>
                )}

                {role === 'technician' && (
                  <div>
                    <label className="block text-xs font-medium mb-1.5" style={{ color: INK }}>Dealer / Service Centre</label>
                    <input disabled value={profile?.dealer_name || ''} className="w-full rounded-xl px-4 py-2.5 text-sm outline-none" style={{ ...inputStyle, backgroundColor: '#F5F5F8', color: MUTED }} />
                    <p className="text-[11px] mt-1" style={{ color: MUTED }}>Assigned by your dealer — contact them to change this.</p>
                  </div>
                )}

                {role === 'customer' && (
                  <div>
                    <label className="block text-xs font-medium mb-1.5" style={{ color: INK }}>Address</label>
                    <input value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                      className="w-full rounded-xl px-4 py-2.5 text-sm outline-none" style={inputStyle} />
                  </div>
                )}

                {message && (
                  <p className="text-xs font-medium" style={{ color: message.type === 'success' ? GREEN : RED }}>{message.text}</p>
                )}

                <button type="submit" disabled={saving}
                  className="text-sm font-semibold text-white px-5 py-2.5 rounded-xl mt-1 disabled:opacity-50"
                  style={{ background: `linear-gradient(135deg, ${VIOLET_LIGHT}, ${VIOLET})` }}>
                  {saving ? 'Saving...' : 'Save changes'}
                </button>
              </div>
            </form>

            {/* Password card */}
            <div className="rounded-[20px] p-7 bg-white border" style={{ borderColor: BORDER, boxShadow: CARD_SHADOW }}>
              <p className="font-bold text-[15px] mb-5" style={{ color: INK }}>Change Password</p>
              <form onSubmit={handleChangePassword} className="flex flex-col gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: INK }}>Current Password *</label>
                  <input required type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)}
                    className="w-full rounded-xl px-4 py-2.5 text-sm outline-none" style={inputStyle} />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: INK }}>New Password *</label>
                  <input required type="password" minLength={8} value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full rounded-xl px-4 py-2.5 text-sm outline-none" style={inputStyle} />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: INK }}>Confirm New Password *</label>
                  <input required type="password" minLength={8} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full rounded-xl px-4 py-2.5 text-sm outline-none" style={inputStyle} />
                </div>
                {pwMessage && (
                  <p className="text-xs font-medium" style={{ color: pwMessage.type === 'success' ? GREEN : RED }}>{pwMessage.text}</p>
                )}
                <button type="submit" disabled={pwSubmitting}
                  className="text-sm font-semibold text-white px-5 py-2.5 rounded-xl mt-1 disabled:opacity-50"
                  style={{ background: `linear-gradient(135deg, ${VIOLET_LIGHT}, ${VIOLET})` }}>
                  {pwSubmitting ? 'Updating...' : 'Update Password'}
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </ResponsiveLayout>
  );
}
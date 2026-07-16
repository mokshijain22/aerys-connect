'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import Image from 'next/image';

const VIOLET = '#6C5CE7';
const VIOLET_LIGHT = '#8B7CF8';
const VIOLET_PALE = '#CFC7FF';
const BG = '#F8F8FC';
const INK = '#1A1A2E';
const MUTED = '#6B7280';
const BORDER = 'rgba(30,20,60,0.08)';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const result = await signIn('credentials', {
      email,
      password,
      redirect: false,
    });

    setLoading(false);

    if (result?.error) {
      setError('Invalid email or password');
    } else {
      router.push('/');
      router.refresh();
    }
  };

  return (
    <div className="min-h-screen flex" style={{ backgroundColor: BG, fontFamily: 'Inter, sans-serif' }}>
      {/* LEFT — scooter stage */}
      <div className="hidden lg:flex relative flex-1 items-center justify-center overflow-hidden" style={{ background: `linear-gradient(160deg, ${BG} 0%, ${VIOLET_PALE}33 100%)` }}>
        <motion.div
          className="absolute w-[42rem] h-[42rem] rounded-full opacity-60 blur-[110px]"
          style={{ background: `radial-gradient(circle, ${VIOLET_PALE}, transparent 70%)` }}
          animate={{ opacity: [0.4, 0.65, 0.4] }}
          transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute w-[24rem] h-[24rem] rounded-full opacity-40 blur-[90px] top-10 right-10"
          style={{ background: `radial-gradient(circle, ${VIOLET_LIGHT}, transparent 70%)` }}
          animate={{ opacity: [0.25, 0.45, 0.25] }}
          transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
        />

        <div
          className="absolute inset-0 opacity-[0.06]"
          style={{ backgroundImage: 'radial-gradient(rgba(30,20,60,0.7) 1px, transparent 1px)', backgroundSize: '24px 24px' }}
        />

        {/* energy rings */}
        <motion.div
          className="absolute w-[32rem] h-[32rem] rounded-full"
          style={{ border: `1px solid ${VIOLET_LIGHT}66` }}
          animate={{ rotate: 360 }}
          transition={{ duration: 40, repeat: Infinity, ease: 'linear' }}
        />
        <motion.div
          className="absolute w-[24rem] h-[24rem] rounded-full"
          style={{ border: `1px dashed ${VIOLET}44` }}
          animate={{ rotate: -360 }}
          transition={{ duration: 55, repeat: Infinity, ease: 'linear' }}
        />

        {/* skyline silhouette */}
        <svg className="absolute bottom-0 left-0 w-full h-40 opacity-[0.12]" viewBox="0 0 800 160" preserveAspectRatio="none">
          <rect x="20" y="70" width="40" height="90" fill={INK} />
          <rect x="70" y="40" width="30" height="120" fill={INK} />
          <rect x="110" y="90" width="35" height="70" fill={INK} />
          <rect x="620" y="55" width="32" height="105" fill={INK} />
          <rect x="660" y="85" width="28" height="75" fill={INK} />
          <rect x="700" y="30" width="36" height="130" fill={INK} />
        </svg>

        {/* floating particles */}
        {[...Array(10)].map((_, i) => (
          <motion.span
            key={i}
            className="absolute rounded-full"
            style={{
              width: 3 + (i % 3),
              height: 3 + (i % 3),
              backgroundColor: VIOLET_LIGHT,
              left: `${10 + i * 8}%`,
              top: `${20 + (i % 5) * 12}%`,
            }}
            animate={{ y: [0, -18, 0], opacity: [0.3, 0.8, 0.3] }}
            transition={{ duration: 4 + (i % 3), repeat: Infinity, delay: i * 0.4, ease: 'easeInOut' }}
          />
        ))}

        {/* platform glow */}
        <div className="absolute bottom-[16%] w-[24rem] h-12 rounded-[50%]"
          style={{ background: `radial-gradient(ellipse, ${VIOLET_LIGHT}77, transparent 70%)`, filter: 'blur(6px)' }} />
        <motion.div
          className="absolute bottom-[15%] w-[17rem] h-6 rounded-[50%] border"
          style={{ borderColor: VIOLET_LIGHT }}
          animate={{ boxShadow: [`0 0 10px ${VIOLET_LIGHT}00`, `0 0 24px ${VIOLET_LIGHT}88`, `0 0 10px ${VIOLET_LIGHT}00`] }}
          transition={{ duration: 2.4, repeat: Infinity }}
        />

        <motion.div
          animate={{ y: [0, -14, 0], rotate: [0, 0.6, 0] }}
          transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
          className="relative z-10 w-[85%] max-w-[520px]"
        >
          <Image
            src="/hero-scooter.png"
            alt="AERYS X1"
            width={640}
            height={640}
            className="object-contain w-full h-auto drop-shadow-[0_40px_60px_rgba(108,92,231,0.3)]"
            priority
          />
        </motion.div>

        <div className="absolute top-10 left-10 text-xs font-medium tracking-wide" style={{ color: MUTED }}>
          AERYS X1 · Fleet Ready
        </div>
      </div>

      {/* RIGHT — glass login card */}
      <div className="flex flex-1 lg:flex-none lg:w-[45%] items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="w-full max-w-[420px] rounded-[32px] p-9"
          style={{
            backgroundColor: 'rgba(255,255,255,0.75)',
            backdropFilter: 'blur(20px)',
            border: `1px solid ${BORDER}`,
            boxShadow: `0 40px 80px -30px ${VIOLET}33, 0 0 0 1px rgba(255,255,255,0.4) inset`,
          }}
        >
          <div className="flex items-center gap-2.5 mb-8">
            <div className="h-24 w-32 overflow-hidden rounded-lg flex items-center justify-center shrink-0">
              <img src="/aerys-logo.png" alt="AERYS" className="h-24 w-auto object-contain scale-[1.4] origin-center" />
            </div>
            <div>
              <p className="font-bold tracking-tight" style={{ color: INK, fontSize: 15 }}>AERYS</p>
              <p className="text-[9px] tracking-[0.2em] uppercase" style={{ color: MUTED }}>Service Connect</p>
            </div>
          </div>

          <h1 className="font-bold mb-1.5" style={{ fontSize: 32, color: INK, letterSpacing: '-0.02em' }}>
            Welcome back
          </h1>
          <p className="mb-7" style={{ fontSize: 14, color: MUTED }}>
            Sign in to your Fleet Command Center
          </p>

          <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full rounded-xl px-4 py-3 text-sm outline-none transition-all"
              style={{ border: `1px solid ${BORDER}`, backgroundColor: 'rgba(255,255,255,0.6)', color: INK }}
              onFocus={(e) => (e.target.style.boxShadow = `0 0 0 3px ${VIOLET}22`)}
              onBlur={(e) => (e.target.style.boxShadow = 'none')}
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full rounded-xl px-4 py-3 text-sm outline-none transition-all"
              style={{ border: `1px solid ${BORDER}`, backgroundColor: 'rgba(255,255,255,0.6)', color: INK }}
              onFocus={(e) => (e.target.style.boxShadow = `0 0 0 3px ${VIOLET}22`)}
              onBlur={(e) => (e.target.style.boxShadow = 'none')}
            />

            <div className="flex items-center justify-between text-xs mt-1" style={{ color: MUTED }}>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input type="checkbox" className="rounded" />
                Remember me
              </label>
              <a href="#" style={{ color: VIOLET }} className="font-medium">Forgot password?</a>
            </div>

            {error && <p className="text-xs" style={{ color: '#E24B4A' }}>{error}</p>}

            <motion.button
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
              type="submit"
              disabled={loading}
              className="w-full rounded-xl py-3.5 mt-1 flex items-center justify-center gap-2 font-semibold text-sm text-white disabled:opacity-60"
              style={{ background: `linear-gradient(135deg, ${VIOLET_LIGHT}, ${VIOLET})`, boxShadow: `0 12px 24px -8px ${VIOLET}77` }}
            >
              {loading ? 'Logging in…' : 'Log in'}
              {!loading && <span>→</span>}
            </motion.button>
          </form>

          <p className="text-center text-[11px] mt-7" style={{ color: MUTED }}>
            Secure. Connected. Electric.
          </p>
          <p className="text-center text-[12px] mt-3" style={{ color: MUTED }}>
            Need help getting in? <a href="mailto:support@aerys.com" style={{ color: VIOLET }} className="font-medium">Contact us</a>
          </p>
        </motion.div>
      </div>
    </div>
  );
}
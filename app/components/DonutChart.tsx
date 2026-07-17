'use client';
import { useState, useEffect, useRef } from 'react';
import { motion, useInView, animate } from 'framer-motion';

export function DonutChart({ active, inService, inactive, total }: { active: number; inService: number; inactive: number; total: number }) {
  const R = 70, C = 2 * Math.PI * R;
  const a1 = (active / total) * C || 0;
  const a2 = (inService / total) * C || 0;
  const a3 = (inactive / total) * C || 0;

  const [hoverSeg, setHoverSeg] = useState<number | null>(null);
  const ref = useRef<SVGSVGElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-40px' });
  const [display, setDisplay] = useState(0);
  const hasAnimated = useRef(false);

  useEffect(() => {
    if (!isInView || hasAnimated.current) return;
    hasAnimated.current = true;
    const controls = animate(0, total, {
      duration: 1.2,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => setDisplay(Math.round(v)),
    });
    return () => controls.stop();
  }, [isInView, total]);

  const opacityFor = (idx: number) => (hoverSeg === null || hoverSeg === idx ? 1 : 0.35);

  return (
    <svg ref={ref} width="160" height="160" viewBox="0 0 160 160">
      <circle cx="80" cy="80" r={R} fill="none" stroke="#F0EDFF" strokeWidth="18" />
      <motion.circle
        cx="80" cy="80" r={R} fill="none" stroke="#6C5CE7" strokeWidth={hoverSeg === 0 ? 20 : 18}
        strokeDasharray={`${a1} ${C - a1}`} strokeLinecap="round" transform="rotate(-90 80 80)"
        animate={{ opacity: opacityFor(0) }}
        transition={{ duration: 0.2 }}
        style={{ cursor: 'pointer' }}
        onMouseEnter={() => setHoverSeg(0)}
        onMouseLeave={() => setHoverSeg(null)}
      />
      <motion.circle
        cx="80" cy="80" r={R} fill="none" stroke="#8B7CF8" strokeWidth={hoverSeg === 1 ? 20 : 18}
        strokeDasharray={`${a2} ${C - a2}`} strokeDashoffset={-a1} strokeLinecap="round" transform="rotate(-90 80 80)"
        animate={{ opacity: opacityFor(1) }}
        transition={{ duration: 0.2 }}
        style={{ cursor: 'pointer' }}
        onMouseEnter={() => setHoverSeg(1)}
        onMouseLeave={() => setHoverSeg(null)}
      />
      <motion.circle
        cx="80" cy="80" r={R} fill="none" stroke="#D9D3FF" strokeWidth={hoverSeg === 2 ? 20 : 18}
        strokeDasharray={`${a3} ${C - a3}`} strokeDashoffset={-(a1 + a2)} strokeLinecap="round" transform="rotate(-90 80 80)"
        animate={{ opacity: opacityFor(2) }}
        transition={{ duration: 0.2 }}
        style={{ cursor: 'pointer' }}
        onMouseEnter={() => setHoverSeg(2)}
        onMouseLeave={() => setHoverSeg(null)}
      />
      <text x="80" y="75" textAnchor="middle" fontSize="12" fill="#6B6B7E">Total</text>
      <text x="80" y="98" textAnchor="middle" fontSize="24" fontWeight="800" fill="#15152A">{display}</text>
    </svg>
  );
}
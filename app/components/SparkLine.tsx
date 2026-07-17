'use client';
import { motion } from 'framer-motion';
import { useId } from 'react';

export function SparkLine({ color = '#6C5CE7', points = [4, 8, 5, 10, 7, 12, 9, 14] }: { color?: string; points?: number[] }) {
  const w = 100, h = 30;
  const max = Math.max(...points);
  const step = w / (points.length - 1);
  const gradId = useId();
  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${i * step},${h - (p / max) * h}`).join(' ');
  const areaPath = `${path} L ${w},${h} L 0,${h} Z`;

  return (
    <svg width="100%" height="34" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="overflow-visible">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.28" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <motion.path
        d={areaPath}
        fill={`url(#${gradId})`}
        stroke="none"
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 1.2, ease: 'easeOut', delay: 0.2 }}
      />
      <motion.path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0, opacity: 0 }}
        whileInView={{ pathLength: 1, opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 1.2, ease: 'easeOut' }}
      />
    </svg>
  );
}
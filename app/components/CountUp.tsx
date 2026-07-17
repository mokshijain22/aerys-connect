// app/components/CountUp.tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import { useInView, animate } from 'framer-motion';

export function CountUp({ value, duration = 1.2 }: { value: number | undefined; duration?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-50px' });
  const [display, setDisplay] = useState(0);
  const hasAnimated = useRef(false);

  useEffect(() => {
    if (!isInView || value === undefined || hasAnimated.current) return;
    hasAnimated.current = true;
    const controls = animate(0, value, {
      duration,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => setDisplay(Math.round(v)),
    });
    return () => controls.stop();
  }, [isInView, value, duration]);

  return <span ref={ref}>{value === undefined ? '—' : display}</span>;
}
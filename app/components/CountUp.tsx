'use client';

import { useEffect, useRef, useState } from 'react';

function easeInOutCubic(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export function CountUp({ value, duration = 1.2 }: { value: number | undefined; duration?: number }) {
  const [display, setDisplay] = useState(value ?? 0);
  const displayRef = useRef(display);

  useEffect(() => {
    displayRef.current = display;
  }, [display]);

  useEffect(() => {
    if (value === undefined) return;
    let frame = 0;
    const startValue = displayRef.current;

    if (startValue === value) {
      setDisplay(value);
      return;
    }

    const startTime = performance.now();
    const step = (now: number) => {
      const progress = Math.min((now - startTime) / (duration * 1000), 1);
      const eased = easeInOutCubic(progress);
      const nextValue = startValue + (value - startValue) * eased;
      setDisplay(Math.round(nextValue));

      if (progress < 1) {
        frame = requestAnimationFrame(step);
      }
    };

    frame = requestAnimationFrame(step);

    return () => cancelAnimationFrame(frame);
  }, [value, duration]);

  return <span>{value === undefined ? '—' : display}</span>;
}
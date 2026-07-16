'use client';

import { useRef, useState } from 'react';
import { motion } from 'framer-motion';

export default function TiltCard({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState({ rotateX: 0, rotateY: 0 });
  const [hovering, setHovering] = useState(false);

  function handleMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const rotateX = ((y - rect.height / 2) / rect.height) * -10;
    const rotateY = ((x - rect.width / 2) / rect.width) * 10;
    setStyle({ rotateX, rotateY });
  }

  function handleMouseLeave() {
    setStyle({ rotateX: 0, rotateY: 0 });
    setHovering(false);
  }

  return (
    <motion.div
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={handleMouseLeave}
      animate={{
        rotateX: style.rotateX,
        rotateY: style.rotateY,
        scale: hovering ? 1.03 : 1,
        // boxShadow: hovering
        //   ? '0 20px 60px rgba(61,255,176,0.25), 0 0 0 1px rgba(61,255,176,0.3)'
        //   : '0 8px 32px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.05)',
      }}
      transition={{ type: 'spring', stiffness: 200, damping: 18 }}
      style={{ transformStyle: 'preserve-3d', perspective: 1000 }}
      className={className}
    >
      <div style={{ transform: 'translateZ(24px)' }}>{children}</div>
    </motion.div>
  );
}
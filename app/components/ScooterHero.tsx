'use client';

import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

export default function ScooterHero() {
  const scooterRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const scooter = scooterRef.current;
    if (!scooter) return;

    const ctx = gsap.context(() => {
      const setupAnimation = () => {
        const target = document.getElementById('scooter-target');
        if (!target) return;

        const targetRect = target.getBoundingClientRect();
        const initialWidth = Math.min(window.innerWidth * 0.6, 600);

        gsap.set(scooter, {
          position: 'fixed',
          top: '50%',
          left: '50%',
          xPercent: -50,
          yPercent: -50,
          width: initialWidth,
          height: 'auto',
          zIndex: 50,
          opacity: 1,
        });

        const finalCenterX = targetRect.left + targetRect.width / 2;
        const finalCenterY = targetRect.top + targetRect.height / 2;
        const viewportCenterX = window.innerWidth / 2;
        const viewportCenterY = window.innerHeight / 2;

        const deltaX = finalCenterX - viewportCenterX;
        const deltaY = finalCenterY - viewportCenterY;

        gsap.timeline({
          scrollTrigger: {
            trigger: '#scooter-scroll-section',
            start: 'top top',
            end: 'bottom top',
            scrub: 1,
            pin: '#scooter-pin-wrapper',
            anticipatePin: 1,
            onUpdate: (self) => {
              const dashboardContent = document.getElementById('dashboard-content');
              if (dashboardContent) {
                gsap.set(dashboardContent, { opacity: self.progress });
              }
            },
            onLeave: () => {
              gsap.set(scooter, { opacity: 0 });
              const t = document.getElementById('scooter-target');
              if (t) gsap.set(t, { opacity: 1 });
            },
            onEnterBack: () => {
              const t = document.getElementById('scooter-target');
              if (t) gsap.set(t, { opacity: 0 });
              gsap.set(scooter, { opacity: 1 });
            },
          },
        }).to(scooter, {
          x: deltaX,
          y: deltaY,
          width: targetRect.width,
          ease: 'none',
        });
      };

      const timer = setTimeout(setupAnimation, 100);

      const handleResize = () => {
        ScrollTrigger.getAll().forEach((t) => t.kill());
        setupAnimation();
      };
      window.addEventListener('resize', handleResize);

      return () => {
        clearTimeout(timer);
        window.removeEventListener('resize', handleResize);
      };
    });

    return () => ctx.revert();
  }, []);

  return (
    <div id="scooter-scroll-section" style={{ height: '150vh', position: 'relative' }}>
      <div id="scooter-pin-wrapper" style={{ height: '100vh', width: '100%' }}>
        <img
          ref={scooterRef}
          src="/scooter-hero.png"
          alt="Scooter"
          style={{ willChange: 'transform, width' }}
        />
      </div>
    </div>
  );
}
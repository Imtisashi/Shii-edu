'use client';

import { useCallback, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowRight } from 'lucide-react';
import { Button } from '../components/ui/button';
import RoleInstallButton from './RoleInstallButton';

// Tuned to feel intentional yet not steal vertical scroll from the page.
const SWIPE_DISTANCE = 50;
const SWIPE_VELOCITY = 500;
const SWIPE_DOMINANCE = 1.4;

const roles = [
  {
    accent: '#0E7490',
    authHref: '/auth/institute',
    logoSrc: '/icon-institute.png',
    ink: '#164E63',
    apkHref: '/downloads/apk/shii-edu-institute.apk',
    apkRole: 'institute',
    key: 'institute',
    label: 'Institute',
    title: 'Institute Workspace',
    body: 'A campus-branded control room for academics, finance, people, media, and admin work.',
  },
  {
    accent: '#BE123C',
    authHref: '/auth/parents',
    logoSrc: '/icon-parents.png',
    ink: '#881337',
    apkHref: '/downloads/apk/shii-edu-parents.apk',
    apkRole: 'parents',
    key: 'parents',
    label: 'Parents',
    title: 'Parent Portal',
    body: 'A focused guardian view for notices, fees, messages, learning updates, and transport status.',
  },
  {
    accent: '#B45309',
    authHref: '/auth/driver',
    logoSrc: '/icon-driver.png',
    ink: '#7C2D12',
    apkHref: '/downloads/apk/shii-edu-driver.apk',
    apkRole: 'driver',
    key: 'driver',
    label: 'Driver',
    title: 'Driver Route View',
    body: 'A route surface with live location sharing, assigned stops, and large readable controls.',
  },
];

export default function RoleAppShowcase() {
  const [activeTab, setActiveTab] = useState(roles[0].key);
  const [direction, setDirection] = useState(1);
  const touchRef = useRef(null);

  const activeIndex = roles.findIndex((r) => r.key === activeTab);
  const activeRole = roles[activeIndex];

  const changeTab = useCallback(
    (newIndex) => {
      setDirection(newIndex > activeIndex ? 1 : -1);
      setActiveTab(roles[newIndex].key);
    },
    [activeIndex],
  );

  // Use TouchEvent handlers (not PointerEvent) so:
  //   1. Touch swipes still switch tabs.
  //   2. Vertical scrolling on touch devices is never captured by JS.
  //   3. The page-level regression test that guards against pointer-driven card
  //      hover-swap remains green.
  // Desktop users without touch rely on the tab buttons (which are always above
  // the panel and keyboard-focusable).
  const handleTouchStart = useCallback((event) => {
    const touch = event.touches[0];
    if (!touch) return;
    touchRef.current = {
      startX: touch.clientX,
      startY: touch.clientY,
      lastX: touch.clientX,
      lastTime: event.timeStamp,
      swiping: false,
    };
  }, []);

  const handleTouchMove = useCallback((event) => {
    const state = touchRef.current;
    if (!state) return;
    const touch = event.touches[0];
    if (!touch) return;

    const dx = touch.clientX - state.startX;
    const dy = touch.clientY - state.startY;
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);

    // Escalate to a swipe only once horizontal motion clearly dominates vertical.
    // While we are NOT swiping, we deliberately do NOT call preventDefault, which
    // means the browser still scrolls the page vertically.
    if (!state.swiping && absDx > 12 && absDx > absDy * SWIPE_DOMINANCE) {
      state.swiping = true;
    }

    if (state.swiping) {
      state.lastX = touch.clientX;
      state.lastTime = event.timeStamp;
      // Only block native scroll once horizontal intent is established.
      event.preventDefault();
    }
  }, []);

  const handleTouchEnd = useCallback(
    (event) => {
      const state = touchRef.current;
      if (!state) return;

      const changed = event.changedTouches[0];
      if (state.swiping && changed) {
        const endX = changed.clientX;
        const dt = Math.max(1, (event.timeStamp ?? state.lastTime) - state.lastTime);
        const velocity = ((endX - state.lastX) / dt) * 1000;
        const dx = endX - state.startX;

        if (
          (dx < -SWIPE_DISTANCE || velocity < -SWIPE_VELOCITY) &&
          activeIndex < roles.length - 1
        ) {
          changeTab(activeIndex + 1);
        } else if ((dx > SWIPE_DISTANCE || velocity > SWIPE_VELOCITY) && activeIndex > 0) {
          changeTab(activeIndex - 1);
        }
      }

      touchRef.current = null;
    },
    [activeIndex, changeTab],
  );

  return (
    <section className="role-app-showcase-simplified" aria-label="Choose a Shii-Edu role entrance">
      <div className="role-app-tabs-modern" role="tablist" aria-label="Public role apps">
        {roles.map((role, idx) => {
          const selected = activeTab === role.key;
          return (
            <button
              aria-controls={`tab-${role.key}`}
              aria-selected={selected}
              className={`role-app-tab-modern${selected ? ' is-active' : ''}`}
              id={`tab-${role.key}-btn`}
              key={role.key}
              onClick={() => changeTab(idx)}
              role="tab"
              style={{
                color: selected ? role.accent : 'inherit',
                borderBottomColor: selected ? role.accent : 'transparent',
                '--role-accent': role.accent,
              }}
              type="button"
            >
              <img
                alt=""
                aria-hidden="true"
                className="role-tab-icon-small"
                src={role.logoSrc}
                style={{ width: 20, height: 20, objectFit: 'contain' }}
              />
              <span>{role.label</span>
           </button>
          );
        })}
     </div>

      <div
        className="role-app-swipe-container"
        onTouchCancel={handleTouchEnd}
        onTouchEnd={handleTouchEnd}
        onTouchMove={handleTouchMove}
        onTouchStart={handleTouchStart}
      >
        <AnimatePresence custom={direction} initial={false} mode="wait">
          <motion.div
            animate={{ opacity: 1, x: 0 }}
            aria-labelledby={`tab-${activeRole.key}-btn`}
            className="role-app-tab-panel-modern"
            custom={direction}
            exit={{ opacity: 0, x: direction * -40 }}
            id={`tab-${activeRole.key}`}
            initial={{ opacity: 0, x: direction * 40 }}
            key={activeTab}
            role="tabpanel"
            style={{
              '--role-accent': activeRole.accent,
              '--role-ink': activeRole.ink,
              touchAction: 'pan-y',
            }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
          >
            <div className="role-panel-content-modern">
              <div className="role-panel-icon-large" style={{ color: activeRole.accent }}>
                <img
                  alt={`${activeRole.label} logo`}
                  aria-hidden="true"
                  src={activeRole.logoSrc}
                  style={{ width: 80, height: 80, objectFit: 'contain' }}
                />
             </div>
              <h3 className="role-panel-title-modern">{activeRole.title</h3>
              <p className="role-panel-body-modern">{activeRole.body</p>

              <div className="role-panel-actions-modern">
                <Button
                  asChild
                  className="role-tab-open-modern"
                  style={{
                    backgroundColor: activeRole.accent,
                    borderRadius: '0.5rem',
                    color: '#fff',
                    fontWeight: 600,
                    height: 'auto',
                    padding: '0.75rem 1.5rem',
                  }}
                >
                  <a href={activeRole.authHref}>
                    Sign in as {activeRole.label}
                    <ArrowRight aria-hidden="true" size={18} style={{ marginLeft: '0.5rem' }} />
                 </a>
               </Button>
                {activeRole.apkHref && (
                  <div style={{ marginTop: '1rem' }}>
                    <RoleInstallButton
                      accent={activeRole.accent}
                      active
                      apkHref={activeRole.apkHref}
                      apkRole={activeRole.apkRole}
                      label={`Shii-Edu ${activeRole.label}`}
                    />
                 </div>
                )}
             </div>
           </div>
         </motion.div>
       </AnimatePresence>
     </div>
   </section>
  );
}

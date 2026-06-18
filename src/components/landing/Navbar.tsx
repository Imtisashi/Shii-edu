'use client';

import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { ArrowRight, Menu, X } from 'lucide-react';
import type { NavGroup } from '../../data/landing';
import AnimatedButton from '../ui/AnimatedButton';
import Wordmark from './Wordmark';

type NavbarProps = {
  contactHref: string;
  navItems: NavGroup[];
};

const ease = [0.16, 1, 0.3, 1] as const;

export default function Navbar({ contactHref, navItems }: NavbarProps) {
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const navRef = useRef<HTMLElement | null>(null);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 36);
    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const handlePointer = (event: PointerEvent) => {
      if (!navRef.current?.contains(event.target as Node)) {
        setActiveMenu(null);
      }
    };
    const handleKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        setActiveMenu(null);
        setMobileOpen(false);
      }
    };
    document.addEventListener('pointerdown', handlePointer);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('pointerdown', handlePointer);
      document.removeEventListener('keydown', handleKey);
    };
  }, []);

  const handleNavKey = (event: KeyboardEvent<HTMLButtonElement>, label: string) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      setActiveMenu((current) => (current === label ? null : label));
    }
  };

  return (
    <header className={`tl-nav-shell ${scrolled ? 'is-scrolled' : ''}`} ref={navRef}>
      <a className="tl-skip-link" href="#main">
        Skip to content
      </a>
      <nav className="tl-nav" aria-label="Primary navigation">
        <a className="tl-nav-brand" href="/" aria-label="Shii-Edu home">
          <span className="tl-brand-mark" aria-hidden="true">
            <span />
          </span>
          <span>
            <Wordmark compact />
            <small>Institute OS</small>
          </span>
        </a>

        <div className="tl-nav-center" onMouseLeave={() => setActiveMenu(null)}>
          {navItems.map((item) => (
            <div className="tl-nav-item" key={item.label} onMouseEnter={() => setActiveMenu(item.label)}>
              <button
                aria-expanded={activeMenu === item.label}
                aria-haspopup="true"
                className="tl-nav-link"
                onClick={() => setActiveMenu((current) => (current === item.label ? null : item.label))}
                onFocus={() => setActiveMenu(item.label)}
                onKeyDown={(event) => handleNavKey(event, item.label)}
                type="button"
              >
                {item.label}
              </button>
              <AnimatePresence>
                {activeMenu === item.label && (
                  <motion.div
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    className="tl-mega-menu"
                    exit={{ opacity: 0, scale: 0.98, y: -8 }}
                    initial={{ opacity: 0, scale: 0.98, y: -8 }}
                    transition={{ duration: reducedMotion ? 0.01 : 0.2, ease }}
                  >
                    <div className="tl-mega-summary">
                      <span>{item.label}</span>
                      <p>{item.summary}</p>
                    </div>
                    <div className="tl-mega-list">
                      {item.items.map((link) => (
                        <a className="tl-mega-card" href={link.href} key={link.title}>
                          <span aria-hidden="true" />
                          <strong>{link.title}</strong>
                          <small>{link.description}</small>
                        </a>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>

        <div className="tl-nav-actions">
          <a className="tl-nav-contact" href={contactHref}>
            Contact
          </a>
          <AnimatedButton href="/roles" size="sm">
            Login
          </AnimatedButton>
        </div>

        <button
          aria-expanded={mobileOpen}
          aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
          className="tl-menu-button"
          onClick={() => setMobileOpen((current) => !current)}
          type="button"
        >
          {mobileOpen ? <X size={20} aria-hidden="true" /> : <Menu size={20} aria-hidden="true" />}
        </button>
      </nav>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            animate={{ opacity: 1, y: 0 }}
            className="tl-mobile-drawer"
            exit={{ opacity: 0, y: -12 }}
            initial={{ opacity: 0, y: -12 }}
            transition={{ duration: reducedMotion ? 0.01 : 0.22, ease }}
          >
            {navItems.map((group) => (
              <div className="tl-mobile-group" key={group.label}>
                <a href={group.href} onClick={() => setMobileOpen(false)}>
                  {group.label}
                </a>
                {group.items.map((item) => (
                  <a href={item.href} key={item.title} onClick={() => setMobileOpen(false)}>
                    <span>{item.title}</span>
                    <ArrowRight size={14} aria-hidden="true" />
                  </a>
                ))}
              </div>
            ))}
            <AnimatedButton className="tl-mobile-login" href="/roles">
              Choose a role
            </AnimatedButton>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}

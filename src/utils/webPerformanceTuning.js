import { Platform } from 'react-native';

const STYLE_ID = 'shii-edu-web-performance';

const installPerformanceStyles = () => {
  if (document.getElementById(STYLE_ID)) return;

  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    :root {
      --shii-frame-ms: 16.67ms;
      --shii-tap-ms: 150ms;
    }

    :root[data-high-refresh="true"] {
      --shii-frame-ms: 8.33ms;
      --shii-tap-ms: 110ms;
    }

    html {
      background: #F8FAFC;
      text-rendering: optimizeLegibility;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }

    body {
      background: #F8FAFC;
      min-height: 100%;
    }

    *,
    *::before,
    *::after {
      box-sizing: border-box;
    }

    [role="button"],
    button,
    a,
    input,
    textarea,
    select {
      -webkit-tap-highlight-color: transparent;
    }

    [role="button"],
    button {
      cursor: pointer;
    }

    img,
    svg,
    canvas {
      max-width: 100%;
    }

    @media (prefers-reduced-motion: reduce) {
      *,
      *::before,
      *::after {
        animation-duration: 0.001ms !important;
        animation-iteration-count: 1 !important;
        scroll-behavior: auto !important;
        transition-duration: 0.001ms !important;
      }
    }
  `;
  document.head.appendChild(style);
};

const estimateRefreshRate = () => {
  const samples = [];
  let lastFrame = 0;

  const sample = (timestamp) => {
    if (lastFrame) samples.push(timestamp - lastFrame);
    lastFrame = timestamp;

    if (samples.length < 24) {
      window.requestAnimationFrame(sample);
      return;
    }

    const averageFrameMs = samples.reduce((sum, value) => sum + value, 0) / samples.length;
    document.documentElement.style.setProperty('--shii-frame-ms', `${averageFrameMs.toFixed(2)}ms`);
    document.documentElement.dataset.highRefresh = averageFrameMs < 12 ? 'true' : 'false';
  };

  window.requestAnimationFrame(sample);
};

const isInteractiveElement = (target) => {
  const element = target instanceof Element ? target : target?.parentElement;
  return Boolean(element?.closest('button, a, [role="button"], input, textarea, select'));
};

const installMobileWebHaptics = () => {
  const canVibrate = typeof window.navigator?.vibrate === 'function';
  const coarsePointer = window.matchMedia?.('(pointer: coarse)').matches;
  if (!canVibrate || !coarsePointer) return;

  let lastVibration = 0;
  document.addEventListener('pointerup', (event) => {
    if (!isInteractiveElement(event.target)) return;

    const now = Date.now();
    if (now - lastVibration < 90) return;
    lastVibration = now;
    window.navigator.vibrate(8);
  }, { capture: true, passive: true });
};

export const installWebPerformanceTuning = () => {
  if (Platform.OS !== 'web' || typeof document === 'undefined' || typeof window === 'undefined') return;
  if (window.__SHII_EDU_PERFORMANCE_TUNING_INSTALLED__) return;
  window.__SHII_EDU_PERFORMANCE_TUNING_INSTALLED__ = true;

  installPerformanceStyles();
  installMobileWebHaptics();
  estimateRefreshRate();
};

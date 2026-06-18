import { Platform } from 'react-native';

const STYLE_ID = 'shii-edu-web-scroll-fix';

export const installWebScrollFix = () => {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;
  if (document.getElementById(STYLE_ID)) {
    if (typeof window !== 'undefined') window.__shiiEduSyncDocumentHeight?.();
    return;
  }

  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    html {
      background: var(--shii-edge-background, #02030A);
      width: 100%;
      min-height: 100dvh !important;
      height: 100% !important;
      overflow-x: hidden !important;
      overflow-y: auto !important;
      overscroll-behavior-y: auto;
      -webkit-overflow-scrolling: touch;
    }

    body {
      background: var(--shii-edge-background, #02030A);
      margin: 0;
      width: 100%;
      min-height: 100dvh !important;
      height: 100% !important;
      overflow-x: hidden !important;
      overflow-y: auto !important;
      overscroll-behavior-y: auto;
      position: static !important;
      -webkit-font-smoothing: antialiased;
      text-rendering: optimizeLegibility;
      -webkit-overflow-scrolling: touch;
    }

    #root {
      display: flex !important;
      flex-direction: column !important;
      width: 100%;
      min-height: 100dvh !important;
      height: 100% !important;
      overflow-x: hidden !important;
      overflow-y: visible !important;
      isolation: isolate;
    }

    #root > div {
      flex: 1 1 auto !important;
      width: 100%;
      min-height: 100dvh !important;
      height: 100% !important;
      overflow-x: hidden !important;
      overflow-y: visible !important;
      isolation: isolate;
    }

    #root > div > div {
      flex: 1 1 auto !important;
      width: 100%;
      min-height: 100dvh !important;
      height: 100% !important;
      overflow-x: hidden !important;
      overflow-y: visible !important;
    }

    #root [data-focusable],
    #root [class*="css-view"] {
      max-height: none;
    }

    [style*="height: 100vh"],
    [style*="height:100vh"] {
      min-height: 100vh;
    }

    [role="button"],
    button,
    input,
    textarea,
    select {
      touch-action: manipulation;
    }

    [data-rn-scrollview],
    [style*="overflow: auto"],
    [style*="overflow:auto"],
    [style*="overflow-y: auto"],
    [style*="overflow-y:auto"],
    [style*="overflow: scroll"],
    [style*="overflow:scroll"] {
      -webkit-overflow-scrolling: touch;
      overscroll-behavior-y: auto;
      scroll-behavior: auto;
    }
  `;
  document.head.appendChild(style);

  if (typeof window === 'undefined') return;

  const syncDocumentHeight = () => {
    document.documentElement.style.removeProperty('min-height');
    document.body.style.removeProperty('min-height');
  };

  const requestDocumentHeightSync = () => {
    window.cancelAnimationFrame(window.__shiiEduScrollFrame || 0);
    window.__shiiEduScrollFrame = window.requestAnimationFrame(syncDocumentHeight);
  };
  window.__shiiEduSyncDocumentHeight = requestDocumentHeightSync;

  requestDocumentHeightSync();
  window.addEventListener('resize', requestDocumentHeightSync, { passive: true });
  window.visualViewport?.addEventListener('resize', requestDocumentHeightSync, { passive: true });

  if ('ResizeObserver' in window) {
    const observer = new ResizeObserver(requestDocumentHeightSync);
    const root = document.getElementById('root');
    if (root) observer.observe(root);
    if (document.body) observer.observe(document.body);
    window.__shiiEduScrollFixObserver = observer;
  }

  if ('MutationObserver' in window) {
    const mutationObserver = new MutationObserver(requestDocumentHeightSync);
    const root = document.getElementById('root') || document.body;
    if (root) {
      mutationObserver.observe(root, {
        attributes: true,
        childList: true,
        subtree: true,
      });
      window.__shiiEduScrollFixMutationObserver = mutationObserver;
    }
  }

  let bootSyncCount = 0;
  const bootSyncId = window.setInterval(() => {
    bootSyncCount += 1;
    requestDocumentHeightSync();
    if (bootSyncCount >= 12) window.clearInterval(bootSyncId);
  }, 250);
};

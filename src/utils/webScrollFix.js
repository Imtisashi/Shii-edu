import { Platform } from 'react-native';

const STYLE_ID = 'shii-edu-web-scroll-fix';

const isEditableElement = (element) => {
  if (!element) return false;
  const tagName = element.tagName?.toLowerCase();
  return (
    tagName === 'input' ||
    tagName === 'textarea' ||
    tagName === 'select' ||
    element.isContentEditable
  );
};

const getScrollParent = (startElement) => {
  if (typeof document === 'undefined') return null;

  let element = startElement instanceof Element ? startElement : startElement?.parentElement;
  while (element && element !== document.body && element !== document.documentElement) {
    if (element.scrollHeight > element.clientHeight + 2) {
      return element;
    }
    element = element.parentElement;
  }

  return document.scrollingElement || document.documentElement;
};

const applyScrollableStyle = () => {
  if (typeof document === 'undefined') return;

  const candidates = document.querySelectorAll('div, main, section');
  candidates.forEach((element) => {
    if (element.scrollHeight <= element.clientHeight + 2) return;

    element.style.overflowY = 'auto';
    element.style.webkitOverflowScrolling = 'touch';
    element.style.overscrollBehaviorY = 'contain';
    element.style.touchAction = 'pan-x pan-y';
  });
};

const scrollElement = (element, deltaY) => {
  if (!element || !deltaY) return false;

  const before = element.scrollTop;
  element.scrollTop += deltaY;

  if (element.scrollTop !== before) return true;

  const scrollingElement = document.scrollingElement || document.documentElement;
  if (element !== scrollingElement) {
    const rootBefore = scrollingElement.scrollTop;
    scrollingElement.scrollTop += deltaY;
    return scrollingElement.scrollTop !== rootBefore;
  }

  return false;
};

export const installWebScrollFix = () => {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;
  if (window.__SHII_EDU_SCROLL_FIX_INSTALLED__) return;
  window.__SHII_EDU_SCROLL_FIX_INSTALLED__ = true;

  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    html,
    body {
      min-height: 100%;
      overflow-y: auto !important;
      overscroll-behavior-y: auto;
      -webkit-overflow-scrolling: touch;
      touch-action: pan-x pan-y;
    }

    body {
      position: static !important;
    }

    #root,
    #root > div {
      min-height: 100vh;
      overflow: visible !important;
      touch-action: pan-x pan-y;
    }

    [role="button"],
    button,
    input,
    textarea,
    select {
      touch-action: manipulation;
    }
  `;
  document.head.appendChild(style);

  let touchStartY = 0;
  let mutationFrame = 0;

  const scheduleScrollableStyle = () => {
    window.cancelAnimationFrame(mutationFrame);
    mutationFrame = window.requestAnimationFrame(applyScrollableStyle);
  };

  const wheelHandler = (event) => {
    if (isEditableElement(event.target)) return;
    const target = getScrollParent(event.target);
    if (scrollElement(target, event.deltaY)) {
      event.preventDefault();
    }
  };

  const touchStartHandler = (event) => {
    touchStartY = event.touches?.[0]?.clientY || 0;
  };

  const touchMoveHandler = (event) => {
    if (isEditableElement(event.target)) return;

    const currentY = event.touches?.[0]?.clientY || touchStartY;
    const deltaY = touchStartY - currentY;
    touchStartY = currentY;

    if (Math.abs(deltaY) < 2) return;

    const target = getScrollParent(event.target);
    if (scrollElement(target, deltaY)) {
      event.preventDefault();
    }
  };

  const keyHandler = (event) => {
    if (isEditableElement(event.target)) return;

    const keyDeltas = {
      ArrowDown: 48,
      ArrowUp: -48,
      PageDown: Math.floor(window.innerHeight * 0.85),
      PageUp: -Math.floor(window.innerHeight * 0.85),
      End: Number.MAX_SAFE_INTEGER,
      Home: -Number.MAX_SAFE_INTEGER,
    };

    const deltaY = keyDeltas[event.key];
    if (!deltaY) return;

    const target = getScrollParent(event.target);
    if (scrollElement(target, deltaY)) {
      event.preventDefault();
    }
  };

  document.addEventListener('wheel', wheelHandler, { capture: true, passive: false });
  document.addEventListener('touchstart', touchStartHandler, { capture: true, passive: true });
  document.addEventListener('touchmove', touchMoveHandler, { capture: true, passive: false });
  document.addEventListener('keydown', keyHandler, { capture: true });

  const observer = new MutationObserver(scheduleScrollableStyle);
  observer.observe(document.body, { childList: true, subtree: true });

  window.addEventListener('resize', scheduleScrollableStyle);
  scheduleScrollableStyle();
};

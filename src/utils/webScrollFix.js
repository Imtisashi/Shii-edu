import { Platform } from 'react-native';

const STYLE_ID = 'shii-edu-web-scroll-fix';

export const installWebScrollFix = () => {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;
  if (document.getElementById(STYLE_ID)) return;

  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    html,
    body {
      width: 100%;
      min-height: 100%;
      overflow-x: hidden;
      overflow-y: auto;
      overscroll-behavior-y: auto;
      -webkit-overflow-scrolling: touch;
    }

    body {
      margin: 0;
      position: static !important;
      -webkit-font-smoothing: antialiased;
      text-rendering: optimizeLegibility;
    }

    #root,
    #root > div {
      width: 100%;
      min-height: 100vh;
      overflow: visible;
      isolation: isolate;
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
      overscroll-behavior-y: contain;
      scroll-behavior: auto;
    }
  `;
  document.head.appendChild(style);
};

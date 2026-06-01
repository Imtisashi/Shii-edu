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
      height: auto;
      overflow-x: hidden;
      overflow-y: auto !important;
      overscroll-behavior-y: auto;
      -webkit-overflow-scrolling: touch;
    }

    body {
      margin: 0;
      min-height: 100vh;
      position: static !important;
      -webkit-font-smoothing: antialiased;
      text-rendering: optimizeLegibility;
    }

    #root,
    #root > div {
      width: 100%;
      min-height: 100vh;
      height: auto;
      overflow: visible !important;
      isolation: isolate;
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
      overscroll-behavior-y: contain;
      scroll-behavior: auto;
    }
  `;
  document.head.appendChild(style);
};

import { Platform } from 'react-native';

const STYLE_ID = 'shii-edu-web-scroll-fix';

export const installWebScrollFix = () => {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;
  if (document.getElementById(STYLE_ID)) return;

  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    html,
    body,
    #root {
      width: 100%;
      height: 100%;
      overscroll-behavior-y: none;
    }

    body {
      margin: 0;
      overflow: hidden;
      -webkit-font-smoothing: antialiased;
      text-rendering: optimizeLegibility;
    }

    #root {
      isolation: isolate;
    }

    [role="button"],
    button,
    input,
    textarea,
    select {
      touch-action: manipulation;
    }

    [style*="overflow"] {
      -webkit-overflow-scrolling: touch;
      overscroll-behavior-y: contain;
    }
  `;
  document.head.appendChild(style);
};

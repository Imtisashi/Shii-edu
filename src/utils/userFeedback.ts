import { Alert, Platform, ToastAndroid } from 'react-native';

type WebToastIntent = 'error' | 'info' | 'success' | 'warning';

const WEB_TOAST_ROOT_ID = 'shii-edu-feedback-root';
const WEB_TOAST_STYLE_ID = 'shii-edu-feedback-styles';

const parseAlertMessage = (title: string, message?: string) => {
  const fallback = String(title || '').trim();
  const text = String(message || '').trim();
  if (text) return { title: fallback || 'Shii-Edu', message: text };

  const [firstLine, ...rest] = fallback.split(/\n+/).map((line) => line.trim()).filter(Boolean);
  return {
    title: firstLine || 'Shii-Edu',
    message: rest.join(' ') || '',
  };
};

const ensureWebToastStyles = () => {
  if (typeof document === 'undefined' || document.getElementById(WEB_TOAST_STYLE_ID)) return;

  const style = document.createElement('style');
  style.id = WEB_TOAST_STYLE_ID;
  style.textContent = `
    #${WEB_TOAST_ROOT_ID} {
      bottom: 18px;
      display: grid;
      gap: 10px;
      left: 18px;
      max-width: min(420px, calc(100vw - 36px));
      position: fixed;
      z-index: 2147483000;
    }

    .shii-edu-toast {
      animation: shiiEduToastIn 170ms cubic-bezier(0.32, 0.72, 0, 1) both;
      background: #ffffff;
      border: 1px solid #d9d8e8;
      border-left-color: var(--toast-accent, #635bff);
      border-radius: 8px;
      box-shadow: 0 18px 48px rgba(15, 23, 42, 0.14);
      color: #010110;
      display: grid;
      gap: 3px;
      padding: 13px 15px;
    }

    .shii-edu-toast-title {
      color: #010110;
      font: 900 13px/18px Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      letter-spacing: 0;
      margin: 0;
    }

    .shii-edu-toast-message {
      color: #3f4054;
      font: 700 12px/18px Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      letter-spacing: 0;
      margin: 0;
    }

    @keyframes shiiEduToastIn {
      from { opacity: 0; transform: translate3d(0, 8px, 0) scale(0.985); }
      to { opacity: 1; transform: translate3d(0, 0, 0) scale(1); }
    }

    @media (prefers-reduced-motion: reduce) {
      .shii-edu-toast { animation: none; }
    }
  `;
  document.head.appendChild(style);
};

export const showWebToast = (
  title: string,
  message = '',
  intent: WebToastIntent = 'info'
): boolean => {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return false;

  ensureWebToastStyles();
  const root = document.getElementById(WEB_TOAST_ROOT_ID) || document.createElement('div');
  root.id = WEB_TOAST_ROOT_ID;
  root.setAttribute('aria-live', intent === 'error' ? 'assertive' : 'polite');
  root.setAttribute('aria-relevant', 'additions');
  if (!root.parentElement) document.body.appendChild(root);

  const toast = document.createElement('section');
  const parsed = parseAlertMessage(title, message);
  const accentByIntent: Record<WebToastIntent, string> = {
    error: '#DC2626',
    info: '#635BFF',
    success: '#047857',
    warning: '#B45309',
  };
  toast.className = 'shii-edu-toast';
  toast.setAttribute('role', intent === 'error' ? 'alert' : 'status');
  toast.style.setProperty('--toast-accent', accentByIntent[intent]);

  const titleElement = document.createElement('p');
  titleElement.className = 'shii-edu-toast-title';
  titleElement.textContent = parsed.title;
  toast.appendChild(titleElement);

  if (parsed.message) {
    const messageElement = document.createElement('p');
    messageElement.className = 'shii-edu-toast-message';
    messageElement.textContent = parsed.message;
    toast.appendChild(messageElement);
  }

  root.appendChild(toast);
  window.setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translate3d(0, 6px, 0)';
    toast.style.transition = 'opacity 150ms cubic-bezier(0.32, 0.72, 0, 1), transform 150ms cubic-bezier(0.32, 0.72, 0, 1)';
    window.setTimeout(() => toast.remove(), 180);
  }, intent === 'error' ? 5600 : 4200);
  return true;
};

export const installWebFeedbackBridge = (): void => {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;
  const patchedWindow = window as Window & {
    __shiiEduAlertPatched?: boolean;
    __shiiEduNativeAlert?: Window['alert'];
  };

  if (patchedWindow.__shiiEduAlertPatched) return;
  patchedWindow.__shiiEduNativeAlert = window.alert.bind(window);
  patchedWindow.alert = (message?: unknown) => {
    showWebToast(String(message || 'Shii-Edu'), '', 'info');
  };
  patchedWindow.__shiiEduAlertPatched = true;
};

export const getReadableErrorMessage = (
  error: unknown,
  fallbackMessage: string
): string => {
  if (error instanceof Error && error.message.trim()) return error.message;
  if (typeof error === 'string' && error.trim()) return error;
  return fallbackMessage;
};

export const showNativeError = (
  title: string,
  error: unknown,
  fallbackMessage: string
): void => {
  const message = getReadableErrorMessage(error, fallbackMessage);

  if (Platform.OS === 'android') {
    ToastAndroid.show(`${title}: ${message}`, ToastAndroid.LONG);
    return;
  }

  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    showWebToast(title, message, 'error');
    return;
  }

  Alert.alert(title, message);
};

export const showNativeMessage = (
  title: string,
  message: string
): void => {
  if (Platform.OS === 'android') {
    ToastAndroid.show(`${title}: ${message}`, ToastAndroid.LONG);
    return;
  }

  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    showWebToast(title, message, 'success');
    return;
  }

  Alert.alert(title, message);
};

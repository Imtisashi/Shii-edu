import { Alert, Platform, ToastAndroid } from 'react-native';

type WebToastIntent = 'error' | 'info' | 'success' | 'warning';
type WebAlertButton = {
  isPreferred?: boolean;
  onPress?: () => void;
  style?: 'cancel' | 'default' | 'destructive';
  text?: string;
};

const WEB_TOAST_ROOT_ID = 'shii-edu-feedback-root';
const WEB_TOAST_STYLE_ID = 'shii-edu-feedback-styles';
const WEB_DIALOG_ROOT_ID = 'shii-edu-dialog-root';

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
      box-shadow: 0 10px 24px rgba(15, 23, 42, 0.10);
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

    #${WEB_DIALOG_ROOT_ID} {
      inset: 0;
      position: fixed;
      z-index: 2147483001;
    }

    .shii-edu-dialog-backdrop {
      align-items: center;
      animation: shiiEduToastIn 140ms cubic-bezier(0.32, 0.72, 0, 1) both;
      background: rgba(15, 23, 42, 0.40);
      display: flex;
      inset: 0;
      justify-content: center;
      padding: 18px;
      position: fixed;
    }

    .shii-edu-dialog {
      background: #ffffff;
      border: 1px solid #d9d8e8;
      border-radius: 8px;
      box-shadow: 0 14px 34px rgba(15, 23, 42, 0.14);
      color: #010110;
      display: grid;
      gap: 14px;
      max-width: min(420px, calc(100vw - 36px));
      padding: 18px;
      width: 100%;
    }

    .shii-edu-dialog-title {
      color: #010110;
      font: 900 16px/22px Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      letter-spacing: 0;
      margin: 0;
    }

    .shii-edu-dialog-message {
      color: #343548;
      font: 700 13px/20px Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      letter-spacing: 0;
      margin: 0;
    }

    .shii-edu-dialog-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      justify-content: flex-end;
    }

    .shii-edu-dialog-button {
      align-items: center;
      background: #ffffff;
      border: 1px solid #c9c8d8;
      border-radius: 8px;
      color: #1f2937;
      cursor: pointer;
      display: inline-flex;
      font: 900 13px/18px Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      justify-content: center;
      min-height: 40px;
      min-width: 78px;
      padding: 9px 13px;
    }

    .shii-edu-dialog-button:hover,
    .shii-edu-dialog-button:focus-visible {
      background: #f8fafc;
      border-color: #8b8aa0;
      outline: none;
    }

    .shii-edu-dialog-button[data-variant='primary'] {
      background: #1d4ed8;
      border-color: #1d4ed8;
      color: #ffffff;
    }

    .shii-edu-dialog-button[data-variant='destructive'] {
      background: #dc2626;
      border-color: #dc2626;
      color: #ffffff;
    }

    .shii-edu-dialog-button[data-variant='primary']:hover,
    .shii-edu-dialog-button[data-variant='destructive']:hover,
    .shii-edu-dialog-button[data-variant='primary']:focus-visible,
    .shii-edu-dialog-button[data-variant='destructive']:focus-visible {
      filter: brightness(0.96);
    }

    @keyframes shiiEduToastIn {
      from { opacity: 0; transform: translate3d(0, 8px, 0) scale(0.985); }
      to { opacity: 1; transform: translate3d(0, 0, 0) scale(1); }
    }

    @media (prefers-reduced-motion: reduce) {
      .shii-edu-toast,
      .shii-edu-dialog-backdrop { animation: none; }
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

export const showWebAlertDialog = (
  title: string,
  message = '',
  buttons: WebAlertButton[] = [{ text: 'Close', style: 'cancel' }]
): boolean => {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return false;

  ensureWebToastStyles();
  const existingRoot = document.getElementById(WEB_DIALOG_ROOT_ID);
  existingRoot?.remove();

  const root = document.createElement('div');
  root.id = WEB_DIALOG_ROOT_ID;

  const backdrop = document.createElement('div');
  backdrop.className = 'shii-edu-dialog-backdrop';

  const dialog = document.createElement('section');
  const titleId = `shii-edu-dialog-title-${Date.now()}`;
  const messageId = `shii-edu-dialog-message-${Date.now()}`;
  const parsed = parseAlertMessage(title, message);
  dialog.className = 'shii-edu-dialog';
  dialog.setAttribute('aria-labelledby', titleId);
  dialog.setAttribute('aria-modal', 'true');
  dialog.setAttribute('role', 'dialog');

  const titleElement = document.createElement('p');
  titleElement.className = 'shii-edu-dialog-title';
  titleElement.id = titleId;
  titleElement.textContent = parsed.title;
  dialog.appendChild(titleElement);

  if (parsed.message) {
    const messageElement = document.createElement('p');
    messageElement.className = 'shii-edu-dialog-message';
    messageElement.id = messageId;
    messageElement.textContent = parsed.message;
    dialog.setAttribute('aria-describedby', messageId);
    dialog.appendChild(messageElement);
  }

  const actions = document.createElement('div');
  actions.className = 'shii-edu-dialog-actions';
  const safeButtons: WebAlertButton[] = buttons.length ? buttons : [{ text: 'Close', style: 'cancel' }];

  const closeDialog = (button?: WebAlertButton) => {
    root.remove();
    window.setTimeout(() => {
      button?.onPress?.();
    }, 0);
  };

  safeButtons.forEach((button, index) => {
    const action = document.createElement('button');
    const isLastDefault = button.style !== 'cancel' && index === safeButtons.length - 1;
    action.className = 'shii-edu-dialog-button';
    action.textContent = button.text || (button.style === 'cancel' ? 'Cancel' : 'OK');
    action.type = 'button';
    action.dataset.variant = button.style === 'destructive'
      ? 'destructive'
      : button.isPreferred || isLastDefault
        ? 'primary'
        : 'secondary';
    action.addEventListener('click', () => closeDialog(button));
    actions.appendChild(action);
  });

  dialog.appendChild(actions);
  backdrop.appendChild(dialog);
  root.appendChild(backdrop);
  document.body.appendChild(root);

  const firstPrimary = actions.querySelector<HTMLButtonElement>("[data-variant='primary']");
  const firstButton = actions.querySelector<HTMLButtonElement>('button');
  (firstPrimary || firstButton)?.focus();
  return true;
};

export const installWebFeedbackBridge = (): void => {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;
  const patchedWindow = window as Window & {
    __shiiEduAlertPatched?: boolean;
    __shiiEduNativeAlert?: Window['alert'];
    __shiiEduNativeReactAlert?: typeof Alert.alert;
  };

  if (patchedWindow.__shiiEduAlertPatched) return;
  patchedWindow.__shiiEduNativeAlert = window.alert.bind(window);
  patchedWindow.__shiiEduNativeReactAlert = Alert.alert.bind(Alert);
  patchedWindow.alert = (message?: unknown) => {
    showWebToast(String(message || 'Shii-Edu'), '', 'info');
  };
  Alert.alert = ((title: string, message?: string, buttons?: WebAlertButton[]) => {
    showWebAlertDialog(String(title || 'Shii-Edu'), String(message || ''), buttons);
  }) as typeof Alert.alert;
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

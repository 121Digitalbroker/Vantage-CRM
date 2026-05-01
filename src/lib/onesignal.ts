/**
 * OneSignal Web (Page SDK v16). Requires VITE_ONESIGNAL_APP_ID at build time.
 * @see https://documentation.onesignal.com/docs/web-push-setup
 */

declare global {
  interface Window {
    OneSignalDeferred?: Array<(OneSignal: OneSignalNamespace) => void | Promise<void>>;
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type OneSignalNamespace = any;

const appId = import.meta.env.VITE_ONESIGNAL_APP_ID as string | undefined;
const safariWebId = import.meta.env.VITE_ONESIGNAL_SAFARI_WEB_ID as string | undefined;

export function initOneSignal(): void {
  if (!appId?.trim()) {
    if (import.meta.env.DEV) {
      console.warn('[OneSignal] Set VITE_ONESIGNAL_APP_ID to enable web push');
    }
    return;
  }

  window.OneSignalDeferred = window.OneSignalDeferred || [];
  window.OneSignalDeferred.push(async (OneSignal: OneSignalNamespace) => {
    await OneSignal.init({
      appId: appId.trim(),
      ...(safariWebId?.trim() ? { safari_web_id: safariWebId.trim() } : {}),
      notifyButton: { enable: true },
      allowLocalhostAsSecureOrigin: import.meta.env.DEV,
    });
  });
}

/**
 * Map CRM user id → OneSignal External ID so you can target this user in the dashboard
 * (Messages → New Push → Audience → Send to particular segment / External user id).
 */
export function syncOneSignalUser(externalUserId: string | null): void {
  if (!appId?.trim()) return;

  window.OneSignalDeferred = window.OneSignalDeferred || [];
  window.OneSignalDeferred.push(async (OneSignal: OneSignalNamespace) => {
    try {
      if (externalUserId?.trim()) {
        await OneSignal.login(externalUserId.trim());
      } else {
        await OneSignal.logout();
      }
    } catch (e) {
      console.warn('[OneSignal] login/logout failed', e);
    }
  });
}

/** Queue a callback after the Page SDK is ready (same pattern as init). */
export function withOneSignal(
  fn: (OneSignal: OneSignalNamespace) => void | Promise<void>
): void {
  if (!appId?.trim()) return;
  window.OneSignalDeferred = window.OneSignalDeferred || [];
  window.OneSignalDeferred.push(fn);
}

/** Ask browser + OneSignal for notification permission (bell / slide prompt). */
export function requestOneSignalPermission(): void {
  withOneSignal(async (OneSignal) => {
    await OneSignal.Notifications?.requestPermission?.();
  });
}

export function getBrowserNotificationPermission(): NotificationPermission | 'unsupported' {
  if (typeof Notification === 'undefined') return 'unsupported';
  return Notification.permission;
}

/** Quick test without OneSignal servers — confirms OS/browser can show a notification. */
export function showLocalTestNotification(): void {
  if (typeof Notification === 'undefined') {
    throw new Error('Notifications not supported in this browser');
  }
  if (Notification.permission !== 'granted') {
    throw new Error('Allow notifications first');
  }
  new Notification('Vantage CRM', {
    body: 'Local test — browser notifications work. Use OneSignal dashboard to send a real push.',
    icon: '/logo.svg',
  });
}

export function isOneSignalConfigured(): boolean {
  return Boolean(appId?.trim());
}

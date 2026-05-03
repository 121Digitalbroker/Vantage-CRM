/**
 * OneSignal Web (Page SDK v16). Requires VITE_ONESIGNAL_APP_ID at build time.
 * @see https://documentation.onesignal.com/docs/web-push-setup
 *
 * Login/logout must run only after init completes — otherwise LoginManager throws
 * (e.g. Cannot read properties of undefined reading minified props).
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

let resolveInitDone: (() => void) | undefined;
let initDonePromise: Promise<void> | undefined;

function ensureInitDonePromise(): Promise<void> {
  if (!initDonePromise) {
    initDonePromise = new Promise<void>((resolve) => {
      resolveInitDone = resolve;
    });
  }
  return initDonePromise;
}

export function initOneSignal(): void {
  if (!appId?.trim()) {
    if (import.meta.env.DEV) {
      console.warn('[OneSignal] Set VITE_ONESIGNAL_APP_ID to enable web push');
    }
    return;
  }

  ensureInitDonePromise();

  window.OneSignalDeferred = window.OneSignalDeferred || [];
  window.OneSignalDeferred.push(async (OneSignal: OneSignalNamespace) => {
    try {
      await OneSignal.init({
        appId: appId.trim(),
        ...(safariWebId?.trim() ? { safari_web_id: safariWebId.trim() } : {}),
        notifyButton: { enable: true },
        allowLocalhostAsSecureOrigin: import.meta.env.DEV,
      });
    } finally {
      resolveInitDone?.();
    }
  });
}

/**
 * Map CRM user id → OneSignal External ID so you can target this user in the dashboard
 * (Messages → New Push → Audience → Send to particular segment / External user id).
 */
export function syncOneSignalUser(externalUserId: string | null): void {
  if (!appId?.trim()) return;

  ensureInitDonePromise();

  window.OneSignalDeferred = window.OneSignalDeferred || [];
  window.OneSignalDeferred.push(async (OneSignal: OneSignalNamespace) => {
    await initDonePromise;
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
  ensureInitDonePromise();
  window.OneSignalDeferred = window.OneSignalDeferred || [];
  window.OneSignalDeferred.push(async (OneSignal: OneSignalNamespace) => {
    await initDonePromise;
    await fn(OneSignal);
  });
}

export type OneSignalPermissionResult = {
  pushSupported: boolean;
  permission: NotificationPermission | 'unsupported';
  /** OneSignal web push subscription on (v16 user model), or null if not exposed */
  optedIn: boolean | null;
};

/**
 * Browser permission and OneSignal subscription are separate in SDK v16.
 * After permission, we must call PushSubscription.optIn() or the user may stay unsubscribed.
 *
 * @see https://documentation.onesignal.com/docs/web-sdk-reference
 */
export function requestOneSignalPermission(): Promise<OneSignalPermissionResult> {
  if (!appId?.trim()) {
    return Promise.resolve({
      pushSupported: false,
      permission: getBrowserNotificationPermission(),
      optedIn: null,
    });
  }

  ensureInitDonePromise();

  return new Promise((resolve) => {
    window.OneSignalDeferred = window.OneSignalDeferred || [];
    window.OneSignalDeferred.push(async (OneSignal: OneSignalNamespace) => {
      await initDonePromise;
      let pushSupported = true;
      try {
        const s = await OneSignal.Notifications?.isPushSupported?.();
        if (s === false) pushSupported = false;
      } catch {
        /* optional API */
      }

      if (pushSupported) {
        try {
          await OneSignal.Notifications?.requestPermission?.();
        } catch (e) {
          console.warn('[OneSignal] requestPermission', e);
        }
        try {
          await OneSignal.User?.PushSubscription?.optIn?.();
        } catch (e) {
          console.warn('[OneSignal] PushSubscription.optIn', e);
        }
      }

      let optedIn: boolean | null = null;
      try {
        const sub = OneSignal.User?.PushSubscription;
        if (sub && typeof sub.optedIn === 'boolean') optedIn = sub.optedIn;
      } catch {
        optedIn = null;
      }

      resolve({
        pushSupported,
        permission: getBrowserNotificationPermission(),
        optedIn,
      });
    });
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

// Install support and push notifications for the public map only; the CRM never loads this.
//
// The OneSignal SDK is not part of the bundle. It is fetched only after a visitor taps "Get updates" and accepts
// the browser's permission question, so everyone else pays nothing for it. OneSignal's site URL must be
// https://zion.ormcrm.com; it refuses to start anywhere else, including localhost and Vercel previews.

/** Public id from the OneSignal dashboard (Settings → Keys & IDs). Empty hides the menu item. */
const ONESIGNAL_APP_ID = '';
const SDK_URL = 'https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js';
const SDK_TIMEOUT_MS = 10000;
const STORAGE_KEY = 'zh-map-updates';

export type PushState = 'unavailable' | 'off' | 'on' | 'blocked';

interface OneSignalSdk {
  init(options: Record<string, unknown>): Promise<void>;
  User: { PushSubscription: { optIn(): Promise<void>; optOut(): Promise<void> } };
}
declare global {
  interface Window { OneSignalDeferred?: ((sdk: OneSignalSdk) => void | Promise<void>)[] }
}

function remembered(): boolean {
  try { return localStorage.getItem(STORAGE_KEY) === 'on'; } catch { return false; }
}
function remember(on: boolean) {
  try {
    if (on) localStorage.setItem(STORAGE_KEY, 'on');
    else localStorage.removeItem(STORAGE_KEY);
  } catch { /* private window */ }
}

export function pushState(): PushState {
  if (!ONESIGNAL_APP_ID || !('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) return 'unavailable';
  if (Notification.permission === 'denied') return 'blocked';
  return Notification.permission === 'granted' && remembered() ? 'on' : 'off';
}

let sdk: Promise<OneSignalSdk> | null = null;

function loadSdk(): Promise<OneSignalSdk> {
  sdk ??= new Promise<OneSignalSdk>((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error('OneSignal timed out')), SDK_TIMEOUT_MS);
    window.OneSignalDeferred = window.OneSignalDeferred ?? [];
    window.OneSignalDeferred.push(async (oneSignal) => {
      try {
        await oneSignal.init({
          appId: ONESIGNAL_APP_ID,
          serviceWorkerPath: 'push/onesignal/OneSignalSDKWorker.js',
          serviceWorkerParam: { scope: '/push/onesignal/' },
        });
        resolve(oneSignal);
      } catch (e) {
        reject(e);
      } finally {
        window.clearTimeout(timer);
      }
    });
    const script = document.createElement('script');
    script.src = SDK_URL;
    script.defer = true;
    script.onerror = () => reject(new Error('OneSignal could not load'));
    document.head.appendChild(script);
  }).catch((e: unknown) => {
    sdk = null; // a later tap may try again
    throw e;
  });
  return sdk;
}

/** Call directly from a tap: the permission question must come from the tap, before anything is downloaded. */
export async function turnOnUpdates(): Promise<PushState> {
  if ((await Notification.requestPermission()) !== 'granted') return pushState();
  const oneSignal = await loadSdk();
  await oneSignal.User.PushSubscription.optIn();
  remember(true);
  return 'on';
}

export async function turnOffUpdates(): Promise<PushState> {
  const oneSignal = await loadSdk();
  await oneSignal.User.PushSubscription.optOut();
  remember(false);
  return 'off';
}

/** Registers the empty install worker once the map has loaded. */
export function registerInstallWorker() {
  if (import.meta.env.DEV || !('serviceWorker' in navigator)) return;
  const register = () => { void navigator.serviceWorker.register('/sw.js').catch(() => undefined); };
  if (document.readyState === 'complete') register();
  else window.addEventListener('load', register, { once: true });
}

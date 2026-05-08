/**
 * WebPushService — Web Push subscribe/unsubscribe voor PWA
 *
 * Werkt alleen op web (Platform.OS === 'web').
 * Native push loopt via expo-notifications (NotificationService.ts).
 *
 * Flow:
 *   1. Browser vraagt toestemming
 *   2. Subscribe via PushManager met VAPID public key
 *   3. Subscription opslaan in Supabase (upsert op endpoint)
 */

const VAPID_PUBLIC_KEY = process.env.EXPO_PUBLIC_VAPID_PUBLIC_KEY ?? '';
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return new Uint8Array([...rawData].map(c => c.charCodeAt(0))).buffer as ArrayBuffer;
}

export type PushSubscribeResult =
  | { subscribed: true }
  | { subscribed: false; reason: 'no_sw' | 'no_push' | 'no_vapid' | 'denied' | 'save_failed' | 'error'; message?: string };

/** Vraag toestemming + subscribe + sla op in Supabase */
export async function subscribeToWebPush(
  projectId: string,
  userId: string,
  supabaseAccessToken: string
): Promise<PushSubscribeResult> {
  if (typeof window === 'undefined') return { subscribed: false, reason: 'no_sw' };
  if (!('serviceWorker' in navigator)) return { subscribed: false, reason: 'no_sw' };
  if (!('PushManager' in window)) return { subscribed: false, reason: 'no_push' };
  if (!VAPID_PUBLIC_KEY) return { subscribed: false, reason: 'no_vapid' };

  try {
    // Vraag toestemming (moet na een user gesture worden aangeroepen)
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return { subscribed: false, reason: 'denied' };

    // Wacht op service worker
    const registration = await navigator.serviceWorker.ready;

    // Hergebruik bestaande subscription of maak nieuwe aan
    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
    }

    // Sla op in Supabase (upsert op endpoint — voorkomt duplicaten)
    const subJson = subscription.toJSON();
    const response = await fetch(`${SUPABASE_URL}/rest/v1/push_subscriptions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseAccessToken}`,
        'apikey': SUPABASE_ANON_KEY,
        'Prefer': 'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify({
        user_id: userId,
        project_id: projectId,
        endpoint: subJson.endpoint,
        keys_p256dh: subJson.keys?.p256dh ?? '',
        keys_auth: subJson.keys?.auth ?? '',
        device_label: `${(navigator as Navigator & { platform?: string }).platform ?? 'web'} · ${new Date().toLocaleDateString('nl-NL')}`,
        is_active: true,
        updated_at: new Date().toISOString(),
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error('Push subscription opslaan mislukt:', text);
      return { subscribed: false, reason: 'save_failed', message: text };
    }

    console.log('✅ Web Push subscription actief');
    return { subscribed: true };
  } catch (err) {
    console.error('subscribeToWebPush error:', err);
    return { subscribed: false, reason: 'error', message: String(err) };
  }
}

/** Opzeggen van push subscription */
export async function unsubscribeFromWebPush(supabaseAccessToken: string): Promise<void> {
  if (!('serviceWorker' in navigator)) return;
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (!subscription) return;

    const endpoint = subscription.endpoint;
    await subscription.unsubscribe();

    // Deactiveer in Supabase
    await fetch(`${SUPABASE_URL}/rest/v1/push_subscriptions?endpoint=eq.${encodeURIComponent(endpoint)}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseAccessToken}`,
        'apikey': SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ is_active: false }),
    });
  } catch (err) {
    console.error('unsubscribeFromWebPush error:', err);
  }
}

/** Check of Web Push ondersteund wordt door deze browser */
export function isPushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

/** Geeft de huidige toestemmingsstatus terug */
export function getPushPermission(): NotificationPermission | null {
  if (typeof window === 'undefined' || !('Notification' in window)) return null;
  return Notification.permission;
}

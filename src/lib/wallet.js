import { functionUrl, supabase } from './supabase';

export function detectPlatform() {
  const ua = navigator.userAgent || '';
  const iPadOS = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
  if (/iPhone|iPad|iPod/i.test(ua) || iPadOS) return 'apple';
  if (/Android/i.test(ua)) return 'google';
  return 'web';
}

/** Which wallet integrations the backend has credentials for. */
export async function walletAvailability() {
  const check = (url) =>
    fetch(url)
      .then((r) => (r.ok ? r.json() : { configured: false }))
      .then((b) => Boolean(b.configured))
      .catch(() => false);
  const [apple, google] = await Promise.all([
    check(functionUrl('apple-wallet/status')),
    check(functionUrl('google-wallet')),
  ]);
  return { apple, google };
}

/** cards: [{ id, token }] — one tap adds every card (a .pkpasses bundle when there are several). */
export function addToAppleWallet(cards) {
  const c = cards.map((card) => `${card.id}.${card.token}`).join(',');
  window.location.href = `${functionUrl('apple-wallet/pass')}?c=${c}`;
}

export async function addToGoogleWallet(cards) {
  const res = await fetch(functionUrl('google-wallet'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cards: cards.map(({ id, token }) => ({ id, token })) }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.saveUrl) throw new Error(body.error || 'Could not create Google Wallet pass');
  window.location.href = body.saveUrl;
}

/** Fire-and-forget: refresh passes already sitting in customers' wallets. */
export function notifyPassUpdated(payload) {
  supabase.functions.invoke('pass-updated', { body: payload }).catch(() => {});
}

const savedKey = (slug) => `xtracup:card:${slug}`;

export function rememberCard(slug, card) {
  try {
    localStorage.setItem(savedKey(slug), JSON.stringify(card));
  } catch {
    /* storage unavailable */
  }
}

export function savedCard(slug) {
  try {
    return JSON.parse(localStorage.getItem(savedKey(slug)) || 'null');
  } catch {
    return null;
  }
}

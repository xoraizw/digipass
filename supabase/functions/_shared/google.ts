// Google Wallet loyalty passes: "Save to Google Wallet" links + REST updates.
// One Google "class" per card type (program), one "object" per card a customer holds.
import { importPKCS8, SignJWT } from 'npm:jose@5.9.6';
import { env, type Row } from './http.ts';
import { cardColor, cardSummary } from './card.ts';

const API = 'https://walletobjects.googleapis.com/walletobjects/v1';

function serviceAccount(): { client_email: string; private_key: string } | null {
  const raw = env('GOOGLE_SERVICE_ACCOUNT_JSON').trim();
  if (!raw) return null;
  try {
    return JSON.parse(raw.startsWith('{') ? raw : atob(raw));
  } catch {
    return null;
  }
}

export const googleConfigured = () => Boolean(serviceAccount() && env('GOOGLE_ISSUER_ID'));

const safe = (s: string) => s.replace(/[^a-zA-Z0-9_.-]/g, '_');
const classId = (program: Row) => `${env('GOOGLE_ISSUER_ID')}.program_${safe(program.id)}`;
const objectId = (c: Row) => `${env('GOOGLE_ISSUER_ID')}.card_${safe(c.id)}`;

export function loyaltyClass(shop: Row, program: Row) {
  const logo = shop.logo_url || `${env('PUBLIC_APP_URL')}/pass-logo.png`;
  return {
    id: classId(program),
    issuerName: shop.name,
    programName: program.name,
    programLogo: {
      sourceUri: { uri: logo },
      contentDescription: { defaultValue: { language: 'en-US', value: `${shop.name} logo` } },
    },
    hexBackgroundColor: cardColor(shop, program),
    reviewStatus: 'UNDER_REVIEW',
    multipleDevicesAndHoldersAllowedStatus: 'ONE_USER_ALL_DEVICES',
  };
}

export function loyaltyObject(c: Row, shop: Row, program: Row) {
  const s = cardSummary(c, program);
  const modules = [{ id: 'status', header: s.headline, body: s.title }];
  if (shop.promo_text) modules.push({ id: 'promo', header: 'Current offer', body: shop.promo_text });
  modules.push({ id: 'how', header: 'How it works', body: s.howItWorks });

  return {
    id: objectId(c),
    classId: classId(program),
    state: 'ACTIVE',
    accountId: c.email,
    accountName: c.name,
    loyaltyPoints: { label: s.balanceLabel, balance: { string: s.balance } },
    secondaryLoyaltyPoints: { label: 'Visits', balance: { int: c.visits } },
    barcode: { type: 'QR_CODE', value: c.id, alternateText: c.id.slice(0, 8).toUpperCase() },
    textModulesData: modules,
  };
}

async function signingKey() {
  return importPKCS8(serviceAccount()!.private_key, 'RS256');
}

/** One link that saves every given card (each with its shop + program embedded). */
export async function saveUrl(cards: Row[]) {
  const origin = env('PUBLIC_APP_URL');
  const classes = new Map(cards.map((c) => [c.program.id, loyaltyClass(c.shop, c.program)]));
  const jwt = await new SignJWT({
    origins: origin ? [origin] : [],
    typ: 'savetowallet',
    payload: {
      loyaltyClasses: [...classes.values()],
      loyaltyObjects: cards.map((c) => loyaltyObject(c, c.shop, c.program)),
    },
  })
    .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
    .setIssuer(serviceAccount()!.client_email)
    .setAudience('google')
    .setIssuedAt()
    .sign(await signingKey());
  return `https://pay.google.com/gp/v/save/${jwt}`;
}

let cachedToken: { value: string; exp: number } | null = null;

async function accessToken() {
  if (cachedToken && cachedToken.exp > Date.now() + 60_000) return cachedToken.value;
  const assertion = await new SignJWT({ scope: 'https://www.googleapis.com/auth/wallet_object.issuer' })
    .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
    .setIssuer(serviceAccount()!.client_email)
    .setAudience('https://oauth2.googleapis.com/token')
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(await signingKey());
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
  });
  if (!res.ok) throw new Error(`Google auth failed: ${await res.text()}`);
  const body = await res.json();
  cachedToken = { value: body.access_token, exp: Date.now() + body.expires_in * 1000 };
  return cachedToken.value;
}

async function patch(path: string, body: unknown) {
  const res = await fetch(`${API}/${path}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${await accessToken()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  // 404 just means the customer never saved the pass (or the class was never created).
  return res.status;
}

export const updateGoogleObject = (c: Row) =>
  patch(`loyaltyObject/${encodeURIComponent(objectId(c))}`, loyaltyObject(c, c.shop, c.program));

export const updateGoogleClass = (shop: Row, program: Row) =>
  patch(`loyaltyClass/${encodeURIComponent(classId(program))}`, loyaltyClass(shop, program));

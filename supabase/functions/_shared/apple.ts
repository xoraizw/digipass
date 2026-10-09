// Apple Wallet (.pkpass) generation, signing and APNs update pushes.
import forge from 'npm:node-forge@1.3.1';
import { zipSync } from 'npm:fflate@0.8.2';
import { env, type Row } from './http.ts';
import { DEFAULT_ICON_3X_B64, DEFAULT_ICON_B64 } from './default-icon.ts';
import { cardColor, cardSummary } from './card.ts';

/** Secrets may be stored as raw PEM (with real or escaped newlines) or base64 of the PEM. */
function pem(key: string): string {
  const v = env(key).trim();
  if (!v) return '';
  return v.startsWith('-----') ? v.replace(/\\n/g, '\n') : atob(v);
}

export const passTypeId = () => env('APPLE_PASS_TYPE_ID');

export function appleConfigured(): boolean {
  return Boolean(
    passTypeId() && env('APPLE_TEAM_ID') && pem('APPLE_PASS_CERT') && pem('APPLE_PASS_KEY') && pem('APPLE_WWDR_CERT'),
  );
}

function privateKey() {
  const passphrase = env('APPLE_PASS_KEY_PASSPHRASE');
  const key = passphrase
    ? forge.pki.decryptRsaPrivateKey(pem('APPLE_PASS_KEY'), passphrase)
    : forge.pki.privateKeyFromPem(pem('APPLE_PASS_KEY'));
  if (!key) throw new Error('Could not read APPLE_PASS_KEY (wrong passphrase?)');
  return key;
}

const toBinary = (bytes: Uint8Array) => {
  let out = '';
  for (let i = 0; i < bytes.length; i += 0x8000) out += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return out;
};
const fromBinary = (s: string) => Uint8Array.from(s, (ch) => ch.charCodeAt(0));
const fromB64 = (b64: string) => fromBinary(atob(b64));

function rgb(hex: string) {
  let h = (hex || '#000000').replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h, 16);
  return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
}

async function sha1Hex(data: Uint8Array) {
  const digest = await crypto.subtle.digest('SHA-1', data as Uint8Array<ArrayBuffer>);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function signManifest(manifest: Uint8Array): Uint8Array {
  const cert = forge.pki.certificateFromPem(pem('APPLE_PASS_CERT'));
  const wwdr = forge.pki.certificateFromPem(pem('APPLE_WWDR_CERT'));
  const p7 = forge.pkcs7.createSignedData();
  p7.content = forge.util.createBuffer(toBinary(manifest));
  p7.addCertificate(cert);
  p7.addCertificate(wwdr);
  p7.addSigner({
    key: privateKey(),
    certificate: cert,
    digestAlgorithm: forge.pki.oids.sha256,
    authenticatedAttributes: [
      { type: forge.pki.oids.contentType, value: forge.pki.oids.data },
      { type: forge.pki.oids.messageDigest },
      { type: forge.pki.oids.signingTime, value: new Date() },
    ],
  });
  p7.sign({ detached: true });
  return fromBinary(forge.asn1.toDer(p7.toAsn1()).getBytes());
}

async function fetchPng(url?: string | null): Promise<Uint8Array | null> {
  if (!url) return null;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const bytes = new Uint8Array(await res.arrayBuffer());
    // Wallet only accepts PNG; check the signature.
    return bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 ? bytes : null;
  } catch {
    return null;
  }
}

export function passJson(c: Row, shop: Row, program: Row) {
  const s = cardSummary(c, program);
  const secondary = [{ key: 'member', label: 'MEMBER', value: c.name }];
  if (program.kind === 'subscription' && c.packs_purchased > 0) {
    secondary.push({ key: 'packs', label: 'PACKS BOUGHT', value: String(c.packs_purchased) });
  }
  const back = [
    program.description && { key: 'about', label: program.name, value: program.description },
    shop.promo_text && { key: 'promo', label: 'Current offer', value: shop.promo_text },
    { key: 'how', label: 'How it works', value: s.howItWorks },
    shop.address && { key: 'address', label: 'Find us', value: shop.address },
    { key: 'visits', label: 'Total visits', value: String(c.visits) },
  ].filter(Boolean);

  return {
    formatVersion: 1,
    passTypeIdentifier: passTypeId(),
    teamIdentifier: env('APPLE_TEAM_ID'),
    serialNumber: c.id,
    organizationName: shop.name,
    description: `${shop.name} ${program.name}`,
    logoText: shop.name,
    foregroundColor: rgb(shop.text_color),
    labelColor: rgb(shop.accent_color),
    backgroundColor: rgb(cardColor(shop, program)),
    webServiceURL: `${env('SUPABASE_URL')}/functions/v1/apple-wallet`,
    authenticationToken: c.pass_token,
    barcodes: [
      { format: 'PKBarcodeFormatQR', message: c.id, messageEncoding: 'iso-8859-1', altText: c.id.slice(0, 8).toUpperCase() },
    ],
    storeCard: {
      headerFields: [
        { key: 'balance', label: s.balanceLabel.toUpperCase(), value: s.balance, changeMessage: s.changeMessage },
      ],
      primaryFields: [{ key: 'title', label: s.headline.toUpperCase(), value: s.title, changeMessage: '%@' }],
      secondaryFields: secondary,
      backFields: back,
    },
  };
}

export async function buildPkpass(c: Row): Promise<Uint8Array> {
  const logo = await fetchPng(c.shop.logo_url);
  const icon = fromB64(DEFAULT_ICON_B64);
  const icon3 = fromB64(DEFAULT_ICON_3X_B64);

  const files: Record<string, Uint8Array> = {
    'pass.json': new TextEncoder().encode(JSON.stringify(passJson(c, c.shop, c.program))),
    'icon.png': logo ?? icon,
    'icon@2x.png': logo ?? icon3,
    'logo.png': logo ?? icon,
    'logo@2x.png': logo ?? icon3,
  };

  const manifest: Record<string, string> = {};
  for (const [name, data] of Object.entries(files)) manifest[name] = await sha1Hex(data);
  const manifestBytes = new TextEncoder().encode(JSON.stringify(manifest));

  return zipSync({
    ...files,
    'manifest.json': manifestBytes,
    signature: signManifest(manifestBytes),
  });
}

/** Several passes in one .pkpasses bundle, so Wallet adds them all in one tap (iOS 15+). */
export async function buildBundle(cards: Row[]): Promise<Uint8Array> {
  const entries: Record<string, Uint8Array> = {};
  for (const [i, c] of cards.entries()) entries[`card-${i + 1}.pkpass`] = await buildPkpass(c);
  return zipSync(entries);
}

/**
 * Tells Wallet on each device to fetch the latest pass (via our web service).
 * APNs for passes authenticates with the pass certificate itself, so this needs
 * TLS client certificates (Deno.createHttpClient). Best effort: returns a summary.
 */
export async function pushApple(pushTokens: string[]) {
  if (!pushTokens.length || !appleConfigured()) return { sent: 0 };
  let client: Deno.HttpClient;
  try {
    const cert = pem('APPLE_PASS_CERT');
    const key = forge.pki.privateKeyToPem(privateKey());
    // deno-lint-ignore no-explicit-any
    client = Deno.createHttpClient({ cert, key, certChain: cert, privateKey: key } as any);
  } catch (e) {
    return { sent: 0, error: `APNs client unavailable: ${(e as Error).message}` };
  }
  let sent = 0;
  const failures: string[] = [];
  await Promise.all(
    [...new Set(pushTokens)].map(async (token) => {
      try {
        const res = await fetch(`https://api.push.apple.com/3/device/${token}`, {
          method: 'POST',
          // deno-lint-ignore no-explicit-any
          client,
          headers: { 'apns-topic': passTypeId(), 'content-type': 'application/json' },
          body: '{}',
        } as any);
        if (res.ok) sent++;
        else failures.push(`${res.status} ${await res.text()}`);
      } catch (e) {
        failures.push((e as Error).message);
      }
    }),
  );
  client.close();
  return { sent, failures };
}

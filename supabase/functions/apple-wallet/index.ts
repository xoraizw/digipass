// Apple Wallet: pass download + the PassKit web service Apple devices call.
//   GET  /apple-wallet/status                    -> { configured }
//   GET  /apple-wallet/pass?c=id.token[,id.token] -> .pkpass (one card) or .pkpasses bundle
//   PassKit web service (https://developer.apple.com/documentation/walletpasses):
//   POST   /v1/devices/:device/registrations/:passType/:serial
//   DELETE /v1/devices/:device/registrations/:passType/:serial
//   GET    /v1/devices/:device/registrations/:passType?passesUpdatedSince=
//   GET    /v1/passes/:passType/:serial
//   POST   /v1/log
import { admin, corsHeaders, json, loadCustomer, markWalletAdded, type Row } from '../_shared/http.ts';
import { appleConfigured, buildBundle, buildPkpass, passTypeId } from '../_shared/apple.ts';

const pkpassResponse = (bytes: Uint8Array, c: Row, download: boolean) =>
  new Response(bytes as Uint8Array<ArrayBuffer>, {
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/vnd.apple.pkpass',
      'Last-Modified': new Date(c.updated_at).toUTCString(),
      'Cache-Control': 'no-store',
      ...(download ? { 'Content-Disposition': `attachment; filename="${c.shop.slug}.pkpass"` } : {}),
    },
  });

async function authorized(req: Request, serial: string) {
  const token = (req.headers.get('Authorization') ?? '').replace(/^ApplePass\s+/i, '');
  const c = await loadCustomer(serial);
  return c && token && c.pass_token === token ? c : null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const url = new URL(req.url);
  const path = url.pathname.replace(/^.*?\/apple-wallet/, '') || '/';
  const parts = path.split('/').filter(Boolean);

  if (path === '/status') return json({ configured: appleConfigured() });
  if (!appleConfigured()) return json({ error: 'apple_not_configured' }, 501);

  try {
    // Pass download from the customer card page: ?c=id.token,id.token (one or more cards)
    if (req.method === 'GET' && parts[0] === 'pass') {
      const pairs = (url.searchParams.get('c') ?? '').split(',').filter(Boolean).slice(0, 10);
      const cards: Row[] = [];
      for (const pair of pairs) {
        const [id, token] = pair.split('.');
        const c = await loadCustomer(id);
        if (!c || c.pass_token !== token) return json({ error: 'not_found' }, 404);
        if (c.platform !== 'apple') await admin.from('customers').update({ platform: 'apple' }).eq('id', c.id);
        cards.push(c);
      }
      if (!cards.length) return json({ error: 'not_found' }, 404);
      if (cards.length === 1) return pkpassResponse(await buildPkpass(cards[0]), cards[0], true);
      return new Response((await buildBundle(cards)) as Uint8Array<ArrayBuffer>, {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/vnd.apple.pkpasses',
          'Content-Disposition': `attachment; filename="${cards[0].shop.slug}.pkpasses"`,
          'Cache-Control': 'no-store',
        },
      });
    }

    if (parts[0] !== 'v1') return json({ error: 'not_found' }, 404);

    // POST/DELETE /v1/devices/:device/registrations/:passType/:serial
    if (parts[1] === 'devices' && parts[3] === 'registrations' && parts.length === 6) {
      const [, , device, , passType, serial] = parts;
      if (passType !== passTypeId()) return new Response(null, { status: 404 });
      const c = await authorized(req, serial);
      if (!c) return new Response(null, { status: 401 });

      if (req.method === 'POST') {
        const { pushToken } = await req.json();
        const { data: existing } = await admin
          .from('apple_registrations')
          .select('push_token')
          .match({ device_library_id: device, pass_type_id: passType, serial_number: serial })
          .maybeSingle();
        await admin.from('apple_registrations').upsert({
          device_library_id: device,
          pass_type_id: passType,
          serial_number: serial,
          push_token: pushToken,
        });
        await markWalletAdded(c, 'apple');
        return new Response(null, { status: existing ? 200 : 201 });
      }
      if (req.method === 'DELETE') {
        await admin
          .from('apple_registrations')
          .delete()
          .match({ device_library_id: device, pass_type_id: passType, serial_number: serial });
        return new Response(null, { status: 200 });
      }
    }

    // GET /v1/devices/:device/registrations/:passType?passesUpdatedSince=
    if (req.method === 'GET' && parts[1] === 'devices' && parts[3] === 'registrations' && parts.length === 5) {
      const [, , device, , passType] = parts;
      const { data: regs } = await admin
        .from('apple_registrations')
        .select('serial_number')
        .match({ device_library_id: device, pass_type_id: passType });
      if (!regs?.length) return new Response(null, { status: 204 });

      let query = admin.from('customers').select('id, updated_at').in('id', regs.map((r) => r.serial_number));
      const since = Number(url.searchParams.get('passesUpdatedSince'));
      if (since) query = query.gt('updated_at', new Date(since).toISOString());
      const { data: changed } = await query;
      if (!changed?.length) return new Response(null, { status: 204 });

      const lastUpdated = Math.max(...changed.map((c) => new Date(c.updated_at).getTime()));
      return json({ serialNumbers: changed.map((c) => c.id), lastUpdated: String(lastUpdated) });
    }

    // GET /v1/passes/:passType/:serial
    if (req.method === 'GET' && parts[1] === 'passes' && parts.length === 4) {
      const c = await authorized(req, parts[3]);
      if (!c) return new Response(null, { status: 401 });
      const since = req.headers.get('If-Modified-Since');
      if (since && new Date(c.updated_at).getTime() <= new Date(since).getTime() + 999) {
        return new Response(null, { status: 304 });
      }
      return pkpassResponse(await buildPkpass(c), c, false);
    }

    if (req.method === 'POST' && parts[1] === 'log') {
      console.log('[apple-wallet log]', JSON.stringify(await req.json().catch(() => ({}))));
      return new Response(null, { status: 200 });
    }

    return json({ error: 'not_found' }, 404);
  } catch (e) {
    console.error(e);
    return json({ error: (e as Error).message }, 500);
  }
});

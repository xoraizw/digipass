// Google Wallet: returns one signed "Save to Google Wallet" link for one or more cards.
//   GET  /google-wallet                                -> { configured }
//   POST /google-wallet { cards: [{ id, token }, ...] } -> { saveUrl }
import { corsHeaders, json, loadCustomer, markWalletAdded, type Row } from '../_shared/http.ts';
import { googleConfigured, saveUrl } from '../_shared/google.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method === 'GET') return json({ configured: googleConfigured() });
  if (!googleConfigured()) return json({ error: 'google_not_configured' }, 501);

  try {
    const body = await req.json();
    const requested: { id: string; token: string }[] = body.cards ?? [{ id: body.customer_id, token: body.token }];
    const cards: Row[] = [];
    for (const { id, token } of requested.slice(0, 10)) {
      const c = await loadCustomer(id);
      if (!c || c.pass_token !== token) return json({ error: 'not_found' }, 404);
      cards.push(c);
    }
    if (!cards.length) return json({ error: 'not_found' }, 404);

    const url = await saveUrl(cards);
    // Google has no "added" callback without extra setup, so count the save link as added.
    for (const c of cards) await markWalletAdded(c, 'google');
    return json({ saveUrl: url });
  } catch (e) {
    console.error(e);
    return json({ error: (e as Error).message }, 500);
  }
});

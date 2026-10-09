// Called by the dashboard after stamps/branding change, to refresh passes already in wallets.
//   POST { customer_id }  -> refresh one customer's pass
//   POST { shop_id }      -> refresh the pass design for every card of a shop (branding or card types changed)
import { admin, corsHeaders, json, loadCustomer } from '../_shared/http.ts';
import { appleConfigured, pushApple } from '../_shared/apple.ts';
import { googleConfigured, updateGoogleClass, updateGoogleObject } from '../_shared/google.ts';

async function canManage(userId: string, shop: { owner_id: string }) {
  if (shop.owner_id === userId) return true;
  const { data } = await admin.from('platform_admins').select('user_id').eq('user_id', userId).maybeSingle();
  return Boolean(data);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  const { data: auth } = await admin.auth.getUser(jwt);
  if (!auth?.user) return json({ error: 'unauthorized' }, 401);

  try {
    const { customer_id, shop_id } = await req.json();
    const result: Record<string, unknown> = {};

    if (customer_id) {
      const c = await loadCustomer(customer_id);
      if (!c || !(await canManage(auth.user.id, c.shop))) return json({ error: 'not_found' }, 404);
      if (googleConfigured()) result.google = await updateGoogleObject(c);
      if (appleConfigured()) {
        const { data: regs } = await admin.from('apple_registrations').select('push_token').eq('serial_number', c.id);
        result.apple = await pushApple((regs ?? []).map((r) => r.push_token));
      }
    } else if (shop_id) {
      const { data: shop } = await admin.from('shops').select('*').eq('id', shop_id).maybeSingle();
      if (!shop || !(await canManage(auth.user.id, shop))) return json({ error: 'not_found' }, 404);
      if (googleConfigured()) {
        const { data: programs } = await admin.from('programs').select('*').eq('shop_id', shop.id);
        result.google = await Promise.all((programs ?? []).map((p) => updateGoogleClass(shop, p)));
      }
      if (appleConfigured()) {
        // Touch customers so the PassKit web service reports them as updated, then push.
        await admin.from('customers').update({ updated_at: new Date().toISOString() }).eq('shop_id', shop.id);
        const { data: regs } = await admin
          .from('apple_registrations')
          .select('push_token, customers!inner(shop_id)')
          .eq('customers.shop_id', shop.id);
        result.apple = await pushApple((regs ?? []).map((r) => r.push_token));
      }
    } else {
      return json({ error: 'customer_id or shop_id required' }, 400);
    }

    return json({ ok: true, ...result });
  } catch (e) {
    console.error(e);
    return json({ error: (e as Error).message }, 500);
  }
});

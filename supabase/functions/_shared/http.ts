import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
};

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

export const env = (key: string) => Deno.env.get(key) ?? '';

export const admin = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), {
  auth: { persistSession: false },
});

// deno-lint-ignore no-explicit-any
export type Row = Record<string, any>;

/** Loads a card (customer row) with its shop and program embedded. */
export async function loadCustomer(id: string): Promise<Row | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id ?? '')) return null;
  const { data } = await admin.from('customers').select('*, shop:shops(*), program:programs(*)').eq('id', id).maybeSingle();
  return data;
}

export async function markWalletAdded(customer: Row, platform: 'apple' | 'google') {
  if (customer.wallet_added_at) return;
  await admin
    .from('customers')
    .update({ wallet_added_at: new Date().toISOString(), platform })
    .eq('id', customer.id);
  await admin
    .from('events')
    .insert({ shop_id: customer.shop_id, program_id: customer.program_id, customer_id: customer.id, type: 'wallet_added' });
}

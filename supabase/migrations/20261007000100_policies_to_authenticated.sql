-- Anonymous visitors only use the RPCs; scope table policies to signed-in users.
alter policy "admins read admins" on public.platform_admins to authenticated;
alter policy "owner or admin reads shop" on public.shops to authenticated;
alter policy "owner creates shop" on public.shops to authenticated;
alter policy "owner or admin updates shop" on public.shops to authenticated;
alter policy "admin deletes shop" on public.shops to authenticated;
alter policy "shop reads customers" on public.customers to authenticated;
alter policy "shop updates customers" on public.customers to authenticated;
alter policy "shop deletes customers" on public.customers to authenticated;
alter policy "shop reads events" on public.events to authenticated;

alter function public.protect_shop_billing() set search_path = public;
alter function public.touch_updated_at() set search_path = public;
alter function public.shop_public_json(public.shops) set search_path = public;

-- Owner/staff functions: signed-in users only (they also check shop ownership internally).
revoke execute on function public.add_stamps(uuid, int) from public, anon;
revoke execute on function public.redeem_reward(uuid) from public, anon;
revoke execute on function public.set_membership(uuid, boolean, date) from public, anon;
revoke execute on function public.shop_analytics(uuid, int) from public, anon;
revoke execute on function public.owns_shop(uuid) from public, anon;
revoke execute on function public.is_platform_admin() from public, anon;
grant execute on function public.add_stamps(uuid, int) to authenticated;
grant execute on function public.redeem_reward(uuid) to authenticated;
grant execute on function public.set_membership(uuid, boolean, date) to authenticated;
grant execute on function public.shop_analytics(uuid, int) to authenticated;
grant execute on function public.owns_shop(uuid) to authenticated;
grant execute on function public.is_platform_admin() to authenticated;

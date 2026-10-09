-- Multiple cards per shop: loyalty (stamps -> reward) and subscription (prepaid cup packs).
-- A row in `customers` is now one card held by one person; a person = same email within a shop.

create table public.programs (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops on delete cascade,
  kind text not null check (kind in ('loyalty', 'subscription')),
  name text not null check (char_length(name) between 1 and 40),
  description text,
  card_color text,
  is_active boolean not null default true,
  sort_order int not null default 0,
  -- loyalty
  stamps_required int check (stamps_required between 1 and 30),
  reward_text text,
  welcome_stamps int not null default 0 check (welcome_stamps between 0 and 10),
  -- subscription (prepaid pack)
  cups_included int check (cups_included between 1 and 200),
  pack_price numeric(10, 2) check (pack_price >= 0),
  regular_cup_price numeric(10, 2) check (regular_cup_price >= 0),
  valid_days int check (valid_days between 1 and 730),
  created_at timestamptz not null default now(),
  constraint loyalty_fields check (kind <> 'loyalty' or (stamps_required is not null and reward_text is not null)),
  constraint pack_fields check (kind <> 'subscription' or (cups_included is not null and pack_price is not null))
);
create index programs_shop_idx on public.programs (shop_id, sort_order);

-- Every existing shop gets its current stamp program as a loyalty card.
insert into public.programs (shop_id, kind, name, stamps_required, reward_text, welcome_stamps)
select id, 'loyalty', 'Loyalty card', stamps_required, reward_text, welcome_stamps from public.shops;

alter table public.customers
  add column program_id uuid references public.programs on delete restrict,
  add column credits int not null default 0 check (credits >= 0),
  add column credits_total int not null default 0,
  add column packs_purchased int not null default 0,
  add column pack_expires_at timestamptz;

update public.customers c set program_id = p.id from public.programs p where p.shop_id = c.shop_id;
alter table public.customers alter column program_id set not null;
alter table public.customers drop constraint customers_shop_id_email_key;
alter table public.customers add constraint customers_program_email_key unique (program_id, email);
create index customers_shop_email_idx on public.customers (shop_id, email);
alter table public.customers drop column membership_active, drop column membership_expires_at;

drop function if exists public.set_membership(uuid, boolean, date);
drop function if exists public.join_shop(text, text, text, int, text);

alter table public.shops
  drop column stamps_required, drop column reward_text, drop column welcome_stamps,
  drop column membership_name, drop column membership_perks;

alter table public.events
  add column program_id uuid references public.programs on delete cascade,
  add column value numeric(10, 2);
update public.events e set program_id = c.program_id from public.customers c where c.id = e.customer_id;
delete from public.events where type = 'membership';
alter table public.events drop constraint events_type_check;
alter table public.events add constraint events_type_check
  check (type in ('signup', 'stamp', 'redeem', 'wallet_added', 'purchase', 'cup'));

-- RLS for programs (public reads go through get_public_shop)
alter table public.programs enable row level security;
create policy "shop reads programs" on public.programs
  for select to authenticated using (public.owns_shop(shop_id));
create policy "shop creates programs" on public.programs
  for insert to authenticated with check (public.owns_shop(shop_id));
create policy "shop updates programs" on public.programs
  for update to authenticated using (public.owns_shop(shop_id));
create policy "shop deletes programs" on public.programs
  for delete to authenticated using (public.owns_shop(shop_id));

-- Public JSON shapes ------------------------------------------------------
create or replace function public.shop_public_json(s public.shops)
returns json language sql stable set search_path = public as $$
  select json_build_object(
    'id', s.id, 'slug', s.slug, 'name', s.name, 'address', s.address, 'logo_url', s.logo_url,
    'brand_color', s.brand_color, 'accent_color', s.accent_color, 'text_color', s.text_color,
    'welcome_title', s.welcome_title, 'welcome_body', s.welcome_body, 'promo_text', s.promo_text
  );
$$;

create or replace function public.program_public_json(p public.programs)
returns json language sql stable set search_path = public as $$
  select json_build_object(
    'id', p.id, 'kind', p.kind, 'name', p.name, 'description', p.description, 'card_color', p.card_color,
    'stamps_required', p.stamps_required, 'reward_text', p.reward_text, 'welcome_stamps', p.welcome_stamps,
    'cups_included', p.cups_included, 'pack_price', p.pack_price, 'regular_cup_price', p.regular_cup_price,
    'valid_days', p.valid_days
  );
$$;

create or replace function public.get_public_shop(p_slug text)
returns json language sql stable security definer set search_path = public as $$
  select (public.shop_public_json(s)::jsonb || jsonb_build_object('programs', coalesce((
    select jsonb_agg(public.program_public_json(p)::jsonb order by p.sort_order, p.created_at)
    from programs p where p.shop_id = s.id and p.is_active
  ), '[]'::jsonb)))::json
  from shops s
  where s.slug = lower(p_slug) and s.is_live and s.plan_status <> 'cancelled';
$$;

create or replace function public.join_shop(
  p_slug text, p_name text, p_email text, p_age int, p_platform text, p_program_ids uuid[]
) returns json language plpgsql security definer set search_path = public as $$
declare
  s shops;
  p programs;
  c customers;
  v_email text := lower(trim(p_email));
  v_existing boolean;
  v_cards json[] := '{}';
begin
  select * into s from shops where slug = lower(p_slug) and is_live and plan_status <> 'cancelled';
  if not found then raise exception 'This shop is not accepting sign-ups right now.'; end if;
  if coalesce(trim(p_name), '') = '' then raise exception 'Please enter your name.'; end if;
  if coalesce(array_length(p_program_ids, 1), 0) = 0 then raise exception 'Pick at least one card.'; end if;
  if p_platform is null or p_platform not in ('apple', 'google', 'web') then p_platform := 'web'; end if;

  for p in
    select * from programs where shop_id = s.id and is_active and id = any (p_program_ids)
    order by sort_order, created_at
  loop
    v_existing := false;
    select * into c from customers where program_id = p.id and email = v_email;
    if found then
      v_existing := true;
      update customers set platform = p_platform where id = c.id returning * into c;
    else
      insert into customers (shop_id, program_id, name, email, age, platform, stamps, lifetime_stamps)
      values (s.id, p.id, trim(p_name), v_email, p_age, p_platform,
              case when p.kind = 'loyalty' then p.welcome_stamps else 0 end,
              case when p.kind = 'loyalty' then p.welcome_stamps else 0 end)
      returning * into c;
      insert into events (shop_id, program_id, customer_id, type) values (s.id, p.id, c.id, 'signup');
    end if;
    v_cards := v_cards || json_build_object('card_id', c.id, 'token', c.pass_token, 'existing', v_existing);
  end loop;

  if coalesce(array_length(v_cards, 1), 0) = 0 then raise exception 'Those cards are no longer available.'; end if;
  return json_build_object('cards', array_to_json(v_cards));
end $$;

-- A card plus the holder's other cards at the same shop (same email), so one link shows them all.
create or replace function public.get_card(p_customer_id uuid, p_token text)
returns json language sql stable security definer set search_path = public as $$
  select json_build_object(
    'customer', json_build_object(
      'id', c.id, 'name', c.name, 'stamps', c.stamps, 'credits', c.credits, 'credits_total', c.credits_total,
      'packs_purchased', c.packs_purchased, 'pack_expires_at', c.pack_expires_at, 'visits', c.visits,
      'rewards_redeemed', c.rewards_redeemed, 'platform', c.platform, 'wallet_added_at', c.wallet_added_at
    ),
    'program', public.program_public_json(p),
    'shop', public.shop_public_json(s),
    'others', coalesce((
      select json_agg(json_build_object('id', o.id, 'token', o.pass_token, 'name', op.name, 'kind', op.kind)
                      order by op.sort_order, op.created_at)
      from customers o join programs op on op.id = o.program_id
      where o.shop_id = c.shop_id and o.email = c.email and o.id <> c.id
    ), '[]'::json)
  )
  from customers c
  join programs p on p.id = c.program_id
  join shops s on s.id = c.shop_id
  where c.id = p_customer_id and c.pass_token = p_token;
$$;

-- Staff actions -----------------------------------------------------------
create or replace function public.add_stamps(p_customer_id uuid, p_count int default 1)
returns public.customers language plpgsql security definer set search_path = public as $$
declare c customers; p programs;
begin
  if p_count < 1 or p_count > 20 then raise exception 'Invalid stamp count'; end if;
  select * into c from customers where id = p_customer_id;
  if not found or not public.owns_shop(c.shop_id) then raise exception 'Customer not found'; end if;
  select * into p from programs where id = c.program_id;
  if p.kind <> 'loyalty' then raise exception 'This is not a stamp card'; end if;
  update customers
     set stamps = stamps + p_count, lifetime_stamps = lifetime_stamps + p_count,
         visits = visits + 1, last_visit_at = now()
   where id = c.id returning * into c;
  insert into events (shop_id, program_id, customer_id, type, amount) values (c.shop_id, p.id, c.id, 'stamp', p_count);
  return c;
end $$;

create or replace function public.redeem_reward(p_customer_id uuid)
returns public.customers language plpgsql security definer set search_path = public as $$
declare c customers; p programs;
begin
  select * into c from customers where id = p_customer_id;
  if not found or not public.owns_shop(c.shop_id) then raise exception 'Customer not found'; end if;
  select * into p from programs where id = c.program_id;
  if p.kind <> 'loyalty' then raise exception 'This is not a stamp card'; end if;
  if c.stamps < p.stamps_required then raise exception 'Not enough stamps yet'; end if;
  update customers
     set stamps = stamps - p.stamps_required, rewards_redeemed = rewards_redeemed + 1, last_visit_at = now()
   where id = c.id returning * into c;
  insert into events (shop_id, program_id, customer_id, type) values (c.shop_id, p.id, c.id, 'redeem');
  return c;
end $$;

-- Staff took payment for a pack at the till: load the cups onto the card.
create or replace function public.sell_pack(p_customer_id uuid)
returns public.customers language plpgsql security definer set search_path = public as $$
declare c customers; p programs; v_live int;
begin
  select * into c from customers where id = p_customer_id;
  if not found or not public.owns_shop(c.shop_id) then raise exception 'Customer not found'; end if;
  select * into p from programs where id = c.program_id;
  if p.kind <> 'subscription' then raise exception 'This is not a pack card'; end if;
  -- Unused cups carry over unless the old pack already expired.
  v_live := case when c.pack_expires_at is null or c.pack_expires_at > now() then c.credits else 0 end;
  update customers
     set credits = v_live + p.cups_included,
         credits_total = v_live + p.cups_included,
         packs_purchased = packs_purchased + 1,
         pack_expires_at = case when p.valid_days is null then null else now() + make_interval(days => p.valid_days) end,
         last_visit_at = now()
   where id = c.id returning * into c;
  insert into events (shop_id, program_id, customer_id, type, amount, value)
  values (c.shop_id, p.id, c.id, 'purchase', p.cups_included, p.pack_price);
  return c;
end $$;

create or replace function public.use_cup(p_customer_id uuid, p_count int default 1)
returns public.customers language plpgsql security definer set search_path = public as $$
declare c customers; p programs;
begin
  if p_count < 1 or p_count > 10 then raise exception 'Invalid cup count'; end if;
  select * into c from customers where id = p_customer_id;
  if not found or not public.owns_shop(c.shop_id) then raise exception 'Customer not found'; end if;
  select * into p from programs where id = c.program_id;
  if p.kind <> 'subscription' then raise exception 'This is not a pack card'; end if;
  if c.pack_expires_at is not null and c.pack_expires_at <= now() then raise exception 'This pack has expired'; end if;
  if c.credits < p_count then raise exception 'Not enough cups left on this pack'; end if;
  update customers
     set credits = credits - p_count, visits = visits + 1, last_visit_at = now()
   where id = c.id returning * into c;
  insert into events (shop_id, program_id, customer_id, type, amount) values (c.shop_id, p.id, c.id, 'cup', p_count);
  return c;
end $$;

create or replace function public.shop_analytics(p_shop_id uuid, p_days int default 30)
returns json language plpgsql stable security definer set search_path = public as $$
declare
  result json;
  v_from timestamptz := date_trunc('day', now()) - make_interval(days => p_days - 1);
begin
  if not public.owns_shop(p_shop_id) then raise exception 'Not allowed'; end if;

  select json_build_object(
    'totals', (
      select json_build_object(
        'members', count(distinct c.email),
        'cards', count(*),
        'active', count(distinct c.email) filter (where c.last_visit_at >= v_from),
        'apple', count(*) filter (where c.platform = 'apple'),
        'google', count(*) filter (where c.platform = 'google'),
        'web', count(*) filter (where c.platform = 'web'),
        'in_wallet', count(*) filter (where c.wallet_added_at is not null),
        'reward_ready', count(*) filter (where p.kind = 'loyalty' and c.stamps >= p.stamps_required),
        'active_packs', count(*) filter (where p.kind = 'subscription' and c.credits > 0
                                           and (c.pack_expires_at is null or c.pack_expires_at > now())),
        'prepaid_cups', coalesce(sum(c.credits) filter (where p.kind = 'subscription'
                                           and (c.pack_expires_at is null or c.pack_expires_at > now())), 0)
      )
      from customers c join programs p on p.id = c.program_id
      where c.shop_id = p_shop_id
    ),
    'new_members', (
      select count(*) from (
        select min(created_at) as first_seen from customers where shop_id = p_shop_id group by email
      ) m where m.first_seen >= v_from
    ),
    'avg_age', (
      select round(avg(age)::numeric, 1) from (
        select distinct on (email) age from customers
        where shop_id = p_shop_id and age is not null order by email, created_at
      ) a
    ),
    'period', (
      select json_build_object(
        'stamps', coalesce(sum(amount) filter (where type = 'stamp'), 0),
        'redeems', count(*) filter (where type = 'redeem'),
        'packs_sold', count(*) filter (where type = 'purchase'),
        'pack_revenue', coalesce(sum(value) filter (where type = 'purchase'), 0),
        'cups_used', coalesce(sum(amount) filter (where type = 'cup'), 0),
        'visits', count(*) filter (where type in ('stamp', 'cup'))
      )
      from events where shop_id = p_shop_id and created_at >= v_from
    ),
    'daily', (
      select coalesce(json_agg(json_build_object(
        'day', d.day, 'signups', d.signups, 'visits', d.visits, 'revenue', d.revenue) order by d.day), '[]'::json)
      from (
        select g.day::date as day,
               count(e.id) filter (where e.type = 'signup') as signups,
               count(e.id) filter (where e.type in ('stamp', 'cup')) as visits,
               coalesce(sum(e.value) filter (where e.type = 'purchase'), 0) as revenue
        from generate_series(v_from, date_trunc('day', now()), interval '1 day') as g(day)
        left join events e
          on e.shop_id = p_shop_id and e.created_at >= g.day and e.created_at < g.day + interval '1 day'
        group by g.day
      ) d
    ),
    'programs', (
      select coalesce(json_agg(json_build_object(
        'id', p.id, 'name', p.name, 'kind', p.kind, 'is_active', p.is_active,
        'cards', (select count(*) from customers c where c.program_id = p.id),
        'visits', (select count(*) from events e where e.program_id = p.id and e.type in ('stamp', 'cup') and e.created_at >= v_from),
        'redeems', (select count(*) from events e where e.program_id = p.id and e.type = 'redeem' and e.created_at >= v_from),
        'packs_sold', (select count(*) from events e where e.program_id = p.id and e.type = 'purchase' and e.created_at >= v_from),
        'revenue', (select coalesce(sum(e.value), 0) from events e where e.program_id = p.id and e.type = 'purchase' and e.created_at >= v_from)
      ) order by p.sort_order, p.created_at), '[]'::json)
      from programs p where p.shop_id = p_shop_id
    ),
    'ages', (
      select coalesce(json_agg(json_build_object('bucket', b.bucket, 'n', b.n) order by b.ord), '[]'::json)
      from (
        select case when age < 18 then 'Under 18' when age < 25 then '18–24' when age < 35 then '25–34'
                    when age < 45 then '35–44' when age < 55 then '45–54' else '55+' end as bucket,
               case when age < 18 then 0 when age < 25 then 1 when age < 35 then 2
                    when age < 45 then 3 when age < 55 then 4 else 5 end as ord,
               count(*) as n
        from (
          select distinct on (email) age from customers
          where shop_id = p_shop_id and age is not null order by email, created_at
        ) people
        group by 1, 2
      ) b
    )
  ) into result;
  return result;
end $$;

-- Grants ----------------------------------------------------------------------
revoke execute on function public.join_shop(text, text, text, int, text, uuid[]) from public;
grant execute on function public.join_shop(text, text, text, int, text, uuid[]) to anon, authenticated;
grant execute on function public.get_public_shop(text) to anon, authenticated;
grant execute on function public.get_card(uuid, text) to anon, authenticated;

revoke execute on function public.sell_pack(uuid) from public, anon;
revoke execute on function public.use_cup(uuid, int) from public, anon;
revoke execute on function public.add_stamps(uuid, int) from public, anon;
revoke execute on function public.redeem_reward(uuid) from public, anon;
revoke execute on function public.shop_analytics(uuid, int) from public, anon;
grant execute on function public.sell_pack(uuid) to authenticated;
grant execute on function public.use_cup(uuid, int) to authenticated;
grant execute on function public.add_stamps(uuid, int) to authenticated;
grant execute on function public.redeem_reward(uuid) to authenticated;
grant execute on function public.shop_analytics(uuid, int) to authenticated;

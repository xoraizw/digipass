-- XtraCup: multi-tenant wallet loyalty cards for coffee shops
-- ------------------------------------------------------------

-- Platform admins (you). Add yourself after signing up:
--   insert into public.platform_admins (user_id) values ('<your auth user id>');
create table public.platform_admins (
  user_id uuid primary key references auth.users on delete cascade
);

create or replace function public.is_platform_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from platform_admins where user_id = auth.uid());
$$;

-- Shops ------------------------------------------------------------
create table public.shops (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references auth.users on delete cascade,
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$'),
  name text not null check (char_length(name) between 1 and 60),
  contact_email text,
  contact_phone text,
  address text,
  logo_url text,
  brand_color text not null default '#2b1a10',
  accent_color text not null default '#e0a15e',
  text_color text not null default '#fbf3e6',
  welcome_title text not null default 'Join our loyalty club',
  welcome_body text not null default 'Collect a stamp with every visit and earn a free drink.',
  stamps_required int not null default 10 check (stamps_required between 1 and 30),
  reward_text text not null default 'Free drink of your choice',
  welcome_stamps int not null default 0 check (welcome_stamps between 0 and 10),
  membership_name text,
  membership_perks text,
  promo_text text,
  is_live boolean not null default true,
  -- billing (only editable by platform admins)
  plan_status text not null default 'trial' check (plan_status in ('trial', 'active', 'past_due', 'cancelled')),
  setup_fee_paid boolean not null default false,
  monthly_fee numeric(10, 2) not null default 0,
  created_at timestamptz not null default now()
);

-- Owners can't change their own billing fields; only admins / service role / SQL editor can.
create or replace function public.protect_shop_billing()
returns trigger language plpgsql as $$
begin
  if current_user not in ('authenticated', 'anon') or public.is_platform_admin() then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.plan_status := 'trial';
    new.setup_fee_paid := false;
    new.monthly_fee := 0;
  else
    new.owner_id := old.owner_id;
    new.plan_status := old.plan_status;
    new.setup_fee_paid := old.setup_fee_paid;
    new.monthly_fee := old.monthly_fee;
  end if;
  return new;
end $$;

create trigger shops_protect_billing
  before insert or update on public.shops
  for each row execute function public.protect_shop_billing();

create or replace function public.owns_shop(p_shop_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from shops where id = p_shop_id and owner_id = auth.uid())
      or public.is_platform_admin();
$$;

-- Customers (one row = one wallet card) --------------------------------
create table public.customers (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops on delete cascade,
  name text not null check (char_length(name) between 1 and 100),
  email text not null check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  age int check (age between 1 and 120),
  platform text not null default 'web' check (platform in ('apple', 'google', 'web')),
  stamps int not null default 0 check (stamps >= 0),
  lifetime_stamps int not null default 0,
  rewards_redeemed int not null default 0,
  visits int not null default 0,
  membership_active boolean not null default false,
  membership_expires_at date,
  pass_token text not null default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  wallet_added_at timestamptz,
  last_visit_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (shop_id, email)
);
create index customers_shop_idx on public.customers (shop_id, created_at desc);

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger customers_touch
  before update on public.customers
  for each row execute function public.touch_updated_at();

-- Event log for analytics --------------------------------------------
create table public.events (
  id bigint generated always as identity primary key,
  shop_id uuid not null references public.shops on delete cascade,
  customer_id uuid references public.customers on delete cascade,
  type text not null check (type in ('signup', 'stamp', 'redeem', 'wallet_added', 'membership')),
  amount int not null default 1,
  created_at timestamptz not null default now()
);
create index events_shop_time_idx on public.events (shop_id, created_at);

-- Apple Wallet device registrations (service role only) ----------------
create table public.apple_registrations (
  device_library_id text not null,
  pass_type_id text not null,
  serial_number uuid not null references public.customers on delete cascade,
  push_token text not null,
  created_at timestamptz not null default now(),
  primary key (device_library_id, pass_type_id, serial_number)
);

-- RLS ----------------------------------------------------------------
alter table public.platform_admins enable row level security;
alter table public.shops enable row level security;
alter table public.customers enable row level security;
alter table public.events enable row level security;
alter table public.apple_registrations enable row level security;

create policy "admins read admins" on public.platform_admins
  for select using (user_id = auth.uid());

create policy "owner or admin reads shop" on public.shops
  for select using (owner_id = auth.uid() or public.is_platform_admin());
create policy "owner creates shop" on public.shops
  for insert with check (owner_id = auth.uid());
create policy "owner or admin updates shop" on public.shops
  for update using (owner_id = auth.uid() or public.is_platform_admin());
create policy "admin deletes shop" on public.shops
  for delete using (public.is_platform_admin());

create policy "shop reads customers" on public.customers
  for select using (public.owns_shop(shop_id));
create policy "shop updates customers" on public.customers
  for update using (public.owns_shop(shop_id));
create policy "shop deletes customers" on public.customers
  for delete using (public.owns_shop(shop_id));

create policy "shop reads events" on public.events
  for select using (public.owns_shop(shop_id));

-- Public RPCs (customer-facing) ---------------------------------------
create or replace function public.shop_public_json(s public.shops)
returns json language sql stable as $$
  select json_build_object(
    'id', s.id, 'slug', s.slug, 'name', s.name, 'address', s.address, 'logo_url', s.logo_url,
    'brand_color', s.brand_color, 'accent_color', s.accent_color, 'text_color', s.text_color,
    'welcome_title', s.welcome_title, 'welcome_body', s.welcome_body,
    'stamps_required', s.stamps_required, 'reward_text', s.reward_text, 'welcome_stamps', s.welcome_stamps,
    'membership_name', s.membership_name, 'membership_perks', s.membership_perks, 'promo_text', s.promo_text
  );
$$;

create or replace function public.get_public_shop(p_slug text)
returns json language sql stable security definer set search_path = public as $$
  select public.shop_public_json(s) from shops s
  where s.slug = lower(p_slug) and s.is_live and s.plan_status <> 'cancelled';
$$;

create or replace function public.join_shop(
  p_slug text, p_name text, p_email text, p_age int, p_platform text
) returns json language plpgsql security definer set search_path = public as $$
declare
  s shops;
  c customers;
  v_email text := lower(trim(p_email));
  v_existing boolean := false;
begin
  select * into s from shops where slug = lower(p_slug) and is_live and plan_status <> 'cancelled';
  if not found then raise exception 'This shop is not accepting sign-ups right now.'; end if;
  if coalesce(trim(p_name), '') = '' then raise exception 'Please enter your name.'; end if;
  if p_platform is null or p_platform not in ('apple', 'google', 'web') then p_platform := 'web'; end if;

  select * into c from customers where shop_id = s.id and email = v_email;
  if found then
    v_existing := true;
    update customers set platform = p_platform where id = c.id returning * into c;
  else
    insert into customers (shop_id, name, email, age, platform, stamps, lifetime_stamps)
    values (s.id, trim(p_name), v_email, p_age, p_platform, s.welcome_stamps, s.welcome_stamps)
    returning * into c;
    insert into events (shop_id, customer_id, type) values (s.id, c.id, 'signup');
  end if;

  return json_build_object('customer_id', c.id, 'token', c.pass_token, 'existing', v_existing);
end $$;

create or replace function public.get_card(p_customer_id uuid, p_token text)
returns json language sql stable security definer set search_path = public as $$
  select json_build_object(
    'customer', json_build_object(
      'id', c.id, 'name', c.name, 'stamps', c.stamps, 'visits', c.visits,
      'rewards_redeemed', c.rewards_redeemed, 'membership_active', c.membership_active,
      'membership_expires_at', c.membership_expires_at, 'platform', c.platform,
      'wallet_added_at', c.wallet_added_at
    ),
    'shop', public.shop_public_json(s)
  )
  from customers c join shops s on s.id = c.shop_id
  where c.id = p_customer_id and c.pass_token = p_token;
$$;

-- Staff RPCs (shop owner only) ------------------------------------------
create or replace function public.add_stamps(p_customer_id uuid, p_count int default 1)
returns public.customers language plpgsql security definer set search_path = public as $$
declare c customers;
begin
  if p_count < 1 or p_count > 20 then raise exception 'Invalid stamp count'; end if;
  select * into c from customers where id = p_customer_id;
  if not found or not public.owns_shop(c.shop_id) then raise exception 'Customer not found'; end if;
  update customers
     set stamps = stamps + p_count, lifetime_stamps = lifetime_stamps + p_count,
         visits = visits + 1, last_visit_at = now()
   where id = c.id returning * into c;
  insert into events (shop_id, customer_id, type, amount) values (c.shop_id, c.id, 'stamp', p_count);
  return c;
end $$;

create or replace function public.redeem_reward(p_customer_id uuid)
returns public.customers language plpgsql security definer set search_path = public as $$
declare c customers; v_required int;
begin
  select * into c from customers where id = p_customer_id;
  if not found or not public.owns_shop(c.shop_id) then raise exception 'Customer not found'; end if;
  select stamps_required into v_required from shops where id = c.shop_id;
  if c.stamps < v_required then raise exception 'Not enough stamps yet'; end if;
  update customers
     set stamps = stamps - v_required, rewards_redeemed = rewards_redeemed + 1, last_visit_at = now()
   where id = c.id returning * into c;
  insert into events (shop_id, customer_id, type) values (c.shop_id, c.id, 'redeem');
  return c;
end $$;

create or replace function public.set_membership(p_customer_id uuid, p_active boolean, p_expires date)
returns public.customers language plpgsql security definer set search_path = public as $$
declare c customers;
begin
  select * into c from customers where id = p_customer_id;
  if not found or not public.owns_shop(c.shop_id) then raise exception 'Customer not found'; end if;
  update customers set membership_active = p_active, membership_expires_at = case when p_active then p_expires end
   where id = c.id returning * into c;
  if p_active then
    insert into events (shop_id, customer_id, type) values (c.shop_id, c.id, 'membership');
  end if;
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
        'members', count(*),
        'new', count(*) filter (where c.created_at >= v_from),
        'active', count(*) filter (where c.last_visit_at >= v_from),
        'apple', count(*) filter (where c.platform = 'apple'),
        'google', count(*) filter (where c.platform = 'google'),
        'web', count(*) filter (where c.platform = 'web'),
        'in_wallet', count(*) filter (where c.wallet_added_at is not null),
        'memberships', count(*) filter (where c.membership_active),
        'avg_age', round(avg(c.age)::numeric, 1),
        'reward_ready', count(*) filter (where c.stamps >= s.stamps_required)
      )
      from customers c join shops s on s.id = c.shop_id
      where c.shop_id = p_shop_id
    ),
    'period', (
      select json_build_object(
        'stamps', coalesce(sum(amount) filter (where type = 'stamp'), 0),
        'redeems', count(*) filter (where type = 'redeem'),
        'returning', count(distinct customer_id) filter (where type = 'stamp')
      )
      from events where shop_id = p_shop_id and created_at >= v_from
    ),
    'daily', (
      select coalesce(json_agg(json_build_object(
        'day', d.day, 'signups', d.signups, 'stamps', d.stamps, 'redeems', d.redeems) order by d.day), '[]'::json)
      from (
        select g.day::date as day,
               count(e.id) filter (where e.type = 'signup') as signups,
               coalesce(sum(e.amount) filter (where e.type = 'stamp'), 0) as stamps,
               count(e.id) filter (where e.type = 'redeem') as redeems
        from generate_series(v_from, date_trunc('day', now()), interval '1 day') as g(day)
        left join events e
          on e.shop_id = p_shop_id and e.created_at >= g.day and e.created_at < g.day + interval '1 day'
        group by g.day
      ) d
    ),
    'ages', (
      select coalesce(json_agg(json_build_object('bucket', b.bucket, 'n', b.n) order by b.ord), '[]'::json)
      from (
        select case when age < 18 then 'Under 18' when age < 25 then '18–24' when age < 35 then '25–34'
                    when age < 45 then '35–44' when age < 55 then '45–54' else '55+' end as bucket,
               case when age < 18 then 0 when age < 25 then 1 when age < 35 then 2
                    when age < 45 then 3 when age < 55 then 4 else 5 end as ord,
               count(*) as n
        from customers where shop_id = p_shop_id and age is not null
        group by 1, 2
      ) b
    )
  ) into result;
  return result;
end $$;

grant execute on function public.get_public_shop(text) to anon, authenticated;
grant execute on function public.join_shop(text, text, text, int, text) to anon, authenticated;
grant execute on function public.get_card(uuid, text) to anon, authenticated;

-- Storage for shop logos ----------------------------------------------
insert into storage.buckets (id, name, public)
values ('shop-assets', 'shop-assets', true)
on conflict (id) do nothing;

create policy "owners upload own assets" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'shop-assets' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "owners update own assets" on storage.objects
  for update to authenticated
  using (bucket_id = 'shop-assets' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "owners delete own assets" on storage.objects
  for delete to authenticated
  using (bucket_id = 'shop-assets' and (storage.foldername(name))[1] = auth.uid()::text);

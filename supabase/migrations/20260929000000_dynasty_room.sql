-- Dynasty Room: accounts, plans, play-money bets and the AI gazette cache.
-- Every table has row level security on. Clients (the browser, with the anon key and a user session) can only do
-- what the policies below allow; Stripe and the AI function write through the service role inside Edge Functions.

-- ---------- profiles: one per Google account, linked to a Sleeper username ----------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  sleeper_username text,
  sleeper_user_id text,
  default_league_id text,
  stripe_customer_id text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy "read own profile" on public.profiles for select to authenticated using (auth.uid() = id);
create policy "create own profile" on public.profiles for insert to authenticated with check (auth.uid() = id);
create policy "update own profile" on public.profiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);
-- users may only touch their Sleeper link and default league; email and the Stripe customer id are server-managed
revoke insert, update on public.profiles from authenticated, anon;
grant insert (id, sleeper_username, sleeper_user_id, default_league_id) on public.profiles to authenticated;
grant update (id, sleeper_username, sleeper_user_id, default_league_id) on public.profiles to authenticated;

create function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
create trigger profiles_touch before update on public.profiles for each row execute function public.touch_updated_at();

-- a profile row appears the first time someone signs in with Google
create function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email) on conflict (id) do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- managers in the same league see each other's Sleeper names on the sportsbook leaderboard, nothing else
create view public.profile_names as select id, sleeper_username from public.profiles;
revoke all on public.profile_names from anon;
grant select on public.profile_names to authenticated;

-- ---------- subscriptions: written only by the Stripe webhook ----------
create table public.subscriptions (
  id text primary key,                         -- Stripe subscription id
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null,                        -- active, trialing, past_due, canceled, ...
  price_id text,
  interval text,                               -- month or year
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  updated_at timestamptz not null default now()
);
create index subscriptions_user on public.subscriptions (user_id);
alter table public.subscriptions enable row level security;
create policy "read own subscriptions" on public.subscriptions for select to authenticated using (auth.uid() = user_id);

-- ---------- complimentary access: the La Dinastía code and a comp list of emails ----------
create table public.invite_codes (
  code text primary key,
  note text,
  max_uses int,                                -- null means unlimited
  uses int not null default 0,
  grants_until timestamptz,                    -- null means premium with no end date
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create table public.comp_emails (
  email text primary key,
  note text,
  until timestamptz
);
create table public.comp_grants (
  user_id uuid primary key references auth.users(id) on delete cascade,
  source text not null,                        -- code, email or admin
  code text references public.invite_codes(code),
  until timestamptz,
  created_at timestamptz not null default now()
);
alter table public.invite_codes enable row level security;
alter table public.comp_emails enable row level security;
alter table public.comp_grants enable row level security;
create policy "read own comp" on public.comp_grants for select to authenticated using (auth.uid() = user_id);

-- ---------- the plan for a user: comp first, then an active Stripe subscription, else free ----------
create function public.plan_for(p_uid uuid, p_email text)
returns table (plan text, until timestamptz, source text)
language plpgsql stable security definer set search_path = public as $$
begin
  if p_uid is null then return query select 'free'::text, null::timestamptz, null::text; return; end if;
  return query select 'comp'::text, g.until, g.source from public.comp_grants g
    where g.user_id = p_uid and (g.until is null or g.until > now()) limit 1;
  if found then return; end if;
  return query select 'comp'::text, c.until, 'email'::text from public.comp_emails c
    where lower(c.email) = lower(coalesce(p_email, '')) and (c.until is null or c.until > now()) limit 1;
  if found then return; end if;
  -- past_due keeps access for a short grace period while Stripe retries the card
  return query select 'premium'::text, s.current_period_end, 'stripe'::text from public.subscriptions s
    where s.user_id = p_uid and s.status in ('active', 'trialing', 'past_due')
      and (s.current_period_end is null or s.current_period_end > now() - interval '3 days')
    order by s.current_period_end desc nulls last limit 1;
  if found then return; end if;
  return query select 'free'::text, null::timestamptz, null::text;
end $$;
revoke execute on function public.plan_for(uuid, text) from public, anon, authenticated;

create function public.my_plan()
returns table (plan text, until timestamptz, source text)
language sql stable security definer set search_path = public as $$
  select * from public.plan_for(auth.uid(), auth.jwt() ->> 'email');
$$;
revoke execute on function public.my_plan() from public, anon;
grant execute on function public.my_plan() to authenticated;

-- redeem an invite code; locked row so two people can't take the last use at once
create function public.redeem_code(p_code text) returns text
language plpgsql security definer set search_path = public as $$
declare c public.invite_codes%rowtype; uid uuid := auth.uid();
begin
  if uid is null then raise exception 'Sign in first.'; end if;
  select * into c from public.invite_codes where upper(code) = upper(trim(p_code)) and active for update;
  if not found then raise exception 'That code doesn''t exist or is no longer active.'; end if;
  if c.max_uses is not null and c.uses >= c.max_uses then raise exception 'That code has been used up.'; end if;
  if exists (select 1 from public.comp_grants where user_id = uid) then return 'already'; end if;
  insert into public.comp_grants (user_id, source, code, until) values (uid, 'code', c.code, c.grants_until);
  update public.invite_codes set uses = uses + 1 where code = c.code;
  return 'ok';
end $$;
revoke execute on function public.redeem_code(text) from public, anon;
grant execute on function public.redeem_code(text) to authenticated;

-- ---------- play-money bets for the league leaderboard ----------
create table public.bets (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  league_id text not null,
  season int not null,
  bet jsonb not null,
  placed_at timestamptz not null default now(),
  constraint bet_stake check ((bet ->> 'stake')::numeric between 1 and 1000),
  constraint bet_legs check (jsonb_array_length(bet -> 'legs') between 1 and 12),
  constraint bet_size check (pg_column_size(bet) < 16000)
);
create index bets_league on public.bets (league_id, season);
alter table public.bets enable row level security;
create policy "read bets" on public.bets for select to authenticated using (true);
create policy "place own bets" on public.bets for insert to authenticated with check (user_id = auth.uid());
create policy "clear own bets" on public.bets for delete to authenticated using (user_id = auth.uid());

-- ---------- AI gazette: cached editions and a daily usage counter ----------
create table public.gazettes (
  user_id uuid not null references auth.users(id) on delete cascade,
  league_id text not null,
  season text not null,
  week int not null,
  lang text not null,
  content jsonb not null,
  created_at timestamptz not null default now(),
  primary key (user_id, league_id, season, week, lang)
);
create table public.ai_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null default current_date,
  calls int not null default 0,
  primary key (user_id, day)
);
alter table public.gazettes enable row level security;
alter table public.ai_usage enable row level security;
create policy "read own gazettes" on public.gazettes for select to authenticated using (auth.uid() = user_id);

-- MapGame leaderboard schema — paste into the Supabase SQL Editor and Run.
-- Minimal by design: two tables, open read/write via the publishable key
-- (this is a non-critical, game-only database).

create table if not exists public.players (
  id uuid primary key default gen_random_uuid(),
  name text unique not null check (char_length(name) between 1 and 20),
  pin_hash text not null,
  lang text default 'en',
  created_at timestamptz default now()
);

create table if not exists public.leaderboard (
  player_id uuid not null references public.players(id) on delete cascade,
  player_name text not null,
  mode text not null default 'difficulty',  -- 'difficulty' | 'zone'
  level_n int not null,
  best_score int not null default 0,
  total int not null default 0,
  best_stars int not null default 0,
  plays int not null default 0,
  updated_at timestamptz default now(),
  primary key (player_id, mode, level_n)
);

-- Migration for an existing leaderboard table (safe to run repeatedly): add
-- the mode column and make it part of the primary key.
alter table public.leaderboard add column if not exists mode text not null default 'difficulty';
do $$ begin
  if not exists (
    select 1 from pg_constraint where conname = 'leaderboard_pkey'
      and conrelid = 'public.leaderboard'::regclass
      and array_length(conkey, 1) = 3
  ) then
    alter table public.leaderboard drop constraint if exists leaderboard_pkey;
    alter table public.leaderboard add primary key (player_id, mode, level_n);
  end if;
end $$;

alter table public.players enable row level security;
alter table public.leaderboard enable row level security;

drop policy if exists "players read" on public.players;
drop policy if exists "players insert" on public.players;
drop policy if exists "players update" on public.players;
drop policy if exists "leaderboard read" on public.leaderboard;
drop policy if exists "leaderboard insert" on public.leaderboard;
drop policy if exists "leaderboard update" on public.leaderboard;
drop policy if exists "leaderboard delete" on public.leaderboard;

create policy "players read"      on public.players     for select using (true);
create policy "players insert"    on public.players     for insert with check (true);
create policy "players update"    on public.players     for update using (true) with check (true);
create policy "leaderboard read"   on public.leaderboard for select using (true);
create policy "leaderboard insert" on public.leaderboard for insert with check (true);
create policy "leaderboard update" on public.leaderboard for update using (true) with check (true);
create policy "leaderboard delete" on public.leaderboard for delete using (true);

-- ===== Admin cleanup (password-protected RPC) =====
-- Deletes the player accounts listed in `names` from the website's hidden
-- admin panel (select-all in the UI wipes everything). The password is
-- checked INSIDE the function: only its SHA-256 hash lives in the database,
-- and the plaintext password is deliberately NOT in this repository.
-- Before running, replace the placeholder below with the hex sha256 of
-- your admin password:
--   printf '%s' 'your-password' | openssl dgst -sha256
-- Note: the deletes are filtered on purpose — Supabase's safeupdate guard
-- rejects unfiltered DELETEs ("DELETE requires a WHERE clause").
create extension if not exists pgcrypto with schema extensions;

drop function if exists public.admin_wipe_players(text);

create or replace function public.admin_delete_players(secret text, names text[])
returns json
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  n_players int;
  n_scores int;
begin
  if encode(digest(secret, 'sha256'), 'hex')
     <> 'REPLACE_WITH_SHA256_HEX_OF_ADMIN_PASSWORD' then
    return json_build_object('ok', false, 'error', 'unauthorized');
  end if;
  delete from public.leaderboard where player_name = any(names);
  get diagnostics n_scores = row_count;
  delete from public.players where name = any(names);
  get diagnostics n_players = row_count;
  return json_build_object('ok', true, 'players', n_players, 'scores', n_scores);
end;
$$;

revoke all on function public.admin_delete_players(text, text[]) from public;
grant execute on function public.admin_delete_players(text, text[]) to anon, authenticated;

-- ===== Account cap (abuse guard) =====
-- Caps the total number of player accounts. Well above any realistic use
-- (a few dozen players), it only ever trips on scripted abuse: extra INSERTs
-- are refused cleanly instead of letting the table grow without bound. Change
-- the limit by re-running this block with a different max_players.
create or replace function public.enforce_player_cap()
returns trigger language plpgsql security definer set search_path = public as $$
declare max_players int := 500;   -- adjust the limit here
begin
  if (select count(*) from public.players) >= max_players then
    raise exception 'player cap reached' using errcode = 'check_violation';
  end if;
  return new;
end; $$;

drop trigger if exists trg_player_cap on public.players;
create trigger trg_player_cap before insert on public.players
  for each row execute function public.enforce_player_cap();

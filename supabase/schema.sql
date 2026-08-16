-- =====================================================================
-- League of Tetris — Supabase schema
--
-- Paste the whole file into the Supabase SQL editor and run it once.
-- Safe to re-run: everything is created if-not-exists or replaced.
--
-- Also switch OFF email confirmation:
--   Authentication -> Providers -> Email -> "Confirm email" = off
-- Players sign up with a username only, so there is no mailbox to confirm.
-- =====================================================================


-- ---------------------------------------------------------------------
-- profiles: one row per player, created automatically at signup
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id            uuid primary key references auth.users on delete cascade,
  username      text not null unique,
  gold          bigint  not null default 0,
  high_score    integer not null default 0,
  best_level    integer not null default 1,
  total_rows    integer not null default 0,
  total_pure    integer not null default 0,
  games_played  integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint username_shape check (username ~ '^[A-Za-z0-9_]{3,16}$')
);

-- Leaderboard reads are ordered by score; this keeps the top-100 query cheap.
create index if not exists profiles_high_score_idx
  on public.profiles (high_score desc);


-- ---------------------------------------------------------------------
-- runs: every finished game, kept for history and future stats
-- ---------------------------------------------------------------------
create table if not exists public.runs (
  id           bigint generated always as identity primary key,
  user_id      uuid not null references auth.users on delete cascade,
  score        integer not null,
  level        integer not null,
  rows_cleared integer not null,
  pure_rows    integer not null,
  gold_earned  integer not null,
  created_at   timestamptz not null default now()
);

create index if not exists runs_user_idx on public.runs (user_id, created_at desc);


-- ---------------------------------------------------------------------
-- Create the profile row whenever a new auth user appears.
-- The username arrives in raw_user_meta_data from the signup call.
-- ---------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, username)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'username', split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- ---------------------------------------------------------------------
-- submit_run: the ONLY way a client may change gold or high_score.
--
-- Clients never get UPDATE rights on profiles. They call this instead, and it
-- takes the greater of the old and new score, so a weak run can never lower a
-- record, and adds gold rather than setting it.
--
-- Note this still trusts the numbers the client sends. A modified client can
-- claim any score. Making that impossible means simulating the run
-- server-side; the clamps below only stop the accidental and the casual.
-- ---------------------------------------------------------------------
create or replace function public.submit_run(
  p_score     integer,
  p_level     integer,
  p_rows      integer,
  p_pure_rows integer,
  p_gold      integer
)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  result public.profiles;
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;

  -- Reject obviously impossible submissions outright.
  if p_score < 0 or p_gold < 0 or p_rows < 0 or p_pure_rows < 0 or p_level < 1 then
    raise exception 'negative or invalid run';
  end if;
  if p_score > 100000000 or p_gold > 1000000 then
    raise exception 'run out of range';
  end if;
  if p_pure_rows > p_rows then
    raise exception 'more pure rows than rows';
  end if;

  insert into public.runs (user_id, score, level, rows_cleared, pure_rows, gold_earned)
  values (auth.uid(), p_score, p_level, p_rows, p_pure_rows, p_gold);

  update public.profiles
     set gold         = gold + p_gold,
         high_score   = greatest(high_score, p_score),
         best_level   = greatest(best_level, p_level),
         total_rows   = total_rows + p_rows,
         total_pure   = total_pure + p_pure_rows,
         games_played = games_played + 1,
         updated_at   = now()
   where id = auth.uid()
   returning * into result;

  return result;
end;
$$;


-- ---------------------------------------------------------------------
-- leaderboard: the public view.
--
-- A view rather than exposing `profiles` directly, so the public surface is
-- exactly these four columns and nothing added to profiles later leaks by
-- accident.
-- ---------------------------------------------------------------------
create or replace view public.leaderboard
with (security_invoker = on) as
  select username, high_score, best_level, gold
  from public.profiles
  where high_score > 0;


-- ---------------------------------------------------------------------
-- Row Level Security
--
-- The anon key is public — anyone can read it out of the page source. These
-- policies, not the key, are what actually protect the data.
-- ---------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.runs     enable row level security;

-- Anyone may read profiles: this is what makes the leaderboard work.
drop policy if exists "profiles are publicly readable" on public.profiles;
create policy "profiles are publicly readable"
  on public.profiles for select
  using (true);

-- Nobody may INSERT, UPDATE or DELETE a profile from the client. Creation is
-- the signup trigger's job; changes go through submit_run. The absence of
-- those policies is deliberate — do not add them.

-- A player may read their own runs, and only insert runs as themselves.
drop policy if exists "players read their own runs" on public.runs;
create policy "players read their own runs"
  on public.runs for select
  using (auth.uid() = user_id);

drop policy if exists "players insert their own runs" on public.runs;
create policy "players insert their own runs"
  on public.runs for insert
  with check (auth.uid() = user_id);


-- ---------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------
grant usage on schema public to anon, authenticated;
grant select on public.profiles    to anon, authenticated;
grant select on public.leaderboard to anon, authenticated;
grant select, insert on public.runs to authenticated;
grant execute on function public.submit_run(integer, integer, integer, integer, integer)
  to authenticated;

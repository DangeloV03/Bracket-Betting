-- NBA Playoff Bracket App — Supabase Schema
-- Run this in the Supabase SQL editor to initialize the database.

-- ─────────────────────────────────────────────
-- Extensions
-- ─────────────────────────────────────────────
create extension if not exists "uuid-ossp";

-- ─────────────────────────────────────────────
-- ENUMS
-- ─────────────────────────────────────────────
create type round_type as enum (
  'playin',
  'first_round',
  'semifinals',
  'conference_finals',
  'finals'
);

create type conference_type as enum ('east', 'west', 'none');

create type matchup_status as enum ('scheduled', 'in_progress', 'complete');

create type pool_status as enum ('setup', 'open', 'locked', 'complete');

create type pool_role as enum ('admin', 'member');

create type sync_status as enum ('success', 'failure', 'partial');

-- ─────────────────────────────────────────────
-- USERS (mirrors Supabase auth.users)
-- ─────────────────────────────────────────────
create table public.users (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text not null unique,
  username    text not null unique,
  display_name text,
  avatar_url  text,
  created_at  timestamptz not null default now()
);

alter table public.users enable row level security;

create policy "Users can read own profile"
  on public.users for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.users for update
  using (auth.uid() = id);

-- Allow insert from trigger
create policy "Service can insert users"
  on public.users for insert
  with check (true);

-- Auto-create user profile on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.users (id, email, username, display_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─────────────────────────────────────────────
-- TEAMS
-- ─────────────────────────────────────────────
create table public.teams (
  id             uuid primary key default uuid_generate_v4(),
  external_api_id text,
  conference     conference_type not null,
  city           text not null,
  name           text not null,
  abbreviation   text not null unique,
  logo_url       text,
  created_at     timestamptz not null default now()
);

alter table public.teams enable row level security;

create policy "Anyone can read teams"
  on public.teams for select using (true);

create policy "Only service role can modify teams"
  on public.teams for all
  using (auth.role() = 'service_role');

-- ─────────────────────────────────────────────
-- POOLS
-- ─────────────────────────────────────────────
create table public.pools (
  id                  uuid primary key default uuid_generate_v4(),
  name                text not null,
  season              int not null,
  created_by          uuid not null references public.users(id),
  is_public           boolean not null default false,
  invite_code         text unique default substr(md5(random()::text), 1, 8),
  lock_at             timestamptz not null,
  scoring_config_json jsonb not null default '{
    "playin_correct": 5,
    "series_winner_correct": 10,
    "series_length_correct": 5,
    "finals_game_correct": 5,
    "series_length_requires_winner": true
  }'::jsonb,
  status              pool_status not null default 'setup',
  created_at          timestamptz not null default now()
);

alter table public.pools enable row level security;

create policy "Public pools readable by all authenticated users"
  on public.pools for select
  using (auth.uid() is not null and (is_public = true or created_by = auth.uid()));

create policy "Pool admin can update"
  on public.pools for update
  using (created_by = auth.uid());

create policy "Authenticated can create pool"
  on public.pools for insert
  with check (auth.uid() = created_by);

-- ─────────────────────────────────────────────
-- POOL MEMBERS
-- ─────────────────────────────────────────────
create table public.pool_members (
  id         uuid primary key default uuid_generate_v4(),
  pool_id    uuid not null references public.pools(id) on delete cascade,
  user_id    uuid not null references public.users(id) on delete cascade,
  role       pool_role not null default 'member',
  joined_at  timestamptz not null default now(),
  unique (pool_id, user_id)
);

alter table public.pool_members enable row level security;

create policy "Members can see pool membership"
  on public.pool_members for select
  using (
    auth.uid() = user_id or
    exists (
      select 1 from public.pool_members pm2
      where pm2.pool_id = pool_members.pool_id and pm2.user_id = auth.uid()
    )
  );

create policy "Users can join pools"
  on public.pool_members for insert
  with check (auth.uid() = user_id);

create policy "Admin can update membership"
  on public.pool_members for update
  using (
    exists (
      select 1 from public.pool_members pm2
      where pm2.pool_id = pool_members.pool_id
        and pm2.user_id = auth.uid()
        and pm2.role = 'admin'
    )
  );

-- ─────────────────────────────────────────────
-- POSTSEASON MATCHUPS
-- ─────────────────────────────────────────────
create table public.postseason_matchups (
  id                  uuid primary key default uuid_generate_v4(),
  season              int not null,
  round_type          round_type not null,
  conference          conference_type not null default 'none',
  matchup_slot        int not null,          -- ordering within a round
  higher_seed_team_id uuid references public.teams(id),
  lower_seed_team_id  uuid references public.teams(id),
  best_of             int not null default 7,
  starts_at           timestamptz,
  winner_team_id      uuid references public.teams(id),
  series_length       int,                   -- actual number of games played
  status              matchup_status not null default 'scheduled',
  external_series_id  text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (season, round_type, conference, matchup_slot)
);

alter table public.postseason_matchups enable row level security;

create policy "Anyone authenticated can read matchups"
  on public.postseason_matchups for select
  using (auth.uid() is not null);

create policy "Service role can modify matchups"
  on public.postseason_matchups for all
  using (auth.role() = 'service_role');

-- ─────────────────────────────────────────────
-- GAMES (individual games within a series)
-- ─────────────────────────────────────────────
create table public.games (
  id               uuid primary key default uuid_generate_v4(),
  matchup_id       uuid not null references public.postseason_matchups(id) on delete cascade,
  game_number      int not null,             -- 1-7
  home_team_id     uuid references public.teams(id),
  away_team_id     uuid references public.teams(id),
  winner_team_id   uuid references public.teams(id),
  scheduled_at     timestamptz,
  status           matchup_status not null default 'scheduled',
  external_game_id text,
  created_at       timestamptz not null default now(),
  unique (matchup_id, game_number)
);

alter table public.games enable row level security;

create policy "Anyone authenticated can read games"
  on public.games for select
  using (auth.uid() is not null);

create policy "Service role can modify games"
  on public.games for all
  using (auth.role() = 'service_role');

-- ─────────────────────────────────────────────
-- BRACKETS
-- ─────────────────────────────────────────────
create table public.brackets (
  id                    uuid primary key default uuid_generate_v4(),
  pool_id               uuid not null references public.pools(id) on delete cascade,
  user_id               uuid not null references public.users(id) on delete cascade,
  is_submitted          boolean not null default false,
  submitted_at          timestamptz,
  locked_snapshot_json  jsonb,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (pool_id, user_id)
);

alter table public.brackets enable row level security;

-- Users can always read their own bracket
-- Other users can read brackets only after pool is locked
create policy "Users can read their own bracket"
  on public.brackets for select
  using (auth.uid() = user_id);

create policy "Pool members can read brackets after lock"
  on public.brackets for select
  using (
    exists (
      select 1 from public.pool_members pm
      join public.pools p on p.id = pm.pool_id
      where pm.pool_id = brackets.pool_id
        and pm.user_id = auth.uid()
        and p.lock_at <= now()
    )
  );

create policy "Users can insert their own bracket"
  on public.brackets for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own draft bracket"
  on public.brackets for update
  using (auth.uid() = user_id and is_submitted = false);

-- ─────────────────────────────────────────────
-- BRACKET PICKS
-- ─────────────────────────────────────────────
create table public.bracket_picks (
  id                    uuid primary key default uuid_generate_v4(),
  bracket_id            uuid not null references public.brackets(id) on delete cascade,
  matchup_id            uuid not null references public.postseason_matchups(id),
  picked_winner_team_id uuid references public.teams(id),
  picked_series_length  int,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (bracket_id, matchup_id)
);

alter table public.bracket_picks enable row level security;

create policy "Users can read own picks"
  on public.bracket_picks for select
  using (
    exists (
      select 1 from public.brackets b
      where b.id = bracket_picks.bracket_id and b.user_id = auth.uid()
    )
  );

create policy "Pool members can read picks after lock"
  on public.bracket_picks for select
  using (
    exists (
      select 1 from public.brackets b
      join public.pool_members pm on pm.pool_id = b.pool_id
      join public.pools p on p.id = b.pool_id
      where b.id = bracket_picks.bracket_id
        and pm.user_id = auth.uid()
        and p.lock_at <= now()
    )
  );

create policy "Users can insert own picks"
  on public.bracket_picks for insert
  with check (
    exists (
      select 1 from public.brackets b
      where b.id = bracket_picks.bracket_id
        and b.user_id = auth.uid()
        and b.is_submitted = false
    )
  );

create policy "Users can update own picks"
  on public.bracket_picks for update
  using (
    exists (
      select 1 from public.brackets b
      where b.id = bracket_picks.bracket_id
        and b.user_id = auth.uid()
        and b.is_submitted = false
    )
  );

-- ─────────────────────────────────────────────
-- FINALS GAME PICKS
-- ─────────────────────────────────────────────
create table public.finals_game_picks (
  id                    uuid primary key default uuid_generate_v4(),
  bracket_id            uuid not null references public.brackets(id) on delete cascade,
  game_number           int not null check (game_number between 1 and 7),
  picked_winner_team_id uuid references public.teams(id),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (bracket_id, game_number)
);

alter table public.finals_game_picks enable row level security;

create policy "Users can read own finals picks"
  on public.finals_game_picks for select
  using (
    exists (
      select 1 from public.brackets b
      where b.id = finals_game_picks.bracket_id and b.user_id = auth.uid()
    )
  );

create policy "Pool members can read finals picks after lock"
  on public.finals_game_picks for select
  using (
    exists (
      select 1 from public.brackets b
      join public.pool_members pm on pm.pool_id = b.pool_id
      join public.pools p on p.id = b.pool_id
      where b.id = finals_game_picks.bracket_id
        and pm.user_id = auth.uid()
        and p.lock_at <= now()
    )
  );

create policy "Users can insert own finals picks"
  on public.finals_game_picks for insert
  with check (
    exists (
      select 1 from public.brackets b
      where b.id = finals_game_picks.bracket_id
        and b.user_id = auth.uid()
        and b.is_submitted = false
    )
  );

create policy "Users can update own finals picks"
  on public.finals_game_picks for update
  using (
    exists (
      select 1 from public.brackets b
      where b.id = finals_game_picks.bracket_id
        and b.user_id = auth.uid()
        and b.is_submitted = false
    )
  );

-- ─────────────────────────────────────────────
-- SCORES
-- ─────────────────────────────────────────────
create table public.scores (
  id                    uuid primary key default uuid_generate_v4(),
  pool_id               uuid not null references public.pools(id) on delete cascade,
  user_id               uuid not null references public.users(id) on delete cascade,
  total_points          int not null default 0,
  playin_points         int not null default 0,
  series_winner_points  int not null default 0,
  series_length_points  int not null default 0,
  finals_game_points    int not null default 0,
  recalculated_at       timestamptz not null default now(),
  unique (pool_id, user_id)
);

alter table public.scores enable row level security;

create policy "Pool members can read scores"
  on public.scores for select
  using (
    exists (
      select 1 from public.pool_members pm
      where pm.pool_id = scores.pool_id and pm.user_id = auth.uid()
    )
  );

create policy "Service role can modify scores"
  on public.scores for all
  using (auth.role() = 'service_role');

-- ─────────────────────────────────────────────
-- SYNC LOGS
-- ─────────────────────────────────────────────
create table public.sync_logs (
  id                uuid primary key default uuid_generate_v4(),
  provider          text not null,
  sync_type         text not null,
  status            sync_status not null,
  message           text,
  payload_meta_json jsonb,
  created_at        timestamptz not null default now()
);

alter table public.sync_logs enable row level security;

create policy "Admins can read sync logs"
  on public.sync_logs for select
  using (auth.role() = 'service_role' or auth.uid() is not null);

create policy "Service role can insert sync logs"
  on public.sync_logs for insert
  with check (true);

-- ─────────────────────────────────────────────
-- ADMIN OVERRIDES
-- ─────────────────────────────────────────────
create table public.admin_overrides (
  id           uuid primary key default uuid_generate_v4(),
  pool_id      uuid references public.pools(id),
  entity_type  text not null,
  entity_id    uuid not null,
  changed_by   uuid not null references public.users(id),
  before_json  jsonb,
  after_json   jsonb,
  created_at   timestamptz not null default now()
);

alter table public.admin_overrides enable row level security;

create policy "Service role or pool admin can read overrides"
  on public.admin_overrides for select
  using (auth.uid() = changed_by or auth.role() = 'service_role');

create policy "Admins can insert overrides"
  on public.admin_overrides for insert
  with check (auth.uid() = changed_by);

-- ─────────────────────────────────────────────
-- INDEXES
-- ─────────────────────────────────────────────
create index on public.bracket_picks (bracket_id);
create index on public.bracket_picks (matchup_id);
create index on public.finals_game_picks (bracket_id);
create index on public.scores (pool_id, total_points desc);
create index on public.pool_members (pool_id);
create index on public.pool_members (user_id);
create index on public.postseason_matchups (season, round_type);
create index on public.brackets (pool_id, user_id);
create index on public.sync_logs (created_at desc);

-- ─────────────────────────────────────────────
-- SEED — 2026 NBA Teams
-- ─────────────────────────────────────────────
insert into public.teams (conference, city, name, abbreviation) values
  -- Eastern Conference
  ('east', 'Boston',        'Celtics',      'BOS'),
  ('east', 'New York',      'Knicks',        'NYK'),
  ('east', 'Cleveland',     'Cavaliers',     'CLE'),
  ('east', 'Milwaukee',     'Bucks',         'MIL'),
  ('east', 'Indiana',       'Pacers',        'IND'),
  ('east', 'Orlando',       'Magic',         'ORL'),
  ('east', 'Miami',         'Heat',          'MIA'),
  ('east', 'Philadelphia',  '76ers',         'PHI'),
  ('east', 'Detroit',       'Pistons',       'DET'),
  ('east', 'Chicago',       'Bulls',         'CHI'),
  ('east', 'Atlanta',       'Hawks',         'ATL'),
  ('east', 'Brooklyn',      'Nets',          'BKN'),
  ('east', 'Charlotte',     'Hornets',       'CHA'),
  ('east', 'Washington',    'Wizards',       'WAS'),
  ('east', 'Toronto',       'Raptors',       'TOR'),
  -- Western Conference
  ('west', 'Oklahoma City', 'Thunder',       'OKC'),
  ('west', 'Houston',       'Rockets',       'HOU'),
  ('west', 'Los Angeles',   'Lakers',        'LAL'),
  ('west', 'Golden State',  'Warriors',      'GSW'),
  ('west', 'Los Angeles',   'Clippers',      'LAC'),
  ('west', 'Memphis',       'Grizzlies',     'MEM'),
  ('west', 'Denver',        'Nuggets',       'DEN'),
  ('west', 'Dallas',        'Mavericks',     'DAL'),
  ('west', 'Minnesota',     'Timberwolves',  'MIN'),
  ('west', 'Phoenix',       'Suns',          'PHX'),
  ('west', 'Sacramento',    'Kings',         'SAC'),
  ('west', 'San Antonio',   'Spurs',         'SAS'),
  ('west', 'New Orleans',   'Pelicans',      'NOP'),
  ('west', 'Utah',          'Jazz',          'UTA'),
  ('west', 'Portland',      'Trail Blazers', 'POR')
on conflict (abbreviation) do nothing;

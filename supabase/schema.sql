-- Run this in your Supabase SQL editor (Dashboard → SQL Editor → New query)

-- Profiles (extends auth.users)
create table public.profiles (
  id uuid references auth.users on delete cascade,
  full_name text,
  avatar_url text,
  reference_code text unique,
  payment_status text default 'pending',  -- pending | paid
  paid_at timestamptz,
  created_at timestamptz default now(),
  primary key (id)
);

-- Predictions
create table public.predictions (
  id uuid default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  match_id integer not null,
  home_score integer,
  away_score integer,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  primary key (id),
  unique(user_id, match_id)
);

-- Match results (admin enters these)
create table public.match_results (
  match_id integer primary key,
  home_score integer,
  away_score integer,
  entered_at timestamptz default now()
);

-- Enable RLS
alter table public.profiles enable row level security;
alter table public.predictions enable row level security;
alter table public.match_results enable row level security;

-- Profiles policies
create policy "Profiles viewable by all" on public.profiles
  for select using (true);
create policy "Users insert own profile" on public.profiles
  for insert with check (auth.uid() = id);
create policy "Users update own profile" on public.profiles
  for update using (auth.uid() = id);

-- Predictions policies
create policy "Predictions viewable by all" on public.predictions
  for select using (true);
create policy "Users manage own predictions" on public.predictions
  for all using (auth.uid() = user_id);

-- Match results policies
create policy "Results viewable by all" on public.match_results
  for select using (true);
-- Results are inserted/updated via service role key (admin panel uses this)

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
declare
  ref_code text;
  chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  i int;
begin
  ref_code := 'BSA-';
  for i in 1..4 loop
    ref_code := ref_code || substr(chars, (floor(random() * length(chars)) + 1)::int, 1);
  end loop;
  insert into public.profiles (id, full_name, avatar_url, reference_code)
  values (
    new.id,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url',
    ref_code
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

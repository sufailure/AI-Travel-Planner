-- Enable extensions required for UUID generation and advanced JSON operations
create extension if not exists "uuid-ossp";
create extension if not exists pgcrypto;

-- Profiles table mirrors authenticated users with extra metadata
create table if not exists public.profiles (
  id uuid primary key references auth.users on delete cascade,
  display_name text,
  avatar_url text,
  home_airport text,
  preferences jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- High level itineraries owned by a user
create table if not exists public.itineraries (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  destination text not null,
  start_date date not null,
  end_date date not null,
  travelers integer not null default 1,
  budget numeric,
  preferences jsonb,
  draft_plan jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Day-level summary per itinerary
create table if not exists public.itinerary_days (
  id uuid primary key default gen_random_uuid(),
  itinerary_id uuid not null references public.itineraries(id) on delete cascade,
  day_index integer not null,
  date date not null,
  summary text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (itinerary_id, day_index)
);

-- Concrete items within a day
create type if not exists public.activity_kind as enum ('transport', 'lodging', 'activity', 'meal', 'note');

create table if not exists public.itinerary_items (
  id uuid primary key default gen_random_uuid(),
  day_id uuid not null references public.itinerary_days(id) on delete cascade,
  item_type public.activity_kind not null,
  title text not null,
  description text,
  location_name text,
  location_lat double precision,
  location_lng double precision,
  start_time timestamptz,
  end_time timestamptz,
  metadata jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Budget container per itinerary
create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  itinerary_id uuid not null references public.itineraries(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  currency text not null default 'CNY',
  planned_total numeric,
  actual_total numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (itinerary_id, owner_id)
);

-- Individual expense entries (planned or actual)
create type if not exists public.expense_source as enum ('plan', 'actual');

create table if not exists public.expense_entries (
  id uuid primary key default gen_random_uuid(),
  expense_id uuid not null references public.expenses(id) on delete cascade,
  category text not null,
  amount numeric not null,
  notes text,
  incurred_on date,
  source public.expense_source not null default 'plan',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Store raw voice commands / transcripts for auditing
create table if not exists public.voice_logs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  transcript text not null,
  intent text,
  payload jsonb,
  created_at timestamptz not null default now()
);

-- Row Level Security policies
alter table public.profiles enable row level security;
alter table public.itineraries enable row level security;
alter table public.itinerary_days enable row level security;
alter table public.itinerary_items enable row level security;
alter table public.expenses enable row level security;
alter table public.expense_entries enable row level security;
alter table public.voice_logs enable row level security;

-- Profiles policies
create policy "Users can view own profile" on public.profiles
  for select using (auth.uid() = id);

create policy "Users can insert own profile" on public.profiles
  for insert with check (auth.uid() = id);

create policy "Users can update own profile" on public.profiles
  for update using (auth.uid() = id);

-- Itineraries policies
create policy "Users can view itineraries they own" on public.itineraries
  for select using (auth.uid() = owner_id);

create policy "Users can manage their itineraries" on public.itineraries
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

-- Child tables policies rely on parent ownership
create policy "Users can view their itinerary days" on public.itinerary_days
  for select using (
    auth.uid() = (
      select owner_id from public.itineraries where id = itinerary_id
    )
  );

create policy "Users can manage their itinerary days" on public.itinerary_days
  for all using (
    auth.uid() = (
      select owner_id from public.itineraries where id = itinerary_id
    )
  ) with check (
    auth.uid() = (
      select owner_id from public.itineraries where id = itinerary_id
    )
  );

create policy "Users can view their itinerary items" on public.itinerary_items
  for select using (
    auth.uid() = (
      select owner_id
      from public.itineraries i
      join public.itinerary_days d on d.itinerary_id = i.id
      where d.id = day_id
    )
  );

create policy "Users can manage their itinerary items" on public.itinerary_items
  for all using (
    auth.uid() = (
      select owner_id
      from public.itineraries i
      join public.itinerary_days d on d.itinerary_id = i.id
      where d.id = day_id
    )
  ) with check (
    auth.uid() = (
      select owner_id
      from public.itineraries i
      join public.itinerary_days d on d.itinerary_id = i.id
      where d.id = day_id
    )
  );

create policy "Users can view their expense summaries" on public.expenses
  for select using (auth.uid() = owner_id);

create policy "Users can manage their expense summaries" on public.expenses
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

create policy "Users can view their expense entries" on public.expense_entries
  for select using (
    auth.uid() = (
      select owner_id
      from public.expenses e
      where e.id = expense_id
    )
  );

create policy "Users can manage their expense entries" on public.expense_entries
  for all using (
    auth.uid() = (
      select owner_id
      from public.expenses e
      where e.id = expense_id
    )
  ) with check (
    auth.uid() = (
      select owner_id
      from public.expenses e
      where e.id = expense_id
    )
  );

create policy "Users can view their voice logs" on public.voice_logs
  for select using (auth.uid() = owner_id);

create policy "Users can manage their voice logs" on public.voice_logs
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

-- Trigger to keep updated_at fresh
create or replace function public.refresh_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger set_itineraries_updated_at
  before update on public.itineraries
  for each row execute procedure public.refresh_updated_at();

create trigger set_itinerary_days_updated_at
  before update on public.itinerary_days
  for each row execute procedure public.refresh_updated_at();

create trigger set_itinerary_items_updated_at
  before update on public.itinerary_items
  for each row execute procedure public.refresh_updated_at();

create trigger set_expenses_updated_at
  before update on public.expenses
  for each row execute procedure public.refresh_updated_at();

create trigger set_expense_entries_updated_at
  before update on public.expense_entries
  for each row execute procedure public.refresh_updated_at();

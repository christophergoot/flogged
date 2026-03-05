-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor) to create the activities table.

create table if not exists public.activities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  duration_minutes integer not null check (duration_minutes > 0),
  end_time timestamptz,
  created_at timestamptz not null default now()
);

-- RLS: users can only see and insert their own activities
alter table public.activities enable row level security;

create policy "Users can read own activities"
  on public.activities for select
  using (auth.uid() = user_id);

create policy "Users can insert own activities"
  on public.activities for insert
  with check (auth.uid() = user_id);

create policy "Users can delete own activities"
  on public.activities for delete
  using (auth.uid() = user_id);

-- Optional: index for fast listing by user
create index if not exists activities_user_created_idx
  on public.activities (user_id, created_at desc);

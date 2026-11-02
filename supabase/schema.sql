-- COUNT365 database schema.
-- Run this in Supabase: SQL Editor -> New query -> paste everything -> Run.
-- It is safe to run again: it only adds what is missing.

-- ---------- Tasks ----------
create table if not exists public.tasks (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  day        date not null,
  text       text not null check (char_length(text) between 1 and 120),
  done       boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists tasks_user_day_idx on public.tasks (user_id, day);

-- ---------- Repeating tasks ----------
create table if not exists public.routines (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  text       text not null check (char_length(text) between 1 and 120),
  start_day  date not null,
  end_day    date not null,
  weekdays   smallint[] not null check (cardinality(weekdays) between 1 and 7),
  created_at timestamptz not null default now(),
  check (end_day >= start_day and end_day - start_day <= 400)
);

-- Each task created by a repeating task points back to it
alter table public.tasks
  add column if not exists routine_id uuid references public.routines (id) on delete set null;

create index if not exists tasks_routine_idx on public.tasks (routine_id);

-- ---------- Row Level Security: every user only sees and changes their own rows ----------
alter table public.tasks    enable row level security;
alter table public.routines enable row level security;

drop policy if exists "tasks_select_own" on public.tasks;
drop policy if exists "tasks_insert_own" on public.tasks;
drop policy if exists "tasks_update_own" on public.tasks;
drop policy if exists "tasks_delete_own" on public.tasks;

create policy "tasks_select_own" on public.tasks
  for select to authenticated using (auth.uid() = user_id);
create policy "tasks_insert_own" on public.tasks
  for insert to authenticated with check (auth.uid() = user_id);
create policy "tasks_update_own" on public.tasks
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "tasks_delete_own" on public.tasks
  for delete to authenticated using (auth.uid() = user_id);

drop policy if exists "routines_select_own" on public.routines;
drop policy if exists "routines_insert_own" on public.routines;
drop policy if exists "routines_update_own" on public.routines;
drop policy if exists "routines_delete_own" on public.routines;

create policy "routines_select_own" on public.routines
  for select to authenticated using (auth.uid() = user_id);
create policy "routines_insert_own" on public.routines
  for insert to authenticated with check (auth.uid() = user_id);
create policy "routines_update_own" on public.routines
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "routines_delete_own" on public.routines
  for delete to authenticated using (auth.uid() = user_id);

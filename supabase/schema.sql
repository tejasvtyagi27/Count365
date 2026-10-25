-- COUNT365 database schema. Run this once in Supabase: SQL Editor -> New query -> Run.

create table if not exists public.tasks (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  day        date not null,
  text       text not null check (char_length(text) between 1 and 120),
  done       boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists tasks_user_day_idx on public.tasks (user_id, day);

-- Row Level Security: every user can only see and change their own tasks.
alter table public.tasks enable row level security;

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

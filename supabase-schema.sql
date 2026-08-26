create extension if not exists pgcrypto;

create table if not exists public.poll_responses (
  id uuid primary key default gen_random_uuid(),
  poll_id text not null,
  question_id text not null check (question_id in ('1', '2', '3')),
  answer text not null check (char_length(answer) between 1 and 80),
  created_at timestamptz not null default now()
);

alter table public.poll_responses enable row level security;

drop policy if exists "Anyone can submit poll responses" on public.poll_responses;
create policy "Anyone can submit poll responses"
on public.poll_responses
for insert
to anon
with check (
  poll_id in ('women-in-mining-keynote-2026', 'women-in-mining-keynote-qa')
  and (
    (question_id = '1' and answer in ('Mbokodo', 'Egg', 'Marshmallow', 'Air bubble'))
    or (question_id = '2' and answer in ('Yes', 'No'))
    or (question_id = '3' and char_length(answer) between 1 and 36)
  )
);

drop policy if exists "Anyone can view live poll responses" on public.poll_responses;
create policy "Anyone can view live poll responses"
on public.poll_responses
for select
to anon
using (poll_id = 'women-in-mining-keynote-2026');

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'poll_responses'
  ) then
    alter publication supabase_realtime add table public.poll_responses;
  end if;
end $$;

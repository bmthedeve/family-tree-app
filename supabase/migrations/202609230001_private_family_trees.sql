-- Run once in this project's Supabase SQL Editor.
-- Deliberately does not modify auth.users, auth triggers, or another app's tables.
begin;

create table public.family_tree_documents (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  document jsonb not null default '{"people":[],"relationships":[],"recycleBin":[]}'::jsonb,
  revision integer not null default 1 check (revision > 0),
  constraint family_tree_document_shape check (
    jsonb_typeof(document) = 'object'
    and document ?& array['people', 'relationships', 'recycleBin']
    and jsonb_typeof(document -> 'people') = 'array'
    and jsonb_typeof(document -> 'relationships') = 'array'
    and jsonb_typeof(document -> 'recycleBin') = 'array'
  )
);

alter table public.family_tree_documents enable row level security;
revoke all on public.family_tree_documents from anon, authenticated;
grant select, insert, update on public.family_tree_documents to authenticated;

create policy family_tree_read_own on public.family_tree_documents
  for select to authenticated using ((select auth.uid()) = owner_id);
create policy family_tree_insert_own on public.family_tree_documents
  for insert to authenticated with check ((select auth.uid()) = owner_id);
create policy family_tree_update_own on public.family_tree_documents
  for update to authenticated using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

commit;

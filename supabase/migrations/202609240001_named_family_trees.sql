-- Run AFTER 202609230001_private_family_trees.sql. Existing data is preserved.
begin;
alter table public.family_tree_documents add column id uuid;
-- Stable ID for the original tree also allows recovery of old browser drafts.
update public.family_tree_documents set id = owner_id;
alter table public.family_tree_documents alter column id set not null;
alter table public.family_tree_documents alter column id set default gen_random_uuid();
alter table public.family_tree_documents drop constraint family_tree_documents_pkey;
alter table public.family_tree_documents add primary key (id);
alter table public.family_tree_documents add column name text not null default 'My Family Tree'
  check (length(btrim(name)) between 1 and 120);
create index family_tree_documents_owner_id_idx on public.family_tree_documents(owner_id);
-- Existing owner_id foreign key and owner-only RLS policies remain in place.
commit;

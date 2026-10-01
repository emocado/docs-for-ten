-- One record type: a shared document.
-- content holds the Yjs document state, base64-encoded.
create table public.documents (
  id uuid primary key default gen_random_uuid(),
  title text not null default 'Untitled document',
  content text,
  owner_id uuid not null default auth.uid() references auth.users on delete cascade,
  owner_email text not null default (auth.jwt() ->> 'email'),
  updated_at timestamptz not null default now()
);

-- The rule: every signed-in member can view and edit any document,
-- but only the person who created it can delete it.
alter table public.documents enable row level security;

create policy "members can read" on public.documents
  for select to authenticated using (true);
create policy "members can create their own" on public.documents
  for insert to authenticated with check (owner_id = auth.uid());
create policy "members can edit" on public.documents
  for update to authenticated using (true) with check (true);
create policy "only the owner can delete" on public.documents
  for delete to authenticated using (owner_id = auth.uid());

-- Live editing goes over private Realtime broadcast channels; only members may join.
create policy "members can use realtime" on realtime.messages
  for all to authenticated using (true) with check (true);

-- An app for ten: refuse the eleventh sign-up.
create function public.limit_to_ten_members() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from auth.users) >= 10 then
    raise exception 'This group is full (10 members max)';
  end if;
  return new;
end;
$$;

create trigger limit_to_ten_members
  before insert on auth.users
  for each row execute function public.limit_to_ten_members();

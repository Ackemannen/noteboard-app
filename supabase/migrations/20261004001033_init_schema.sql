-- Collaboard initial schema: boards, board membership and sticky notes.
--
-- Access model
--   * A board has exactly one owner (boards.owner_id) who can rename and delete it.
--   * Everyone in board_members (the owner is added automatically) can read and edit its notes.
--   * Opening a board's share link calls public.join_board(), which adds the caller as an editor.

-- ---------------------------------------------------------------------------
-- Helpers (kept in a non-exposed schema so they can't be called through the API)
-- ---------------------------------------------------------------------------
create schema if not exists private;
grant usage on schema private to authenticated;

create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table public.boards (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index boards_owner_id_idx on public.boards (owner_id);

create table public.board_members (
  board_id uuid not null references public.boards (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'editor' check (role in ('owner', 'editor')),
  created_at timestamptz not null default now(),
  primary key (board_id, user_id)
);

create index board_members_user_id_idx on public.board_members (user_id);

create table public.notes (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.boards (id) on delete cascade,
  title text not null default '' check (char_length(title) <= 50),
  content text not null default '' check (char_length(content) <= 200),
  color text not null default 'yellow'
    check (color in ('yellow', 'pink', 'blue', 'green', 'orange')),
  x double precision not null default 0,
  y double precision not null default 0,
  rotation double precision not null default 0,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index notes_board_id_idx on public.notes (board_id);
create index notes_created_by_idx on public.notes (created_by);

create trigger boards_set_updated_at
  before update on public.boards
  for each row execute function private.set_updated_at();

create trigger notes_set_updated_at
  before update on public.notes
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- Membership helpers
-- ---------------------------------------------------------------------------

-- security definer so RLS policies can check membership without recursing
-- into board_members' own policies.
create or replace function private.is_board_member(p_board_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.board_members m
    where m.board_id = p_board_id
      and m.user_id = (select auth.uid())
  );
$$;

revoke execute on function private.is_board_member(uuid) from public, anon;
grant execute on function private.is_board_member(uuid) to authenticated;

-- Every new board gets its owner as a member.
create or replace function private.add_board_owner_membership()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.board_members (board_id, user_id, role)
  values (new.id, new.owner_id, 'owner')
  on conflict (board_id, user_id) do update set role = 'owner';
  return new;
end;
$$;

create trigger boards_add_owner_membership
  after insert on public.boards
  for each row execute function private.add_board_owner_membership();

-- Called when someone opens a share link. Returns false if the board doesn't exist.
create or replace function public.join_board(p_board_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  if not exists (select 1 from public.boards b where b.id = p_board_id) then
    return false;
  end if;

  insert into public.board_members (board_id, user_id, role)
  values (p_board_id, (select auth.uid()), 'editor')
  on conflict (board_id, user_id) do nothing;

  return true;
end;
$$;

revoke execute on function public.join_board(uuid) from public, anon;
grant execute on function public.join_board(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Grants (explicit, so access doesn't depend on project default privileges)
-- ---------------------------------------------------------------------------
revoke all on public.boards, public.board_members, public.notes from anon;
grant select, insert, update, delete on public.boards to authenticated;
grant select, delete on public.board_members to authenticated;
grant select, insert, update, delete on public.notes to authenticated;

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------
alter table public.boards enable row level security;
alter table public.board_members enable row level security;
alter table public.notes enable row level security;

-- boards
create policy "Members can view boards"
  on public.boards for select
  to authenticated
  using (owner_id = (select auth.uid()) or (select private.is_board_member(id)));

create policy "Users can create their own boards"
  on public.boards for insert
  to authenticated
  with check (owner_id = (select auth.uid()));

create policy "Owners can update boards"
  on public.boards for update
  to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create policy "Owners can delete boards"
  on public.boards for delete
  to authenticated
  using (owner_id = (select auth.uid()));

-- board_members
create policy "Members can view fellow members"
  on public.board_members for select
  to authenticated
  using (user_id = (select auth.uid()) or (select private.is_board_member(board_id)));

create policy "Editors can leave and owners can remove editors"
  on public.board_members for delete
  to authenticated
  using (
    role <> 'owner'
    and (
      user_id = (select auth.uid())
      or exists (
        select 1 from public.boards b
        where b.id = board_id and b.owner_id = (select auth.uid())
      )
    )
  );

-- notes
create policy "Members can view notes"
  on public.notes for select
  to authenticated
  using ((select private.is_board_member(board_id)));

create policy "Members can create notes"
  on public.notes for insert
  to authenticated
  with check ((select private.is_board_member(board_id)));

create policy "Members can update notes"
  on public.notes for update
  to authenticated
  using ((select private.is_board_member(board_id)))
  with check ((select private.is_board_member(board_id)));

create policy "Members can delete notes"
  on public.notes for delete
  to authenticated
  using ((select private.is_board_member(board_id)));

-- ---------------------------------------------------------------------------
-- Realtime: stream note changes to everyone viewing a board
-- ---------------------------------------------------------------------------
alter publication supabase_realtime add table public.notes;

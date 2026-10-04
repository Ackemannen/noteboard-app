-- Board chat: messages (optionally linked to a note), read receipts, and the
-- public profiles needed to show who wrote what.

-- ---------------------------------------------------------------------------
-- Profiles: display name + avatar for each user, synced from auth.users.
-- Visible to yourself and to people you share a board with.
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null,
  avatar_url text,
  updated_at timestamptz not null default now()
);

create or replace function private.profile_name(meta jsonb, email text)
returns text
language sql
immutable
set search_path = ''
as $$
  select coalesce(
    nullif(btrim(meta ->> 'full_name'), ''),
    nullif(btrim(meta ->> 'name'), ''),
    nullif(split_part(email, '@', 1), ''),
    'Someone'
  );
$$;

create or replace function private.sync_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    private.profile_name(new.raw_user_meta_data, new.email),
    coalesce(new.raw_user_meta_data ->> 'avatar_url', new.raw_user_meta_data ->> 'picture')
  )
  on conflict (id) do update
    set display_name = excluded.display_name,
        avatar_url = excluded.avatar_url,
        updated_at = now();
  return new;
end;
$$;

create trigger sync_profile_from_auth
  after insert or update of raw_user_meta_data, email on auth.users
  for each row execute function private.sync_profile();

-- Existing users
insert into public.profiles (id, display_name, avatar_url)
select
  u.id,
  private.profile_name(u.raw_user_meta_data, u.email),
  coalesce(u.raw_user_meta_data ->> 'avatar_url', u.raw_user_meta_data ->> 'picture')
from auth.users u
on conflict (id) do nothing;

create or replace function private.shares_board_with(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_user_id = (select auth.uid())
    or exists (
      select 1
      from public.board_members mine
      join public.board_members theirs on theirs.board_id = mine.board_id
      where mine.user_id = (select auth.uid())
        and theirs.user_id = p_user_id
    );
$$;

revoke execute on function private.shares_board_with(uuid) from public, anon;
grant execute on function private.shares_board_with(uuid) to authenticated;

alter table public.profiles enable row level security;
revoke all on public.profiles from anon;
grant select on public.profiles to authenticated;

create policy "Profiles are visible to people sharing a board"
  on public.profiles for select
  to authenticated
  using ((select private.shares_board_with(id)));

-- ---------------------------------------------------------------------------
-- Messages
-- ---------------------------------------------------------------------------
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.boards (id) on delete cascade,
  author_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 2000),
  -- Optional note the message points at; cleared if the note is deleted.
  note_id uuid references public.notes (id) on delete set null,
  created_at timestamptz not null default now(),
  -- Set by the database when the text changes, so "edited" can't be faked.
  edited_at timestamptz
);

create index messages_board_id_created_at_idx on public.messages (board_id, created_at);
create index messages_note_id_idx on public.messages (note_id);
create index messages_author_id_idx on public.messages (author_id);

create or replace function private.mark_message_edited()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.body is distinct from old.body then
    new.edited_at = now();
  end if;
  return new;
end;
$$;

create trigger messages_mark_edited
  before update on public.messages
  for each row execute function private.mark_message_edited();

alter table public.messages enable row level security;
revoke all on public.messages from anon;
grant select, insert, delete on public.messages to authenticated;
-- Editing may only change the text and the linked note.
grant update (body, note_id) on public.messages to authenticated;

create policy "Members can read messages"
  on public.messages for select
  to authenticated
  using ((select private.is_board_member(board_id)));

create policy "Members can post as themselves"
  on public.messages for insert
  to authenticated
  with check (
    author_id = (select auth.uid())
    and (select private.is_board_member(board_id))
    and (
      note_id is null
      or exists (
        select 1 from public.notes n where n.id = note_id and n.board_id = messages.board_id
      )
    )
  );

create policy "Authors can edit their messages"
  on public.messages for update
  to authenticated
  using (author_id = (select auth.uid()))
  with check (
    author_id = (select auth.uid())
    and (
      note_id is null
      or exists (
        select 1 from public.notes n where n.id = note_id and n.board_id = messages.board_id
      )
    )
  );

create policy "Authors can delete their messages"
  on public.messages for delete
  to authenticated
  using (author_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Read receipts: when each member last read a board's chat.
-- ---------------------------------------------------------------------------
create table public.chat_reads (
  board_id uuid not null references public.boards (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (board_id, user_id)
);

create index chat_reads_user_id_idx on public.chat_reads (user_id);

alter table public.chat_reads enable row level security;
revoke all on public.chat_reads from anon;
grant select, insert, update on public.chat_reads to authenticated;

create policy "Members can see read receipts"
  on public.chat_reads for select
  to authenticated
  using ((select private.is_board_member(board_id)));

create policy "Members record their own reads"
  on public.chat_reads for insert
  to authenticated
  with check (user_id = (select auth.uid()) and (select private.is_board_member(board_id)));

create policy "Members update their own reads"
  on public.chat_reads for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and (select private.is_board_member(board_id)));

-- Uses the database clock, so read receipts don't depend on the client's clock.
create or replace function public.mark_chat_read(p_board_id uuid)
returns timestamptz
language sql
security invoker
set search_path = ''
as $$
  insert into public.chat_reads (board_id, user_id, last_read_at)
  values (p_board_id, (select auth.uid()), now())
  on conflict (board_id, user_id) do update set last_read_at = excluded.last_read_at
  returning last_read_at;
$$;

revoke execute on function public.mark_chat_read(uuid) from public, anon;
grant execute on function public.mark_chat_read(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Realtime
-- ---------------------------------------------------------------------------
alter publication supabase_realtime add table public.messages, public.chat_reads;

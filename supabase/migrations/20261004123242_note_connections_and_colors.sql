-- More sticky note colors, and connections (threads and arrows) between notes.

-- ---------------------------------------------------------------------------
-- Colors
-- ---------------------------------------------------------------------------
alter table public.notes drop constraint notes_color_check;
alter table public.notes add constraint notes_color_check check (
  color in ('yellow', 'orange', 'coral', 'pink', 'purple', 'blue', 'teal', 'green', 'lime', 'paper')
);

-- ---------------------------------------------------------------------------
-- Connections: a pinned thread or an arrow from one note to another.
-- Deleting either note deletes the connection.
-- ---------------------------------------------------------------------------
create table public.connections (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.boards (id) on delete cascade,
  from_note_id uuid not null references public.notes (id) on delete cascade,
  to_note_id uuid not null references public.notes (id) on delete cascade,
  kind text not null default 'thread' check (kind in ('thread', 'arrow')),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  check (from_note_id <> to_note_id),
  unique (from_note_id, to_note_id, kind)
);

create index connections_board_id_idx on public.connections (board_id);
create index connections_to_note_id_idx on public.connections (to_note_id);
create index connections_created_by_idx on public.connections (created_by);

revoke all on public.connections from anon;
grant select, insert, delete on public.connections to authenticated;

alter table public.connections enable row level security;

create policy "Members can view connections"
  on public.connections for select
  to authenticated
  using ((select private.is_board_member(board_id)));

create policy "Members can create connections"
  on public.connections for insert
  to authenticated
  with check ((select private.is_board_member(board_id)));

create policy "Members can delete connections"
  on public.connections for delete
  to authenticated
  using ((select private.is_board_member(board_id)));

alter publication supabase_realtime add table public.connections;

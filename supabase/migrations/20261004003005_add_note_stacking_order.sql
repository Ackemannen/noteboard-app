-- Persist the stacking order of notes so a note brought to the front by one
-- collaborator is on top for everyone. Higher z is drawn above lower z.
alter table public.notes add column z integer not null default 0;

-- Keep existing boards looking the same: stack notes in creation order.
update public.notes n
set z = ordered.position
from (
  select id, row_number() over (partition by board_id order by created_at, id) as position
  from public.notes
) ordered
where n.id = ordered.id;

create index notes_board_id_z_idx on public.notes (board_id, z);
drop index if exists public.notes_board_id_idx;

-- Live presence on boards: who's online and their cursors.
--
-- Clients join the private Realtime channel "board-presence:<board id>".
-- Private channels are authorized through RLS on realtime.messages, so only
-- members of a board can see (select) or publish (insert) presence and cursor
-- broadcasts for it.

create or replace function private.board_presence_board_id(topic text)
returns uuid
language plpgsql
immutable
set search_path = ''
as $$
begin
  if split_part(topic, ':', 1) <> 'board-presence' then
    return null;
  end if;
  return split_part(topic, ':', 2)::uuid;
exception
  when invalid_text_representation then
    return null; -- malformed topic: no access
end;
$$;

revoke execute on function private.board_presence_board_id(text) from public, anon;
grant execute on function private.board_presence_board_id(text) to authenticated;

create policy "Board members can receive presence and cursors"
  on realtime.messages for select
  to authenticated
  using (
    realtime.messages.extension in ('broadcast', 'presence')
    and (select private.is_board_member(private.board_presence_board_id((select realtime.topic()))))
  );

create policy "Board members can send presence and cursors"
  on realtime.messages for insert
  to authenticated
  with check (
    realtime.messages.extension in ('broadcast', 'presence')
    and (select private.is_board_member(private.board_presence_board_id((select realtime.topic()))))
  );

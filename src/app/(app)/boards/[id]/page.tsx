import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import { rowToNote } from "@/lib/notes";
import { createClient, getUser } from "@/lib/supabase/server";
import BoardLoader from "./BoardLoader";

type Props = { params: Promise<{ id: string }> };

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Loads a board, joining it first if the user isn't a member yet (that's how
 * share links work). Cached so generateMetadata and the page share the work.
 */
const loadBoard = cache(async (boardId: string) => {
  const supabase = await createClient();
  const selectBoard = () =>
    supabase.from("boards").select("id, name").eq("id", boardId).maybeSingle();

  // RLS only returns the board to members.
  let { data: board } = await selectBoard();
  let justJoined = false;

  if (!board) {
    const { data: exists, error } = await supabase.rpc("join_board", {
      p_board_id: boardId,
    });
    if (error) console.error("join_board:", error);
    if (!exists) return null;
    ({ data: board } = await selectBoard());
    justJoined = true;
  }
  if (!board) return null;

  const { data: notes, error } = await supabase
    .from("notes")
    .select("*")
    .eq("board_id", boardId)
    .order("z", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) console.error("Failed to load notes:", error);

  return { board, notes: (notes ?? []).map(rowToNote), justJoined };
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  if (!UUID_RE.test(id) || !(await getUser())) return { title: "Collaboard" };
  const result = await loadBoard(id);
  return { title: result ? `${result.board.name} · Collaboard` : "Collaboard" };
}

export default async function BoardPage({ params }: Props) {
  const { id } = await params;

  const user = await getUser();
  if (!user) redirect(`/auth?next=${encodeURIComponent(`/boards/${id}`)}`);

  if (!UUID_RE.test(id)) notFound();

  const result = await loadBoard(id);
  if (!result) notFound();

  return (
    <BoardLoader
      key={id}
      boardId={id}
      boardName={result.board.name}
      initialNotes={result.notes}
      justJoined={result.justJoined}
    />
  );
}

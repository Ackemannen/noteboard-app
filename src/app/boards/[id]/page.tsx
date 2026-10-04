import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import { rowToNote } from "@/lib/notes";
import { createClient, getUser } from "@/lib/supabase/server";
import Board from "./Board";

type Props = { params: Promise<{ id: string }> };

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Opening a board link joins it (that's how sharing works), then loads it.
 * Cached so generateMetadata and the page share one round trip.
 */
const loadBoard = cache(async (boardId: string) => {
  const supabase = await createClient();

  const { data: exists, error: joinError } = await supabase.rpc("join_board", {
    p_board_id: boardId,
  });
  if (joinError) console.error("join_board:", joinError);
  if (!exists) return null;

  const [boardResult, notesResult] = await Promise.all([
    supabase.from("boards").select("id, name").eq("id", boardId).maybeSingle(),
    supabase
      .from("notes")
      .select("*")
      .eq("board_id", boardId)
      .order("created_at", { ascending: true }),
  ]);

  if (!boardResult.data) return null;
  if (notesResult.error) console.error("Failed to load notes:", notesResult.error);

  return {
    board: boardResult.data,
    notes: (notesResult.data ?? []).map(rowToNote),
  };
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

  return <Board key={id} boardId={id} initialNotes={result.notes} />;
}

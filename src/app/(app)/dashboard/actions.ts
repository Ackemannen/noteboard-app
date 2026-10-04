"use server";

import { revalidatePath } from "next/cache";
import { createClient, getUser } from "@/lib/supabase/server";

/** Refresh the dashboard and the sidebar (which lives in the shared layout). */
const revalidateApp = () => revalidatePath("/", "layout");

function validateName(name: string): { ok: true; name: string } | { ok: false; error: string } {
  const trimmed = name.trim();
  if (!trimmed) return { ok: false, error: "Board name is required" };
  if (trimmed.length > 100) return { ok: false, error: "Board name is too long" };
  return { ok: true, name: trimmed };
}

type ActionResult<T = undefined> =
  | ({ ok: true } & (T extends undefined ? object : { data: T }))
  | { ok: false; error: string };

export async function createBoard(
  name: string
): Promise<ActionResult<{ id: string }>> {
  const valid = validateName(name);
  if (!valid.ok) return valid;

  const user = await getUser();
  if (!user) return { ok: false, error: "Not signed in" };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("boards")
    .insert({ name: valid.name, owner_id: user.id })
    .select("id")
    .single();

  if (error) {
    console.error("createBoard:", error);
    return { ok: false, error: "Failed to create board" };
  }

  revalidateApp();
  return { ok: true, data: { id: data.id } };
}

export async function deleteBoard(boardId: string): Promise<ActionResult> {
  const supabase = await createClient();
  // RLS only lets the owner delete; `count` tells us whether anything happened.
  const { error, count } = await supabase
    .from("boards")
    .delete({ count: "exact" })
    .eq("id", boardId);

  if (error || !count) {
    if (error) console.error("deleteBoard:", error);
    return { ok: false, error: "Failed to delete board" };
  }

  revalidateApp();
  return { ok: true };
}

export async function leaveBoard(boardId: string): Promise<ActionResult> {
  const user = await getUser();
  if (!user) return { ok: false, error: "Not signed in" };

  const supabase = await createClient();
  const { error, count } = await supabase
    .from("board_members")
    .delete({ count: "exact" })
    .eq("board_id", boardId)
    .eq("user_id", user.id);

  if (error || !count) {
    if (error) console.error("leaveBoard:", error);
    return { ok: false, error: "Failed to leave board" };
  }

  revalidateApp();
  return { ok: true };
}

export async function renameBoard(boardId: string, name: string): Promise<ActionResult> {
  const valid = validateName(name);
  if (!valid.ok) return valid;

  const supabase = await createClient();
  // RLS only lets the owner rename.
  const { error, count } = await supabase
    .from("boards")
    .update({ name: valid.name }, { count: "exact" })
    .eq("id", boardId);

  if (error || !count) {
    if (error) console.error("renameBoard:", error);
    return { ok: false, error: "Failed to rename board" };
  }

  revalidateApp();
  return { ok: true };
}

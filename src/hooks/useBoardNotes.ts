import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import type { Tables } from "@/lib/supabase/database.types";
import { isSameNote, noteToRow, rowToNote, type Note } from "@/lib/notes";

const SAVE_DEBOUNCE_MS = 150;

/** A note position shared live while someone drags it. */
export type NotePreview = Pick<Note, "id" | "x" | "y" | "z">;

/**
 * Local note state for a board that is kept in sync with Supabase.
 *
 * Components edit `notes` freely through `setNotes`. Changes are diffed
 * against the last known server state and flushed (debounced) as upserts and
 * deletes. Changes made by other people arrive over Realtime and are merged
 * in, except for notes with unsaved local edits, which win until saved.
 */
export function useBoardNotes(boardId: string, initialNotes: Note[]) {
  const [supabase] = useState(createClient);
  const [notes, setNotes] = useState<Note[]>(initialNotes);
  const notesRef = useRef(notes);
  const serverNotesRef = useRef(
    new Map(initialNotes.map((note) => [note.id, note]))
  );
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    notesRef.current = notes;
  }, [notes]);

  const flush = useCallback(async () => {
    const server = serverNotesRef.current;
    const local = notesRef.current;

    const upserts = local.filter((note) => {
      const saved = server.get(note.id);
      return !saved || !isSameNote(saved, note);
    });
    const localIds = new Set(local.map((note) => note.id));
    const deletes = [...server.keys()].filter((id) => !localIds.has(id));

    if (upserts.length === 0 && deletes.length === 0) return;

    // Optimistically treat these as saved so overlapping flushes don't resend them.
    const previous = new Map(server);
    upserts.forEach((note) => server.set(note.id, note));
    deletes.forEach((id) => server.delete(id));

    const [upsertResult, deleteResult] = await Promise.all([
      upserts.length
        ? supabase
            .from("notes")
            .upsert(upserts.map((note) => noteToRow(note, boardId)))
        : null,
      deletes.length
        ? supabase.from("notes").delete().in("id", deletes)
        : null,
    ]);

    if (upsertResult?.error) {
      console.error("Error saving notes:", upsertResult.error);
      // Roll back so the next change retries these notes.
      upserts.forEach((note) => {
        const before = previous.get(note.id);
        if (before) server.set(note.id, before);
        else server.delete(note.id);
      });
    }
    if (deleteResult?.error) {
      console.error("Error deleting notes:", deleteResult.error);
      deletes.forEach((id) => {
        const before = previous.get(id);
        if (before) server.set(id, before);
      });
    }
    if (upsertResult?.error || deleteResult?.error) {
      toast.error("Couldn't save your latest changes");
    }
  }, [boardId, supabase]);

  // Debounced save whenever local notes change.
  useEffect(() => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(flush, SAVE_DEBOUNCE_MS);
  }, [notes, flush]);

  // Save anything pending when leaving the board.
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      void flush();
    };
  }, [flush]);

  // Live updates from other collaborators.
  useEffect(() => {
    const applyRemoteUpsert = (remote: Note) => {
      const server = serverNotesRef.current;
      const saved = server.get(remote.id);
      const local = notesRef.current.find((note) => note.id === remote.id);
      server.set(remote.id, remote);

      // Unsaved local edit (or pending local delete): keep ours, it saves next.
      if (saved && (!local || !isSameNote(local, saved))) return;

      setNotes((prev) =>
        prev.some((note) => note.id === remote.id)
          ? prev.map((note) => (note.id === remote.id ? remote : note))
          : [...prev, remote]
      );
    };

    const applyRemoteDelete = (id: string) => {
      serverNotesRef.current.delete(id);
      setNotes((prev) => prev.filter((note) => note.id !== id));
    };

    const filter = `board_id=eq.${boardId}`;
    const channel = supabase
      .channel(`board:${boardId}`)
      .on<Tables<"notes">>(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notes", filter },
        ({ new: row }) => applyRemoteUpsert(rowToNote(row))
      )
      .on<Tables<"notes">>(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "notes", filter },
        ({ new: row }) => applyRemoteUpsert(rowToNote(row))
      )
      // Delete events can't be filtered and only carry the primary key;
      // ids from other boards simply won't match anything here.
      .on<Tables<"notes">>(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "notes" },
        ({ old }) => {
          if (old.id) applyRemoteDelete(old.id);
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [boardId, supabase]);

  /** Save pending changes right away (e.g. when a drag ends) instead of debouncing. */
  const saveNow = useCallback(() => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = null;
    void flush();
  }, [flush]);

  /**
   * Show another user's in-progress drag. Treated as already-saved state, so
   * this client never writes it back; their own save on drop arrives later
   * over postgres_changes with the same values. Notes with unsaved local edits
   * keep the local version.
   */
  const applyRemotePreview = useCallback((moves: NotePreview[]) => {
    const server = serverNotesRef.current;
    const updates = new Map<string, Note>();
    for (const move of moves) {
      const local = notesRef.current.find((note) => note.id === move.id);
      const saved = server.get(move.id);
      if (!local || (saved && !isSameNote(saved, local))) continue;
      const next = { ...local, x: move.x, y: move.y, z: move.z };
      server.set(move.id, next);
      updates.set(move.id, next);
    }
    if (updates.size === 0) return;
    // Keep the ref in step so several previews between renders build on each other.
    notesRef.current = notesRef.current.map((note) => updates.get(note.id) ?? note);
    setNotes((prev) => prev.map((note) => updates.get(note.id) ?? note));
  }, []);

  return { notes, setNotes, saveNow, applyRemotePreview };
}

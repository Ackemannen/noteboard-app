import type { Tables } from "@/lib/supabase/database.types";

export const MESSAGE_MAX = 2000;

export interface ChatMessage {
  id: string;
  authorId: string;
  body: string;
  /** Note the message points at, if any. */
  noteId: string | null;
  createdAt: string;
  editedAt: string | null;
  /** Optimistic message not yet confirmed by the server. */
  pending?: boolean;
}

export interface Profile {
  id: string;
  name: string;
  avatarUrl: string | null;
}

export function rowToMessage(row: Tables<"messages">): ChatMessage {
  return {
    id: row.id,
    authorId: row.author_id,
    body: row.body,
    noteId: row.note_id,
    createdAt: row.created_at,
    editedAt: row.edited_at,
  };
}

export function rowToProfile(row: Tables<"profiles">): Profile {
  return { id: row.id, name: row.display_name, avatarUrl: row.avatar_url };
}

/** Timestamps from Postgres compare correctly as numbers, not as strings. */
export const time = (iso: string) => new Date(iso).getTime();

export const byCreatedAt = (a: ChatMessage, b: ChatMessage) =>
  time(a.createdAt) - time(b.createdAt);

/** Other members who have read `message` (their last read is at or after it). */
export function readersOf(message: ChatMessage, reads: Record<string, string>, myId: string) {
  return Object.entries(reads)
    .filter(([userId, readAt]) => userId !== myId && time(readAt) >= time(message.createdAt))
    .map(([userId]) => userId);
}

import type { Tables } from "@/lib/supabase/database.types";

export type NoteColor = "yellow" | "pink" | "blue" | "green" | "orange";

export interface Note {
  id: string;
  title: string;
  content: string;
  color: string;
  x: number;
  y: number;
  rotation: number;
}

type NoteRow = Tables<"notes">;

export function rowToNote(row: NoteRow): Note {
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    color: row.color,
    x: row.x,
    y: row.y,
    rotation: row.rotation,
  };
}

export function noteToRow(note: Note, boardId: string) {
  return { ...note, board_id: boardId };
}

export function isSameNote(a: Note, b: Note) {
  return (
    a.title === b.title &&
    a.content === b.content &&
    a.color === b.color &&
    a.x === b.x &&
    a.y === b.y &&
    a.rotation === b.rotation
  );
}

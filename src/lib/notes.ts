import type { Tables } from "@/lib/supabase/database.types";

/** Sticky notes are square; this is their size in board (world) units. */
export const NOTE_SIZE = 192;

/**
 * Paper colors, in palette order. Must match the `notes_color_check` constraint.
 * `shadow` is a darker tint of the paper, for colored drop shadows.
 */
export const NOTE_COLORS = {
  yellow: { label: "Yellow", className: "bg-yellow-200 border-yellow-300", hex: "#fef08a", shadow: "#a16207" },
  orange: { label: "Orange", className: "bg-orange-200 border-orange-300", hex: "#fed7aa", shadow: "#c2410c" },
  coral: { label: "Coral", className: "bg-red-200 border-red-300", hex: "#fecaca", shadow: "#b91c1c" },
  pink: { label: "Pink", className: "bg-pink-200 border-pink-300", hex: "#fbcfe8", shadow: "#be185d" },
  purple: { label: "Purple", className: "bg-purple-200 border-purple-300", hex: "#e9d5ff", shadow: "#7e22ce" },
  blue: { label: "Blue", className: "bg-blue-200 border-blue-300", hex: "#bfdbfe", shadow: "#1d4ed8" },
  teal: { label: "Teal", className: "bg-teal-200 border-teal-300", hex: "#99f6e4", shadow: "#0f766e" },
  green: { label: "Green", className: "bg-green-200 border-green-300", hex: "#bbf7d0", shadow: "#15803d" },
  lime: { label: "Lime", className: "bg-lime-200 border-lime-300", hex: "#d9f99d", shadow: "#4d7c0f" },
  paper: { label: "Paper", className: "bg-stone-50 border-stone-200", hex: "#fafaf9", shadow: "#57534e" },
} as const;

export type NoteColor = keyof typeof NOTE_COLORS;

export function noteColor(color: string) {
  return NOTE_COLORS[color as NoteColor] ?? NOTE_COLORS.yellow;
}

export interface Note {
  id: string;
  title: string;
  content: string;
  color: string;
  /** Center of the note in world coordinates. */
  x: number;
  y: number;
  rotation: number;
  /** Stacking order; higher is drawn on top. */
  z: number;
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
    z: row.z,
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
    a.rotation === b.rotation &&
    a.z === b.z
  );
}

export function sortByZ(notes: Note[]) {
  return [...notes].sort((a, b) => a.z - b.z);
}

export function maxZ(notes: Note[]) {
  return notes.reduce((max, note) => Math.max(max, note.z), 0);
}

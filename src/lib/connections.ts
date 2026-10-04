import type { Tables } from "@/lib/supabase/database.types";
import { noteRect, type Point } from "@/lib/board-geometry";
import { NOTE_SIZE, type Note } from "@/lib/notes";

export type ConnectionKind = "thread" | "arrow";

export interface Connection {
  id: string;
  fromId: string;
  toId: string;
  kind: ConnectionKind;
}

export function rowToConnection(row: Tables<"connections">): Connection {
  return {
    id: row.id,
    fromId: row.from_note_id,
    toId: row.to_note_id,
    kind: row.kind as ConnectionKind,
  };
}

export function connectionToRow(connection: Connection, boardId: string) {
  return {
    id: connection.id,
    board_id: boardId,
    from_note_id: connection.fromId,
    to_note_id: connection.toId,
    kind: connection.kind,
  };
}

/** Where a thread's pin sits: on the tape at the top of the note, following its rotation. */
export function pinPoint(note: Pick<Note, "x" | "y" | "rotation">): Point {
  const offset = -NOTE_SIZE / 2 + 2; // tape center, relative to the note center
  const angle = (note.rotation * Math.PI) / 180;
  return { x: note.x - offset * Math.sin(angle), y: note.y + offset * Math.cos(angle) };
}

/** A thread sags like real string: a quadratic curve dipping below the straight line. */
export function threadPath(a: Point, b: Point) {
  const length = Math.hypot(b.x - a.x, b.y - a.y);
  const sag = Math.min(90, 12 + length * 0.12);
  const control = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 + sag };
  return {
    d: `M ${a.x} ${a.y} Q ${control.x} ${control.y} ${b.x} ${b.y}`,
    // Point on the curve at t = 0.5
    mid: { x: (a.x + 2 * control.x + b.x) / 4, y: (a.y + 2 * control.y + b.y) / 4 },
  };
}

const ARROW_GAP = 10;

/** Point where the ray from `from`'s center towards `to` leaves `from`'s square (plus a gap). */
function edgePoint(from: Point, to: Point): Point {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const scale = (NOTE_SIZE / 2 + ARROW_GAP) / Math.max(Math.abs(dx), Math.abs(dy), 1e-6);
  return { x: from.x + dx * scale, y: from.y + dy * scale };
}

/**
 * Arrow from the edge of one note to the edge of another (rotation ignored).
 * Null when the notes overlap too much for an arrow to fit.
 */
export function arrowSegment(from: Point, to: Point) {
  const start = edgePoint(from, to);
  const end = edgePoint(to, from);
  const fits = (end.x - start.x) * (to.x - from.x) + (end.y - start.y) * (to.y - from.y) > 0;
  if (!fits) return null;
  return { start, end, mid: { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 } };
}

/** Arrowhead triangle pointing at `tip`, coming from `tail`. */
export function arrowHead(tail: Point, tip: Point, size = 16) {
  const angle = Math.atan2(tip.y - tail.y, tip.x - tail.x);
  const spread = Math.PI / 7;
  const left = {
    x: tip.x - size * Math.cos(angle - spread),
    y: tip.y - size * Math.sin(angle - spread),
  };
  const right = {
    x: tip.x - size * Math.cos(angle + spread),
    y: tip.y - size * Math.sin(angle + spread),
  };
  return `${tip.x},${tip.y} ${left.x},${left.y} ${right.x},${right.y}`;
}

/** Topmost note under a world point (rotation ignored), skipping `excludeId`. */
export function noteAt(notesByZ: Note[], point: Point, excludeId?: string) {
  for (let i = notesByZ.length - 1; i >= 0; i--) {
    const note = notesByZ[i];
    if (note.id === excludeId) continue;
    const r = noteRect(note);
    if (point.x >= r.minX && point.x <= r.maxX && point.y >= r.minY && point.y <= r.maxY) {
      return note;
    }
  }
  return null;
}

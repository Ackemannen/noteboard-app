"use client";

import { memo } from "react";
import { Trash2 } from "lucide-react";
import type { Point } from "@/lib/board-geometry";
import type { Note } from "@/lib/notes";
import {
  arrowHead,
  arrowSegment,
  pinPoint,
  threadPath,
  type Connection,
  type ConnectionKind,
} from "@/lib/connections";

const THREAD = "#b91c1c";
const ARROW = "#292524";
const SHADOW = "rgba(60, 25, 0, 0.3)";

/** A connection being drawn: from a note to the pointer (or a hovered target note). */
export type ConnectionDraft = {
  kind: ConnectionKind;
  fromId: string;
  to: Point;
  toId: string | null;
};

interface ConnectionsLayerProps {
  notesById: ReadonlyMap<string, Note>;
  connections: Connection[];
  selectedId: string | null;
  draft: ConnectionDraft | null;
  zoom: number;
  onDelete: (id: string) => void;
}

type Shape = { d: string; head?: string; mid: Point };

function shapeFor(kind: ConnectionKind, from: Note, to: Note | Point): Shape | null {
  const isNote = "id" in to;
  if (kind === "thread") return threadPath(pinPoint(from), isNote ? pinPoint(to) : to);
  const segment = arrowSegment(from, to);
  if (!segment) return null;
  // While drawing towards empty board, the arrow ends right at the pointer.
  const end = isNote ? segment.end : to;
  return {
    d: `M ${segment.start.x} ${segment.start.y} L ${end.x} ${end.y}`,
    head: arrowHead(segment.start, end),
    mid: { x: (segment.start.x + end.x) / 2, y: (segment.start.y + end.y) / 2 },
  };
}

function Strand({ kind, shape, faded }: { kind: ConnectionKind; shape: Shape; faded?: boolean }) {
  const color = kind === "thread" ? THREAD : ARROW;
  const width = kind === "thread" ? 2.5 : 3;
  return (
    <g opacity={faded ? 0.6 : 1} strokeLinecap="round">
      <g transform="translate(2 5)">
        <path d={shape.d} fill="none" stroke={SHADOW} strokeWidth={width} />
        {shape.head && <polygon points={shape.head} fill={SHADOW} />}
      </g>
      <path
        d={shape.d}
        fill="none"
        stroke={color}
        strokeWidth={width}
        strokeDasharray={faded && kind === "arrow" ? "8 6" : undefined}
      />
      {shape.head && <polygon points={shape.head} fill={color} strokeLinejoin="round" />}
    </g>
  );
}

function Pin({ at }: { at: Point }) {
  return (
    <g pointerEvents="none">
      <ellipse cx={at.x + 2.5} cy={at.y + 4} rx={6.5} ry={5} fill="rgba(40,15,0,0.35)" />
      <circle cx={at.x} cy={at.y} r={7} fill="url(#pin-head)" stroke="#7f1d1d" strokeWidth={0.6} />
      <circle cx={at.x - 2.2} cy={at.y - 2.4} r={1.8} fill="rgba(255,255,255,0.75)" />
    </g>
  );
}

/**
 * Threads and arrows between notes, drawn in world coordinates above the
 * notes. Each connection has a wide invisible stroke so it's easy to click.
 */
const ConnectionsLayer = memo(function ConnectionsLayer({
  notesById,
  connections,
  selectedId,
  draft,
  zoom,
  onDelete,
}: ConnectionsLayerProps) {
  const drawn = connections.flatMap((connection) => {
    const from = notesById.get(connection.fromId);
    const to = notesById.get(connection.toId);
    const shape = from && to ? shapeFor(connection.kind, from, to) : null;
    return shape ? [{ connection, shape }] : [];
  });

  // Every note with a thread gets a pin; a draft thread pins its ends too.
  const pinned = new Set(
    drawn.filter(({ connection }) => connection.kind === "thread")
      .flatMap(({ connection }) => [connection.fromId, connection.toId])
  );
  const draftFrom = draft && notesById.get(draft.fromId);
  const draftTarget = draft?.toId ? notesById.get(draft.toId) : undefined;
  const draftShape = draftFrom && draft ? shapeFor(draft.kind, draftFrom, draftTarget ?? draft.to) : null;
  if (draft?.kind === "thread" && draftFrom) {
    pinned.add(draftFrom.id);
    if (draftTarget) pinned.add(draftTarget.id);
  }

  const selected = drawn.find(({ connection }) => connection.id === selectedId);

  return (
    <>
      <svg className="pointer-events-none absolute left-0 top-0 overflow-visible" width={1} height={1}>
        <defs>
          <radialGradient id="pin-head" cx="35%" cy="35%" r="70%">
            <stop offset="0%" stopColor="#fca5a5" />
            <stop offset="45%" stopColor="#dc2626" />
            <stop offset="100%" stopColor="#7f1d1d" />
          </radialGradient>
        </defs>

        {drawn.map(({ connection, shape }) => (
          <g key={connection.id} data-connection-id={connection.id}>
            {connection.id === selectedId && (
              <path
                d={shape.d}
                fill="none"
                stroke="rgba(59,130,246,0.45)"
                strokeWidth={10}
                vectorEffect="non-scaling-stroke"
                strokeLinecap="round"
              />
            )}
            <Strand kind={connection.kind} shape={shape} />
            {/* Generous, zoom-independent hit area */}
            <path
              d={shape.d}
              fill="none"
              stroke="transparent"
              strokeWidth={16}
              vectorEffect="non-scaling-stroke"
              pointerEvents="stroke"
              className="cursor-pointer"
            />
          </g>
        ))}

        {draft && draftShape && <Strand kind={draft.kind} shape={draftShape} faded />}

        {[...pinned].map((id) => {
          const note = notesById.get(id);
          return note ? <Pin key={id} at={pinPoint(note)} /> : null;
        })}
      </svg>

      {selected && (
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => onDelete(selected.connection.id)}
          title={`Remove ${selected.connection.kind} (Delete)`}
          aria-label={`Remove ${selected.connection.kind}`}
          className="absolute grid size-8 place-items-center rounded-full bg-white text-red-600 shadow-lg ring-1 ring-black/10 transition-colors hover:bg-red-50"
          style={{
            left: selected.shape.mid.x,
            top: selected.shape.mid.y,
            transform: `translate(-50%, -50%) scale(${1 / zoom})`,
          }}
        >
          <Trash2 className="size-4" />
        </button>
      )}
    </>
  );
});

export default ConnectionsLayer;

"use client";

import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { cn } from "@/lib/utils";
import { NOTE_SIZE, type Note } from "@/lib/notes";
import {
  BOARD_RECT,
  distance,
  midpoint,
  noteRect,
  rectFromPoints,
  rectsIntersect,
  screenToWorld,
  worldToScreen,
  zoomAt,
  type Camera,
  type Point,
  type Rect,
} from "@/lib/board-geometry";
import { noteAt, type Connection, type ConnectionKind } from "@/lib/connections";
import ConnectionsLayer, { type ConnectionDraft } from "./ConnectionsLayer";
import StickyNote from "./StickyNote";

/** Pan/select tools, or a connection tool that draws that kind of connection. */
export type CanvasMode = "pan" | "select" | ConnectionKind;

const isConnectMode = (mode: CanvasMode): mode is ConnectionKind =>
  mode === "thread" || mode === "arrow";

/** The cork board itself: a fixed-size, framed rectangle in world space. */
function CorkBoardSurface() {
  return (
    <div
      className="pointer-events-none absolute rounded-[20px] bg-[#c08a4f]"
      style={{
        left: BOARD_RECT.minX,
        top: BOARD_RECT.minY,
        width: BOARD_RECT.maxX - BOARD_RECT.minX,
        height: BOARD_RECT.maxY - BOARD_RECT.minY,
        backgroundImage: "url(/cork.webp)",
        // World units (the image is 1024×680); 1.5× hides the tile repeat when zoomed out.
        backgroundSize: "1536px 1020px",
        // Wooden frame (spread shadows scale with the board) plus depth.
        boxShadow:
          "inset 0 8px 24px rgba(40,20,0,0.35), 0 0 0 26px #7a4b28, 0 0 0 30px #4e2f17, 0 50px 140px 30px rgba(0,0,0,0.55)",
      }}
    >
      {/* Dark mode dims the cork (not the notes, which are drawn above it) */}
      <div className="absolute inset-0 hidden rounded-[inherit] bg-stone-950/50 dark:block" />
    </div>
  );
}

type Gesture =
  | { kind: "none" }
  /** Pressed on a note; becomes a drag (or a marquee with shift) once it moves. */
  | { kind: "pending-note"; pointerId: number; start: Point; noteId: string; shift: boolean }
  /** Pressed on empty board (or a connection); becomes a pan or marquee once it moves, else a click. */
  | {
      kind: "pending-canvas";
      pointerId: number;
      start: Point;
      shift: boolean;
      connectionId: string | null;
    }
  /** Drawing a connection from a note with a connection tool. */
  | {
      kind: "connect";
      pointerId: number;
      start: Point;
      fromId: string;
      connectionKind: ConnectionKind;
    }
  | { kind: "pan"; pointerId: number; last: Point }
  | {
      kind: "drag";
      pointerId: number;
      startWorld: Point;
      origins: Map<string, Point>;
    }
  | {
      kind: "marquee";
      pointerId: number;
      startWorld: Point;
      base: string[];
    }
  | { kind: "pinch"; startDistance: number; startMid: Point; startCamera: Camera };

export interface BoardCanvasProps {
  /** Notes in stacking order (lowest z first). */
  notes: Note[];
  selection: string[];
  onSelectionChange: (ids: string[]) => void;
  camera: Camera;
  cameraRef: React.RefObject<Camera>;
  onCameraChange: (next: Camera | ((camera: Camera) => Camera)) => void;
  mode: CanvasMode;
  /** Called continuously while dragging with each moved note's new center. */
  onMoveNotes: (positions: Map<string, Point>) => void;
  onBringToFront: (ids: string[]) => void;
  onOpenNote: (id: string) => void;
  onCreateNote: (world: Point) => void;
  /** Called once when a note drag finishes (or is interrupted). */
  onDragEnd?: () => void;
  /** Notes someone else is dragging right now, mapped to that person's color. */
  remoteMoving?: ReadonlyMap<string, string>;
  /** Where the pointer is on the board (world coordinates), or null when it leaves. */
  onPointerWorldMove?: (world: Point | null) => void;
  /** Extra content drawn in the world layer above the notes (e.g. remote cursors). */
  overlay?: React.ReactNode;
  connections: Connection[];
  selectedConnectionId: string | null;
  onSelectConnection: (id: string | null) => void;
  onCreateConnection: (fromId: string, toId: string, kind: ConnectionKind) => void;
  onDeleteConnection: (id: string) => void;
  /** Note to flash briefly (e.g. after jumping to it from the chat). */
  highlightedNoteId?: string | null;
}

const dragThreshold = (pointerType: string) => (pointerType === "touch" ? 8 : 3);

export default function BoardCanvas(props: BoardCanvasProps) {
  const { notes, selection, camera, mode } = props;

  const viewportRef = useRef<HTMLDivElement>(null);
  const latest = useRef(props);
  const gesture = useRef<Gesture>({ kind: "none" });
  const pointers = useRef(new Map<number, Point>());
  const spaceHeld = useRef(false);

  const [marquee, setMarquee] = useState<Rect | null>(null);
  const [liftedIds, setLiftedIds] = useState<ReadonlySet<string>>(new Set());
  const [isGrabbing, setIsGrabbing] = useState(false);
  const [isSpaceHeld, setIsSpaceHeld] = useState(false);
  const [draft, setDraft] = useState<ConnectionDraft | null>(null);

  useLayoutEffect(() => {
    latest.current = props;
  });

  const selectedSet = useMemo(() => new Set(selection), [selection]);
  const notesById = useMemo(() => new Map(notes.map((note) => [note.id, note])), [notes]);

  // ---------------------------------------------------------------------------
  // Helpers (read the latest props through the ref; safe inside event handlers)
  // ---------------------------------------------------------------------------
  const localPoint = (e: { clientX: number; clientY: number }): Point => {
    const rect = viewportRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const notesInRect = (rect: Rect) =>
    latest.current.notes
      .filter((note) => rectsIntersect(noteRect(note), rect))
      .map((note) => note.id);

  const startDrag = (pointerId: number, noteId: string, start: Point) => {
    const { selection, notes, cameraRef, onSelectionChange, onBringToFront } =
      latest.current;
    const ids = selection.includes(noteId) ? selection : [noteId];
    if (!selection.includes(noteId)) onSelectionChange([]);

    const origins = new Map<string, Point>();
    for (const note of notes) {
      if (ids.includes(note.id)) origins.set(note.id, { x: note.x, y: note.y });
    }
    onBringToFront(ids);
    setLiftedIds(new Set(ids));
    setIsGrabbing(true);
    gesture.current = {
      kind: "drag",
      pointerId,
      startWorld: screenToWorld(start, cameraRef.current),
      origins,
    };
  };

  const startMarquee = (pointerId: number, start: Point, additive: boolean) => {
    const { selection, cameraRef, onSelectionChange } = latest.current;
    const base = additive ? selection : [];
    if (!additive) onSelectionChange([]);
    gesture.current = {
      kind: "marquee",
      pointerId,
      startWorld: screenToWorld(start, cameraRef.current),
      base,
    };
  };

  const startPan = (pointerId: number, last: Point) => {
    gesture.current = { kind: "pan", pointerId, last };
    setIsGrabbing(true);
  };

  const startPinch = () => {
    const [a, b] = [...pointers.current.values()];
    endGesture();
    gesture.current = {
      kind: "pinch",
      startDistance: Math.max(1, distance(a, b)),
      startMid: midpoint(a, b),
      startCamera: latest.current.cameraRef.current,
    };
  };

  const endGesture = () => {
    const wasDragging = gesture.current.kind === "drag";
    gesture.current = { kind: "none" };
    if (wasDragging) latest.current.onDragEnd?.();
    setMarquee(null);
    setDraft(null);
    setLiftedIds(new Set());
    setIsGrabbing(false);
  };

  // ---------------------------------------------------------------------------
  // Pointer handlers
  // ---------------------------------------------------------------------------
  const handlePointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button === 2) return; // leave right-click alone

    const point = localPoint(e);
    pointers.current.set(e.pointerId, point);
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // The pointer may already be gone (e.g. released before this ran); carry on uncaptured.
    }

    if (pointers.current.size === 2) {
      startPinch();
      return;
    }
    if (pointers.current.size > 2) return;

    const noteEl = (e.target as Element).closest<HTMLElement>("[data-note-id]");
    const wantsPan =
      e.button === 1 || spaceHeld.current || (e.ctrlKey && !noteEl);

    const { mode, cameraRef } = latest.current;
    if (wantsPan) {
      e.preventDefault(); // no middle-click autoscroll
      startPan(e.pointerId, point);
    } else if (noteEl && isConnectMode(mode)) {
      const fromId = noteEl.dataset.noteId!;
      gesture.current = {
        kind: "connect",
        pointerId: e.pointerId,
        start: point,
        fromId,
        connectionKind: mode,
      };
      setDraft({ kind: mode, fromId, to: screenToWorld(point, cameraRef.current), toId: null });
    } else if (noteEl) {
      gesture.current = {
        kind: "pending-note",
        pointerId: e.pointerId,
        start: point,
        noteId: noteEl.dataset.noteId!,
        shift: e.shiftKey,
      };
    } else {
      gesture.current = {
        kind: "pending-canvas",
        pointerId: e.pointerId,
        start: point,
        shift: e.shiftKey,
        connectionId:
          (e.target as Element).closest<SVGElement>("[data-connection-id]")?.dataset
            .connectionId ?? null,
      };
    }
  };

  const handlePointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const point = localPoint(e);
    latest.current.onPointerWorldMove?.(
      screenToWorld(point, latest.current.cameraRef.current)
    );
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, point);

    const g = gesture.current;
    const { cameraRef, onCameraChange, onMoveNotes, onSelectionChange, mode } =
      latest.current;

    if (g.kind === "pinch") {
      const [a, b] = [...pointers.current.values()];
      if (!a || !b) return;
      const mid = midpoint(a, b);
      const zoom = g.startCamera.zoom * (distance(a, b) / g.startDistance);
      // Zoom around the original midpoint, then follow the fingers' movement.
      const zoomed = zoomAt(g.startCamera, g.startMid, zoom);
      onCameraChange({
        ...zoomed,
        x: zoomed.x + (mid.x - g.startMid.x),
        y: zoomed.y + (mid.y - g.startMid.y),
      });
      return;
    }

    if ("pointerId" in g && g.pointerId !== e.pointerId) return;

    switch (g.kind) {
      case "pending-note":
      case "pending-canvas": {
        if (distance(point, g.start) < dragThreshold(e.pointerType)) return;
        if (g.kind === "pending-note") {
          if (g.shift) startMarquee(e.pointerId, g.start, true);
          else startDrag(e.pointerId, g.noteId, g.start);
        } else if (g.shift || mode === "select") {
          startMarquee(e.pointerId, g.start, g.shift);
        } else {
          startPan(e.pointerId, g.start);
        }
        handlePointerMove(e); // apply this movement to the new gesture
        return;
      }
      case "connect": {
        const world = screenToWorld(point, cameraRef.current);
        const target = noteAt(latest.current.notes, world, g.fromId);
        setDraft({ kind: g.connectionKind, fromId: g.fromId, to: world, toId: target?.id ?? null });
        return;
      }
      case "pan": {
        const dx = point.x - g.last.x;
        const dy = point.y - g.last.y;
        g.last = point;
        onCameraChange((c) => ({ ...c, x: c.x + dx, y: c.y + dy }));
        return;
      }
      case "drag": {
        const world = screenToWorld(point, cameraRef.current);
        // Clamp the shared offset (not each note) so a dragged group keeps its
        // shape and every note stays on the board.
        const half = NOTE_SIZE / 2;
        let dx = world.x - g.startWorld.x;
        let dy = world.y - g.startWorld.y;
        g.origins.forEach((origin) => {
          dx = Math.min(BOARD_RECT.maxX - half - origin.x, Math.max(BOARD_RECT.minX + half - origin.x, dx));
          dy = Math.min(BOARD_RECT.maxY - half - origin.y, Math.max(BOARD_RECT.minY + half - origin.y, dy));
        });
        const positions = new Map<string, Point>();
        g.origins.forEach((origin, id) =>
          positions.set(id, { x: origin.x + dx, y: origin.y + dy })
        );
        onMoveNotes(positions);
        return;
      }
      case "marquee": {
        const rect = rectFromPoints(g.startWorld, screenToWorld(point, cameraRef.current));
        setMarquee(rect);
        const hits = notesInRect(rect);
        onSelectionChange([...new Set([...g.base, ...hits])]);
        return;
      }
    }
  };

  const finishPointer = (e: ReactPointerEvent<HTMLDivElement>, cancelled: boolean) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.delete(e.pointerId);
    const g = gesture.current;
    const {
      selection,
      onSelectionChange,
      onOpenNote,
      onCreateNote,
      cameraRef,
      selectedConnectionId,
      onSelectConnection,
      onCreateConnection,
    } = latest.current;

    if (g.kind === "pinch") {
      // Keep panning with the finger that's still down.
      const remaining = [...pointers.current.entries()][0];
      endGesture();
      if (remaining) startPan(remaining[0], remaining[1]);
      return;
    }
    if (!("pointerId" in g) || g.pointerId !== e.pointerId) return;

    if (!cancelled && g.kind === "pending-note") {
      if (g.shift) {
        onSelectionChange(
          selection.includes(g.noteId)
            ? selection.filter((id) => id !== g.noteId)
            : [...selection, g.noteId]
        );
      } else {
        onSelectionChange([]);
        onOpenNote(g.noteId);
      }
    } else if (!cancelled && g.kind === "pending-canvas") {
      if (g.connectionId) {
        onSelectionChange([]);
        onSelectConnection(g.connectionId);
      } else if (selectedConnectionId) onSelectConnection(null);
      else if (selection.length > 0) onSelectionChange([]);
      else if (!g.shift) onCreateNote(screenToWorld(g.start, cameraRef.current));
    } else if (!cancelled && g.kind === "connect") {
      const point = localPoint(e);
      const target = noteAt(latest.current.notes, screenToWorld(point, cameraRef.current), g.fromId);
      if (target) onCreateConnection(g.fromId, target.id, g.connectionKind);
      // A plain click with a connection tool still opens the note.
      else if (distance(point, g.start) < dragThreshold(e.pointerType)) onOpenNote(g.fromId);
    }

    endGesture();
  };

  // ---------------------------------------------------------------------------
  // Wheel zoom (native listener: React's onWheel is passive and can't preventDefault)
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const scale = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1;
      // Trackpad pinches arrive as ctrl+wheel with small deltas.
      const speed = e.ctrlKey ? 0.01 : 0.0015;
      const factor = Math.exp(-e.deltaY * scale * speed);
      const rect = el.getBoundingClientRect();
      const anchor = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      latest.current.onCameraChange((c) => zoomAt(c, anchor, c.zoom * factor));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  // Hold space to pan with the left mouse button.
  useEffect(() => {
    const isTyping = (e: KeyboardEvent) =>
      (e.target as HTMLElement | null)?.closest?.("input, textarea, [contenteditable='true']");
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code !== "Space" || isTyping(e)) return;
      e.preventDefault();
      spaceHeld.current = true;
      setIsSpaceHeld(true);
    };
    const release = () => {
      spaceHeld.current = false;
      setIsSpaceHeld(false);
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") release();
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", release);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", release);
    };
  }, []);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  const marqueeScreen = marquee && {
    topLeft: worldToScreen({ x: marquee.minX, y: marquee.minY }, camera),
    bottomRight: worldToScreen({ x: marquee.maxX, y: marquee.maxY }, camera),
  };

  return (
    <div
      ref={viewportRef}
      className={cn(
        "fixed inset-0 touch-none select-none overflow-hidden bg-[#2a1d14] outline-none dark:bg-[#140e0a]",
        isGrabbing
          ? "cursor-grabbing [&_*]:cursor-grabbing"
          : isSpaceHeld || mode === "pan"
            ? "cursor-grab"
            : "cursor-crosshair",
        isConnectMode(mode) && !isGrabbing && "[&_.sticky-note]:!cursor-crosshair",
        !isGrabbing && !isSpaceHeld && "[&_.sticky-note]:cursor-pointer"
      )}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={(e) => finishPointer(e, false)}
      onPointerCancel={(e) => finishPointer(e, true)}
      onPointerLeave={() => latest.current.onPointerWorldMove?.(null)}
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* World layer */}
      <div
        className="absolute left-0 top-0 origin-top-left will-change-transform"
        style={{
          transform: `translate(${camera.x}px, ${camera.y}px) scale(${camera.zoom})`,
        }}
      >
        <CorkBoardSurface />
        {notes.map((note) => (
          <StickyNote
            key={note.id}
            note={note}
            isSelected={selectedSet.has(note.id)}
            isLifted={liftedIds.has(note.id)}
            remoteColor={props.remoteMoving?.get(note.id)}
            isHighlighted={props.highlightedNoteId === note.id}
          />
        ))}
        <ConnectionsLayer
          notesById={notesById}
          connections={props.connections}
          selectedId={props.selectedConnectionId}
          draft={draft}
          zoom={camera.zoom}
          onDelete={props.onDeleteConnection}
        />
        {props.overlay}
      </div>

      {marqueeScreen && (
        <div
          className="pointer-events-none absolute rounded-sm border-2 border-dashed border-blue-500 bg-blue-500/10"
          style={{
            left: marqueeScreen.topLeft.x,
            top: marqueeScreen.topLeft.y,
            width: marqueeScreen.bottomRight.x - marqueeScreen.topLeft.x,
            height: marqueeScreen.bottomRight.y - marqueeScreen.topLeft.y,
          }}
        />
      )}
    </div>
  );
}

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
import type { Note } from "@/lib/notes";
import {
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
import StickyNote from "./StickyNote";

export type CanvasMode = "pan" | "select";

/** World size of one cork texture tile (the image is 1024×680). */
const TILE = { width: 1024, height: 680 };

type Gesture =
  | { kind: "none" }
  /** Pressed on a note; becomes a drag (or a marquee with shift) once it moves. */
  | { kind: "pending-note"; pointerId: number; start: Point; noteId: string; shift: boolean }
  /** Pressed on empty board; becomes a pan or marquee once it moves, else a click. */
  | { kind: "pending-canvas"; pointerId: number; start: Point; shift: boolean }
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

  useLayoutEffect(() => {
    latest.current = props;
  });

  const selectedSet = useMemo(() => new Set(selection), [selection]);

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

    if (wantsPan) {
      e.preventDefault(); // no middle-click autoscroll
      startPan(e.pointerId, point);
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
      case "pan": {
        const dx = point.x - g.last.x;
        const dy = point.y - g.last.y;
        g.last = point;
        onCameraChange((c) => ({ ...c, x: c.x + dx, y: c.y + dy }));
        return;
      }
      case "drag": {
        const world = screenToWorld(point, cameraRef.current);
        const dx = world.x - g.startWorld.x;
        const dy = world.y - g.startWorld.y;
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
    const { selection, onSelectionChange, onOpenNote, onCreateNote, cameraRef } =
      latest.current;

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
      if (selection.length > 0) onSelectionChange([]);
      else if (!g.shift) onCreateNote(screenToWorld(g.start, cameraRef.current));
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
        "fixed inset-0 touch-none select-none overflow-hidden bg-[#c08a4f] outline-none",
        isGrabbing
          ? "cursor-grabbing [&_*]:cursor-grabbing"
          : isSpaceHeld || mode === "pan"
            ? "cursor-grab"
            : "cursor-crosshair",
        !isGrabbing && !isSpaceHeld && "[&_.sticky-note]:cursor-pointer"
      )}
      style={{
        backgroundImage: "url(/cork.webp)",
        backgroundSize: `${TILE.width * camera.zoom}px ${TILE.height * camera.zoom}px`,
        backgroundPosition: `${camera.x}px ${camera.y}px`,
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={(e) => finishPointer(e, false)}
      onPointerCancel={(e) => finishPointer(e, true)}
      onPointerLeave={() => latest.current.onPointerWorldMove?.(null)}
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* Soft vignette for depth */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_55%,rgba(60,30,0,0.25))]" />

      {/* World layer */}
      <div
        className="absolute left-0 top-0 origin-top-left will-change-transform"
        style={{
          transform: `translate(${camera.x}px, ${camera.y}px) scale(${camera.zoom})`,
        }}
      >
        {notes.map((note) => (
          <StickyNote
            key={note.id}
            note={note}
            isSelected={selectedSet.has(note.id)}
            isLifted={liftedIds.has(note.id)}
            remoteColor={props.remoteMoving?.get(note.id)}
          />
        ))}
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

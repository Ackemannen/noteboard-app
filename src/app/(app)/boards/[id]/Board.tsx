"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import BoardCanvas, { type CanvasMode } from "@/components/board/BoardCanvas";
import BoardToolbar from "@/components/board/BoardToolbar";
import NavigatorPanel, {
  navigatorPanelHeight,
  readMinimapOpen,
} from "@/components/board/NavigatorPanel";
import NoteModal from "@/components/board/NoteModal";
import SelectionBar from "@/components/board/SelectionBar";
import { useBoardNotes } from "@/hooks/useBoardNotes";
import { useCamera } from "@/hooks/useCamera";
import { useViewportSize } from "@/hooks/useViewportSize";
import {
  fitRect,
  notesBounds,
  zoomAt,
  type Camera,
  type Point,
  type Size,
} from "@/lib/board-geometry";
import { maxZ, sortByZ, type Note, type NoteColor } from "@/lib/notes";

export interface BoardProps {
  boardId: string;
  boardName: string;
  initialNotes: Note[];
  /** True the first time this user opens the board through a share link. */
  justJoined: boolean;
}

const ZOOM_STEP = 1.25;

/** Space taken by the sidebar rail, toolbar and bottom panels when fitting notes. */
const fitInsets = (viewport: Size, mapOpen: boolean) => ({
  top: 80,
  right: 32,
  bottom: navigatorPanelHeight(viewport, mapOpen) + 24,
  left: 88,
});

function initialCamera(notes: Note[], viewport: Size, mapOpen: boolean): Camera {
  const bounds = notesBounds(notes);
  return bounds
    ? fitRect(bounds, viewport, { insets: fitInsets(viewport, mapOpen), maxZoom: 1 })
    : { x: 0, y: 0, zoom: 1 };
}

const isTyping = (target: EventTarget | null) =>
  !!(target as HTMLElement | null)?.closest?.("input, textarea, select, [contenteditable='true']");

export default function Board({ boardId, boardName, initialNotes, justJoined }: BoardProps) {
  const router = useRouter();
  const { notes, setNotes } = useBoardNotes(boardId, initialNotes);
  const sortedNotes = useMemo(() => sortByZ(notes), [notes]);
  const viewport = useViewportSize();
  const [mapOpen, setMapOpen] = useState(() => readMinimapOpen(viewport));
  const { camera, cameraRef, setCamera, animateCamera } = useCamera(boardId, () =>
    initialCamera(initialNotes, viewport, mapOpen)
  );

  const [selection, setSelection] = useState<string[]>([]);
  const [mode, setMode] = useState<CanvasMode>("pan");
  const [modal, setModal] = useState<{ note: Note | null; at: Point } | null>(null);

  // Notes can disappear (deleted by someone else); never keep them selected.
  const liveSelection = useMemo(() => {
    const ids = new Set(notes.map((note) => note.id));
    return selection.filter((id) => ids.has(id));
  }, [notes, selection]);

  useEffect(() => {
    if (!justJoined) return;
    toast.success(`You joined "${boardName}"`);
    router.refresh(); // so the sidebar lists the board
  }, [justJoined, boardName, router]);

  // ---------------------------------------------------------------------------
  // Note operations
  // ---------------------------------------------------------------------------
  const moveNotes = useCallback(
    (positions: Map<string, Point>) =>
      setNotes((prev) =>
        prev.map((note) => {
          const position = positions.get(note.id);
          return position ? { ...note, ...position } : note;
        })
      ),
    [setNotes]
  );

  const bringToFront = useCallback(
    (ids: string[]) =>
      setNotes((prev) => {
        const moving = prev.filter((note) => ids.includes(note.id));
        const othersTop = Math.max(
          -Infinity,
          ...prev.filter((note) => !ids.includes(note.id)).map((note) => note.z)
        );
        // Already on top: don't write anything.
        if (moving.length === 0 || Math.min(...moving.map((n) => n.z)) > othersTop) {
          return prev;
        }
        const top = maxZ(prev);
        const newZ = new Map(
          sortByZ(moving).map((note, index) => [note.id, top + 1 + index])
        );
        return prev.map((note) =>
          newZ.has(note.id) ? { ...note, z: newZ.get(note.id)! } : note
        );
      }),
    [setNotes]
  );

  const deleteNotes = useCallback(
    (ids: string[]) => {
      if (ids.length === 0) return;
      const removedIds = new Set(ids);
      const removed = notes.filter((note) => removedIds.has(note.id));
      setNotes((prev) => prev.filter((note) => !removedIds.has(note.id)));
      setSelection((prev) => prev.filter((id) => !removedIds.has(id)));
      toast(`Deleted ${removed.length} ${removed.length === 1 ? "note" : "notes"}`, {
        duration: 8000,
        action: {
          label: "Undo",
          onClick: () =>
            setNotes((prev) => [
              ...prev.filter((note) => !removedIds.has(note.id)),
              ...removed,
            ]),
        },
      });
    },
    [notes, setNotes]
  );

  const colorNotes = useCallback(
    (ids: string[], color: NoteColor) =>
      setNotes((prev) =>
        prev.map((note) => (ids.includes(note.id) ? { ...note, color } : note))
      ),
    [setNotes]
  );

  const nudgeNotes = useCallback(
    (ids: string[], dx: number, dy: number) =>
      setNotes((prev) =>
        prev.map((note) =>
          ids.includes(note.id) ? { ...note, x: note.x + dx, y: note.y + dy } : note
        )
      ),
    [setNotes]
  );

  const handleSave = (data: { title: string; content: string; color: string }) => {
    if (!modal) return;
    if (modal.note) {
      const id = modal.note.id;
      setNotes((prev) => prev.map((note) => (note.id === id ? { ...note, ...data } : note)));
    } else {
      setNotes((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          ...data,
          x: modal.at.x,
          y: modal.at.y,
          rotation: Math.random() * 10 - 5, // between -5 and 5 degrees
          z: maxZ(prev) + 1,
        },
      ]);
    }
    setModal(null);
  };

  // ---------------------------------------------------------------------------
  // View operations
  // ---------------------------------------------------------------------------
  const screenCenter = useMemo(
    () => ({ x: viewport.width / 2, y: viewport.height / 2 }),
    [viewport]
  );
  const zoomIn = useCallback(
    () => animateCamera((c) => zoomAt(c, screenCenter, c.zoom * ZOOM_STEP), viewport),
    [animateCamera, screenCenter, viewport]
  );
  const zoomOut = useCallback(
    () => animateCamera((c) => zoomAt(c, screenCenter, c.zoom / ZOOM_STEP), viewport),
    [animateCamera, screenCenter, viewport]
  );
  const resetZoom = useCallback(
    () => animateCamera((c) => zoomAt(c, screenCenter, 1), viewport),
    [animateCamera, screenCenter, viewport]
  );
  const fitAll = useCallback(() => {
    const bounds = notesBounds(notes);
    if (!bounds) return;
    const target = fitRect(bounds, viewport, {
      insets: fitInsets(viewport, mapOpen),
      maxZoom: 1.5,
    });
    animateCamera(target, viewport, 320);
  }, [animateCamera, notes, viewport, mapOpen]);

  const share = () => {
    navigator.clipboard.writeText(`${window.location.origin}/boards/${boardId}`);
    toast.success("Share link copied to clipboard!");
  };

  // ---------------------------------------------------------------------------
  // Keyboard shortcuts (handlers read the latest state through a ref)
  // ---------------------------------------------------------------------------
  const shortcutState = useRef({
    modalOpen: false,
    selection: liveSelection,
    notes,
    deleteNotes,
    nudgeNotes,
    zoomIn,
    zoomOut,
    resetZoom,
    fitAll,
  });
  useLayoutEffect(() => {
    shortcutState.current = {
      modalOpen: modal !== null,
      selection: liveSelection,
      notes,
      deleteNotes,
      nudgeNotes,
      zoomIn,
      zoomOut,
      resetZoom,
      fitAll,
    };
  });

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const s = shortcutState.current;
      if (s.modalOpen || isTyping(e.target)) return;
      const mod = e.ctrlKey || e.metaKey;

      if (mod && e.key.toLowerCase() === "a") {
        e.preventDefault();
        setSelection(s.notes.map((note) => note.id));
        return;
      }
      if (mod || e.altKey) return; // leave browser shortcuts alone

      switch (e.key) {
        case "Escape":
          setSelection([]);
          return;
        case "Delete":
        case "Backspace":
          if (s.selection.length) {
            e.preventDefault();
            s.deleteNotes(s.selection);
          }
          return;
        case "ArrowUp":
        case "ArrowDown":
        case "ArrowLeft":
        case "ArrowRight": {
          if (!s.selection.length) return;
          e.preventDefault();
          const step = e.shiftKey ? 40 : 8;
          const dx = e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0;
          const dy = e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0;
          s.nudgeNotes(s.selection, dx, dy);
          return;
        }
        case "+":
        case "=":
          s.zoomIn();
          return;
        case "-":
        case "_":
          s.zoomOut();
          return;
        case "0":
          s.resetZoom();
          return;
        case "f":
        case "F":
          s.fitAll();
          return;
        case "h":
        case "H":
          setMode("pan");
          return;
        case "v":
        case "V":
          setMode("select");
          return;
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const closeModal = useCallback(() => setModal(null), []);

  return (
    <>
      <BoardCanvas
        notes={sortedNotes}
        selection={liveSelection}
        onSelectionChange={setSelection}
        camera={camera}
        cameraRef={cameraRef}
        onCameraChange={setCamera}
        mode={mode}
        onMoveNotes={moveNotes}
        onBringToFront={bringToFront}
        onOpenNote={(id) => {
          const note = notes.find((n) => n.id === id);
          if (note) setModal({ note, at: { x: note.x, y: note.y } });
        }}
        onCreateNote={(at) => setModal({ note: null, at })}
      />

      <BoardToolbar
        boardName={boardName}
        noteCount={notes.length}
        mode={mode}
        onModeChange={setMode}
        onShare={share}
      />

      <SelectionBar
        count={liveSelection.length}
        onColor={(color) => colorNotes(liveSelection, color)}
        onDelete={() => deleteNotes(liveSelection)}
        onClear={() => setSelection([])}
      />

      <NavigatorPanel
        open={mapOpen}
        onOpenChange={setMapOpen}
        notes={notes}
        camera={camera}
        viewport={viewport}
        onCameraChange={setCamera}
        onZoomIn={zoomIn}
        onZoomOut={zoomOut}
        onResetZoom={resetZoom}
        onFit={fitAll}
      />

      <NoteModal
        key={modal ? (modal.note?.id ?? "new") : "closed"}
        isOpen={modal !== null}
        onClose={closeModal}
        onSave={handleSave}
        onDelete={
          modal?.note
            ? () => {
                deleteNotes([modal.note!.id]);
                setModal(null);
              }
            : undefined
        }
        initialData={modal?.note ?? null}
      />
    </>
  );
}

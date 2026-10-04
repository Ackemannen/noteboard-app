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
import RemoteCursors from "@/components/board/RemoteCursors";
import ChatPanel from "@/components/chat/ChatPanel";
import { useBoardChat, type ChatSnapshot } from "@/hooks/useBoardChat";
import { useBoardNotes } from "@/hooks/useBoardNotes";
import { useBoardConnections } from "@/hooks/useBoardConnections";
import type { Connection } from "@/lib/connections";
import {
  useBoardPresence,
  type CurrentUser,
  type NotesMoveMessage,
} from "@/hooks/useBoardPresence";
import { useCamera } from "@/hooks/useCamera";
import { useViewportSize } from "@/hooks/useViewportSize";
import {
  BOARD_RECT,
  centerOn,
  clampToBoard,
  fitRect,
  noteRect,
  notesBounds,
  padRect,
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
  initialConnections: Connection[];
  initialChat: ChatSnapshot;
  /** True the first time this user opens the board through a share link. */
  justJoined: boolean;
  currentUser: CurrentUser;
}

const ZOOM_STEP = 1.25;

/** Width the chat panel covers on the right (22rem + margins), on screens wider than a phone. */
const CHAT_WIDTH = 384;

/** Space taken by the sidebar rail, toolbar, chat and bottom panels when fitting notes. */
const fitInsets = (viewport: Size, mapOpen: boolean, chatOpen = false) => ({
  top: 80,
  right: chatOpen && viewport.width >= 640 ? CHAT_WIDTH + 24 : 32,
  bottom: navigatorPanelHeight(viewport, mapOpen) + 24,
  left: 88,
});

function initialCamera(notes: Note[], viewport: Size, mapOpen: boolean): Camera {
  const bounds = notesBounds(notes);
  return bounds
    ? fitRect(bounds, viewport, { insets: fitInsets(viewport, mapOpen), maxZoom: 1 })
    : centerOn({ x: 0, y: 0 }, 1, viewport); // empty board: start in the middle
}

const isTyping = (target: EventTarget | null) =>
  !!(target as HTMLElement | null)?.closest?.("input, textarea, select, [contenteditable='true']");

export default function Board({
  boardId,
  boardName,
  initialNotes,
  initialConnections,
  initialChat,
  justJoined,
  currentUser,
}: BoardProps) {
  const router = useRouter();
  const { notes, setNotes, saveNow, applyRemotePreview, restoreNotes } = useBoardNotes(
    boardId,
    initialNotes
  );
  const { connections, addConnection, removeConnections, dropLocal, restoreConnections } =
    useBoardConnections(boardId, initialConnections);
  const [selectedConnectionId, setSelectedConnectionId] = useState<string | null>(null);
  // Only connections whose notes both exist (a note may have just been deleted).
  const liveConnections = useMemo(() => {
    const ids = new Set(notes.map((note) => note.id));
    return connections.filter((c) => ids.has(c.fromId) && ids.has(c.toId));
  }, [notes, connections]);
  const notesRef = useRef(notes);
  useLayoutEffect(() => {
    notesRef.current = notes;
  });

  // Notes other people are dragging right now, per session (for highlighting).
  const [remoteMovers, setRemoteMovers] = useState<
    Record<string, { ids: string[]; color: string }>
  >({});
  const moverTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const handleRemoteNotesMove = useCallback(
    (message: NotesMoveMessage) => {
      applyRemotePreview(message.notes);

      const { sessionId, color } = message;
      const timers = moverTimers.current;
      const pending = timers.get(sessionId);
      if (pending) clearTimeout(pending);
      const stopHighlight = () => {
        timers.delete(sessionId);
        setRemoteMovers((prev) =>
          sessionId in prev
            ? Object.fromEntries(Object.entries(prev).filter(([id]) => id !== sessionId))
            : prev
        );
      };

      if (message.done) {
        stopHighlight();
        return;
      }
      const ids = message.notes.map((note) => note.id);
      setRemoteMovers((prev) => {
        const current = prev[sessionId];
        const unchanged =
          current?.color === color &&
          current.ids.length === ids.length &&
          current.ids.every((id, i) => id === ids[i]);
        return unchanged ? prev : { ...prev, [sessionId]: { ids, color } };
      });
      // In case the drop message never arrives, stop highlighting after a pause.
      timers.set(sessionId, setTimeout(stopHighlight, 1500));
    },
    [applyRemotePreview]
  );

  useEffect(() => {
    const timers = moverTimers.current;
    return () => timers.forEach(clearTimeout);
  }, []);

  const remoteMoving = useMemo(() => {
    const byNote = new Map<string, string>();
    for (const { ids, color } of Object.values(remoteMovers)) {
      ids.forEach((id) => byNote.set(id, color));
    }
    return byNote;
  }, [remoteMovers]);

  const { sessions, cursors, sendCursor, sendNoteMoves, endNoteMoves } = useBoardPresence(
    boardId,
    currentUser,
    { onRemoteNotesMove: handleRemoteNotesMove }
  );
  const sortedNotes = useMemo(() => sortByZ(notes), [notes]);
  const viewport = useViewportSize();
  const [mapOpen, setMapOpen] = useState(() => readMinimapOpen(viewport));
  const { camera, cameraRef, setCamera, animateCamera } = useCamera(boardId, viewport, () =>
    initialCamera(initialNotes, viewport, mapOpen)
  );

  const [selection, setSelection] = useState<string[]>([]);
  const [mode, setMode] = useState<CanvasMode>("pan");
  const [modal, setModal] = useState<{ note: Note | null; at: Point } | null>(null);

  // Chat
  const chat = useBoardChat(boardId, currentUser.id, initialChat);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatAttachment, setChatAttachment] = useState<string | null>(null);
  const [pickingNote, setPickingNote] = useState(false);
  const [highlightedNoteId, setHighlightedNoteId] = useState<string | null>(null);
  const highlightTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(highlightTimer.current), []);

  // Notes can disappear (deleted by someone else); never keep them selected.
  const notesById = useMemo(() => new Map(notes.map((note) => [note.id, note])), [notes]);
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
    (positions: Map<string, Point>) => {
      setNotes((prev) =>
        prev.map((note) => {
          const position = positions.get(note.id);
          return position ? { ...note, ...position } : note;
        })
      );
      // Others see the drag live; the database is written once on drop.
      sendNoteMoves(
        [...positions].map(([id, position]) => ({
          id,
          ...position,
          z: notesRef.current.find((note) => note.id === id)?.z ?? 0,
        }))
      );
    },
    [setNotes, sendNoteMoves]
  );

  const handleDragEnd = useCallback(() => {
    endNoteMoves();
    saveNow();
  }, [endNoteMoves, saveNow]);

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
      // The database deletes their threads/arrows too; remember them for undo.
      const attached = connections.filter(
        (c) => removedIds.has(c.fromId) || removedIds.has(c.toId)
      );
      setNotes((prev) => prev.filter((note) => !removedIds.has(note.id)));
      dropLocal(attached.map((c) => c.id));
      setSelection((prev) => prev.filter((id) => !removedIds.has(id)));
      toast(`Deleted ${removed.length} ${removed.length === 1 ? "note" : "notes"}`, {
        duration: 8000,
        action: {
          label: "Undo",
          onClick: async () => {
            await restoreNotes(removed); // connections need their notes saved first
            await restoreConnections(attached);
          },
        },
      });
    },
    [notes, setNotes, connections, dropLocal, restoreNotes, restoreConnections]
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
          ids.includes(note.id)
            ? { ...note, ...clampToBoard({ x: note.x + dx, y: note.y + dy }) }
            : note
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
          ...clampToBoard(modal.at),
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
      insets: fitInsets(viewport, mapOpen, chatOpen),
      maxZoom: 1.5,
    });
    animateCamera(target, viewport, 320);
  }, [animateCamera, notes, viewport, mapOpen, chatOpen]);

  /** Fly to a note (e.g. from a chat message) and flash it. */
  const showNote = useCallback(
    (noteId: string) => {
      const note = notes.find((n) => n.id === noteId);
      if (!note) {
        toast("That note has been deleted");
        return;
      }
      const isPhone = viewport.width < 640;
      if (isPhone) setChatOpen(false); // the chat covers the whole board on phones
      const zoom = Math.min(Math.max(cameraRef.current.zoom, 0.9), 1.25);
      const target = fitRect(padRect(noteRect(note), 40), viewport, {
        insets: fitInsets(viewport, mapOpen, chatOpen && !isPhone),
        maxZoom: zoom,
      });
      animateCamera(target, viewport, 420);
      setHighlightedNoteId(noteId);
      clearTimeout(highlightTimer.current);
      highlightTimer.current = setTimeout(() => setHighlightedNoteId(null), 2600);
    },
    [notes, viewport, mapOpen, chatOpen, animateCamera, cameraRef]
  );

  /** Pin button in the chat: use the selected note, or let the user click one. */
  const attachNoteToChat = () => {
    if (liveSelection.length === 1) {
      setChatAttachment(liveSelection[0]);
      setPickingNote(false);
    } else {
      setPickingNote((picking) => !picking);
    }
  };

  const share = () => {
    navigator.clipboard.writeText(`${window.location.origin}/boards/${boardId}`);
    toast.success("Share link copied");
  };

  // ---------------------------------------------------------------------------
  // Keyboard shortcuts (handlers read the latest state through a ref)
  // ---------------------------------------------------------------------------
  const shortcutState = useRef({
    modalOpen: false,
    selectedConnectionId,
    removeConnections,
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
      selectedConnectionId,
      removeConnections,
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
          setSelectedConnectionId(null);
          setPickingNote(false);
          return;
        case "c":
        case "C":
          setChatOpen((open) => !open);
          return;
        case "Delete":
        case "Backspace":
          if (s.selectedConnectionId) {
            e.preventDefault();
            void s.removeConnections([s.selectedConnectionId]);
            setSelectedConnectionId(null);
          } else if (s.selection.length) {
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
        case "t":
        case "T":
          setMode("thread");
          return;
        case "a":
        case "A":
          setMode("arrow");
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
        onSelectionChange={(ids) => {
          setSelection(ids);
          if (ids.length) setSelectedConnectionId(null);
        }}
        camera={camera}
        cameraRef={cameraRef}
        onCameraChange={setCamera}
        mode={mode}
        onMoveNotes={moveNotes}
        onBringToFront={bringToFront}
        onOpenNote={(id) => {
          if (pickingNote) {
            // Attaching a note to a chat message instead of editing it.
            setChatAttachment(id);
            setPickingNote(false);
            setChatOpen(true);
            return;
          }
          const note = notes.find((n) => n.id === id);
          if (note) setModal({ note, at: { x: note.x, y: note.y } });
        }}
        onCreateNote={(at) => {
          if (pickingNote) setPickingNote(false);
          // Clicks on the frame around the cork don't create notes.
          else if (
            at.x >= BOARD_RECT.minX && at.x <= BOARD_RECT.maxX &&
            at.y >= BOARD_RECT.minY && at.y <= BOARD_RECT.maxY
          ) {
            setModal({ note: null, at });
          }
        }}
        highlightedNoteId={highlightedNoteId}
        onPointerWorldMove={sendCursor}
        onDragEnd={handleDragEnd}
        remoteMoving={remoteMoving}
        connections={liveConnections}
        selectedConnectionId={selectedConnectionId}
        onSelectConnection={setSelectedConnectionId}
        onCreateConnection={(fromId, toId, kind) => {
          const exists = connections.some(
            (c) =>
              c.kind === kind &&
              ((c.fromId === fromId && c.toId === toId) ||
                // A thread has no direction, so the reverse is the same thread.
                (kind === "thread" && c.fromId === toId && c.toId === fromId))
          );
          if (exists) toast(`Those notes already have ${kind === "thread" ? "a thread" : "that arrow"}`);
          else void addConnection(fromId, toId, kind);
        }}
        onDeleteConnection={(id) => {
          void removeConnections([id]);
          setSelectedConnectionId(null);
        }}
        overlay={<RemoteCursors store={cursors} sessions={sessions} zoom={camera.zoom} />}
      />

      <BoardToolbar
        boardName={boardName}
        noteCount={notes.length}
        mode={mode}
        onModeChange={setMode}
        onShare={share}
        sessions={sessions}
        chatOpen={chatOpen}
        unreadCount={chat.unreadCount}
        onToggleChat={() => setChatOpen((open) => !open)}
      />

      {pickingNote && (
        <div className="pointer-events-none fixed left-1/2 top-20 z-40 -translate-x-1/2 rounded-full bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-lg animate-in fade-in-0 slide-in-from-top-2">
          Click a note to pin it to your message · Esc to cancel
        </div>
      )}

      {chatOpen && (
        <ChatPanel
          myId={currentUser.id}
          messages={chat.messages}
          profiles={chat.profiles}
          reads={chat.reads}
          notesById={notesById}
          unreadCount={chat.unreadCount}
          onSend={chat.send}
          onEdit={chat.edit}
          onDelete={(id) => void chat.remove(id)}
          onMarkRead={chat.markRead}
          onShowNote={showNote}
          onClose={() => {
            setChatOpen(false);
            setPickingNote(false);
          }}
          attachment={chatAttachment}
          onAttach={attachNoteToChat}
          onClearAttachment={() => setChatAttachment(null)}
          picking={pickingNote}
          onCancelPicking={() => setPickingNote(false)}
        />
      )}

      <SelectionBar
        // Center in the space left of the open chat panel.
        className={chatOpen ? "sm:left-[calc(50%-12rem)]" : undefined}
        count={liveSelection.length}
        onColor={(color) => colorNotes(liveSelection, color)}
        onDelete={() => deleteNotes(liveSelection)}
        onClear={() => setSelection([])}
      />

      <NavigatorPanel
        className={chatOpen ? "sm:right-[24rem]" : undefined}
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
        onDiscuss={
          modal?.note
            ? () => {
                setChatAttachment(modal.note!.id);
                setChatOpen(true);
                setModal(null);
              }
            : undefined
        }
      />
    </>
  );
}

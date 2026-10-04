import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import type { Point } from "@/lib/board-geometry";
import type { NotePreview } from "@/hooks/useBoardNotes";

/** Cursor and live-drag updates are throttled to this interval (ms) per sender. */
const CURSOR_INTERVAL = 50;
const NOTES_MOVE_INTERVAL = 50;

const round = (n: number) => Math.round(n * 10) / 10;

const PRESENCE_COLORS = [
  "#ef4444",
  "#f97316",
  "#16a34a",
  "#0891b2",
  "#2563eb",
  "#7c3aed",
  "#db2777",
  "#0d9488",
  "#ca8a04",
  "#e11d48",
];

/** A stable, distinct color per user. */
export function presenceColor(userId: string) {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) hash = (hash * 31 + userId.charCodeAt(i)) | 0;
  return PRESENCE_COLORS[Math.abs(hash) % PRESENCE_COLORS.length];
}

export type CurrentUser = {
  id: string;
  name: string | null;
  email: string | null;
  avatarUrl: string | null;
};

/** What each open board tab announces about itself. */
type PresencePayload = {
  userId: string;
  name: string;
  avatarUrl: string | null;
  color: string;
};

/** One open tab of someone viewing the board. */
export type PresenceSession = PresencePayload & {
  sessionId: string;
  isSelf: boolean;
};

type CursorMessage = { sessionId: string; x: number | null; y: number | null };

/** Live positions of notes someone is dragging. `done` marks the drop. */
export type NotesMoveMessage = {
  sessionId: string;
  color: string;
  notes: NotePreview[];
  /** The mover's cursor rides along, so dragging doesn't double the traffic. */
  cursor: Point | null;
  done: boolean;
};

export type PresenceHandlers = {
  onRemoteNotesMove?: (message: NotesMoveMessage) => void;
};

/**
 * Tiny external store for remote cursor positions. Cursors change many times a
 * second, so only the component that draws them subscribes (via
 * useSyncExternalStore) instead of re-rendering the whole board.
 */
export function createCursorStore() {
  let snapshot: ReadonlyMap<string, Point> = new Map();
  const listeners = new Set<() => void>();
  const emit = (next: Map<string, Point>) => {
    snapshot = next;
    listeners.forEach((listener) => listener());
  };
  return {
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getSnapshot: () => snapshot,
    set(sessionId: string, position: Point | null) {
      const next = new Map(snapshot);
      if (position) next.set(sessionId, position);
      else next.delete(sessionId);
      emit(next);
    },
    /** Drop cursors of sessions that are no longer present. */
    retain(sessionIds: Set<string>) {
      if ([...snapshot.keys()].every((id) => sessionIds.has(id))) return;
      emit(new Map([...snapshot].filter(([id]) => sessionIds.has(id))));
    },
  };
}

export type CursorStore = ReturnType<typeof createCursorStore>;

export const displayName = (user: Pick<CurrentUser, "name" | "email">) =>
  user.name ?? user.email?.split("@")[0] ?? "Someone";

/**
 * Who is on the board right now, and where their cursors are, over a private
 * Supabase Realtime channel (only board members are allowed to join it).
 */
export function useBoardPresence(
  boardId: string,
  me: CurrentUser,
  handlers: PresenceHandlers = {}
) {
  const [supabase] = useState(createClient);
  const [sessionId] = useState(() => crypto.randomUUID());
  const [cursors] = useState(createCursorStore);
  const [sessions, setSessions] = useState<PresenceSession[]>([]);

  const channelRef = useRef<RealtimeChannel | null>(null);
  const lastSent = useRef(0);
  const pending = useRef<Point | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Live drag state for notes this tab is moving.
  const moving = useRef(false);
  const pendingMoves = useRef(new Map<string, NotePreview>());
  const lastMoveSent = useRef(0);
  const moveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handlersRef = useRef(handlers);
  useLayoutEffect(() => {
    handlersRef.current = handlers;
  });

  const { id: myId, avatarUrl: myAvatar } = me;
  const myName = displayName(me);

  useEffect(() => {
    let cancelled = false;
    const channel = supabase.channel(`board-presence:${boardId}`, {
      config: {
        private: true,
        presence: { key: sessionId },
        broadcast: { self: false },
      },
    });

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState<PresencePayload>();
        const list = Object.entries(state).flatMap(([key, metas]) => {
          const meta = metas[0];
          if (!meta) return [];
          return [
            {
              sessionId: key,
              userId: meta.userId,
              name: meta.name,
              avatarUrl: meta.avatarUrl,
              color: meta.color,
              isSelf: key === sessionId,
            },
          ];
        });
        setSessions(list);
        cursors.retain(new Set(list.map((session) => session.sessionId)));
      })
      .on("broadcast", { event: "notes-move" }, ({ payload }) => {
        const message = payload as NotesMoveMessage;
        if (!message?.sessionId || message.sessionId === sessionId) return;
        if (message.cursor) cursors.set(message.sessionId, message.cursor);
        handlersRef.current.onRemoteNotesMove?.(message);
      })
      .on("broadcast", { event: "cursor" }, ({ payload }) => {
        const message = payload as CursorMessage;
        if (!message?.sessionId || message.sessionId === sessionId) return;
        cursors.set(
          message.sessionId,
          message.x === null || message.y === null ? null : { x: message.x, y: message.y }
        );
      });

    (async () => {
      // Private channels authorize with the user's JWT.
      await supabase.realtime.setAuth();
      if (cancelled) return;
      channel.subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          channelRef.current = channel;
          await channel.track({
            userId: myId,
            name: myName,
            avatarUrl: myAvatar,
            color: presenceColor(myId),
          } satisfies PresencePayload);
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          console.warn(`Presence channel ${status.toLowerCase()} for board ${boardId}`);
        }
      });
    })();

    return () => {
      cancelled = true;
      channelRef.current = null;
      if (timer.current) clearTimeout(timer.current);
      if (moveTimer.current) clearTimeout(moveTimer.current);
      timer.current = null;
      moveTimer.current = null;
      void supabase.removeChannel(channel);
    };
  }, [supabase, boardId, sessionId, cursors, myId, myName, myAvatar]);

  /** Share this tab's cursor (world coordinates), or null when it leaves the board. */
  const sendCursor = useCallback(
    (position: Point | null) => {
      pending.current = position;
      const flush = () => {
        timer.current = null;
        lastSent.current = performance.now();
        const p = pending.current;
        void channelRef.current?.send({
          type: "broadcast",
          event: "cursor",
          payload: {
            sessionId,
            x: p ? Math.round(p.x * 10) / 10 : null,
            y: p ? Math.round(p.y * 10) / 10 : null,
          } satisfies CursorMessage,
        });
      };
      if (!channelRef.current) return;
      // While dragging notes, the cursor is sent along with the note positions.
      if (moving.current) return;
      // Leaving is sent right away so the cursor disappears promptly.
      const wait = position === null ? 0 : CURSOR_INTERVAL - (performance.now() - lastSent.current);
      if (wait <= 0) {
        if (timer.current) clearTimeout(timer.current);
        flush();
      } else if (!timer.current) {
        timer.current = setTimeout(flush, wait);
      }
    },
    [sessionId]
  );

  const myColor = presenceColor(myId);

  const flushMoves = useCallback(
    (done: boolean) => {
      if (moveTimer.current) clearTimeout(moveTimer.current);
      moveTimer.current = null;
      lastMoveSent.current = performance.now();
      const cursor = pending.current;
      void channelRef.current?.send({
        type: "broadcast",
        event: "notes-move",
        payload: {
          sessionId,
          color: myColor,
          notes: [...pendingMoves.current.values()],
          cursor: cursor ? { x: round(cursor.x), y: round(cursor.y) } : null,
          done,
        } satisfies NotesMoveMessage,
      });
      if (done) {
        pendingMoves.current.clear();
        moving.current = false;
      }
    },
    [sessionId, myColor]
  );

  /** Share the live position of notes this tab is dragging (throttled). */
  const sendNoteMoves = useCallback(
    (notes: NotePreview[]) => {
      if (!channelRef.current || notes.length === 0) return;
      moving.current = true;
      for (const note of notes) {
        pendingMoves.current.set(note.id, {
          id: note.id,
          x: round(note.x),
          y: round(note.y),
          z: note.z,
        });
      }
      const wait = NOTES_MOVE_INTERVAL - (performance.now() - lastMoveSent.current);
      if (wait <= 0) flushMoves(false);
      else if (!moveTimer.current) moveTimer.current = setTimeout(() => flushMoves(false), wait);
    },
    [flushMoves]
  );

  /** Send the final positions when the drag ends. */
  const endNoteMoves = useCallback(() => {
    if (moving.current) flushMoves(true);
  }, [flushMoves]);

  return { sessions, cursors, sendCursor, sendNoteMoves, endNoteMoves };
}

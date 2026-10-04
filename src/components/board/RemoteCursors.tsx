"use client";

import { useSyncExternalStore } from "react";
import type { CursorStore, PresenceSession } from "@/hooks/useBoardPresence";

interface RemoteCursorsProps {
  store: CursorStore;
  sessions: PresenceSession[];
  zoom: number;
}

/**
 * Other people's cursors. Rendered inside the board's world layer (so they
 * stick to the board while panning) and counter-scaled to stay a fixed size.
 */
export default function RemoteCursors({ store, sessions, zoom }: RemoteCursorsProps) {
  const cursors = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  const bySession = new Map(sessions.map((session) => [session.sessionId, session]));

  return (
    <>
      {[...cursors].map(([sessionId, position]) => {
        const session = bySession.get(sessionId);
        if (!session || session.isSelf) return null;
        return (
          <div
            key={sessionId}
            className="pointer-events-none absolute left-0 top-0"
            style={{
              left: position.x,
              top: position.y,
              transform: `scale(${1 / zoom})`,
              transformOrigin: "0 0",
              // Smooths the gaps between throttled updates.
              transition: "left 80ms linear, top 80ms linear",
            }}
          >
            <svg width="20" height="22" viewBox="0 0 20 22" className="drop-shadow-md" aria-hidden="true">
              <path
                d="M2 2 L2 18 L6.5 14 L9.5 20.5 L12.5 19 L9.5 12.5 L16 12.5 Z"
                fill={session.color}
                stroke="white"
                strokeWidth="1.5"
                strokeLinejoin="round"
              />
            </svg>
            <span
              className="absolute left-4 top-5 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium text-white shadow-md"
              style={{ backgroundColor: session.color }}
            >
              {session.name}
            </span>
          </div>
        );
      })}
    </>
  );
}

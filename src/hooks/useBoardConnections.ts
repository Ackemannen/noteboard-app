import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import type { Tables } from "@/lib/supabase/database.types";
import {
  connectionToRow,
  rowToConnection,
  type Connection,
  type ConnectionKind,
} from "@/lib/connections";

/**
 * Threads and arrows between notes, kept in sync with Supabase. Changes are
 * rare, so they're written immediately (optimistically) instead of debounced.
 */
export function useBoardConnections(boardId: string, initial: Connection[]) {
  const [supabase] = useState(createClient);
  const [connections, setConnections] = useState(initial);
  const connectionsRef = useRef(connections);
  useLayoutEffect(() => {
    connectionsRef.current = connections;
  });

  useEffect(() => {
    const channel = supabase
      .channel(`connections:${boardId}`)
      .on<Tables<"connections">>(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "connections", filter: `board_id=eq.${boardId}` },
        ({ new: row }) => {
          const connection = rowToConnection(row);
          setConnections((prev) =>
            prev.some((c) => c.id === connection.id) ? prev : [...prev, connection]
          );
        }
      )
      // Delete events can't be filtered and only carry the id.
      .on<Tables<"connections">>(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "connections" },
        ({ old }) => {
          if (old.id) setConnections((prev) => prev.filter((c) => c.id !== old.id));
        }
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabase, boardId]);

  const addConnection = useCallback(
    async (fromId: string, toId: string, kind: ConnectionKind) => {
      const connection: Connection = { id: crypto.randomUUID(), fromId, toId, kind };
      setConnections((prev) => [...prev, connection]);
      const { error } = await supabase
        .from("connections")
        .insert(connectionToRow(connection, boardId));
      if (error) {
        console.error("Error adding connection:", error);
        setConnections((prev) => prev.filter((c) => c.id !== connection.id));
        toast.error(`Couldn't add the ${kind}`);
      }
    },
    [supabase, boardId]
  );

  const removeConnections = useCallback(
    async (ids: string[]) => {
      if (ids.length === 0) return;
      const removed = connectionsRef.current.filter((c) => ids.includes(c.id));
      setConnections((prev) => prev.filter((c) => !ids.includes(c.id)));
      const { error } = await supabase.from("connections").delete().in("id", ids);
      if (error) {
        console.error("Error removing connections:", error);
        setConnections((prev) => [...prev, ...removed]);
        toast.error("Couldn't remove that connection");
      }
    },
    [supabase]
  );

  /** Forget connections locally only (e.g. their notes were deleted; the database cascades). */
  const dropLocal = useCallback((ids: string[]) => {
    setConnections((prev) => prev.filter((c) => !ids.includes(c.id)));
  }, []);

  /** Bring back connections (undo). Their notes must already be saved. */
  const restoreConnections = useCallback(
    async (restored: Connection[]) => {
      if (restored.length === 0) return;
      setConnections((prev) => [
        ...prev.filter((c) => !restored.some((r) => r.id === c.id)),
        ...restored,
      ]);
      const { error } = await supabase
        .from("connections")
        .upsert(restored.map((c) => connectionToRow(c, boardId)), { ignoreDuplicates: true });
      if (error) {
        console.error("Error restoring connections:", error);
        toast.error("Couldn't restore some connections");
      }
    },
    [supabase, boardId]
  );

  return { connections, addConnection, removeConnections, dropLocal, restoreConnections };
}

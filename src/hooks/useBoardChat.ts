import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import type { Tables } from "@/lib/supabase/database.types";
import {
  byCreatedAt,
  rowToMessage,
  rowToProfile,
  time,
  type ChatMessage,
  type Profile,
} from "@/lib/chat";

export interface ChatSnapshot {
  messages: ChatMessage[];
  /** userId -> when they last read this board's chat */
  reads: Record<string, string>;
  profiles: Record<string, Profile>;
}

const upsertSorted = (list: ChatMessage[], message: ChatMessage) =>
  [...list.filter((m) => m.id !== message.id), message].sort(byCreatedAt);

const later = (a: string | undefined, b: string) => (a && time(a) >= time(b) ? a : b);

/**
 * A board's chat, kept live over Supabase Realtime: messages (with optimistic
 * send/edit/delete), read receipts and the authors' profiles.
 */
export function useBoardChat(boardId: string, myId: string, initial: ChatSnapshot) {
  const [supabase] = useState(createClient);
  const [messages, setMessages] = useState(initial.messages);
  const [reads, setReads] = useState(initial.reads);
  const [profiles, setProfiles] = useState(initial.profiles);

  const profilesRef = useRef(profiles);
  const messagesRef = useRef(messages);
  useLayoutEffect(() => {
    profilesRef.current = profiles;
    messagesRef.current = messages;
  });
  const requestedProfiles = useRef(new Set<string>());

  /** Fetch a profile we don't know yet (e.g. someone who just joined the board). */
  const ensureProfile = useCallback(
    async (userId: string) => {
      if (profilesRef.current[userId] || requestedProfiles.current.has(userId)) return;
      requestedProfiles.current.add(userId);
      const { data } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
      if (data) setProfiles((prev) => ({ ...prev, [data.id]: rowToProfile(data) }));
    },
    [supabase]
  );

  useEffect(() => {
    const filter = `board_id=eq.${boardId}`;
    const onMessage = ({ new: row }: { new: Tables<"messages"> }) => {
      setMessages((prev) => upsertSorted(prev, rowToMessage(row)));
      void ensureProfile(row.author_id);
    };
    const onRead = ({ new: row }: { new: Tables<"chat_reads"> }) => {
      setReads((prev) => ({ ...prev, [row.user_id]: later(prev[row.user_id], row.last_read_at) }));
      void ensureProfile(row.user_id);
    };

    const channel = supabase
      .channel(`chat:${boardId}`)
      .on<Tables<"messages">>("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter }, onMessage)
      .on<Tables<"messages">>("postgres_changes", { event: "UPDATE", schema: "public", table: "messages", filter }, onMessage)
      // Delete events can't be filtered and only carry the id.
      .on<Tables<"messages">>("postgres_changes", { event: "DELETE", schema: "public", table: "messages" }, ({ old }) => {
        if (old.id) setMessages((prev) => prev.filter((m) => m.id !== old.id));
      })
      .on<Tables<"chat_reads">>("postgres_changes", { event: "INSERT", schema: "public", table: "chat_reads", filter }, onRead)
      .on<Tables<"chat_reads">>("postgres_changes", { event: "UPDATE", schema: "public", table: "chat_reads", filter }, onRead)
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabase, boardId, ensureProfile]);

  /** Post a message. Resolves false (and rolls back) if it couldn't be sent. */
  const send = useCallback(
    async (body: string, noteId: string | null) => {
      const message: ChatMessage = {
        id: crypto.randomUUID(),
        authorId: myId,
        body,
        noteId,
        createdAt: new Date().toISOString(),
        editedAt: null,
        pending: true,
      };
      setMessages((prev) => upsertSorted(prev, message));
      const { data, error } = await supabase
        .from("messages")
        .insert({ id: message.id, board_id: boardId, body, note_id: noteId })
        .select()
        .single();
      if (error) {
        console.error("Error sending message:", error);
        setMessages((prev) => prev.filter((m) => m.id !== message.id));
        toast.error("Couldn't send your message");
        return false;
      }
      setMessages((prev) => upsertSorted(prev, rowToMessage(data)));
      return true;
    },
    [supabase, boardId, myId]
  );

  const edit = useCallback(
    async (id: string, body: string) => {
      const before = messagesRef.current.find((m) => m.id === id);
      if (!before || before.body === body) return true;
      setMessages((prev) =>
        prev.map((m) => (m.id === id ? { ...m, body, editedAt: new Date().toISOString() } : m))
      );
      const { data, error } = await supabase
        .from("messages")
        .update({ body })
        .eq("id", id)
        .select()
        .single();
      if (error) {
        console.error("Error editing message:", error);
        setMessages((prev) => upsertSorted(prev, before));
        toast.error("Couldn't save your edit");
        return false;
      }
      setMessages((prev) => upsertSorted(prev, rowToMessage(data)));
      return true;
    },
    [supabase]
  );

  const remove = useCallback(
    async (id: string) => {
      const before = messagesRef.current.find((m) => m.id === id);
      setMessages((prev) => prev.filter((m) => m.id !== id));
      const { error } = await supabase.from("messages").delete().eq("id", id);
      if (error) {
        console.error("Error deleting message:", error);
        if (before) setMessages((prev) => upsertSorted(prev, before));
        toast.error("Couldn't delete that message");
      }
    },
    [supabase]
  );

  /** Record that I've read everything up to now (database clock). */
  const markRead = useCallback(async () => {
    const { data, error } = await supabase.rpc("mark_chat_read", { p_board_id: boardId });
    if (error) console.error("Error marking chat read:", error);
    else if (data) setReads((prev) => ({ ...prev, [myId]: later(prev[myId], data) }));
  }, [supabase, boardId, myId]);

  const unreadCount = useMemo(() => {
    const myRead = reads[myId];
    return messages.filter(
      (m) => m.authorId !== myId && !m.pending && (!myRead || time(m.createdAt) > time(myRead))
    ).length;
  }, [messages, reads, myId]);

  return { messages, reads, profiles, unreadCount, send, edit, remove, markRead };
}

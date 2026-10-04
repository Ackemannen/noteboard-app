"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  ArrowDown,
  Check,
  CheckCheck,
  Clock,
  LocateFixed,
  MessagesSquare,
  Pencil,
  Pin,
  SendHorizontal,
  Trash2,
  X,
} from "lucide-react";
import ConfirmDialog from "@/components/ConfirmDialog";
import UserAvatar from "@/components/UserAvatar";
import { MESSAGE_MAX, readersOf, time, type ChatMessage, type Profile } from "@/lib/chat";
import { noteColor, type Note } from "@/lib/notes";
import { cn } from "@/lib/utils";

const GROUP_GAP_MS = 5 * 60 * 1000;
const clock = new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" });
const fullDate = new Intl.DateTimeFormat("en", { dateStyle: "full", timeStyle: "short" });
const dayLabel = new Intl.DateTimeFormat("en", { weekday: "long", month: "long", day: "numeric" });

function dayHeading(iso: string) {
  const date = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return "Today";
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  return dayLabel.format(date);
}

const sameDay = (a: string, b: string) => new Date(a).toDateString() === new Date(b).toDateString();

const listNames = (names: string[]) =>
  names.length <= 2
    ? names.join(" and ")
    : `${names.slice(0, 2).join(", ")} and ${names.length - 2} more`;

interface ChatPanelProps {
  myId: string;
  messages: ChatMessage[];
  profiles: Record<string, Profile>;
  reads: Record<string, string>;
  notesById: ReadonlyMap<string, Note>;
  unreadCount: number;
  onSend: (body: string, noteId: string | null) => Promise<boolean>;
  onEdit: (id: string, body: string) => Promise<boolean>;
  onDelete: (id: string) => void;
  onMarkRead: () => void;
  onShowNote: (noteId: string) => void;
  onClose: () => void;
  /** Note attached to the message being written. */
  attachment: string | null;
  onAttach: () => void;
  onClearAttachment: () => void;
  /** Waiting for the user to click a note on the board. */
  picking: boolean;
  onCancelPicking: () => void;
}

/** Chat for one board: messages, read receipts, edits and links to notes. */
export default function ChatPanel(props: ChatPanelProps) {
  const { myId, messages, profiles, reads, notesById, unreadCount, onMarkRead, picking } = props;

  const listRef = useRef<HTMLDivElement>(null);
  const atBottom = useRef(true);
  const [newBelow, setNewBelow] = useState(false);
  const [deleting, setDeleting] = useState<ChatMessage | null>(null);
  const lastId = messages[messages.length - 1]?.id;
  const lastIsMine = messages[messages.length - 1]?.authorId === myId;

  const scrollToBottom = (smooth = false) => {
    const el = listRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: smooth ? "smooth" : "auto" });
    setNewBelow(false);
  };

  // Start at the latest message; then follow new ones if already at the bottom
  // (or if it's mine), otherwise offer a jump instead of yanking the scroll.
  useLayoutEffect(() => {
    const el = listRef.current;
    if (!el || !lastId) return;
    if (atBottom.current || lastIsMine) {
      el.scrollTop = el.scrollHeight;
      atBottom.current = true;
    } else {
      setNewBelow(true);
    }
  }, [lastId, lastIsMine]);

  // Opening the chat (and seeing new messages while it's open) marks them read.
  useEffect(() => {
    if (unreadCount === 0) return;
    if (document.visibilityState === "visible") onMarkRead();
    const onVisible = () => {
      if (document.visibilityState === "visible") onMarkRead();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [unreadCount, onMarkRead]);

  const myLatest = [...messages].reverse().find((m) => m.authorId === myId && !m.pending);
  const nameOf = (userId: string) =>
    userId === myId ? "You" : (profiles[userId]?.name ?? "Former member");

  return (
    <aside
      aria-label="Board chat"
      className={cn(
        "fixed inset-0 z-50 flex flex-col overflow-hidden bg-card/95 shadow-2xl ring-1 ring-border backdrop-blur-md animate-in fade-in-0 slide-in-from-right-4 duration-200",
        "sm:inset-auto sm:bottom-4 sm:right-4 sm:top-[4.5rem] sm:w-[22rem] sm:rounded-2xl",
        // On phones the panel covers the board, so step aside while a note is being picked.
        picking && "max-sm:hidden"
      )}
    >
      <header className="flex items-center gap-3 border-b border-border px-4 py-3">
        <div className="grid size-8 place-items-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400">
          <MessagesSquare className="size-4" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold text-foreground">Board chat</h2>
          <p className="text-xs text-muted-foreground">Everyone on this board can read it</p>
        </div>
        <button
          onClick={props.onClose}
          aria-label="Close chat"
          className="grid size-8 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <X className="size-4" />
        </button>
      </header>

      <div className="relative min-h-0 flex-1">
        <div
          ref={listRef}
          onScroll={(e) => {
            const el = e.currentTarget;
            atBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
            if (atBottom.current) setNewBelow(false);
          }}
          className="h-full overflow-y-auto px-3 py-4 [scrollbar-width:thin]"
        >
          {messages.length === 0 ? (
            <EmptyChat />
          ) : (
            messages.map((message, i) => {
              const prev = messages[i - 1];
              const newDay = !prev || !sameDay(prev.createdAt, message.createdAt);
              const continued =
                !newDay &&
                prev.authorId === message.authorId &&
                time(message.createdAt) - time(prev.createdAt) < GROUP_GAP_MS;
              const readers = message.authorId === myId ? readersOf(message, reads, myId) : [];
              return (
                <div key={message.id}>
                  {newDay && (
                    <div className="my-4 flex items-center gap-3 text-xs font-medium text-muted-foreground first:mt-0">
                      <div className="h-px flex-1 bg-border" />
                      {dayHeading(message.createdAt)}
                      <div className="h-px flex-1 bg-border" />
                    </div>
                  )}
                  <MessageItem
                    message={message}
                    mine={message.authorId === myId}
                    continued={continued}
                    author={profiles[message.authorId]}
                    authorName={nameOf(message.authorId)}
                    note={message.noteId ? notesById.get(message.noteId) : undefined}
                    readerNames={readers.map(nameOf)}
                    showSeenBy={message.id === myLatest?.id && readers.length > 0}
                    onEdit={props.onEdit}
                    onDelete={() => setDeleting(message)}
                    onShowNote={props.onShowNote}
                  />
                </div>
              );
            })
          )}
        </div>

        {newBelow && (
          <button
            onClick={() => scrollToBottom(true)}
            className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-blue-600 px-3 py-1.5 text-xs font-medium text-white shadow-lg transition-transform hover:bg-blue-700 active:scale-95"
          >
            <ArrowDown className="size-3.5" />
            New messages
          </button>
        )}
      </div>

      <Composer {...props} />

      <ConfirmDialog
        open={deleting !== null}
        title="Delete message?"
        description="It will be removed for everyone on this board."
        confirmLabel="Delete"
        destructive
        onConfirm={() => {
          if (deleting) props.onDelete(deleting.id);
          setDeleting(null);
        }}
        onCancel={() => setDeleting(null)}
      />
    </aside>
  );
}

function EmptyChat() {
  return (
    <div className="flex h-full flex-col items-center justify-center px-6 text-center">
      <div className="relative mb-4 h-16 w-24" aria-hidden="true">
        <div className="absolute left-1 top-2 h-10 w-16 -rotate-6 rounded-2xl rounded-bl-md bg-muted" />
        <div className="absolute right-0 top-5 h-10 w-16 rotate-3 rounded-2xl rounded-br-md bg-blue-600/90" />
      </div>
      <p className="text-sm font-medium text-foreground">No messages yet</p>
      <p className="mt-1 max-w-[16rem] text-xs leading-relaxed text-muted-foreground">
        Say hi, or pin a note to your message so everyone can jump straight to it.
      </p>
    </div>
  );
}

function NoteChip({ note, mine, onShow }: { note: Note; mine: boolean; onShow: () => void }) {
  const label = note.title || note.content || "Untitled note";
  return (
    <button
      type="button"
      onClick={onShow}
      title="Show this note on the board"
      className={cn(
        "mb-1.5 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs transition-colors",
        mine
          ? "bg-white/15 text-white hover:bg-white/25"
          : "bg-card text-foreground ring-1 ring-border hover:bg-accent"
      )}
    >
      <span
        className={cn("size-3.5 shrink-0 rounded-[3px] border", noteColor(note.color).className)}
        aria-hidden="true"
      />
      <span className="min-w-0 flex-1 truncate font-medium">{label}</span>
      <LocateFixed className="size-3.5 shrink-0 opacity-80" />
    </button>
  );
}

interface MessageItemProps {
  message: ChatMessage;
  mine: boolean;
  continued: boolean;
  author: Profile | undefined;
  authorName: string;
  note: Note | undefined;
  readerNames: string[];
  showSeenBy: boolean;
  onEdit: (id: string, body: string) => Promise<boolean>;
  onDelete: () => void;
  onShowNote: (noteId: string) => void;
}

function MessageItem({
  message,
  mine,
  continued,
  author,
  authorName,
  note,
  readerNames,
  showSeenBy,
  onEdit,
  onDelete,
  onShowNote,
}: MessageItemProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(message.body);

  const saveEdit = async () => {
    const body = draft.trim();
    if (!body) return;
    if (await onEdit(message.id, body)) setEditing(false);
  };

  const status = message.pending ? (
    <Clock className="size-3" aria-label="Sending" />
  ) : readerNames.length > 0 ? (
    <CheckCheck className="size-3.5 text-blue-500" aria-label={`Read by ${listNames(readerNames)}`} />
  ) : (
    <Check className="size-3.5" aria-label="Sent" />
  );

  return (
    <div className={cn("group flex gap-2", mine ? "justify-end" : "justify-start", continued ? "mt-1" : "mt-3")}>
      {!mine && (
        <div className="w-7 shrink-0">
          {!continued && (
            <UserAvatar
              name={author?.name ?? authorName}
              email={null}
              avatarUrl={author?.avatarUrl ?? null}
              className="size-7 ring-0"
            />
          )}
        </div>
      )}

      <div className={cn("flex min-w-0 max-w-[80%] flex-col", mine ? "items-end" : "items-start")}>
        {!mine && !continued && (
          <span className="mb-0.5 px-1 text-xs font-medium text-foreground/80">{authorName}</span>
        )}

        <div className={cn("flex items-center gap-1", mine && "flex-row-reverse")}>
          {editing ? (
            <div className="w-64 max-w-full rounded-2xl bg-muted p-2 ring-2 ring-blue-500/60">
              <textarea
                value={draft}
                autoFocus
                maxLength={MESSAGE_MAX}
                onChange={(e) => setDraft(e.target.value)}
                onFocus={(e) => e.currentTarget.setSelectionRange(draft.length, draft.length)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void saveEdit();
                  } else if (e.key === "Escape") {
                    setEditing(false);
                    setDraft(message.body);
                  }
                }}
                rows={Math.min(6, Math.max(2, draft.split("\n").length))}
                aria-label="Edit message"
                className="w-full resize-none bg-transparent text-sm text-foreground outline-none"
              />
              <div className="mt-1 flex justify-end gap-1">
                <button
                  onClick={() => {
                    setEditing(false);
                    setDraft(message.body);
                  }}
                  className="rounded-md px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
                >
                  Cancel
                </button>
                <button
                  onClick={() => void saveEdit()}
                  disabled={!draft.trim()}
                  className="rounded-md bg-blue-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-40"
                >
                  Save
                </button>
              </div>
            </div>
          ) : (
            <div
              title={fullDate.format(new Date(message.createdAt))}
              className={cn(
                "rounded-2xl px-3 py-2 text-sm leading-relaxed",
                mine
                  ? "rounded-br-md bg-blue-600 text-white"
                  : "rounded-bl-md bg-muted text-foreground",
                message.pending && "opacity-70"
              )}
            >
              {note && <NoteChip note={note} mine={mine} onShow={() => onShowNote(note.id)} />}
              <p className="whitespace-pre-wrap break-words">{message.body}</p>
            </div>
          )}

          {mine && !editing && !message.pending && (
            <div className="flex shrink-0 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100 [@media(hover:none)]:opacity-100">
              <button
                onClick={() => {
                  setDraft(message.body);
                  setEditing(true);
                }}
                title="Edit"
                aria-label="Edit message"
                className="grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <Pencil className="size-3.5" />
              </button>
              <button
                onClick={onDelete}
                title="Delete"
                aria-label="Delete message"
                className="grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/15 dark:hover:text-red-400"
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>
          )}
        </div>

        <div className="mt-0.5 flex items-center gap-1 px-1 text-[11px] tabular-nums text-muted-foreground">
          <time dateTime={message.createdAt}>{clock.format(new Date(message.createdAt))}</time>
          {message.editedAt && (
            <span title={`Edited ${fullDate.format(new Date(message.editedAt))}`}>· edited</span>
          )}
          {mine && (
            <span title={readerNames.length ? `Read by ${listNames(readerNames)}` : "Sent"}>
              {status}
            </span>
          )}
        </div>

        {showSeenBy && (
          <p className="mt-0.5 px-1 text-[11px] text-muted-foreground">
            Seen by {listNames(readerNames)}
          </p>
        )}
      </div>
    </div>
  );
}

function Composer({
  notesById,
  onSend,
  attachment,
  onAttach,
  onClearAttachment,
  picking,
  onCancelPicking,
}: ChatPanelProps) {
  const [text, setText] = useState("");
  const textRef = useRef<HTMLTextAreaElement>(null);
  const attachedNote = attachment ? notesById.get(attachment) : undefined;

  // Grow with the text, up to ~5 lines.
  useLayoutEffect(() => {
    const el = textRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 132)}px`;
  }, [text]);

  // Focus the box when a note gets attached, ready to write about it.
  useEffect(() => {
    if (attachment) textRef.current?.focus();
  }, [attachment]);

  const submit = async () => {
    const body = text.trim();
    if (!body) return;
    setText("");
    onClearAttachment();
    const sent = await onSend(body, attachedNote ? attachedNote.id : null);
    if (!sent) setText(body); // keep what they wrote if it failed
    textRef.current?.focus();
  };

  return (
    <div className="border-t border-border p-3">
      {picking && (
        <p className="mb-2 flex items-center gap-1.5 rounded-lg bg-blue-50 px-2.5 py-1.5 text-xs text-blue-700 dark:bg-blue-500/15 dark:text-blue-300">
          <Pin className="size-3.5" />
          Click a note on the board to attach it
          <button onClick={onCancelPicking} className="ml-auto font-medium hover:underline">
            Cancel
          </button>
        </p>
      )}
      {attachedNote && (
        <div className="mb-2 flex items-center gap-2 rounded-lg bg-muted px-2.5 py-1.5 text-xs">
          <span
            className={cn("size-3.5 shrink-0 rounded-[3px] border", noteColor(attachedNote.color).className)}
            aria-hidden="true"
          />
          <span className="min-w-0 flex-1 truncate text-foreground">
            <span className="text-muted-foreground">Pinned: </span>
            {attachedNote.title || attachedNote.content}
          </span>
          <button
            onClick={onClearAttachment}
            aria-label="Remove attached note"
            className="grid size-5 place-items-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <X className="size-3.5" />
          </button>
        </div>
      )}
      <form
        className="flex items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <button
          type="button"
          onClick={onAttach}
          aria-pressed={picking}
          title="Pin a note to your message (uses the selected note, or click one on the board)"
          aria-label="Pin a note to your message"
          className={cn(
            "grid size-9 shrink-0 place-items-center rounded-lg transition-colors",
            picking || attachedNote
              ? "bg-blue-50 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          )}
        >
          <Pin className="size-4" />
        </button>
        <textarea
          ref={textRef}
          value={text}
          rows={1}
          maxLength={MESSAGE_MAX}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void submit();
            } else if (e.key === "Escape" && picking) {
              onCancelPicking();
            }
          }}
          placeholder="Message the board…"
          aria-label="Message"
          className="min-h-9 flex-1 resize-none rounded-lg bg-muted px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-blue-500/50"
        />
        <button
          type="submit"
          disabled={!text.trim()}
          aria-label="Send"
          className="grid size-9 shrink-0 place-items-center rounded-lg bg-blue-600 text-white shadow-sm transition-[background-color,transform] hover:bg-blue-700 active:scale-95 disabled:opacity-40 disabled:hover:bg-blue-600"
        >
          <SendHorizontal className="size-4" />
        </button>
      </form>
    </div>
  );
}

"use client";

import React, { useEffect, useRef, useState } from "react";
import { Check, MessageCircle, Trash2, X } from "lucide-react";
import { NOTE_COLORS, noteColor, type Note, type NoteColor } from "@/lib/notes";
import { cn } from "@/lib/utils";

interface NoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (noteData: { title: string; content: string; color: string }) => void;
  onDelete?: () => void;
  /** Open the board chat with this note pinned to a new message. */
  onDiscuss?: () => void;
  initialData?: Note | null;
}

const TITLE_MAX = 50;
const CONTENT_MAX = 200;
const LINE = 28; // ruled-line spacing on the note, in px

/**
 * Create/edit dialog shaped like the note itself: you write straight onto a
 * sticky note in the chosen color, with the palette and actions on a tray below.
 */
const NoteModal: React.FC<NoteModalProps> = ({
  isOpen,
  onClose,
  onSave,
  onDelete,
  onDiscuss,
  initialData,
}) => {
  // The parent remounts this modal (via key) per note, so props seed the state.
  const [title, setTitle] = useState(initialData?.title ?? "");
  const [content, setContent] = useState(initialData?.content ?? "");
  const [color, setColor] = useState(initialData?.color ?? "yellow");
  const contentRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const paper = noteColor(color);
  const canSave = content.trim().length > 0;
  const isEditing = Boolean(initialData);

  const submit = () => {
    if (!canSave) return;
    onSave({ title: title.trim(), content: content.trim(), color });
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-stone-950/45 p-4 backdrop-blur-sm animate-in fade-in-0 duration-150"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="note-dialog-title"
        className="flex w-[min(100%,24rem,58dvh)] flex-col items-stretch gap-4 animate-in fade-in-0 zoom-in-95 slide-in-from-bottom-2 duration-200"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            submit();
          }
        }}
      >
        {/* The note */}
        <div
          className={cn(
            "group relative flex aspect-square flex-col rounded-xl border-2 px-6 pb-4 pt-7 transition-[transform,background-color,box-shadow] duration-300 ease-out",
            "-rotate-[1.5deg] focus-within:rotate-0",
            paper.className
          )}
          style={{
            boxShadow: `0 30px 50px -20px ${paper.shadow}80, 0 12px 20px -12px ${paper.shadow}66`,
          }}
        >
          {/* Tape */}
          <div className="absolute -top-4 left-1/2 h-8 w-28 -translate-x-1/2 -rotate-2 rounded-sm border border-white/60 bg-white/55 shadow-sm backdrop-blur-[1px]" />

          <div className="mb-2 flex items-center justify-between">
            <h2 id="note-dialog-title" className="text-xs font-medium text-black/45">
              {isEditing ? "Edit note" : "New note"}
            </h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="-mr-2 grid size-8 place-items-center rounded-lg text-black/45 transition-colors hover:bg-black/5 hover:text-black/70 focus-visible:outline-2 focus-visible:outline-black/40"
            >
              <X className="size-4" />
            </button>
          </div>

          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.ctrlKey && !e.metaKey) {
                e.preventDefault();
                contentRef.current?.focus();
              }
            }}
            maxLength={TITLE_MAX}
            placeholder="Title (optional)"
            aria-label="Title"
            className="w-full bg-transparent text-xl font-semibold tracking-tight text-stone-900 outline-none placeholder:font-medium placeholder:text-black/30"
          />

          <textarea
            ref={contentRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            maxLength={CONTENT_MAX}
            autoFocus
            required
            placeholder="Write something…"
            aria-label="Note"
            className="mt-2 min-h-0 flex-1 resize-none bg-transparent text-[15px] text-stone-800 outline-none placeholder:text-black/35"
            style={{
              lineHeight: `${LINE}px`,
              // Faint ruled lines that scroll with the text.
              backgroundImage: `repeating-linear-gradient(transparent 0 ${LINE - 1}px, rgba(0,0,0,0.07) ${LINE - 1}px ${LINE}px)`,
              backgroundAttachment: "local",
            }}
          />

          <div
            className={cn(
              "pt-1 text-right text-xs tabular-nums",
              content.length >= CONTENT_MAX - 20 ? "text-red-700/80" : "text-black/40"
            )}
          >
            {content.length}/{CONTENT_MAX}
          </div>
        </div>

        {/* Tray: palette + actions */}
        <div className="rounded-2xl bg-card/95 p-3 shadow-xl ring-1 ring-border">
          <div role="radiogroup" aria-label="Note color" className="grid grid-cols-10 gap-1.5">
            {(Object.keys(NOTE_COLORS) as NoteColor[]).map((key) => {
              const selected = color === key;
              return (
                <button
                  key={key}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  aria-label={NOTE_COLORS[key].label}
                  title={NOTE_COLORS[key].label}
                  onClick={() => setColor(key)}
                  className={cn(
                    "grid aspect-square place-items-center rounded-md border transition-transform duration-150 hover:-translate-y-0.5 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600",
                    NOTE_COLORS[key].className,
                    selected && "ring-2 ring-foreground ring-offset-2 ring-offset-card"
                  )}
                >
                  {selected && <Check className="size-3.5 text-black/60" strokeWidth={3} />}
                </button>
              );
            })}
          </div>

          <div className="mt-3 flex items-center gap-1 border-t border-border pt-3">
            {onDelete && (
              <button
                type="button"
                onClick={onDelete}
                className="flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 active:scale-[0.98] dark:text-red-400 dark:hover:bg-red-500/15"
              >
                <Trash2 className="size-4" />
                Delete
              </button>
            )}
            {onDiscuss && (
              <button
                type="button"
                onClick={onDiscuss}
                title="Open the board chat with this note pinned"
                className="flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground active:scale-[0.98]"
              >
                <MessageCircle className="size-4" />
                <span className="hidden sm:inline">Chat about this</span>
              </button>
            )}
            <span className="ml-auto mr-1 hidden text-xs text-muted-foreground sm:inline">
              <kbd className="font-sans">Ctrl</kbd> + <kbd className="font-sans">Enter</kbd>
            </span>
            <button
              type="button"
              onClick={onClose}
              className={cn(
                "h-9 rounded-lg px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground active:scale-[0.98]",
                !onDelete && "max-sm:ml-auto"
              )}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!canSave}
              className="h-9 rounded-lg bg-blue-600 px-4 text-sm font-medium text-white shadow-sm transition-[background-color,transform] hover:bg-blue-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-blue-600"
            >
              {isEditing ? "Save" : "Add note"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};

export default NoteModal;

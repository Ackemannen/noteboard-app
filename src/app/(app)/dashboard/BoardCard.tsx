"use client";

import { useState } from "react";
import Link from "next/link";
import { Link as LinkIcon, LogOut, Pencil, StickyNote, Trash2, Users } from "lucide-react";
import BoardThumbnail from "@/components/board/BoardThumbnail";
import { cn } from "@/lib/utils";
import type { BoardSummary } from "./BoardList";

const relativeTime = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 365 * 24 * 3600],
  ["month", 30 * 24 * 3600],
  ["week", 7 * 24 * 3600],
  ["day", 24 * 3600],
  ["hour", 3600],
  ["minute", 60],
];

function timeAgo(iso: string) {
  const seconds = (new Date(iso).getTime() - Date.now()) / 1000;
  for (const [unit, size] of UNITS) {
    if (Math.abs(seconds) >= size) return relativeTime.format(Math.round(seconds / size), unit);
  }
  return "just now";
}

const actionButton =
  "grid size-8 place-items-center rounded-lg bg-card/90 text-foreground/80 shadow-sm backdrop-blur-sm transition-colors hover:bg-card";

interface BoardCardProps {
  board: BoardSummary;
  onShare: () => void;
  /** Resolves to whether the rename succeeded. */
  onRename: (name: string) => Promise<boolean>;
  onRemove: () => void;
}

export default function BoardCard({ board, onShare, onRename, onRemove }: BoardCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(board.name);
  const [isSaving, setIsSaving] = useState(false);
  const href = `/boards/${board.id}`;

  const startEditing = () => {
    setDraft(board.name);
    setIsEditing(true);
  };

  const commit = async () => {
    if (isSaving) return;
    if (!draft.trim()) {
      setIsEditing(false);
      return;
    }
    setIsSaving(true);
    const ok = await onRename(draft);
    setIsSaving(false);
    if (ok) setIsEditing(false);
  };

  return (
    <article className="group relative overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl">
      <Link href={href} className="block outline-none" aria-label={`Open ${board.name}`} tabIndex={-1}>
        <BoardThumbnail
          notes={board.previewNotes}
          className="h-40 transition-transform duration-300 group-hover:scale-[1.02]"
        />
      </Link>

      {!board.isOwner && (
        <span className="pointer-events-none absolute left-3 top-3 flex items-center gap-1 rounded-full bg-card/90 px-2 py-0.5 text-[11px] font-medium text-foreground/80 shadow-sm backdrop-blur-sm">
          <Users className="size-3" /> Shared with you
        </span>
      )}

      {/* Actions: visible on hover/focus, always on touch screens */}
      <div className="absolute right-3 top-3 flex gap-1 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100">
        <button onClick={onShare} className={actionButton} title="Copy share link" aria-label="Copy share link">
          <LinkIcon className="size-4" />
        </button>
        {board.isOwner && (
          <button onClick={startEditing} className={actionButton} title="Rename" aria-label="Rename board">
            <Pencil className="size-4" />
          </button>
        )}
        <button
          onClick={onRemove}
          className={cn(actionButton, "text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/15")}
          title={board.isOwner ? "Delete board" : "Leave board"}
          aria-label={board.isOwner ? "Delete board" : "Leave board"}
        >
          {board.isOwner ? <Trash2 className="size-4" /> : <LogOut className="size-4" />}
        </button>
      </div>

      <div className="p-4">
        {isEditing ? (
          <input
            autoFocus
            value={draft}
            maxLength={100}
            disabled={isSaving}
            onChange={(e) => setDraft(e.target.value)}
            onFocus={(e) => e.currentTarget.select()}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter") commit();
              if (e.key === "Escape") setIsEditing(false);
            }}
            aria-label="Board name"
            className="-mx-1.5 -my-1 w-[calc(100%+0.75rem)] rounded-md border border-blue-400 px-1.5 py-1 font-semibold text-foreground outline-none ring-2 ring-blue-100"
          />
        ) : (
          <h3 className="truncate font-semibold text-foreground">
            <Link
              href={href}
              className="rounded outline-none after:absolute after:inset-x-0 after:bottom-0 after:top-40 focus-visible:ring-2 focus-visible:ring-blue-500"
              onDoubleClick={(e) => {
                if (!board.isOwner) return;
                e.preventDefault();
                startEditing();
              }}
            >
              {board.name}
            </Link>
          </h3>
        )}

        <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1" title={`${board.noteCount} notes`}>
            <StickyNote className="size-3.5" /> {board.noteCount}
          </span>
          {board.memberCount > 1 && (
            <span className="flex items-center gap-1" title={`${board.memberCount} members`}>
              <Users className="size-3.5" /> {board.memberCount}
            </span>
          )}
          <span className="ml-auto truncate" suppressHydrationWarning>
            {board.noteCount > 0 ? "Edited " : "Created "}
            {timeAgo(board.lastActivity)}
          </span>
        </div>
      </div>
    </article>
  );
}

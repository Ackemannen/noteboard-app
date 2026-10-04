"use client";

import { useEffect, useRef, useState } from "react";
import {
  CircleHelp,
  Hand,
  Link as LinkIcon,
  MoveUpRight,
  Spline,
  SquareDashedMousePointer,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { PresenceSession } from "@/hooks/useBoardPresence";
import type { CanvasMode } from "./BoardCanvas";
import PresenceAvatars from "./PresenceAvatars";

interface BoardToolbarProps {
  boardName: string;
  noteCount: number;
  mode: CanvasMode;
  onModeChange: (mode: CanvasMode) => void;
  onShare: () => void;
  /** People currently on the board. */
  sessions: PresenceSession[];
}

const SHORTCUTS: [string, string][] = [
  ["Click the board", "Add a note"],
  ["Click a note", "Edit it"],
  ["Drag a note", "Move it (it comes to the front)"],
  ["Drag the board", "Pan · also Space + drag or middle mouse"],
  ["Shift + drag", "Select an area (or use the Select tool)"],
  ["Shift + click a note", "Add to / remove from selection"],
  ["Drag a selected note", "Move the whole selection"],
  ["Scroll · pinch", "Zoom around the pointer"],
  ["Map (bottom right)", "Click or drag to jump around"],
  ["Delete · Backspace", "Delete selected notes"],
  ["Arrow keys", "Nudge selected notes (Shift = more)"],
  ["Ctrl/⌘ + A · Esc", "Select all · clear selection"],
  ["+ / − · 0 · F", "Zoom · 100% · fit all notes"],
  ["Thread / Arrow tool", "Drag from one note to another to connect them"],
  ["Click a thread or arrow", "Select it · Delete removes it"],
  ["H · V · T · A", "Pan · Select · Thread · Arrow tool"],
];

const shell =
  "flex h-10 items-center rounded-xl border border-black/5 bg-white/90 shadow-lg backdrop-blur-sm";

export default function BoardToolbar({
  boardName,
  noteCount,
  mode,
  onModeChange,
  onShare,
  sessions,
}: BoardToolbarProps) {
  const [helpOpen, setHelpOpen] = useState(false);
  const helpRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!helpOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!helpRef.current?.contains(e.target as Node)) setHelpOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setHelpOpen(false);
    };
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [helpOpen]);

  const toolButton = (value: CanvasMode, label: string, Icon: typeof Hand) => (
    <button
      onClick={() => onModeChange(value)}
      title={label}
      aria-pressed={mode === value}
      className={cn(
        "grid size-8 place-items-center rounded-lg transition-colors",
        mode === value
          ? "bg-blue-600 text-white shadow-sm"
          : "text-gray-600 hover:bg-gray-100"
      )}
    >
      <Icon className="size-4" />
    </button>
  );

  return (
    <div className="fixed left-[4.5rem] right-4 top-4 z-40 flex flex-wrap items-start gap-2 pointer-events-none [&>*]:pointer-events-auto">
      <div className={cn(shell, "min-w-0 max-w-[min(22rem,calc(100vw-6rem))] gap-2 px-3")}>
        <h1 className="truncate text-sm font-semibold text-gray-900" title={boardName}>
          {boardName}
        </h1>
        <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800">
          {noteCount} {noteCount === 1 ? "note" : "notes"}
        </span>
      </div>

      <div className={cn(shell, "gap-0.5 px-1")} role="group" aria-label="Tool">
        {toolButton("pan", "Pan tool: drag to move around", Hand)}
        {toolButton("select", "Select tool: drag to select notes", SquareDashedMousePointer)}
        <div className="mx-0.5 h-5 w-px bg-gray-200" />
        {toolButton("thread", "Thread tool: drag between notes to pin a thread (T)", Spline)}
        {toolButton("arrow", "Arrow tool: drag from one note to another (A)", MoveUpRight)}
      </div>

      <button
        onClick={onShare}
        className={cn(shell, "gap-2 px-3 text-sm font-medium text-gray-700 hover:bg-white")}
        title="Copy share link"
      >
        <LinkIcon className="size-4" />
        <span className="hidden sm:inline">Share</span>
      </button>

      <PresenceAvatars sessions={sessions} className={shell} />

      {/* Not "relative": the popover anchors to the whole toolbar so it fits on small screens */}
      <div ref={helpRef}>
        <button
          onClick={() => setHelpOpen((open) => !open)}
          className={cn(shell, "w-10 justify-center text-gray-700 hover:bg-white")}
          title="How to use the board"
          aria-expanded={helpOpen}
        >
          <CircleHelp className="size-4" />
        </button>
        {helpOpen && (
          <div className="absolute left-0 top-full mt-2 w-[min(22rem,calc(100vw-6rem))] rounded-xl border border-black/5 bg-white/95 p-4 shadow-xl backdrop-blur-sm">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-900">Using the board</h2>
              <button
                onClick={() => setHelpOpen(false)}
                className="rounded-md p-1 text-gray-500 hover:bg-gray-100"
                aria-label="Close"
              >
                <X className="size-4" />
              </button>
            </div>
            <dl className="space-y-1.5 text-xs">
              {SHORTCUTS.map(([keys, action]) => (
                <div key={keys} className="flex justify-between gap-4">
                  <dt className="shrink-0 font-medium text-gray-800">{keys}</dt>
                  <dd className="text-right text-gray-500">{action}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}
      </div>
    </div>
  );
}

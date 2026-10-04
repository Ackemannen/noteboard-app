"use client";

import { Trash2, X } from "lucide-react";
import { NOTE_COLORS, type NoteColor } from "@/lib/notes";
import { cn } from "@/lib/utils";

interface SelectionBarProps {
  count: number;
  onColor: (color: NoteColor) => void;
  onDelete: () => void;
  onClear: () => void;
}

/** Actions for the current multi-selection, floating at the bottom of the board. */
export default function SelectionBar({ count, onColor, onDelete, onClear }: SelectionBarProps) {
  if (count === 0) return null;

  return (
    <div className="fixed bottom-4 left-1/2 z-40 flex -translate-x-1/2 items-center gap-1 rounded-xl border border-border bg-card/95 p-1.5 pl-3 max-w-[calc(100vw-2rem)] overflow-x-auto shadow-lg backdrop-blur-sm max-sm:bottom-[4.5rem]">
      <span className="mr-1 whitespace-nowrap text-sm font-medium text-foreground">
        {count} selected
      </span>
      <div className="mx-1 h-5 w-px bg-border" />
      {(Object.keys(NOTE_COLORS) as NoteColor[]).map((color) => (
        <button
          key={color}
          onClick={() => onColor(color)}
          title={`Make ${NOTE_COLORS[color].label.toLowerCase()}`}
          className={cn(
            "size-5 shrink-0 rounded-full border-2 transition-transform hover:scale-110",
            NOTE_COLORS[color].className
          )}
        />
      ))}
      <div className="mx-1 h-5 w-px bg-border" />
      <button
        onClick={onDelete}
        className="flex h-8 items-center gap-1.5 rounded-lg px-2 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/15"
        title="Delete selected (Delete)"
      >
        <Trash2 className="size-4" />
        <span className="hidden sm:inline">Delete</span>
      </button>
      <button
        onClick={onClear}
        className="grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-muted"
        title="Clear selection (Esc)"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}

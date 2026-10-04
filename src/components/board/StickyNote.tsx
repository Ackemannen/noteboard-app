import { memo } from "react";
import { cn } from "@/lib/utils";
import { NOTE_SIZE, noteColor, type Note } from "@/lib/notes";

interface StickyNoteProps {
  note: Note;
  isSelected: boolean;
  /** Being dragged right now. */
  isLifted: boolean;
}

/**
 * Purely presentational: pointer input is handled by BoardCanvas, which finds
 * the note under the pointer through `data-note-id`.
 */
const StickyNote = memo(function StickyNote({
  note,
  isSelected,
  isLifted,
}: StickyNoteProps) {
  return (
    <div
      data-note-id={note.id}
      className="sticky-note absolute"
      style={{
        left: note.x,
        top: note.y,
        width: NOTE_SIZE,
        height: NOTE_SIZE,
        transform: `translate(-50%, -50%) rotate(${note.rotation}deg)`,
      }}
    >
      <div
        className={cn(
          "relative h-full w-full rounded-lg border-2 p-4 transition-[transform,box-shadow] duration-150 ease-out",
          noteColor(note.color).className,
          isLifted
            ? "scale-105 shadow-[0_20px_40px_rgba(0,0,0,0.3),0_10px_20px_rgba(0,0,0,0.2)]"
            : "shadow-[0_8px_25px_rgba(0,0,0,0.15),0_4px_10px_rgba(0,0,0,0.1)] hover:scale-[1.03] hover:rotate-1",
          isSelected &&
            "ring-4 ring-blue-500/60 ring-offset-2 ring-offset-transparent"
        )}
      >
        {/* Tape */}
        <div className="absolute -top-3 left-1/2 h-6 w-16 -translate-x-1/2 rounded-sm border border-gray-200 bg-white/60 shadow-sm" />

        <div className="pointer-events-none flex h-full flex-col">
          {note.title && (
            <h3 className="mb-2 line-clamp-2 text-sm font-semibold text-gray-800">
              {note.title}
            </h3>
          )}
          <p className="line-clamp-6 flex-1 whitespace-pre-wrap break-words text-xs leading-relaxed text-gray-700">
            {note.content}
          </p>
        </div>
      </div>
    </div>
  );
});

export default StickyNote;

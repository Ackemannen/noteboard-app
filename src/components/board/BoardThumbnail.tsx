import { NOTE_SIZE, noteColor } from "@/lib/notes";
import { notesBounds, padRect, rectHeight, rectWidth } from "@/lib/board-geometry";
import { cn } from "@/lib/utils";

export type ThumbnailNote = { x: number; y: number; color: string; rotation: number };

/** Frame the notes with some breathing room, without zooming in too far on a few. */
function thumbnailViewBox(notes: ThumbnailNote[]) {
  const bounds = notesBounds(notes);
  if (!bounds) return null;
  const padded = padRect(bounds, NOTE_SIZE * 0.6);
  const width = Math.max(rectWidth(padded), NOTE_SIZE * 3);
  const height = Math.max(rectHeight(padded), NOTE_SIZE * 1.5);
  const cx = (padded.minX + padded.maxX) / 2;
  const cy = (padded.minY + padded.maxY) / 2;
  return `${cx - width / 2} ${cy - height / 2} ${width} ${height}`;
}

/** A miniature, non-interactive rendering of a board's notes. */
export default function BoardThumbnail({
  notes,
  className,
}: {
  notes: ThumbnailNote[];
  className?: string;
}) {
  const viewBox = thumbnailViewBox(notes);

  return (
    <div
      className={cn("relative overflow-hidden bg-[#c08a4f]", className)}
      style={{ backgroundImage: "url(/cork.webp)", backgroundSize: "512px 340px" }}
    >
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_50%,rgba(60,30,0,0.25))]" />
      <div className="absolute inset-0 hidden bg-stone-950/50 dark:block" />
      {viewBox ? (
        <svg
          className="absolute inset-0 h-full w-full drop-shadow-[0_2px_2px_rgba(0,0,0,0.25)]"
          viewBox={viewBox}
          preserveAspectRatio="xMidYMid meet"
          aria-hidden="true"
        >
          {notes.map((note, i) => (
            <rect
              key={i}
              x={note.x - NOTE_SIZE / 2}
              y={note.y - NOTE_SIZE / 2}
              width={NOTE_SIZE}
              height={NOTE_SIZE}
              rx={10}
              fill={noteColor(note.color).hex}
              stroke="rgba(0,0,0,0.12)"
              strokeWidth={4}
              transform={`rotate(${note.rotation} ${note.x} ${note.y})`}
            />
          ))}
        </svg>
      ) : (
        <div className="absolute inset-0 grid place-items-center">
          <span className="rounded-full bg-card/80 px-3 py-1 text-xs font-medium text-amber-900/80">
            Empty board
          </span>
        </div>
      )}
    </div>
  );
}

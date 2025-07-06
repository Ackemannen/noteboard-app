import React, { useRef } from "react";
import StickyNote from "./StickyNote";
import SelectionLasso from "./SelectionLasso";

interface Note {
  id: string;
  title: string;
  content: string;
  color: string;
  x: number;
  y: number;
  rotation: number;
}

interface Position {
  x: number;
  y: number;
}

interface CorkBoardProps {
  notes: Note[];
  selectedNoteIds: string[];
  isSelecting: boolean;
  selectionPath: Position[];
  zoom: number;
  panOffset: Position;
  hasDraggedGroup: boolean;
  onBoardClick: (e: React.MouseEvent<HTMLDivElement>) => void;
  onBoardMouseDown: (e: React.MouseEvent<HTMLDivElement>) => void;
  onNoteClick: (note: Note) => void;
  onNotePositionChange: (noteId: string, x: number, y: number) => void;
}

const CorkBoard: React.FC<CorkBoardProps> = ({
  notes,
  selectedNoteIds,
  isSelecting,
  selectionPath,
  zoom,
  panOffset,
  hasDraggedGroup,
  onBoardClick,
  onBoardMouseDown,
  onNoteClick,
  onNotePositionChange,
}) => {
  const boardRef = useRef<HTMLDivElement>(null);

  return (
    <div
      ref={boardRef}
      className="absolute top-0 left-0 w-[200%] h-[200%] cursor-crosshair"
      style={{
        transform: `translate(${panOffset.x}px, ${panOffset.y}px)`,
        transformOrigin: "0 0",
        touchAction: "none", // Prevent default touch behaviors
      }}
      onClick={onBoardClick}
      onMouseDown={onBoardMouseDown}
      // Add touch handlers for board panning
      onTouchStart={(e) => {
        if (e.touches.length === 1) {
          // Single touch for panning
          onBoardMouseDown(e as any); // Convert to mouse event
        }
      }}
    >
      {/* Render all sticky notes */}
      {notes.map((note) => (
        <StickyNote
          key={note.id}
          note={note}
          onClick={() => onNoteClick(note)}
          onPositionChange={onNotePositionChange}
          isSelected={selectedNoteIds.includes(note.id)}
          hasDraggedGroup={hasDraggedGroup}
          zoom={zoom}
          data-note-id={note.id}
        />
      ))}

      {/* Selection lasso */}
      {isSelecting && (
        <SelectionLasso
          path={selectionPath}
          zoom={zoom}
          panOffset={panOffset}
        />
      )}
    </div>
  );
};

export default CorkBoard;

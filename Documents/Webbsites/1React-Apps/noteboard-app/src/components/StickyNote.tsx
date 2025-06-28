import React from "react";
import { useDrag } from "../hooks/useDrag";

interface Note {
  id: string;
  title: string;
  content: string;
  color: string;
  x: number;
  y: number;
  rotation: number;
}

interface StickyNoteProps {
  note: Note;
  onClick: () => void;
  onPositionChange: (id: string, x: number, y: number) => void;
}

const StickyNote: React.FC<StickyNoteProps> = ({
  note,
  onClick,
  onPositionChange,
}) => {
  const { isDragging, position, hasDragged, handleMouseDown } = useDrag({
    initialPosition: { x: note.x, y: note.y },
    onDragEnd: (newPosition) => {
      onPositionChange(note.id, newPosition.x, newPosition.y);
    },
  });

  const getColorClasses = (color: string) => {
    switch (color) {
      case "yellow":
        return "bg-yellow-200 border-yellow-300 shadow-yellow-200/50";
      case "pink":
        return "bg-pink-200 border-pink-300 shadow-pink-200/50";
      case "blue":
        return "bg-blue-200 border-blue-300 shadow-blue-200/50";
      case "green":
        return "bg-green-200 border-green-300 shadow-green-200/50";
      case "orange":
        return "bg-orange-200 border-orange-300 shadow-orange-200/50";
      default:
        return "bg-yellow-200 border-yellow-300 shadow-yellow-200/50";
    }
  };

  const handleNoteClick = () => {
    // Only trigger onClick if we haven't just finished dragging
    if (!hasDragged) {
      onClick();
    }
  };

  return (
    <div
      className={`sticky-note absolute w-48 h-48 p-4 rounded-lg border-2 select-none will-change-transform ${getColorClasses(
        note.color
      )} ${
        isDragging
          ? "cursor-grabbing z-30 transition-none"
          : "cursor-grab transition-all duration-200 ease-out hover:scale-105 hover:z-20"
      }`}
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        transform: `translate(-50%, -50%) rotate(${note.rotation}deg) ${
          isDragging ? "scale(1.05)" : ""
        }`,
        boxShadow: isDragging
          ? "0 20px 40px rgba(0, 0, 0, 0.3), 0 10px 20px rgba(0, 0, 0, 0.2)"
          : "0 8px 25px rgba(0, 0, 0, 0.15), 0 4px 10px rgba(0, 0, 0, 0.1)",
      }}
      onMouseDown={handleMouseDown}
      onClick={handleNoteClick}
      onMouseEnter={(e) => {
        if (!isDragging) {
          const element = e.currentTarget;
          element.style.transform = `translate(-50%, -50%) rotate(${
            note.rotation + 2
          }deg) scale(1.02)`;
        }
      }}
      onMouseLeave={(e) => {
        if (!isDragging) {
          const element = e.currentTarget;
          element.style.transform = `translate(-50%, -50%) rotate(${note.rotation}deg) scale(1)`;
        }
      }}
    >
      {/* Tape effect at the top */}
      <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 w-16 h-6 bg-white/60 rounded-sm shadow-sm border border-gray-200"></div>

      <div className="h-full flex flex-col pointer-events-none">
        {note.title && (
          <h3 className="font-semibold text-gray-800 mb-2 line-clamp-2 text-sm">
            {note.title}
          </h3>
        )}
        <p className="text-gray-700 text-xs leading-relaxed line-clamp-6 flex-1">
          {note.content}
        </p>
      </div>
    </div>
  );
};

export default StickyNote;

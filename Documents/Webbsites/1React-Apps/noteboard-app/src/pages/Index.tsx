import React, { useState, useEffect } from "react";
import StickyNote from "../components/StickyNote";
import NoteModal from "../components/NoteModal";
import corkboard from "../assets/background.png";

interface Note {
  id: string;
  title: string;
  content: string;
  color: string;
  x: number;
  y: number;
  rotation: number;
}

const Index = () => {
  const [notes, setNotes] = useState<Note[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [modalPosition, setModalPosition] = useState({ x: 0, y: 0 });

  // Load notes from localStorage on component mount
  useEffect(() => {
    try {
      // Check if localStorage is available
      if (typeof window !== "undefined" && window.localStorage) {
        const savedNotes = localStorage.getItem("corkboard-notes");
        if (savedNotes) {
          const parsedNotes = JSON.parse(savedNotes);
          console.log("Loaded notes from localStorage:", parsedNotes);
          setNotes(parsedNotes);
        }
      }
    } catch (error) {
      console.error("Error loading notes from localStorage:", error);
      // Only clear if it's a JSON parsing error, not other errors
      if (error instanceof SyntaxError) {
        try {
          localStorage.removeItem("corkboard-notes");
          console.log("Cleared corrupted localStorage data");
        } catch (clearError) {
          console.error("Error clearing localStorage:", clearError);
        }
      }
    }
  }, []);

  // Save notes to localStorage whenever notes change
  useEffect(() => {
    // Don't save if notes array is empty and we haven't loaded anything yet
    if (notes.length === 0) return;

    try {
      // Check if localStorage is available
      if (typeof window !== "undefined" && window.localStorage) {
        localStorage.setItem("corkboard-notes", JSON.stringify(notes));
        console.log("Saved notes to localStorage:", notes);
      }
    } catch (error) {
      console.error("Error saving notes to localStorage:", error);
      // If it's a quota exceeded error, try to clear old data
      if (error instanceof Error && error.name === "QuotaExceededError") {
        try {
          localStorage.clear();
          localStorage.setItem("corkboard-notes", JSON.stringify(notes));
          console.log("Cleared localStorage and saved notes successfully");
        } catch (retryError) {
          console.error(
            "Failed to save notes even after clearing localStorage:",
            retryError
          );
        }
      }
    }
  }, [notes]);

  const handleBoardClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // Don't create new note if clicking on existing note
    if ((e.target as HTMLElement).closest(".sticky-note")) {
      return;
    }

    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setModalPosition({ x, y });
    setEditingNote(null);
    setIsModalOpen(true);
  };

  const handleNoteClick = (note: Note) => {
    setEditingNote(note);
    setModalPosition({ x: note.x, y: note.y });
    setIsModalOpen(true);
  };

  const handleNotePositionChange = (noteId: string, x: number, y: number) => {
    setNotes(
      notes.map((note) => (note.id === noteId ? { ...note, x, y } : note))
    );
  };

  const handleNoteSave = (noteData: {
    title: string;
    content: string;
    color: string;
  }) => {
    if (editingNote) {
      // Update existing note
      setNotes(
        notes.map((note) =>
          note.id === editingNote.id ? { ...note, ...noteData } : note
        )
      );
    } else {
      // Create new note
      const newNote: Note = {
        id: Date.now().toString(),
        ...noteData,
        x: modalPosition.x,
        y: modalPosition.y,
        rotation: Math.random() * 10 - 5, // Random rotation between -5 and 5 degrees
      };
      setNotes([...notes, newNote]);
    }
    setIsModalOpen(false);
    setEditingNote(null);
  };

  const handleNoteDelete = (noteId: string) => {
    setNotes(notes.filter((note) => note.id !== noteId));
    setIsModalOpen(false);
    setEditingNote(null);
  };

  return (
    <div className="min-h-screen relative overflow-hidden">
      <img
        src={corkboard}
        alt="Corkboard"
        className="absolute inset-0 w-full h-full object-cover"
      />
      {/* Cork board overlay for better texture */}
      <div className="absolute inset-0 bg-gradient-to-br from-amber-100/20 to-amber-800/20 pointer-events-none"></div>

      {/* Main cork board area */}
      <div
        className="relative w-full h-screen cursor-crosshair"
        onClick={handleBoardClick}
      >
        {/* Instructions */}
        <div className="absolute top-4 left-4 bg-white/90 backdrop-blur-sm p-4 rounded-lg shadow-lg max-w-sm z-10">
          <h2 className="font-semibold text-amber-900 mb-2">
            Digital Cork Board
          </h2>
          <p className="text-sm text-amber-800">
            Click anywhere on the board to create a sticky note. Click on
            existing notes to edit them, or drag them to move them around.
          </p>
        </div>

        {/* Render all sticky notes */}
        {notes.map((note) => (
          <StickyNote
            key={note.id}
            note={note}
            onClick={() => handleNoteClick(note)}
            onPositionChange={handleNotePositionChange}
          />
        ))}
      </div>

      {/* Note Modal */}
      <NoteModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleNoteSave}
        onDelete={
          editingNote ? () => handleNoteDelete(editingNote.id) : undefined
        }
        initialData={editingNote}
      />
    </div>
  );
};

export default Index;

import React, { useState, useEffect, useRef } from "react";
import CorkBoard from "../components/CorkBoard";
import NoteModal from "../components/NoteModal";
import ZoomControls from "../components/ZoomControls";
import InfoWindow from "../components/InfoWindow";
import { useZoom } from "../hooks/useZoom";
import { useSelection } from "../hooks/useSelection";
import { useSelectedNotesMovement } from "../hooks/useSelectedNotesMovement";
import corkboardImg from "../assets/corkboard.png";

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
  const boardRef = useRef<HTMLDivElement>(null);

  const {
    zoom,
    panOffset,
    handleWheel,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    zoomIn,
    zoomOut,
    resetZoom,
  } = useZoom();
  const {
    selectedNoteIds,
    isSelecting,
    selectionPath,
    handleSelectionStart,
    handleSelectionMove,
    handleSelectionEnd,
    clearSelection,
  } = useSelection({ notes, zoom, panOffset });

  const {
    isDraggingSelected,
    hasDraggedGroup,
    startDraggingSelected,
    handleSelectedNotesMove,
    stopDraggingSelected,
  } = useSelectedNotesMovement({
    selectedNoteIds,
    notes,
    zoom,
    onNotesMove: (updates) => {
      setNotes((prevNotes) =>
        prevNotes.map((note) => {
          const update = updates.find((u) => u.id === note.id);
          return update ? { ...note, x: update.x, y: update.y } : note;
        })
      );
    },
  });

  // Load notes from localStorage on component mount
  useEffect(() => {
    const savedNotes = localStorage.getItem("corkboard-notes");
    if (savedNotes) {
      setNotes(JSON.parse(savedNotes));
    }
  }, []);

  // Save notes to localStorage whenever notes change
  useEffect(() => {
    localStorage.setItem("corkboard-notes", JSON.stringify(notes));
  }, [notes]);

  // Set up event listeners for zoom and selection
  useEffect(() => {
    const board = boardRef.current;
    if (!board) return;

    const handleMouseMoveGroup = (e: MouseEvent) => {
      handleMouseMove(e);
      handleSelectionMove(e);
      handleSelectedNotesMove(e);
    };

    const handleMouseUpGroup = (e: MouseEvent) => {
      handleMouseUp();
      handleSelectionEnd();
      stopDraggingSelected();
    };

    board.addEventListener("wheel", handleWheel, { passive: false });
    document.addEventListener("mousemove", handleMouseMoveGroup);
    document.addEventListener("mouseup", handleMouseUpGroup);

    return () => {
      board.removeEventListener("wheel", handleWheel);
      document.removeEventListener("mousemove", handleMouseMoveGroup);
      document.removeEventListener("mouseup", handleMouseUpGroup);
    };
  }, [
    handleWheel,
    handleMouseMove,
    handleMouseUp,
    handleSelectionMove,
    handleSelectionEnd,
    handleSelectedNotesMove,
    stopDraggingSelected,
  ]);

  const handleBoardClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;

    // Don't create new note if clicking on existing note or if we're selecting
    if (target.closest(".sticky-note") || isSelecting) {
      return;
    }

    // Clear selection if clicking on empty space (but not during shift+click)
    if (selectedNoteIds.length > 0 && !e.shiftKey) {
      clearSelection();
      return;
    }

    // Don't create note if shift is held (selection mode)
    if (e.shiftKey) {
      return;
    }

    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left - panOffset.x) / zoom;
    const y = (e.clientY - rect.top - panOffset.y) / zoom;

    setModalPosition({ x: x * zoom + panOffset.x, y: y * zoom + panOffset.y });
    setEditingNote(null);
    setIsModalOpen(true);
  };

  const handleBoardMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    console.log("Board mouse down triggered");
    const target = e.target as HTMLElement;
    const boardElement = e.currentTarget;
    const clickedNoteElement = target.closest(".sticky-note");
    const noteId = clickedNoteElement?.getAttribute("data-note-id");
    console.log("Clicked note ID:", noteId, "Selected notes:", selectedNoteIds);

    // If shift is held, start selection (regardless of what we're clicking on)
    if (e.shiftKey) {
      e.preventDefault();
      handleSelectionStart(e, boardElement);
      return;
    }

    // If clicking on a selected note, start group movement
    if (
      noteId &&
      selectedNoteIds.includes(noteId) &&
      selectedNoteIds.length > 1
    ) {
      console.log("Starting group drag for selected notes");
      e.preventDefault();
      startDraggingSelected(e);
      return;
    }

    // If clicking on a note but not selected, clear selection first
    if (noteId && selectedNoteIds.length > 0) {
      clearSelection();
    }

    // Handle panning (middle click or ctrl+click)
    if (e.button === 1 || e.ctrlKey) {
      handleMouseDown(e);
    }
  };

  const handleNoteClick = (note: Note) => {
    // Only open modal if not dragging selected notes
    if (!isDraggingSelected) {
      setEditingNote(note);
      setModalPosition({
        x: note.x * zoom + panOffset.x,
        y: note.y * zoom + panOffset.y,
      });
      setIsModalOpen(true);
    }
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
        x: (modalPosition.x - panOffset.x) / zoom,
        y: (modalPosition.y - panOffset.y) / zoom,
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
    <div className="min-h-screen bg-cork bg-cover bg-center relative overflow-hidden">
      {/* Cork board overlay for better texture */}
      <img
        src={corkboardImg}
        alt="Corkboard"
        className="absolute top-0 left-0 w-full h-full pointer-events-none"
        draggable="false"
      />

      {/* Info Window - Fixed position */}
      <InfoWindow
        selectedCount={selectedNoteIds.length}
        totalNotes={notes.length}
      />

      {/* Main cork board area */}
      <div ref={boardRef}>
        <CorkBoard
          notes={notes}
          selectedNoteIds={selectedNoteIds}
          isSelecting={isSelecting}
          selectionPath={selectionPath}
          zoom={zoom}
          panOffset={panOffset}
          hasDraggedGroup={hasDraggedGroup}
          onBoardClick={handleBoardClick}
          onBoardMouseDown={handleBoardMouseDown}
          onNoteClick={handleNoteClick}
          onNotePositionChange={handleNotePositionChange}
        />
      </div>

      {/* Zoom Controls */}
      <ZoomControls
        zoom={zoom}
        onZoomIn={zoomIn}
        onZoomOut={zoomOut}
        onReset={resetZoom}
      />

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

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import CorkBoard from "../components/CorkBoard";
import NoteModal from "../components/NoteModal";
import ZoomControls from "../components/ZoomControls";
import InfoWindow from "../components/InfoWindow";
import { useZoom } from "../hooks/useZoom";
import { useSelection } from "../hooks/useSelection";
import { useSelectedNotesMovement } from "../hooks/useSelectedNotesMovement";
import { Logout } from "@/components/logout";
import { db } from "../firebase";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { ArrowLeft, Link } from "lucide-react";
import { toast } from "sonner";

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
  const { id: boardId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [notes, setNotes] = useState<Note[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [modalPosition, setModalPosition] = useState({ x: 0, y: 0 });
  const [loading, setLoading] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const boardRef = useRef<HTMLDivElement>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastSavedNotesRef = useRef<Note[]>([]);

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

  // Load notes from Firebase on component mount
  useEffect(() => {
    if (!boardId) return;

    setLoading(true);
    const boardRef = doc(db, "boards", boardId);

    const unsubscribe = onSnapshot(
      boardRef,
      (doc) => {
        if (doc.exists()) {
          const data = doc.data();
          const boardNotes = data.notes || [];

          // Only update if we're not currently dragging to avoid conflicts
          if (!isDragging && !isDraggingSelected) {
            setNotes(boardNotes);
            lastSavedNotesRef.current = boardNotes;
          }
        } else {
          // If board doesn't exist, create it with empty notes
          setNotes([]);
          lastSavedNotesRef.current = [];
          // Initialize the board document
          setDoc(boardRef, { notes: [] }, { merge: true });
        }
        setLoading(false);
      },
      (error) => {
        console.error("Error loading board:", error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [boardId, isDragging, isDraggingSelected]);

  // Debounced save function for better performance
  const debouncedSave = useCallback(
    (notesToSave: Note[]) => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      saveTimeoutRef.current = setTimeout(async () => {
        if (!boardId) return;

        try {
          const boardRef = doc(db, "boards", boardId);
          await setDoc(boardRef, { notes: notesToSave }, { merge: true });
          lastSavedNotesRef.current = notesToSave;
        } catch (error) {
          console.error("Error saving notes:", error);
        }
      }, 100); // 100ms debounce
    },
    [boardId]
  );

  // Save notes to Firebase whenever notes change (debounced)
  useEffect(() => {
    if (!boardId || loading) return;

    // Only save if notes have actually changed
    const notesChanged =
      JSON.stringify(notes) !== JSON.stringify(lastSavedNotesRef.current);

    if (notesChanged) {
      debouncedSave(notes);
    }
  }, [notes, boardId, loading, debouncedSave]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  // Set up event listeners for zoom and selection
  useEffect(() => {
    const board = boardRef.current;
    if (!board) return;

    const handleMouseMoveGroup = (e: MouseEvent) => {
      handleMouseMove(e);
      handleSelectionMove(e);
      handleSelectedNotesMove(e);
    };

    const handleMouseUpGroup = () => {
      handleMouseUp();
      handleSelectionEnd();
      stopDraggingSelected();
      setIsDragging(false);

      // Force save after drag ends
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      debouncedSave(notes);
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
    notes,
    debouncedSave,
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
    const target = e.target as HTMLElement;
    const boardElement = e.currentTarget;
    const clickedNoteElement = target.closest(".sticky-note");
    const noteId = clickedNoteElement?.getAttribute("data-note-id");

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
      e.preventDefault();
      setIsDragging(true);
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
    setIsDragging(true);
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
  const handleCopyShare = (boardId: string) => {
    const url = `${window.location.origin}/noteboard-app/boards/${boardId}`;
    navigator.clipboard.writeText(url);
    toast.success("Share link copied to clipboard!");
  };

  return (
    <div className="min-h-screen bg-cork bg-cover bg-center relative overflow-hidden">
      {/* Cork board overlay for better texture */}
      <div className="absolute inset-0 bg-gradient-to-br from-amber-100/20 to-amber-800/20"></div>

      <div className="flex justify-center gap-4 fixed top-4 left-4 z-50">
        {/* Info Window - Fixed position */}
        <InfoWindow
          selectedCount={selectedNoteIds.length}
          totalNotes={notes.length}
        />

        <button
          className="flex items-center h-10 gap-2 px-4 py-2 bg-white/90 backdrop-blur-sm rounded-lg shadow-lg hover:bg-gray-200 transition-colors border border-gray-300"
          onClick={() => handleCopyShare(boardId!)}
        >
          <Link className="h-4 w-4" />
          Share
        </button>

        {/* Back Button */}
        <button
          onClick={() => navigate("/")}
          className="flex items-center h-10 gap-2 px-4 py-2 bg-white/90 backdrop-blur-sm rounded-lg shadow-lg hover:bg-gray-200 transition-colors border border-gray-300"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Boards
        </button>
      </div>

      {/* Logout Button */}
      <Logout />

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

"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { ArrowLeft, Link as LinkIcon } from "lucide-react";
import { toast } from "sonner";
import CorkBoard from "@/components/CorkBoard";
import NoteModal from "@/components/NoteModal";
import ZoomControls from "@/components/ZoomControls";
import InfoWindow from "@/components/InfoWindow";
import { Logout } from "@/components/auth/Logout";
import { useZoom } from "@/hooks/useZoom";
import { useSelection } from "@/hooks/useSelection";
import { useSelectedNotesMovement } from "@/hooks/useSelectedNotesMovement";
import { useBoardNotes } from "@/hooks/useBoardNotes";
import type { Note } from "@/lib/notes";

const Board = ({
  boardId,
  initialNotes,
}: {
  boardId: string;
  initialNotes: Note[];
}) => {
  const { notes, setNotes } = useBoardNotes(boardId, initialNotes);
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
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
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
    };

    const handleTouchMoveGroup = (e: TouchEvent) => {
      handleTouchMove(e);
    };

    const handleTouchEndGroup = () => {
      handleTouchEnd();
      handleSelectionEnd();
      stopDraggingSelected();
    };

    const handleTouchStartWrapper = (e: TouchEvent) => {
      handleTouchStart(e);
    };

    board.addEventListener("wheel", handleWheel, { passive: false });
    document.addEventListener("mousemove", handleMouseMoveGroup);
    document.addEventListener("mouseup", handleMouseUpGroup);
    document.addEventListener("touchstart", handleTouchStartWrapper, {
      passive: false,
    });
    document.addEventListener("touchmove", handleTouchMoveGroup, {
      passive: false,
    });
    document.addEventListener("touchend", handleTouchEndGroup);

    return () => {
      board.removeEventListener("wheel", handleWheel);
      document.removeEventListener("mousemove", handleMouseMoveGroup);
      document.removeEventListener("mouseup", handleMouseUpGroup);
      document.removeEventListener("touchstart", handleTouchStartWrapper);
      document.removeEventListener("touchmove", handleTouchMoveGroup);
      document.removeEventListener("touchend", handleTouchEndGroup);
    };
  }, [
    handleWheel,
    handleMouseMove,
    handleMouseUp,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
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
    setNotes((prevNotes) =>
      prevNotes.map((note) => (note.id === noteId ? { ...note, x, y } : note))
    );
  };

  const handleNoteSave = (noteData: {
    title: string;
    content: string;
    color: string;
  }) => {
    if (editingNote) {
      // Update existing note
      setNotes((prevNotes) =>
        prevNotes.map((note) =>
          note.id === editingNote.id ? { ...note, ...noteData } : note
        )
      );
    } else {
      // Create new note
      const newNote: Note = {
        id: crypto.randomUUID(),
        ...noteData,
        x: (modalPosition.x - panOffset.x) / zoom,
        y: (modalPosition.y - panOffset.y) / zoom,
        rotation: Math.random() * 10 - 5, // Random rotation between -5 and 5 degrees
      };
      setNotes((prevNotes) => [...prevNotes, newNote]);
    }
    setIsModalOpen(false);
    setEditingNote(null);
  };

  const handleNoteDelete = (noteId: string) => {
    setNotes((prevNotes) => prevNotes.filter((note) => note.id !== noteId));
    setIsModalOpen(false);
    setEditingNote(null);
  };

  const handleCopyShare = () => {
    const url = `${window.location.origin}/boards/${boardId}`;
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
          className="flex items-center h-10 gap-2 px-4 py-2 bg-white/90 backdrop-blur-sm rounded-lg shadow-lg hover:bg-gray-200 transition-colors border border-gray-300 cursor-pointer"
          onClick={handleCopyShare}
        >
          <LinkIcon className="h-4 w-4" />
          <span className="sm:block hidden">Share</span>
        </button>

        {/* Back Button */}
        <Link
          href="/dashboard"
          className="flex items-center h-10 gap-2 px-4 py-2 bg-white/90 backdrop-blur-sm rounded-lg shadow-lg hover:bg-gray-200 transition-colors border border-gray-300 cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4" />
          <span className="sm:block hidden">Back to Boards</span>
        </Link>
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
        key={isModalOpen ? (editingNote?.id ?? "new") : "closed"}
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

export default Board;

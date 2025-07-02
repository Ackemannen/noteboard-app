import { useState, useCallback } from 'react';


interface Note {
  id: string;
  x: number;
  y: number;
}

interface UseSelectedNotesMovementProps {
  selectedNoteIds: string[];
  notes: Note[];
  zoom: number;
  onNotesMove: (updates: { id: string; x: number; y: number }[]) => void;
}

export const useSelectedNotesMovement = ({ 
  selectedNoteIds, 
  notes,
  zoom, 
  onNotesMove 
}: UseSelectedNotesMovementProps) => {
  const [isDraggingSelected, setIsDraggingSelected] = useState(false);
  const [dragStartPos, setDragStartPos] = useState({ x: 0, y: 0 });
  const [initialNotePositions, setInitialNotePositions] = useState<{ [id: string]: { x: number; y: number } }>({});
  const [hasDraggedGroup, setHasDraggedGroup] = useState(false);

  const startDraggingSelected = useCallback((e: React.MouseEvent) => {
    console.log('Starting group drag for', selectedNoteIds.length, 'notes');
    setIsDraggingSelected(true);
    setHasDraggedGroup(false);
    setDragStartPos({ x: e.clientX, y: e.clientY });
    
    // Store initial positions from notes data, not DOM
    const initialPositions: { [id: string]: { x: number; y: number } } = {};
    selectedNoteIds.forEach(id => {
      const note = notes.find(n => n.id === id);
      if (note) {
        initialPositions[id] = { x: note.x, y: note.y };
      }
    });
    setInitialNotePositions(initialPositions);
  }, [selectedNoteIds, notes]);

  const handleSelectedNotesMove = useCallback((e: MouseEvent) => {
    if (!isDraggingSelected || selectedNoteIds.length === 0) return;

    const deltaX = (e.clientX - dragStartPos.x) / zoom;
    const deltaY = (e.clientY - dragStartPos.y) / zoom;
    
    // Mark as dragged if moved more than 5 pixels
    if (!hasDraggedGroup && (Math.abs(deltaX) > 5 || Math.abs(deltaY) > 5)) {
      setHasDraggedGroup(true);
    }
    
    const updates = selectedNoteIds.map(id => {
      const initialPos = initialNotePositions[id];
      
      if (!initialPos) {
        const note = notes.find(n => n.id === id);
        return { id, x: note?.x || 0, y: note?.y || 0 };
      }
      
      return {
        id,
        x: initialPos.x + deltaX,
        y: initialPos.y + deltaY
      };
    });
    
    onNotesMove(updates);
  }, [isDraggingSelected, dragStartPos, selectedNoteIds, zoom, initialNotePositions, notes, onNotesMove, hasDraggedGroup]);

  const stopDraggingSelected = useCallback(() => {
    console.log('Stopping group drag');
    setIsDraggingSelected(false);
    setInitialNotePositions({});
  }, []);

  return {
    isDraggingSelected,
    hasDraggedGroup,
    startDraggingSelected,
    handleSelectedNotesMove,
    stopDraggingSelected
  };
};
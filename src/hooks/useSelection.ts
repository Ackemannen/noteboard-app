import { useState, useCallback, useRef } from 'react';

interface Position {
  x: number;
  y: number;
}

interface Note {
  id: string;
  x: number;
  y: number;
}

interface UseSelectionProps {
  notes: Note[];
  zoom: number;
  panOffset: Position;
}

export const useSelection = ({ notes, zoom, panOffset }: UseSelectionProps) => {
  const [selectedNoteIds, setSelectedNoteIds] = useState<string[]>([]);
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectionPath, setSelectionPath] = useState<Position[]>([]);
  const startPoint = useRef<Position | null>(null);
  const boardRef = useRef<HTMLDivElement | null>(null);

  const handleSelectionStart = useCallback((e: React.MouseEvent, boardElement: HTMLDivElement) => {
    boardRef.current = boardElement;
    const rect = boardElement.getBoundingClientRect();
    const x = (e.clientX - rect.left - panOffset.x) / zoom;
    const y = (e.clientY - rect.top - panOffset.y) / zoom;
    
    startPoint.current = { x, y };
    setIsSelecting(true);
    setSelectionPath([{ x, y }]);
    setSelectedNoteIds([]);
  }, [zoom, panOffset]);

  const handleSelectionMove = useCallback((e: MouseEvent) => {
    if (!isSelecting || !startPoint.current || !boardRef.current) return;
    
    const rect = boardRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left - panOffset.x) / zoom;
    const y = (e.clientY - rect.top - panOffset.y) / zoom;
    
    setSelectionPath(prev => [...prev, { x, y }]);
  }, [isSelecting, zoom, panOffset]);

  const isPointInPolygon = useCallback((point: Position, polygon: Position[]): boolean => {
    if (polygon.length < 3) return false;
    
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i].x, yi = polygon[i].y;
      const xj = polygon[j].x, yj = polygon[j].y;
      
      if (((yi > point.y) !== (yj > point.y)) &&
          (point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi)) {
        inside = !inside;
      }
    }
    return inside;
  }, []);

  const isPointNearPath = useCallback((point: Position, path: Position[], threshold: number = 50): boolean => {
    for (let i = 0; i < path.length - 1; i++) {
      const p1 = path[i];
      const p2 = path[i + 1];
      
      // Calculate distance from point to line segment
      const A = point.x - p1.x;
      const B = point.y - p1.y;
      const C = p2.x - p1.x;
      const D = p2.y - p1.y;
      
      const dot = A * C + B * D;
      const lenSq = C * C + D * D;
      
      if (lenSq === 0) continue;
      
      const param = dot / lenSq;
      let xx, yy;
      
      if (param < 0) {
        xx = p1.x;
        yy = p1.y;
      } else if (param > 1) {
        xx = p2.x;
        yy = p2.y;
      } else {
        xx = p1.x + param * C;
        yy = p1.y + param * D;
      }
      
      const dx = point.x - xx;
      const dy = point.y - yy;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      if (distance <= threshold) {
        return true;
      }
    }
    return false;
  }, []);

  const handleSelectionEnd = useCallback(() => {
    if (!isSelecting) return;
    
    // Create a more reliable selection area using bounding box as fallback
    const minX = Math.min(...selectionPath.map(p => p.x));
    const maxX = Math.max(...selectionPath.map(p => p.x));
    const minY = Math.min(...selectionPath.map(p => p.y));
    const maxY = Math.max(...selectionPath.map(p => p.y));
    
    // Add some padding to the bounding box for better selection
    const padding = 20 / zoom;
    const paddedMinX = minX - padding;
    const paddedMaxX = maxX + padding;
    const paddedMinY = minY - padding;
    const paddedMaxY = maxY + padding;
    
    // Find notes within the selection
    const selected = notes.filter(note => {
      const notePoint = { x: note.x, y: note.y };
      
      // First try polygon detection
      const inPolygon = selectionPath.length >= 3 && isPointInPolygon(notePoint, selectionPath);
      
      // Check if in padded bounding box
      const inBoundingBox = note.x >= paddedMinX && note.x <= paddedMaxX && 
                           note.y >= paddedMinY && note.y <= paddedMaxY;
      
      // For smaller selections or open paths, also check if point is near the selection path
      const nearPath = selectionPath.length >= 2 && isPointNearPath(notePoint, selectionPath, 60 / zoom);
      
      return inPolygon || inBoundingBox || nearPath;
    });
    
    console.log('Selection completed:', { 
      pathLength: selectionPath.length, 
      selectedCount: selected.length,
      boundingBox: { minX: paddedMinX, maxX: paddedMaxX, minY: paddedMinY, maxY: paddedMaxY }
    });
    
    setSelectedNoteIds(selected.map(note => note.id));
    setIsSelecting(false);
    setSelectionPath([]);
    startPoint.current = null;
    boardRef.current = null;
  }, [isSelecting, notes, selectionPath, isPointInPolygon, isPointNearPath, zoom]);

  const clearSelection = useCallback(() => {
    setSelectedNoteIds([]);
  }, []);

  const moveSelectedNotes = useCallback((deltaX: number, deltaY: number) => {
    return selectedNoteIds.map(id => ({ id, deltaX, deltaY }));
  }, [selectedNoteIds]);

  return {
    selectedNoteIds,
    isSelecting,
    selectionPath,
    handleSelectionStart,
    handleSelectionMove,
    handleSelectionEnd,
    clearSelection,
    moveSelectedNotes
  };
};
import { useState, useCallback, useRef } from 'react';

interface Position {
  x: number;
  y: number;
}

interface UseDragProps {
  initialPosition: Position;
  onDrag?: (position: Position) => void;
  onDragEnd?: (position: Position) => void;
}

export const useDrag = ({ initialPosition, onDrag, onDragEnd }: UseDragProps) => {
  const [isDragging, setIsDragging] = useState(false);
  const [position, setPosition] = useState(initialPosition);
  const [hasDragged, setHasDragged] = useState(false);
  const dragStartPos = useRef<Position>({ x: 0, y: 0 });
  const elementStartPos = useRef<Position>(initialPosition);
  const animationFrameRef = useRef<number | null>(null);
  const lastUpdateRef = useRef<number>(0);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    setIsDragging(true);
    setHasDragged(false);
    dragStartPos.current = { x: e.clientX, y: e.clientY };
    elementStartPos.current = position;

    const handleMouseMove = (e: MouseEvent) => {
      e.preventDefault();
      
      // Mark that we've actually dragged (moved the mouse while dragging)
      const deltaX = e.clientX - dragStartPos.current.x;
      const deltaY = e.clientY - dragStartPos.current.y;
      const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
      
      if (distance > 5) { // Only consider it a drag if moved more than 5px
        setHasDragged(true);
      }
      
      // Throttle updates using requestAnimationFrame for smooth performance
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }

      animationFrameRef.current = requestAnimationFrame(() => {
        const now = performance.now();
        
        // Additional throttling: update at most every 8ms (120fps equivalent)
        if (now - lastUpdateRef.current < 8) return;
        lastUpdateRef.current = now;

        const newPosition = {
          x: elementStartPos.current.x + deltaX,
          y: elementStartPos.current.y + deltaY
        };
        
        setPosition(newPosition);
        onDrag?.(newPosition);
      });
    };

    const handleMouseUp = (e: MouseEvent) => {
      e.preventDefault();
      setIsDragging(false);
      
      // Cancel any pending animation frame
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }

      // Get final position for onDragEnd callback
      const deltaX = e.clientX - dragStartPos.current.x;
      const deltaY = e.clientY - dragStartPos.current.y;
      const finalPosition = {
        x: elementStartPos.current.x + deltaX,
        y: elementStartPos.current.y + deltaY
      };
      
      setPosition(finalPosition);
      onDragEnd?.(finalPosition);
      
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    // Use passive: false to allow preventDefault
    document.addEventListener('mousemove', handleMouseMove, { passive: false });
    document.addEventListener('mouseup', handleMouseUp, { passive: false });
  }, [position, onDrag, onDragEnd]);

  return {
    isDragging,
    position,
    hasDragged,
    handleMouseDown
  };
};
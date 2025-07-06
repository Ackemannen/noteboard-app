import { useState, useCallback, useRef, useEffect } from 'react';

interface Position {
  x: number;
  y: number;
}

interface UseDragProps {
  initialPosition: Position;
  onDragEnd?: (position: Position) => void;
  disabled?: boolean;
  zoom?: number;
}

export const useDrag = ({ initialPosition, onDragEnd, disabled = false, zoom = 1 }: UseDragProps) => {
  const [isDragging, setIsDragging] = useState(false);
  const [position, setPosition] = useState(initialPosition);
  const [hasDragged, setHasDragged] = useState(false);
  const dragStartPos = useRef({ x: 0, y: 0 });
  const initialPos = useRef(initialPosition);
  const isDraggingRef = useRef(false);
  const currentPositionRef = useRef(initialPosition);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (disabled) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    setIsDragging(true);
    isDraggingRef.current = true;
    setHasDragged(false);
    
    dragStartPos.current = { x: e.clientX, y: e.clientY };
    initialPos.current = position;

    const handleMouseMove = (e: MouseEvent) => {
      if (disabled || !isDraggingRef.current) return;
      
      const deltaX = (e.clientX - dragStartPos.current.x) / zoom;
      const deltaY = (e.clientY - dragStartPos.current.y) / zoom;
      
      // Mark as dragged if moved more than 5 pixels
      if (!hasDragged && (Math.abs(deltaX * zoom) > 5 || Math.abs(deltaY * zoom) > 5)) {
        setHasDragged(true);
      }
      
      const newPosition = {
        x: initialPos.current.x + deltaX,
        y: initialPos.current.y + deltaY
      };
      
      setPosition(newPosition);
      currentPositionRef.current = newPosition;
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      isDraggingRef.current = false;
      
      if (onDragEnd && !disabled) {
        // Use the ref to get the most current position
        onDragEnd(currentPositionRef.current);
      }
      
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [position, onDragEnd, hasDragged, disabled, zoom]);

  // Adding touch events
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (disabled || e.touches.length !== 1) return;

    e.preventDefault();
    e.stopPropagation();

    const touch = e.touches[0];
    setIsDragging(true);
    isDraggingRef.current = true;
    setHasDragged(false);

    dragStartPos.current = { x: touch.clientX, y: touch.clientY };
    initialPos.current = position;

    const handleTouchMove = (e: TouchEvent) => {
      if (disabled || !isDraggingRef.current || e.touches.length !== 1) return;

      e.preventDefault(); // Prevents scrolling while dragging

      const touch = e.touches[0];
      const deltaX = (touch.clientX - dragStartPos.current.x) / zoom;
      const deltaY = (touch.clientY - dragStartPos.current.y) / zoom;

      // Mark as dragged if moved more than 5 pixels
      if (!hasDragged && (Math.abs(deltaX * zoom) > 5 || Math.abs(deltaY * zoom) > 5)) {
        setHasDragged(true);
      }

      const newPosition = {
        x: initialPos.current.x + deltaX,
        y: initialPos.current.y + deltaY
      };

      setPosition(newPosition);
      currentPositionRef.current = newPosition;
    };

    const handleTouchEnd = () => {
      setIsDragging(false);
      isDraggingRef.current = false;

      if (onDragEnd && !disabled) {
        onDragEnd(currentPositionRef.current);
      }

      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };

    // Add the event listeners without passive option
    document.addEventListener('touchmove', handleTouchMove);
    document.addEventListener('touchend', handleTouchEnd);
  }, [position, onDragEnd, hasDragged, disabled, zoom]);

  // Update position when initialPosition changes (for external updates)
  // Only update if we're not currently dragging to avoid conflicts
  useEffect(() => {
    if (!isDraggingRef.current) {
      setPosition(initialPosition);
      currentPositionRef.current = initialPosition;
    }
  }, [initialPosition.x, initialPosition.y]);

  return {
    isDragging: isDragging && !disabled,
    position,
    hasDragged,
    handleMouseDown,
    handleTouchStart
  };
};
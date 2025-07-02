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

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (disabled) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    setIsDragging(true);
    setHasDragged(false);
    
    dragStartPos.current = { x: e.clientX, y: e.clientY };
    initialPos.current = position;

    const handleMouseMove = (e: MouseEvent) => {
      if (disabled) return;
      
      const deltaX = (e.clientX - dragStartPos.current.x) / zoom;
      const deltaY = (e.clientY - dragStartPos.current.y) / zoom;
      
      // Mark as dragged if moved more than 5 pixels
      if (!hasDragged && (Math.abs(deltaX * zoom) > 5 || Math.abs(deltaY * zoom) > 5)) {
        setHasDragged(true);
      }
      
      setPosition({
        x: initialPos.current.x + deltaX,
        y: initialPos.current.y + deltaY
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      
      if (onDragEnd && !disabled) {
        onDragEnd(position);
      }
      
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [position, onDragEnd, hasDragged, disabled, zoom]);

  // Update position when initialPosition changes (for external updates)
  useEffect(() => {
    setPosition(initialPosition);
  }, [initialPosition.x, initialPosition.y]);

  return {
    isDragging: isDragging && !disabled,
    position,
    hasDragged,
    handleMouseDown
  };
};
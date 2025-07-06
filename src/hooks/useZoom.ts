import { useState, useCallback, useRef } from 'react';

interface UseZoomProps {
  minZoom?: number;
  maxZoom?: number;
  initialZoom?: number;
}

export const useZoom = ({ minZoom = 0.5, maxZoom = 3, initialZoom = 1 }: UseZoomProps = {}) => {
  const [zoom, setZoom] = useState(initialZoom);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const isPanning = useRef(false);
  const lastPanPoint = useRef({ x: 0, y: 0 });
  const initialDistance = useRef(0);
  const initialZoomRef = useRef(zoom);

  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setZoom(prevZoom => Math.min(maxZoom, Math.max(minZoom, prevZoom + delta)));
  }, [minZoom, maxZoom]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 1 || e.ctrlKey) { // Middle mouse button or Ctrl+click for panning
      e.preventDefault();
      isPanning.current = true;
      lastPanPoint.current = { x: e.clientX, y: e.clientY };
    }
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (isPanning.current) {
      const deltaX = e.clientX - lastPanPoint.current.x;
      const deltaY = e.clientY - lastPanPoint.current.y;
      
      setPanOffset(prev => ({
        x: prev.x + deltaX,
        y: prev.y + deltaY
      }));
      
      lastPanPoint.current = { x: e.clientX, y: e.clientY };
    }
  }, []);

  const handleMouseUp = useCallback(() => {
    isPanning.current = false;
  }, []);

  const zoomIn = useCallback(() => {
    setZoom(prevZoom => Math.min(maxZoom, prevZoom + 0.2));
  }, [maxZoom]);

  const zoomOut = useCallback(() => {
    setZoom(prevZoom => Math.max(minZoom, prevZoom - 0.2));
  }, [minZoom]);

  const resetZoom = useCallback(() => {
    setZoom(initialZoom);
    setPanOffset({ x: 0, y: 0 });
  }, [initialZoom]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      // Single touch - panning
      isPanning.current = true;
      lastPanPoint.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    } else if (e.touches.length === 2) {
      // Two touches - zooming
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const distance = Math.sqrt(
        Math.pow(touch2.clientX - touch1.clientX, 2) +
        Math.pow(touch2.clientY - touch1.clientY, 2)
      );
      initialDistance.current = distance;
      initialZoomRef.current = zoom;
    }
  }, [zoom]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (e.touches.length === 1 && isPanning.current) {
      // Single touch - panning
      const touch = e.touches[0];
      const deltaX = touch.clientX - lastPanPoint.current.x;
      const deltaY = touch.clientY - lastPanPoint.current.y;

      setPanOffset(prev => ({
        x: prev.x + deltaX,
        y: prev.y + deltaY
      }));

      lastPanPoint.current = { x: touch.clientX, y: touch.clientY };
    } else if (e.touches.length === 2) {
      // Two touches - zooming
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const distance = Math.sqrt(
        Math.pow(touch2.clientX - touch1.clientX, 2) +
        Math.pow(touch2.clientY - touch1.clientY, 2)
      );

      const scale = distance / initialDistance.current;
      const newZoom = Math.min(maxZoom, Math.max(minZoom, initialZoomRef.current * scale));

      setZoom(newZoom);
    }
  }, [zoom, minZoom, maxZoom]);

  const handleTouchEnd = useCallback(() => {
    isPanning.current = false;
    initialDistance.current = 0;
  }, []);

  return {
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
    resetZoom
  };
};

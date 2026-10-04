import { useCallback, useEffect, useRef, useState } from "react";
import {
  MAX_ZOOM,
  MIN_ZOOM,
  centerOn,
  screenToWorld,
  type Camera,
  type Size,
} from "@/lib/board-geometry";

type CameraUpdate = Camera | ((camera: Camera) => Camera);

function readStoredCamera(key: string): Camera | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<Camera>;
    const { x, y, zoom } = value;
    if (
      typeof x === "number" &&
      typeof y === "number" &&
      typeof zoom === "number" &&
      Number.isFinite(x) &&
      Number.isFinite(y) &&
      zoom >= MIN_ZOOM &&
      zoom <= MAX_ZOOM
    ) {
      return { x, y, zoom };
    }
  } catch {}
  return null;
}

/**
 * Camera (pan + zoom) for a board. Remembered per board in this browser.
 * `cameraRef` always holds the latest value, for use inside event handlers.
 * Must run client-side only (reads localStorage during initialization).
 */
export function useCamera(boardId: string, getInitial: () => Camera) {
  const storageKey = `collaboard:camera:${boardId}`;
  const [camera, setCameraState] = useState<Camera>(
    () => readStoredCamera(storageKey) ?? getInitial()
  );
  const cameraRef = useRef(camera);
  const animationFrame = useRef<number | null>(null);

  const apply = useCallback((next: Camera) => {
    cameraRef.current = next;
    setCameraState(next);
  }, []);

  const stopAnimation = useCallback(() => {
    if (animationFrame.current !== null) {
      cancelAnimationFrame(animationFrame.current);
      animationFrame.current = null;
    }
  }, []);

  /** Set the camera immediately (cancels any running animation). */
  const setCamera = useCallback(
    (update: CameraUpdate) => {
      stopAnimation();
      apply(typeof update === "function" ? update(cameraRef.current) : update);
    },
    [apply, stopAnimation]
  );

  /**
   * Smoothly move to a camera. Interpolates the world point at the center of
   * the screen linearly and the zoom geometrically, so zooms look anchored.
   */
  const animateCamera = useCallback(
    (update: CameraUpdate, viewport: Size, duration = 240) => {
      stopAnimation();
      const from = cameraRef.current;
      const to = typeof update === "function" ? update(from) : update;
      const screenCenter = { x: viewport.width / 2, y: viewport.height / 2 };
      const fromCenter = screenToWorld(screenCenter, from);
      const toCenter = screenToWorld(screenCenter, to);
      const start = performance.now();

      const step = (now: number) => {
        const t = Math.min(1, (now - start) / duration);
        const eased = 1 - Math.pow(1 - t, 3);
        const zoom = from.zoom * Math.pow(to.zoom / from.zoom, eased);
        const center = {
          x: fromCenter.x + (toCenter.x - fromCenter.x) * eased,
          y: fromCenter.y + (toCenter.y - fromCenter.y) * eased,
        };
        apply(t < 1 ? centerOn(center, zoom, viewport) : to);
        animationFrame.current = t < 1 ? requestAnimationFrame(step) : null;
      };
      animationFrame.current = requestAnimationFrame(step);
    },
    [apply, stopAnimation]
  );

  // Remember the view for next time (debounced).
  useEffect(() => {
    const timeout = setTimeout(() => {
      try {
        localStorage.setItem(storageKey, JSON.stringify(camera));
      } catch {}
    }, 300);
    return () => clearTimeout(timeout);
  }, [camera, storageKey]);

  useEffect(() => stopAnimation, [stopAnimation]);

  return { camera, cameraRef, setCamera, animateCamera };
}

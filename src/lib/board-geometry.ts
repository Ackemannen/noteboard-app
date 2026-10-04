import { NOTE_SIZE, type Note } from "@/lib/notes";

export type Point = { x: number; y: number };
export type Size = { width: number; height: number };
export type Rect = { minX: number; minY: number; maxX: number; maxY: number };

/**
 * The view onto the board. A world point maps to the screen as
 * `screen = world * zoom + offset`, where offset is in screen pixels
 * relative to the canvas element's top-left corner.
 */
export type Camera = { x: number; y: number; zoom: number };

export const MIN_ZOOM = 0.15;
export const MAX_ZOOM = 3;

export const clampZoom = (zoom: number) =>
  Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));

export const screenToWorld = (point: Point, camera: Camera): Point => ({
  x: (point.x - camera.x) / camera.zoom,
  y: (point.y - camera.y) / camera.zoom,
});

export const worldToScreen = (point: Point, camera: Camera): Point => ({
  x: point.x * camera.zoom + camera.x,
  y: point.y * camera.zoom + camera.y,
});

/** Zoom to `zoom` while keeping the world point under `anchor` (screen) fixed. */
export function zoomAt(camera: Camera, anchor: Point, zoom: number): Camera {
  const nextZoom = clampZoom(zoom);
  const world = screenToWorld(anchor, camera);
  return {
    zoom: nextZoom,
    x: anchor.x - world.x * nextZoom,
    y: anchor.y - world.y * nextZoom,
  };
}

/** Camera that puts `world` at the center of a viewport of `size`. */
export function centerOn(world: Point, zoom: number, size: Size): Camera {
  return {
    zoom,
    x: size.width / 2 - world.x * zoom,
    y: size.height / 2 - world.y * zoom,
  };
}

/** The part of the board currently visible, in world coordinates. */
export function visibleWorldRect(camera: Camera, size: Size): Rect {
  const topLeft = screenToWorld({ x: 0, y: 0 }, camera);
  const bottomRight = screenToWorld({ x: size.width, y: size.height }, camera);
  return {
    minX: topLeft.x,
    minY: topLeft.y,
    maxX: bottomRight.x,
    maxY: bottomRight.y,
  };
}

export function noteRect(note: Pick<Note, "x" | "y">): Rect {
  const half = NOTE_SIZE / 2;
  return {
    minX: note.x - half,
    minY: note.y - half,
    maxX: note.x + half,
    maxY: note.y + half,
  };
}

export function rectFromPoints(a: Point, b: Point): Rect {
  return {
    minX: Math.min(a.x, b.x),
    minY: Math.min(a.y, b.y),
    maxX: Math.max(a.x, b.x),
    maxY: Math.max(a.y, b.y),
  };
}

export function unionRects(rects: Rect[]): Rect | null {
  if (rects.length === 0) return null;
  return rects.reduce((acc, r) => ({
    minX: Math.min(acc.minX, r.minX),
    minY: Math.min(acc.minY, r.minY),
    maxX: Math.max(acc.maxX, r.maxX),
    maxY: Math.max(acc.maxY, r.maxY),
  }));
}

export function notesBounds(notes: Pick<Note, "x" | "y">[]): Rect | null {
  return unionRects(notes.map(noteRect));
}

export const rectsIntersect = (a: Rect, b: Rect) =>
  a.minX <= b.maxX && a.maxX >= b.minX && a.minY <= b.maxY && a.maxY >= b.minY;

export const rectWidth = (r: Rect) => r.maxX - r.minX;
export const rectHeight = (r: Rect) => r.maxY - r.minY;

export function padRect(r: Rect, padding: number): Rect {
  return {
    minX: r.minX - padding,
    minY: r.minY - padding,
    maxX: r.maxX + padding,
    maxY: r.maxY + padding,
  };
}

export type Insets = { top: number; right: number; bottom: number; left: number };

/**
 * Camera that fits `rect` inside a viewport of `size` (never zooming past
 * `maxZoom`), keeping clear of `insets` such as floating toolbars.
 */
export function fitRect(
  rect: Rect,
  size: Size,
  {
    insets = { top: 80, right: 80, bottom: 80, left: 80 },
    maxZoom = 1,
  }: { insets?: Insets; maxZoom?: number } = {}
): Camera {
  const width = Math.max(1, rectWidth(rect));
  const height = Math.max(1, rectHeight(rect));
  const available = {
    width: Math.max(1, size.width - insets.left - insets.right),
    height: Math.max(1, size.height - insets.top - insets.bottom),
  };
  const zoom = clampZoom(
    Math.min(maxZoom, available.width / width, available.height / height)
  );
  const camera = centerOn(
    { x: rect.minX + width / 2, y: rect.minY + height / 2 },
    zoom,
    available
  );
  return { ...camera, x: camera.x + insets.left, y: camera.y + insets.top };
}

export const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
export const midpoint = (a: Point, b: Point): Point => ({
  x: (a.x + b.x) / 2,
  y: (a.y + b.y) / 2,
});

/**
 * The board's fixed size in world units, centered on the origin. 3:2, the
 * same shape as the minimap, so the map shows the whole board at one scale.
 * (About 37 × 25 notes.)
 */
export const BOARD_RECT: Rect = { minX: -3600, minY: -2400, maxX: 3600, maxY: 2400 };

/** Screen pixels the view may scroll past the board's edge (so edge notes clear the toolbars). */
const EDGE_OVERSCROLL = 96;

/**
 * Keep the view on the board: no zooming out past "whole board visible" and
 * no panning beyond its edges. When the board is smaller than the screen on
 * an axis, it's centered on that axis.
 */
export function clampCamera(camera: Camera, size: Size, board: Rect = BOARD_RECT): Camera {
  // Zoomed all the way out, the whole board fits with a little room for its frame.
  const fitZoom = 0.9 * Math.min(size.width / rectWidth(board), size.height / rectHeight(board));
  const zoom = Math.max(clampZoom(camera.zoom), fitZoom);
  const axis = (offset: number, screen: number, min: number, max: number) => {
    const length = (max - min) * zoom;
    if (length <= screen) return (screen - length) / 2 - min * zoom;
    return Math.min(-min * zoom + EDGE_OVERSCROLL, Math.max(screen - max * zoom - EDGE_OVERSCROLL, offset));
  };
  return {
    zoom,
    x: axis(camera.x, size.width, board.minX, board.maxX),
    y: axis(camera.y, size.height, board.minY, board.maxY),
  };
}

/** Keep a note's center far enough inside the board that the whole note stays on it. */
export function clampToBoard(point: Point, board: Rect = BOARD_RECT): Point {
  const half = NOTE_SIZE / 2;
  return {
    x: Math.min(board.maxX - half, Math.max(board.minX + half, point.x)),
    y: Math.min(board.maxY - half, Math.max(board.minY + half, point.y)),
  };
}

"use client";

import { useRef, type PointerEvent as ReactPointerEvent } from "react";
import { NOTE_SIZE, noteColor, type Note } from "@/lib/notes";
import {
  BOARD_RECT,
  centerOn,
  rectHeight,
  rectWidth,
  visibleWorldRect,
  type Camera,
  type Point,
  type Size,
} from "@/lib/board-geometry";

interface MinimapProps {
  notes: Note[];
  camera: Camera;
  viewport: Size;
  width: number;
  height: number;
  onCameraChange: (camera: Camera) => void;
}

/**
 * The whole board at a fixed scale, with a frame showing what's on screen.
 * Click to jump there, or drag the frame to move around. Because the board has
 * a fixed size, the map never rescales: only the frame moves.
 */
export default function Minimap({
  notes,
  camera,
  viewport,
  width,
  height,
  onCameraChange,
}: MinimapProps) {
  const scale = Math.min(width / rectWidth(BOARD_RECT), height / rectHeight(BOARD_RECT));
  const offset = {
    x: (width - rectWidth(BOARD_RECT) * scale) / 2 - BOARD_RECT.minX * scale,
    y: (height - rectHeight(BOARD_RECT) * scale) / 2 - BOARD_RECT.minY * scale,
  };
  const toMap = (p: Point): Point => ({ x: p.x * scale + offset.x, y: p.y * scale + offset.y });

  // Visible area, clipped to the board (it can be larger when zoomed all the way out).
  const view = visibleWorldRect(camera, viewport);
  const viewTopLeft = toMap({
    x: Math.max(view.minX, BOARD_RECT.minX),
    y: Math.max(view.minY, BOARD_RECT.minY),
  });
  const viewBottomRight = toMap({
    x: Math.min(view.maxX, BOARD_RECT.maxX),
    y: Math.min(view.maxY, BOARD_RECT.maxY),
  });
  const frame = {
    x: viewTopLeft.x,
    y: viewTopLeft.y,
    width: Math.max(4, viewBottomRight.x - viewTopLeft.x),
    height: Math.max(4, viewBottomRight.y - viewTopLeft.y),
  };
  const board = { ...toMap({ x: BOARD_RECT.minX, y: BOARD_RECT.minY }), width: rectWidth(BOARD_RECT) * scale, height: rectHeight(BOARD_RECT) * scale };

  /** Offset between the pointer and the view's center while dragging (handlers only). */
  const grab = useRef<Point | null>(null);

  const toWorld = (e: ReactPointerEvent<SVGSVGElement>): Point => {
    const rect = e.currentTarget.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left - offset.x) / scale,
      y: (e.clientY - rect.top - offset.y) / scale,
    };
  };

  const moveTo = (world: Point) => {
    const g = grab.current ?? { x: 0, y: 0 };
    onCameraChange(centerOn({ x: world.x - g.x, y: world.y - g.y }, camera.zoom, viewport));
  };

  const handlePointerDown = (e: ReactPointerEvent<SVGSVGElement>) => {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    const world = toWorld(e);
    const insideView =
      world.x >= view.minX && world.x <= view.maxX && world.y >= view.minY && world.y <= view.maxY;
    // Grabbing the frame keeps it under the pointer; clicking elsewhere jumps there.
    grab.current = insideView
      ? { x: world.x - (view.minX + view.maxX) / 2, y: world.y - (view.minY + view.maxY) / 2 }
      : { x: 0, y: 0 };
    moveTo(world);
  };

  const noteSize = Math.max(2.5, NOTE_SIZE * scale);

  return (
    <svg
      width={width}
      height={height}
      className="block cursor-pointer touch-none rounded-lg bg-[#2a1d14] dark:bg-[#140e0a]"
      onPointerDown={handlePointerDown}
      onPointerMove={(e) => grab.current && moveTo(toWorld(e))}
      onPointerUp={() => (grab.current = null)}
      onPointerCancel={() => (grab.current = null)}
      role="img"
      aria-label="Board overview. Click or drag to move the view."
    >
      {/* The board */}
      <rect {...board} rx={3} fill="#c99a62" />
      <rect {...board} rx={3} className="hidden fill-stone-950/45 dark:block" />

      {notes.map((note) => {
        const p = toMap(note);
        return (
          <rect
            key={note.id}
            x={p.x - noteSize / 2}
            y={p.y - noteSize / 2}
            width={noteSize}
            height={noteSize}
            rx={Math.min(1.5, noteSize / 6)}
            fill={noteColor(note.color).hex}
            stroke="rgba(0,0,0,0.3)"
            strokeWidth={0.5}
            transform={`rotate(${note.rotation} ${p.x} ${p.y})`}
          />
        );
      })}

      {/* Dim everything outside the visible area */}
      <path
        fillRule="evenodd"
        fill="rgba(20,12,5,0.32)"
        pointerEvents="none"
        d={`M0 0H${width}V${height}H0Z M${frame.x} ${frame.y}h${frame.width}v${frame.height}h${-frame.width}Z`}
      />
      <rect
        {...frame}
        rx={2}
        fill="rgba(37,99,235,0.08)"
        stroke="#3b82f6"
        strokeWidth={1.75}
        pointerEvents="none"
      />
    </svg>
  );
}

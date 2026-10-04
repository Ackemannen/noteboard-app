"use client";

import { useState, type PointerEvent as ReactPointerEvent } from "react";
import { NOTE_SIZE, noteColor, type Note } from "@/lib/notes";
import {
  centerOn,
  notesBounds,
  padRect,
  rectHeight,
  rectWidth,
  unionRects,
  visibleWorldRect,
  type Camera,
  type Point,
  type Rect,
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

type Mapping = { scale: number; offsetX: number; offsetY: number };

function computeMapping(bounds: Rect, width: number, height: number): Mapping {
  const scale = Math.min(width / rectWidth(bounds), height / rectHeight(bounds));
  return {
    scale,
    offsetX: (width - rectWidth(bounds) * scale) / 2 - bounds.minX * scale,
    offsetY: (height - rectHeight(bounds) * scale) / 2 - bounds.minY * scale,
  };
}

/**
 * Overview of the whole board: every note plus a frame showing the part
 * that's currently on screen. Click or drag on it to move the view.
 */
export default function Minimap({
  notes,
  camera,
  viewport,
  width,
  height,
  onCameraChange,
}: MinimapProps) {
  const view = visibleWorldRect(camera, viewport);
  const content = notesBounds(notes);
  const bounds = padRect(
    unionRects(content ? [view, content] : [view])!,
    Math.max(rectWidth(view), rectHeight(view)) * 0.15
  );
  const liveMapping = computeMapping(bounds, width, height);

  // While dragging, keep the mapping from when the drag started; otherwise the
  // map would rescale under the pointer as the view frame moves.
  const [drag, setDrag] = useState<{ mapping: Mapping; grabOffset: Point } | null>(
    null
  );
  const mapping = drag?.mapping ?? liveMapping;

  const toMap = (x: number, y: number) => ({
    x: x * mapping.scale + mapping.offsetX,
    y: y * mapping.scale + mapping.offsetY,
  });

  const toWorld = (e: ReactPointerEvent<SVGSVGElement>, m: Mapping): Point => {
    const rect = e.currentTarget.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left - m.offsetX) / m.scale,
      y: (e.clientY - rect.top - m.offsetY) / m.scale,
    };
  };

  const moveTo = (world: Point, grabOffset: Point) =>
    onCameraChange(
      centerOn(
        { x: world.x - grabOffset.x, y: world.y - grabOffset.y },
        camera.zoom,
        viewport
      )
    );

  const handlePointerDown = (e: ReactPointerEvent<SVGSVGElement>) => {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    const world = toWorld(e, liveMapping);
    const insideView =
      world.x >= view.minX &&
      world.x <= view.maxX &&
      world.y >= view.minY &&
      world.y <= view.maxY;
    // Grabbing the frame keeps it under the pointer; clicking elsewhere jumps there.
    const grabOffset = insideView
      ? {
          x: world.x - (view.minX + view.maxX) / 2,
          y: world.y - (view.minY + view.maxY) / 2,
        }
      : { x: 0, y: 0 };
    setDrag({ mapping: liveMapping, grabOffset });
    moveTo(world, grabOffset);
  };

  const handlePointerMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (!drag) return;
    moveTo(toWorld(e, drag.mapping), drag.grabOffset);
  };

  const endDrag = () => {
    setDrag(null);
  };

  const viewTopLeft = toMap(view.minX, view.minY);
  const viewSize = {
    width: rectWidth(view) * mapping.scale,
    height: rectHeight(view) * mapping.scale,
  };
  const noteSize = Math.max(2, NOTE_SIZE * mapping.scale);

  return (
    <svg
      width={width}
      height={height}
      className="block cursor-pointer touch-none rounded-lg bg-[#c99a62]"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      role="img"
      aria-label="Board overview. Click or drag to move the view."
    >
      {notes.map((note) => {
        const p = toMap(note.x, note.y);
        return (
          <rect
            key={note.id}
            x={p.x - noteSize / 2}
            y={p.y - noteSize / 2}
            width={noteSize}
            height={noteSize}
            rx={Math.min(2, noteSize / 6)}
            fill={noteColor(note.color).hex}
            stroke="rgba(0,0,0,0.25)"
            strokeWidth={0.75}
            transform={`rotate(${note.rotation} ${p.x} ${p.y})`}
          />
        );
      })}

      {/* Dim everything outside the visible area */}
      <path
        fillRule="evenodd"
        fill="rgba(30,20,10,0.28)"
        pointerEvents="none"
        d={`M0 0H${width}V${height}H0Z M${viewTopLeft.x} ${viewTopLeft.y}h${viewSize.width}v${viewSize.height}h${-viewSize.width}Z`}
      />
      <rect
        x={viewTopLeft.x}
        y={viewTopLeft.y}
        width={viewSize.width}
        height={viewSize.height}
        rx={3}
        fill="none"
        stroke="#2563eb"
        strokeWidth={2}
        pointerEvents="none"
      />
    </svg>
  );
}

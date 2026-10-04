"use client";

import { Map as MapIcon, Maximize, Minus, Plus } from "lucide-react";
import type { Note } from "@/lib/notes";
import type { Camera, Size } from "@/lib/board-geometry";
import { cn } from "@/lib/utils";
import Minimap from "./Minimap";

const STORAGE_KEY = "collaboard:minimap-open";

/** Whether the map starts open: the last choice, else open on larger screens. */
export function readMinimapOpen(viewport: Size) {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored !== null) return stored === "1";
  } catch {}
  return viewport.width >= 640;
}

export function saveMinimapOpen(open: boolean) {
  try {
    localStorage.setItem(STORAGE_KEY, open ? "1" : "0");
  } catch {}
}

export function minimapSize(viewport: Size) {
  return viewport.width < 640 ? { width: 168, height: 112 } : { width: 216, height: 144 };
}

/** Distance from the bottom of the window to the top of the panel. */
export function navigatorPanelHeight(viewport: Size, open: boolean) {
  const controls = 16 + 12 + 32; // bottom margin + padding + button row
  return open ? controls + minimapSize(viewport).height + 6 : controls;
}

interface NavigatorPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  notes: Note[];
  camera: Camera;
  viewport: Size;
  onCameraChange: (camera: Camera) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetZoom: () => void;
  onFit: () => void;
}

const iconButton =
  "grid size-8 place-items-center rounded-md text-gray-700 transition-colors hover:bg-gray-100 active:bg-gray-200 disabled:opacity-40";

export default function NavigatorPanel({
  open,
  onOpenChange,
  notes,
  camera,
  viewport,
  onCameraChange,
  onZoomIn,
  onZoomOut,
  onResetZoom,
  onFit,
}: NavigatorPanelProps) {
  const mapSize = minimapSize(viewport);

  const toggle = () => {
    saveMinimapOpen(!open);
    onOpenChange(!open);
  };

  return (
    <div className="fixed bottom-4 right-4 z-40 rounded-xl border border-black/5 bg-white/90 p-1.5 shadow-lg backdrop-blur-sm">
      {open && (
        <div className="mb-1.5">
          <Minimap
            notes={notes}
            camera={camera}
            viewport={viewport}
            width={mapSize.width}
            height={mapSize.height}
            onCameraChange={onCameraChange}
          />
        </div>
      )}
      <div className="flex items-center gap-0.5">
        <button className={iconButton} onClick={onZoomOut} title="Zoom out (−)">
          <Minus className="size-4" />
        </button>
        <button
          className="h-8 min-w-14 rounded-md px-1.5 text-xs font-medium tabular-nums text-gray-700 hover:bg-gray-100"
          onClick={onResetZoom}
          title="Reset to 100% (0)"
        >
          {Math.round(camera.zoom * 100)}%
        </button>
        <button className={iconButton} onClick={onZoomIn} title="Zoom in (+)">
          <Plus className="size-4" />
        </button>
        <div className="mx-1 h-5 w-px bg-gray-200" />
        <button
          className={iconButton}
          onClick={onFit}
          disabled={notes.length === 0}
          title="Fit all notes (F)"
        >
          <Maximize className="size-4" />
        </button>
        <button
          className={cn(iconButton, open && "bg-blue-50 text-blue-600 hover:bg-blue-100")}
          onClick={toggle}
          title={open ? "Hide map" : "Show map"}
          aria-pressed={open}
        >
          <MapIcon className="size-4" />
        </button>
      </div>
    </div>
  );
}

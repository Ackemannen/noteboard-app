import React from "react";
import { ZoomIn, ZoomOut, RotateCcw } from "lucide-react";

interface ZoomControlsProps {
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
}

const ZoomControls: React.FC<ZoomControlsProps> = ({
  zoom,
  onZoomIn,
  onZoomOut,
  onReset,
}) => {
  return (
    <div className="absolute bottom-4 right-4 bg-white/90 backdrop-blur-sm p-2 rounded-lg shadow-lg z-10 flex flex-col gap-2">
      <button
        onClick={onZoomIn}
        className="p-2 hover:bg-gray-100 rounded-md transition-colors"
        title="Zoom In"
      >
        <ZoomIn size={20} />
      </button>

      <div className="text-xs text-center text-gray-600 px-2">
        {Math.round(zoom * 100)}%
      </div>

      <button
        onClick={onZoomOut}
        className="p-2 hover:bg-gray-100 rounded-md transition-colors"
        title="Zoom Out"
      >
        <ZoomOut size={20} />
      </button>

      <button
        onClick={onReset}
        className="p-2 hover:bg-gray-100 rounded-md transition-colors border-t border-gray-200 mt-1"
        title="Reset View"
      >
        <RotateCcw size={16} />
      </button>
    </div>
  );
};

export default ZoomControls;

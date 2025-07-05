import React, { useState } from "react";
import { Info, Minimize2 } from "lucide-react";

interface InfoWindowProps {
  selectedCount: number;
  totalNotes: number;
}

const InfoWindow: React.FC<InfoWindowProps> = ({
  selectedCount,
  totalNotes,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(true);

  if (isCollapsed) {
    return (
      <button
        onClick={() => setIsCollapsed(false)}
        className="bg-blue-500 hover:bg-blue-600 text-white p-3 rounded-full shadow-lg transition-colors"
        title="Show info"
      >
        <Info size={20} />
      </button>
    );
  }

  return (
    <div className="z-30 bg-white/95 backdrop-blur-sm p-4 rounded-lg shadow-lg max-w-sm">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold text-amber-900 flex items-center gap-2">
          <Info size={18} />
          Collaboard
        </h2>
        <button
          onClick={() => setIsCollapsed(true)}
          className="p-1 hover:bg-gray-100 rounded-md transition-colors cursor-pointer"
          title="Collapse"
        >
          <Minimize2 size={16} />
        </button>
      </div>

      <div className="space-y-2 text-sm">
        <div className="flex justify-between text-amber-800">
          <span>Total Notes:</span>
          <span className="font-medium">{totalNotes}</span>
        </div>

        {selectedCount > 0 && (
          <div className="flex justify-between text-blue-600">
            <span>Selected:</span>
            <span className="font-medium">{selectedCount}</span>
          </div>
        )}
      </div>

      <div className="mt-3 pt-3 border-t border-gray-200">
        <p className="text-xs text-amber-700 mb-2">
          <strong>Click</strong> anywhere to create a note
        </p>
        <p className="text-xs text-amber-700 mb-2">
          <strong>Shift + drag</strong> to select multiple notes
        </p>
        <p className="text-xs text-amber-700 mb-2">
          <strong>Drag selected notes</strong> to move them together
        </p>
        <p className="text-xs text-amber-700">
          <strong>Mouse wheel:</strong> zoom • <strong>Middle-click:</strong>{" "}
          pan
        </p>
      </div>
    </div>
  );
};

export default InfoWindow;

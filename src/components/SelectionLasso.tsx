import React from "react";

interface Position {
  x: number;
  y: number;
}

interface SelectionLassoProps {
  path: Position[];
  zoom: number;
  panOffset: Position;
}

const SelectionLasso: React.FC<SelectionLassoProps> = ({
  path,
  zoom,
  panOffset,
}) => {
  if (path.length < 2) return null;

  const pathString =
    path
      .map((point, index) => {
        const x = point.x * zoom + panOffset.x;
        const y = point.y * zoom + panOffset.y;
        return `${index === 0 ? "M" : "L"} ${x} ${y}`;
      })
      .join(" ") + " Z";

  return (
    <svg
      className="absolute inset-0 pointer-events-none z-20"
      style={{ overflow: "visible" }}
    >
      <path
        d={pathString}
        fill="rgba(59, 130, 246, 0.1)"
        stroke="rgb(59, 130, 246)"
        strokeWidth="2"
        strokeDasharray="5,5"
      />
    </svg>
  );
};

export default SelectionLasso;

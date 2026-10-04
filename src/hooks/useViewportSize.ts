import { useEffect, useState } from "react";
import type { Size } from "@/lib/board-geometry";

const readSize = (): Size => ({
  width: window.innerWidth,
  height: window.innerHeight,
});

/** Size of the browser window. Client-side only. */
export function useViewportSize(): Size {
  const [size, setSize] = useState(readSize);

  useEffect(() => {
    const onResize = () => setSize(readSize());
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return size;
}

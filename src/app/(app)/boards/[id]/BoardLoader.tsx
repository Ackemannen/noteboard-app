"use client";

import dynamic from "next/dynamic";
import type { BoardProps } from "./Board";

/**
 * The board is a pure client-side canvas: it sizes itself to the window and
 * restores the saved view from localStorage, so it isn't server-rendered.
 */
const Board = dynamic(() => import("./Board"), {
  ssr: false,
  loading: () => (
    <div
      className="fixed inset-0 bg-[#c08a4f]"
      style={{ backgroundImage: "url(/cork.webp)", backgroundSize: "1024px 680px" }}
    >
      <div className="absolute inset-0 grid place-items-center">
        <div className="rounded-full bg-white/80 px-4 py-2 text-sm font-medium text-amber-900 shadow">
          Loading board…
        </div>
      </div>
    </div>
  ),
});

export default function BoardLoader(props: BoardProps) {
  return <Board {...props} />;
}

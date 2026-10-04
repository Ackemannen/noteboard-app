"use client";

import { useMemo, useState } from "react";
import { Search, StickyNote } from "lucide-react";
import { toast } from "sonner";
import ConfirmDialog from "@/components/ConfirmDialog";
import type { ThumbnailNote } from "@/components/board/BoardThumbnail";
import { cn } from "@/lib/utils";
import { deleteBoard, leaveBoard, renameBoard } from "./actions";
import BoardCard from "./BoardCard";

export type BoardSummary = {
  id: string;
  name: string;
  createdAt: string;
  lastActivity: string;
  isOwner: boolean;
  memberCount: number;
  noteCount: number;
  previewNotes: ThumbnailNote[];
};

type Filter = "all" | "mine" | "shared";
type Sort = "recent" | "name" | "created";

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "mine", label: "Mine" },
  { value: "shared", label: "Shared" },
];

export default function BoardList({ boards }: { boards: BoardSummary[] }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<Sort>("recent");
  const [pendingRemoval, setPendingRemoval] = useState<BoardSummary | null>(null);
  const [isRemoving, setIsRemoving] = useState(false);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return boards
      .filter((board) => (filter === "mine" ? board.isOwner : filter === "shared" ? !board.isOwner : true))
      .filter((board) => !q || board.name.toLowerCase().includes(q))
      .sort((a, b) => {
        if (sort === "name") return a.name.localeCompare(b.name);
        if (sort === "created") return b.createdAt.localeCompare(a.createdAt);
        return b.lastActivity.localeCompare(a.lastActivity);
      });
  }, [boards, query, filter, sort]);

  const copyShareLink = (boardId: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/boards/${boardId}`);
    toast.success("Share link copied");
  };

  const handleRename = async (board: BoardSummary, name: string) => {
    if (name.trim() === board.name) return true;
    const result = await renameBoard(board.id, name);
    if (!result.ok) toast.error(result.error);
    return result.ok;
  };

  const confirmRemoval = async () => {
    if (!pendingRemoval) return;
    const board = pendingRemoval;
    setIsRemoving(true);
    const result = board.isOwner ? await deleteBoard(board.id) : await leaveBoard(board.id);
    setIsRemoving(false);
    setPendingRemoval(null);
    if (result.ok) toast.success(board.isOwner ? `Deleted "${board.name}"` : `Left "${board.name}"`);
    else toast.error(result.error);
  };

  if (boards.length === 0) return <EmptyState />;

  return (
    <section className="mt-10">
      {/* Controls */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex self-start rounded-xl border border-border bg-card p-1 shadow-sm" role="tablist">
          {FILTERS.map(({ value, label }) => (
            <button
              key={value}
              role="tab"
              aria-selected={filter === value}
              onClick={() => setFilter(value)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                filter === value ? "bg-foreground text-background shadow-sm" : "text-foreground/75 hover:bg-muted"
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <label className="relative flex-1 md:w-64 md:flex-none">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search boards"
              aria-label="Search boards"
              className="h-10 w-full rounded-xl border border-border bg-card pl-9 pr-3 text-sm shadow-sm outline-none focus:ring-2 focus:ring-blue-500"
            />
          </label>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as Sort)}
            aria-label="Sort boards"
            className="h-10 rounded-xl border border-border bg-card px-3 text-sm text-foreground/80 shadow-sm outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="recent">Recently active</option>
            <option value="name">Name</option>
            <option value="created">Newest</option>
          </select>
        </div>
      </div>

      {/* Grid */}
      {visible.length > 0 ? (
        <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {visible.map((board) => (
            <BoardCard
              key={board.id}
              board={board}
              onShare={() => copyShareLink(board.id)}
              onRename={(name) => handleRename(board, name)}
              onRemove={() => setPendingRemoval(board)}
            />
          ))}
        </div>
      ) : (
        <p className="mt-16 text-center text-sm text-muted-foreground">
          No boards match{query ? ` “${query}”` : " this filter"}.
        </p>
      )}

      <ConfirmDialog
        open={pendingRemoval !== null}
        title={pendingRemoval?.isOwner ? "Delete board?" : "Leave board?"}
        description={
          pendingRemoval?.isOwner ? (
            <>
              <strong className="text-foreground">{pendingRemoval.name}</strong> and all of its
              notes will be deleted for everyone. This can’t be undone.
            </>
          ) : (
            <>
              You’ll lose access to{" "}
              <strong className="text-foreground">{pendingRemoval?.name}</strong>. You can rejoin
              with its share link.
            </>
          )
        }
        confirmLabel={pendingRemoval?.isOwner ? "Delete board" : "Leave board"}
        destructive
        pending={isRemoving}
        onConfirm={confirmRemoval}
        onCancel={() => setPendingRemoval(null)}
      />
    </section>
  );
}

function EmptyState() {
  return (
    <div className="mt-16 flex flex-col items-center text-center">
      <div className="relative h-28 w-40" aria-hidden="true">
        <div className="absolute left-2 top-4 size-20 -rotate-6 rounded-lg border-2 border-pink-300 bg-pink-200 shadow-md" />
        <div className="absolute right-2 top-2 size-20 rotate-6 rounded-lg border-2 border-blue-300 bg-blue-200 shadow-md" />
        <div className="absolute left-1/2 top-6 grid size-20 -translate-x-1/2 place-items-center rounded-lg border-2 border-yellow-300 bg-yellow-200 shadow-lg">
          <StickyNote className="size-8 text-yellow-700" />
        </div>
      </div>
      <h2 className="mt-6 text-xl font-semibold text-foreground">No boards yet</h2>
      <p className="mt-2 max-w-sm text-muted-foreground">
        Name your first board above. You can share it with a link so others can pin notes too.
      </p>
    </div>
  );
}

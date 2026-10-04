"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LogOut, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { createBoard, deleteBoard, leaveBoard } from "./actions";

export type BoardSummary = {
  id: string;
  name: string;
  createdAt: string;
  isOwner: boolean;
};

export default function BoardList({ boards }: { boards: BoardSummary[] }) {
  const [newBoardName, setNewBoardName] = useState("");
  const [isCreating, startCreate] = useTransition();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const router = useRouter();

  const handleCreateBoard = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBoardName.trim()) return;

    startCreate(async () => {
      const result = await createBoard(newBoardName);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Board created successfully!");
      setNewBoardName("");
      router.push(`/boards/${result.data.id}`);
    });
  };

  const copyShareLink = (boardId: string) => {
    const url = `${window.location.origin}/boards/${boardId}`;
    navigator.clipboard.writeText(url);
    toast.success("Share link copied to clipboard!");
  };

  const handleRemove = async (board: BoardSummary) => {
    const confirmed = window.confirm(
      board.isOwner
        ? `Delete "${board.name}" and all of its notes for everyone?`
        : `Leave "${board.name}"? You can rejoin with its share link.`
    );
    if (!confirmed) return;

    setPendingId(board.id);
    const result = board.isOwner
      ? await deleteBoard(board.id)
      : await leaveBoard(board.id);
    setPendingId(null);

    if (result.ok) {
      toast.success(board.isOwner ? "Board deleted successfully!" : "Left board");
    } else {
      toast.error(result.error);
    }
  };

  return (
    <>
      <form
        onSubmit={handleCreateBoard}
        className="flex gap-2 max-w-md w-full mx-auto"
      >
        <input
          type="text"
          value={newBoardName}
          onChange={(e) => setNewBoardName(e.target.value)}
          placeholder="Board name..."
          maxLength={100}
          className="flex-1 min-w-0 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          disabled={isCreating}
        />
        <button
          type="submit"
          disabled={!newBoardName.trim() || isCreating}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          {isCreating ? "Creating..." : "Create Board"}
        </button>
      </form>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {boards.map((board) => (
          <div
            key={board.id}
            className={`bg-white p-6 rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow ${
              pendingId === board.id ? "opacity-50 pointer-events-none" : ""
            }`}
          >
            <div className="flex justify-between items-center gap-4">
              <h3 className="text-lg font-semibold mb-2">{board.name}</h3>
              <button
                className="text-gray-500 hover:text-gray-700"
                onClick={() => handleRemove(board)}
                title={board.isOwner ? "Delete board" : "Leave board"}
              >
                {board.isOwner ? (
                  <Trash2 className="w-5 h-5 text-red-500 mb-2 cursor-pointer hover:text-red-800" />
                ) : (
                  <LogOut className="w-5 h-5 text-red-500 mb-2 cursor-pointer hover:text-red-800" />
                )}
              </button>
            </div>
            <p className="text-sm text-gray-500 mb-4">
              Created {new Date(board.createdAt).toLocaleDateString()}
              {!board.isOwner && " · Shared with you"}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => router.push(`/boards/${board.id}`)}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 cursor-pointer"
              >
                Open
              </button>
              <button
                onClick={() => copyShareLink(board.id)}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 cursor-pointer"
              >
                Share
              </button>
            </div>
          </div>
        ))}
      </div>

      {boards.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-500">
            No boards yet. Create your first board above!
          </p>
        </div>
      )}
    </>
  );
}

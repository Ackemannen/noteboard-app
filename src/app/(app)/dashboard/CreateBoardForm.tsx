"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { createBoard } from "./actions";

export default function CreateBoardForm() {
  const [name, setName] = useState("");
  const [isCreating, startCreate] = useTransition();
  const router = useRouter();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    startCreate(async () => {
      const result = await createBoard(name);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Board created");
      setName("");
      router.push(`/boards/${result.data.id}`);
    });
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="flex w-full gap-2 rounded-2xl border border-border bg-card p-2 shadow-sm lg:w-auto lg:min-w-[26rem]"
    >
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Name a new board…"
        aria-label="New board name"
        maxLength={100}
        className="min-w-0 flex-1 rounded-xl px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus:bg-muted"
        disabled={isCreating}
      />
      <button
        type="submit"
        disabled={!name.trim() || isCreating}
        className="flex shrink-0 items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Plus className="size-4" />
        {isCreating ? "Creating…" : "New board"}
      </button>
    </form>
  );
}

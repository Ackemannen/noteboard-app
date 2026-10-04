"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Users } from "lucide-react";
import UserAvatar from "@/components/UserAvatar";
import type { PresenceSession } from "@/hooks/useBoardPresence";
import { cn } from "@/lib/utils";

const MAX_AVATARS = 5;

type PresentUser = PresenceSession & { isYou: boolean };

/** Avatars of everyone currently on the board (one per person, max 5 shown). */
export default function PresenceAvatars({
  sessions,
  className,
}: {
  sessions: PresenceSession[];
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // One entry per person even with several tabs open; you're listed last.
  const users = useMemo(() => {
    const byUser = new Map<string, PresentUser>();
    for (const session of sessions) {
      const existing = byUser.get(session.userId);
      byUser.set(session.userId, {
        ...session,
        isYou: (existing?.isYou ?? false) || session.isSelf,
      });
    }
    return [...byUser.values()].sort((a, b) => Number(a.isYou) - Number(b.isYou));
  }, [sessions]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  if (users.length === 0) return null;

  const shown = users.slice(0, MAX_AVATARS);
  const countLabel = users.length > MAX_AVATARS ? `${MAX_AVATARS}+` : String(users.length);

  return (
    <div ref={ref}>
      <button
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        title={`${users.length} on this board`}
        className={cn("gap-2 pl-2 pr-3 hover:bg-card", className)}
      >
        <span className="flex -space-x-2">
          {shown.map((user) => (
            <span
              key={user.userId}
              className="rounded-full"
              style={{ boxShadow: `0 0 0 2px var(--card), 0 0 0 4px ${user.color}` }}
            >
              <UserAvatar
                name={user.name}
                email={null}
                avatarUrl={user.avatarUrl}
                className="size-6 ring-0"
              />
            </span>
          ))}
        </span>
        <span className="flex items-center gap-1 text-xs font-semibold text-foreground/80">
          <Users className="size-3.5" />
          {countLabel}
        </span>
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-2 w-[min(18rem,calc(100vw-6rem))] rounded-xl border border-border bg-card/95 p-3 shadow-xl backdrop-blur-sm">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            On this board · {users.length}
          </h2>
          <ul className="max-h-72 space-y-1 overflow-y-auto">
            {users.map((user) => (
              <li key={user.userId} className="flex items-center gap-2.5 rounded-lg px-1 py-1">
                <UserAvatar
                  name={user.name}
                  email={null}
                  avatarUrl={user.avatarUrl}
                  className="size-7 ring-0"
                />
                <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                  {user.name}
                  {user.isYou && <span className="text-muted-foreground"> (you)</span>}
                </span>
                <span
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: user.color }}
                  aria-hidden="true"
                />
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

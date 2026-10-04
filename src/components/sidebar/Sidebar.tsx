"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGrid, LogOut, Users } from "lucide-react";
import { signOut } from "@/app/auth/actions";
import Logo from "@/components/Logo";
import UserAvatar from "@/components/UserAvatar";
import { boardAccent, initials } from "@/lib/board-style";
import { cn } from "@/lib/utils";

export type SidebarBoard = { id: string; name: string; isOwner: boolean };
export type SidebarUser = {
  email: string | null;
  name: string | null;
  avatarUrl: string | null;
};

const OPEN_DELAY = 60;
const CLOSE_DELAY = 180;

/**
 * Slim rail that unfolds on hover (or on tap of the logo on touch screens),
 * showing navigation, the user's boards and their account.
 */
export default function Sidebar({
  user,
  boards,
}: {
  user: SidebarUser;
  boards: SidebarBoard[];
}) {
  const pathname = usePathname();
  const [hovered, setHovered] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [focusWithin, setFocusWithin] = useState(false);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const asideRef = useRef<HTMLElement>(null);
  const expanded = hovered || pinned || focusWithin;

  const owned = boards.filter((board) => board.isOwner);
  const shared = boards.filter((board) => !board.isOwner);

  const setHoveredLater = (value: boolean) => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    hoverTimer.current = setTimeout(() => setHovered(value), value ? OPEN_DELAY : CLOSE_DELAY);
  };

  useEffect(() => () => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
  }, []);

  // Tap outside closes a sidebar opened by tapping (touch screens).
  useEffect(() => {
    if (!pinned) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!asideRef.current?.contains(e.target as Node)) setPinned(false);
    };
    window.addEventListener("pointerdown", onPointerDown);
    return () => window.removeEventListener("pointerdown", onPointerDown);
  }, [pinned]);

  const close = () => {
    setPinned(false);
    setHovered(false);
  };

  return (
    <aside
      ref={asideRef}
      aria-label="Main navigation"
      className={cn(
        "fixed inset-y-0 left-0 z-50 flex flex-col overflow-hidden border-r border-black/5 bg-white/95 backdrop-blur-md transition-[width,box-shadow] duration-200 ease-out",
        expanded ? "w-64 shadow-2xl" : "w-14 shadow-sm"
      )}
      onPointerEnter={(e) => e.pointerType === "mouse" && setHoveredLater(true)}
      onPointerLeave={(e) => e.pointerType === "mouse" && setHoveredLater(false)}
      // Keyboard users get the expanded sidebar while tabbing through it.
      onFocus={(e) => {
        if ((e.target as HTMLElement).matches(":focus-visible")) setFocusWithin(true);
      }}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setFocusWithin(false);
      }}
    >
      {/* Brand / touch toggle */}
      <button
        type="button"
        onClick={() => setPinned((value) => !value)}
        className="flex h-16 shrink-0 items-center gap-3 px-2.5 text-left"
        aria-expanded={expanded}
        aria-label={expanded ? "Collapse sidebar" : "Expand sidebar"}
      >
        <Logo size={36} priority />
        <Label expanded={expanded} className="text-lg font-bold text-blue-600">
          Collaboard
        </Label>
      </button>

      <nav className="flex min-h-0 flex-1 flex-col gap-1 px-2">
        <NavItem
          href="/dashboard"
          active={pathname === "/dashboard"}
          expanded={expanded}
          onNavigate={close}
          icon={<LayoutGrid className="size-[18px]" />}
          label="All boards"
        />

        <div className="mt-2 min-h-0 flex-1 overflow-y-auto overflow-x-hidden pb-2 [scrollbar-width:thin]">
          <SectionHeading expanded={expanded}>Your boards</SectionHeading>
          {owned.length === 0 && expanded && (
            <p className="px-2.5 py-1 text-xs text-gray-400">No boards yet</p>
          )}
          {owned.map((board) => (
            <BoardItem
              key={board.id}
              board={board}
              active={pathname === `/boards/${board.id}`}
              expanded={expanded}
              onNavigate={close}
            />
          ))}

          {shared.length > 0 && (
            <>
              <SectionHeading expanded={expanded} icon={<Users className="size-3" />}>
                Shared with you
              </SectionHeading>
              {shared.map((board) => (
                <BoardItem
                  key={board.id}
                  board={board}
                  active={pathname === `/boards/${board.id}`}
                  expanded={expanded}
                  onNavigate={close}
                />
              ))}
            </>
          )}
        </div>
      </nav>

      {/* Account */}
      <div className="flex shrink-0 items-center gap-3 border-t border-black/5 px-2.5 py-3">
        <UserAvatar {...user} />
        <Label expanded={expanded} className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-gray-900">
            {user.name ?? user.email?.split("@")[0] ?? "You"}
          </span>
          {user.email && (
            <span className="block truncate text-xs text-gray-500">{user.email}</span>
          )}
        </Label>
        <form action={signOut} className={cn("transition-opacity", !expanded && "pointer-events-none opacity-0")}>
          <button
            type="submit"
            tabIndex={expanded ? 0 : -1}
            className="grid size-8 place-items-center rounded-lg text-gray-500 transition-colors hover:bg-red-50 hover:text-red-600"
            title="Log out"
            aria-label="Log out"
          >
            <LogOut className="size-4" />
          </button>
        </form>
      </div>
    </aside>
  );
}

function Label({
  expanded,
  className,
  children,
}: {
  expanded: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "whitespace-nowrap transition-opacity duration-150",
        expanded ? "opacity-100 delay-75" : "opacity-0",
        className
      )}
    >
      {children}
    </span>
  );
}

function SectionHeading({
  expanded,
  icon,
  children,
}: {
  expanded: boolean;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="relative mb-1 mt-3 flex h-5 items-center px-2.5">
      {/* Collapsed: a short divider instead of the heading */}
      <div
        className={cn(
          "absolute left-3 right-auto h-px w-6 bg-gray-200 transition-opacity",
          expanded ? "opacity-0" : "opacity-100"
        )}
      />
      <Label
        expanded={expanded}
        className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-gray-400"
      >
        {icon}
        {children}
      </Label>
    </div>
  );
}

function NavItem({
  href,
  active,
  expanded,
  icon,
  label,
  onNavigate,
}: {
  href: string;
  active: boolean;
  expanded: boolean;
  icon: React.ReactNode;
  label: string;
  onNavigate: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      title={expanded ? undefined : label}
      className={cn(
        "flex h-10 items-center gap-3 rounded-lg px-2 transition-colors",
        active ? "bg-blue-50 text-blue-700" : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
      )}
    >
      <span className="grid size-6 shrink-0 place-items-center">{icon}</span>
      <Label expanded={expanded} className="text-sm font-medium">
        {label}
      </Label>
    </Link>
  );
}

function BoardItem({
  board,
  active,
  expanded,
  onNavigate,
}: {
  board: SidebarBoard;
  active: boolean;
  expanded: boolean;
  onNavigate: () => void;
}) {
  return (
    <Link
      href={`/boards/${board.id}`}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      title={expanded ? undefined : board.name}
      className={cn(
        "group flex h-9 items-center gap-3 rounded-lg px-1.5 transition-colors",
        active ? "bg-blue-50" : "hover:bg-gray-100"
      )}
    >
      <span
        className={cn(
          "grid size-7 shrink-0 place-items-center rounded-md text-[10px] font-bold shadow-sm transition-transform group-hover:rotate-[-3deg]",
          boardAccent(board.id),
          active && "ring-2 ring-blue-500 ring-offset-1"
        )}
      >
        {initials(board.name)}
      </span>
      <Label
        expanded={expanded}
        className={cn(
          "min-w-0 truncate text-sm",
          active ? "font-semibold text-blue-700" : "text-gray-700"
        )}
      >
        {board.name}
      </Label>
    </Link>
  );
}

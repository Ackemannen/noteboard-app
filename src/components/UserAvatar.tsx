import { cn } from "@/lib/utils";
import { initials } from "@/lib/board-style";

interface UserAvatarProps {
  name: string | null;
  email: string | null;
  avatarUrl: string | null;
  className?: string;
}

export default function UserAvatar({ name, email, avatarUrl, className }: UserAvatarProps) {
  const label = name ?? email ?? "You";

  if (avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- external provider avatar, tiny
      <img
        src={avatarUrl}
        alt=""
        referrerPolicy="no-referrer"
        className={cn("size-9 shrink-0 rounded-full object-cover ring-2 ring-white", className)}
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      className={cn(
        "grid size-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-xs font-semibold text-white ring-2 ring-white",
        className
      )}
    >
      {initials(name ?? (email ? email.split("@")[0] : label))}
    </span>
  );
}

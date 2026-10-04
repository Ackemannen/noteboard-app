import Image from "next/image";
import { cn } from "@/lib/utils";

/** The Collaboard mark. Decorative by default; pass `alt` when it stands alone. */
export default function Logo({
  size = 36,
  alt = "",
  priority,
  className,
}: {
  size?: number;
  alt?: string;
  priority?: boolean;
  className?: string;
}) {
  return (
    <Image
      src="/logo.png"
      width={size}
      height={size}
      alt={alt}
      priority={priority}
      className={cn("shrink-0 select-none", className)}
      draggable={false}
    />
  );
}

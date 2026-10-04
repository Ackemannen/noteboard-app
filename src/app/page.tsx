import Link from "next/link";
import { ArrowRight } from "lucide-react";
import Logo from "@/components/Logo";
import { getUser } from "@/lib/supabase/server";
import { NOTE_COLORS, type NoteColor } from "@/lib/notes";
import { cn } from "@/lib/utils";

/** A static sticky note for the hero scene. */
function SceneNote({
  color,
  className,
  title,
  children,
}: {
  color: NoteColor;
  className: string;
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "absolute w-[38%] rounded-lg border-2 p-3 shadow-[0_10px_25px_rgba(60,30,0,0.25)] sm:p-4",
        NOTE_COLORS[color].className,
        className
      )}
    >
      <div className="absolute -top-2.5 left-1/2 h-5 w-14 -translate-x-1/2 rounded-sm border border-white/60 bg-white/60" />
      {title && <p className="mb-1 text-xs font-semibold text-stone-900 sm:text-sm">{title}</p>}
      <p className="text-[11px] leading-relaxed text-stone-700 sm:text-xs">{children}</p>
    </div>
  );
}

export default async function Landing() {
  const user = await getUser();

  return (
    <div className="min-h-dvh bg-background bg-[radial-gradient(ellipse_at_top_left,#fef3c7_0%,transparent_40%)] dark:bg-[radial-gradient(ellipse_at_top_left,rgba(245,158,11,0.08)_0%,transparent_40%)]">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5 sm:px-8">
        <Link href="/" className="flex items-center gap-2.5">
          <Logo size={36} priority />
          <span className="text-xl font-semibold tracking-tight text-foreground">Collaboard</span>
        </Link>
        <nav className="flex items-center gap-1">
          {user ? (
            <Link
              href="/dashboard"
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700"
            >
              Your boards
            </Link>
          ) : (
            <Link
              href="/auth"
              className="rounded-lg px-4 py-2 text-sm font-medium text-foreground/80 transition-colors hover:bg-muted hover:text-foreground"
            >
              Sign in
            </Link>
          )}
        </nav>
      </header>

      <main className="mx-auto grid max-w-6xl items-center gap-12 px-5 pb-16 pt-8 sm:px-8 lg:min-h-[calc(100dvh-5.5rem)] lg:grid-cols-[1fr_1.1fr] lg:gap-16 lg:pb-24 lg:pt-0">
        <section>
          <p className="text-sm font-medium text-blue-600 dark:text-blue-400">
            A cork board you share with a link
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight text-foreground sm:text-5xl lg:text-6xl lg:leading-[1.05]">
            Pin it up. Thread it together. Work it out live.
          </h1>
          <p className="mt-5 max-w-[34rem] text-lg leading-relaxed text-muted-foreground text-pretty">
            Sticky notes, pinned threads and arrows on an endless cork board. Everyone on the
            board sees each other&apos;s cursors and every note move as it happens.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              href={user ? "/dashboard" : "/auth"}
              className="group inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-medium text-white shadow-sm transition-[background-color,transform] hover:bg-blue-700 active:scale-[0.98]"
            >
              {user ? "Open your boards" : "Start a board, it's free"}
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            {!user && (
              <span className="text-sm text-muted-foreground">Sign in with Google or email</span>
            )}
          </div>
        </section>

        {/* Static scene showing what a board looks like */}
        <div
          aria-hidden="true"
          className="relative aspect-[4/3] overflow-hidden rounded-3xl bg-[#c08a4f] shadow-[0_30px_60px_-20px_rgba(60,30,0,0.45)] ring-1 ring-black/10"
          style={{ backgroundImage: "url(/cork.webp)", backgroundSize: "720px 478px" }}
        >
          <div className="absolute inset-0 hidden bg-stone-950/45 dark:block" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_55%,rgba(60,30,0,0.3))]" />

          <SceneNote color="yellow" title="Launch plan" className="left-[7%] top-[12%] -rotate-3">
            Beta to 50 teams in November
          </SceneNote>
          <SceneNote color="teal" title="Risks" className="right-[8%] top-[9%] rotate-2">
            Realtime costs at scale, onboarding drop-off
          </SceneNote>
          <SceneNote color="pink" className="bottom-[9%] left-[30%] rotate-1">
            Interview 8 users before we pick pricing
          </SceneNote>

          <svg className="absolute inset-0 h-full w-full" viewBox="0 0 400 300" preserveAspectRatio="none">
            {/* Thread between the two top notes' pins */}
            <path d="M 104 33 Q 200 78 297 28" fill="none" stroke="rgba(60,25,0,0.3)" strokeWidth="2" transform="translate(1.5 4)" />
            <path d="M 104 33 Q 200 78 297 28" fill="none" stroke="#b91c1c" strokeWidth="2" />
            <circle cx="104" cy="33" r="5" fill="#dc2626" stroke="#7f1d1d" strokeWidth="0.6" />
            <circle cx="297" cy="28" r="5" fill="#dc2626" stroke="#7f1d1d" strokeWidth="0.6" />
            {/* Arrow from the risks note down to the pink note */}
            <path d="M 300 130 L 238 196" fill="none" stroke="var(--arrow-ink)" strokeWidth="2.5" strokeLinecap="round" />
            <polygon points="232,203 236,190 245,197" fill="var(--arrow-ink)" />
          </svg>

          {/* A collaborator's cursor */}
          <div className="absolute left-[56%] top-[52%]">
            <svg width="18" height="20" viewBox="0 0 20 22" className="drop-shadow-md">
              <path d="M2 2 L2 18 L6.5 14 L9.5 20.5 L12.5 19 L9.5 12.5 L16 12.5 Z" fill="#7c3aed" stroke="white" strokeWidth="1.5" strokeLinejoin="round" />
            </svg>
            <span className="absolute left-4 top-5 whitespace-nowrap rounded-full bg-violet-600 px-2 py-0.5 text-[11px] font-medium text-white shadow-md">
              Maya
            </span>
          </div>
        </div>
      </main>
    </div>
  );
}

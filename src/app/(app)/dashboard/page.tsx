import { redirect } from "next/navigation";
import { createClient, getUser } from "@/lib/supabase/server";
import BoardList, { type BoardSummary } from "./BoardList";
import CreateBoardForm from "./CreateBoardForm";

export const metadata = { title: "Your boards · Collaboard" };

export default async function DashboardPage() {
  const user = await getUser();
  if (!user) redirect("/auth?next=/dashboard");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("boards")
    .select(
      "id, name, created_at, updated_at, owner_id, notes(x, y, color, rotation, z, updated_at), board_members(count)"
    )
    .order("created_at", { ascending: false });

  if (error) console.error("Failed to load boards:", error);

  const boards: BoardSummary[] = (data ?? []).map((board) => {
    const notes = [...board.notes].sort((a, b) => a.z - b.z);
    const lastActivity = notes.reduce(
      (latest, note) => (note.updated_at > latest ? note.updated_at : latest),
      board.updated_at
    );
    return {
      id: board.id,
      name: board.name,
      createdAt: board.created_at,
      lastActivity,
      isOwner: board.owner_id === user.id,
      memberCount: board.board_members[0]?.count ?? 1,
      noteCount: notes.length,
      previewNotes: notes.map(({ x, y, color, rotation }) => ({ x, y, color, rotation })),
    };
  });

  const ownedCount = boards.filter((board) => board.isOwner).length;
  const sharedCount = boards.length - ownedCount;
  const firstName = user.name?.split(" ")[0] ?? user.email?.split("@")[0];

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top_left,#fef3c7_0%,transparent_45%),radial-gradient(ellipse_at_bottom_right,#dbeafe_0%,transparent_50%)] bg-slate-50 pl-14">
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-8 sm:py-12">
        <header className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-medium text-blue-600">Collaboard</p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
              Welcome back{firstName ? `, ${firstName}` : ""}
            </h1>
            <p className="mt-2 text-gray-500">
              {boards.length === 0
                ? "Create your first board to start pinning ideas."
                : `${ownedCount} ${ownedCount === 1 ? "board" : "boards"} of your own${
                    sharedCount ? ` · ${sharedCount} shared with you` : ""
                  }`}
            </p>
          </div>
          <CreateBoardForm />
        </header>

        <BoardList boards={boards} />
      </main>
    </div>
  );
}

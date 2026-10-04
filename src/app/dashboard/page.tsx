import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Logout } from "@/components/auth/Logout";
import { createClient, getUser } from "@/lib/supabase/server";
import BoardList from "./BoardList";

export const metadata = { title: "Your boards · Collaboard" };

export default async function DashboardPage() {
  const user = await getUser();
  if (!user) redirect("/auth?next=/dashboard");

  const supabase = await createClient();
  const { data: boards, error } = await supabase
    .from("boards")
    .select("id, name, created_at, owner_id")
    .order("created_at", { ascending: true });

  if (error) console.error("Failed to load boards:", error);

  return (
    <div className="space-y-6 flex flex-col items-center justify-center min-h-screen py-20 px-4">
      <Link
        href="/"
        className="fixed top-4 left-4 text-blue-600"
        aria-label="Back to home"
      >
        <ArrowLeft className="size-8" />
      </Link>
      <Logout />
      <h1 className="text-5xl font-bold text-center text-blue-600">
        Collaboard
      </h1>
      <p className="text-gray-500 text-center mb-10">
        Welcome Back {user.email}
      </p>
      <BoardList
        boards={(boards ?? []).map((board) => ({
          id: board.id,
          name: board.name,
          createdAt: board.created_at,
          isOwner: board.owner_id === user.id,
        }))}
      />
    </div>
  );
}

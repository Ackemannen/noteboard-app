import { redirect } from "next/navigation";
import Sidebar from "@/components/sidebar/Sidebar";
import { createClient, getUser } from "@/lib/supabase/server";

/** Signed-in area: everything here gets the sidebar. */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getUser();
  if (!user) redirect("/auth");

  const supabase = await createClient();
  const { data: boards, error } = await supabase
    .from("boards")
    .select("id, name, owner_id")
    .order("name", { ascending: true });
  if (error) console.error("Failed to load sidebar boards:", error);

  return (
    <>
      <Sidebar
        user={{ email: user.email, name: user.name, avatarUrl: user.avatarUrl }}
        boards={(boards ?? []).map((board) => ({
          id: board.id,
          name: board.name,
          isOwner: board.owner_id === user.id,
        }))}
      />
      {children}
    </>
  );
}

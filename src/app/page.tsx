import Link from "next/link";
import { LogInIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getUser } from "@/lib/supabase/server";

export default async function Landing() {
  const user = await getUser();

  return (
    <div>
      {/* Navbar */}
      <nav className="fixed top-0 left-0 w-full bg-white shadow-md flex items-center justify-between z-50">
        <h1 className="text-2xl sm:text-4xl pl-4 font-bold text-blue-600">
          Collaboard
        </h1>
        {user ? (
          <Button
            asChild
            className="fixed top-4 right-4 z-50 bg-blue-600 hover:bg-blue-700 w-26 h-10"
          >
            <Link href="/dashboard">Boards</Link>
          </Button>
        ) : (
          <Button
            asChild
            className="fixed top-4 right-4 z-50 bg-green-500 hover:bg-green-600 w-26 h-10"
          >
            <Link href="/auth">
              <LogInIcon />
              <span>Login</span>
            </Link>
          </Button>
        )}
      </nav>

      <div className="flex flex-col items-center justify-center h-screen px-4 text-center">
        <h1 className="text-3xl sm:text-4xl md:text-6xl">
          Welcome to <span className="font-bold text-blue-600">Collaboard</span>
        </h1>
        <p className="mt-4 text-xl text-gray-600">
          A collaborative platform for your notes and ideas.
        </p>
      </div>
    </div>
  );
}

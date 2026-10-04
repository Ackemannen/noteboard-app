import Link from "next/link";
import { LogInIcon } from "lucide-react";
import Logo from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { getUser } from "@/lib/supabase/server";

export default async function Landing() {
  const user = await getUser();

  return (
    <div>
      {/* Navbar */}
      <nav className="fixed top-0 left-0 w-full h-18 bg-white shadow-md flex items-center justify-between z-50">
        <Link href="/" className="flex items-center gap-2.5 pl-4">
          <Logo size={44} priority />
          <span className="text-2xl sm:text-3xl font-bold text-blue-600">Collaboard</span>
        </Link>
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
        <Logo size={128} className="mb-6 drop-shadow-xl" />
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

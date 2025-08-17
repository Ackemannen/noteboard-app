import { Button } from "@/components/ui/button";
import type { User } from "firebase/auth";
import { LogInIcon } from "lucide-react";
import { useNavigate } from "react-router-dom";

const Landing = ({ user }: { user: User | null }) => {
  const navigate = useNavigate();

  return (
    <div>
      {/* Navbar */}
      <nav className="fixed top-0 left-0 w-full bg-white shadow-md flex items-center justify-between  z-50">
        <h1 className="text-2xl sm:text-4xl pl-4 font-bold text-blue-600">
          Collaboard
        </h1>
        {user ? (
          <Button
            className="fixed top-4 right-4 cursor-pointer z-50 bg-blue-600 hover:bg-blue-700 w-26 h-10"
            onClick={() => navigate("/dashboard")}
          >
            <span>Boards</span>
          </Button>
        ) : (
          <div>
            <Button
              className="fixed top-4 right-4 cursor-pointer z-50 bg-green-500 hover:bg-green-600 w-26 h-10"
              onClick={() => navigate("/auth")}
            >
              <LogInIcon />
              <span>Login</span>
            </Button>
          </div>
        )}
      </nav>

      <div className="flex flex-col items-center justify-center h-screen">
        <h1 className="!text-3xl sm:!text-4xl md:!text-6xl">
          Welcome to <span className="font-bold text-blue-600">Collaboard</span>
        </h1>
        <p className="mt-4 text-xl text-gray-600">
          A collaborative platform for your notes and ideas.
        </p>
      </div>
    </div>
  );
};

export default Landing;

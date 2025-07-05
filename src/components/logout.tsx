import { signOut } from "firebase/auth";
import { auth } from "../firebase";
import { Button } from "./ui/button";
import { LogOut } from "lucide-react";

export const Logout = () => {
  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Error logging out:", error);
    }
  };

  return (
    <div>
      <Button
        onClick={handleLogout}
        className="fixed top-4 right-4 cursor-pointer z-50 bg-red-500 hover:bg-red-600 w-26 h-10 "
      >
        <LogOut size={20} />
        Logout
      </Button>
    </div>
  );
};

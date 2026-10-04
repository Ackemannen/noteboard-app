import { LogOut } from "lucide-react";
import { signOut } from "@/app/auth/actions";
import { Button } from "@/components/ui/button";

export const Logout = () => {
  return (
    <form action={signOut}>
      <Button
        type="submit"
        className="fixed top-4 right-4 cursor-pointer z-50 bg-red-500 hover:bg-red-600 w-26 h-10"
      >
        <LogOut size={20} />
        Logout
      </Button>
    </form>
  );
};

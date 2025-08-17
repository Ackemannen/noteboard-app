import { Toaster } from "sonner";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import Landing from "./pages/Landing";
import BoardSelect from "./pages/BoardSelect";
import { useEffect, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth } from "./firebase";
import Auth from "./pages/Auth";

const queryClient = new QueryClient();

const App = () => {
  //Auth checking
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
    });
    return () => unsubscribe();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <Toaster />
      <BrowserRouter basename="/noteboard-app">
        <Routes>
          <Route path="/" element={<Landing user={user} />} />
          <Route path="/dashboard" element={<BoardSelect user={user} />} />
          <Route path="/boards/:id" element={<Index user={user} />} />
          <Route path="/auth" element={<Auth />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
};

export default App;

import { Toaster } from "sonner";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import type { User } from "firebase/auth";
import { auth } from "./firebase";
import Auth from "./components/auth/auth";
import BoardSelect from "./components/BoardSelect";

const queryClient = new QueryClient();

const App = () => {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
    });
    return () => unsubscribe();
  }, []);

  if (!user) {
    return <Auth />;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <Toaster />
      <BrowserRouter basename="/noteboard-app">
        <Routes>
          <Route path="/" element={<BoardSelect />} />
          <Route path="/boards/:id" element={<Index />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
};

export default App;

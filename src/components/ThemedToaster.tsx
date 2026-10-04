"use client";

import { Toaster } from "sonner";
import { useTheme } from "@/lib/theme";

export default function ThemedToaster() {
  const { resolved } = useTheme();
  return <Toaster theme={resolved} />;
}

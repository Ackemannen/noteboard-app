import type { Metadata } from "next";
import { Toaster } from "sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: "Collaboard",
  description: "A collaborative cork board for your notes and ideas.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // suppressHydrationWarning: extensions may still add attributes to <html> itself.
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* The app has its own light design; stop Dark Reader from rewriting the
            DOM before hydration (which causes hydration mismatch errors). */}
        <meta name="darkreader-lock" />
      </head>
      <body>
        <Toaster />
        {children}
      </body>
    </html>
  );
}

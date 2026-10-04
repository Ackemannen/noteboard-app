import type { Metadata } from "next";
import { Geist } from "next/font/google";
import ThemedToaster from "@/components/ThemedToaster";
import { themeInitScript } from "@/lib/theme-script";
import "./globals.css";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist" });

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
    // suppressHydrationWarning: the theme script sets class/style on <html> before hydration.
    <html lang="en" className={geist.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        {/* The app has its own dark mode; stop Dark Reader from rewriting the
            DOM before hydration (which causes hydration mismatch errors). */}
        <meta name="darkreader-lock" />
      </head>
      <body>
        <ThemedToaster />
        {children}
      </body>
    </html>
  );
}

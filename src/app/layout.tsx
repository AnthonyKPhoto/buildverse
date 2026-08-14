import type { Metadata } from "next";
import "./globals.css";
import { AppShell } from "@/components/layout/AppShell";
import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider } from "@/components/ThemeProvider";

export const metadata: Metadata = {
  title: "BuildVerse — Vehicle Modification Manager",
  description: "Plan, track, budget, and organize your vehicle modifications.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-background font-sans antialiased">
        <ThemeProvider />
        <AppShell>{children}</AppShell>
        <Toaster />
      </body>
    </html>
  );
}

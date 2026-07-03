import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Sidebar } from "@/components/layout/Sidebar";
import { BottomNav } from "@/components/layout/BottomNav";
import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider } from "@/components/ThemeProvider";
import { SetupWizard } from "@/components/SetupWizard";

export const metadata: Metadata = {
  title: "BuildVerse — Vehicle Modification Manager",
  description: "Plan, track, budget, and organize your vehicle modifications.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var s=localStorage.getItem('bv-scheme');if(s==='light')document.documentElement.classList.add('light');}catch(e){}`,
          }}
        />
      </head>
      <body className="min-h-screen bg-background font-sans antialiased">
        <ThemeProvider />
        <div className="flex h-screen overflow-hidden">
          <Sidebar />
          <main className="flex-1 overflow-y-auto pb-16 md:pb-0">
            <div className="container mx-auto px-3 py-4 md:px-6 md:py-8 max-w-7xl">
              {children}
            </div>
          </main>
        </div>
        <BottomNav />
        <SetupWizard />
        <Toaster />
      </body>
    </html>
  );
}

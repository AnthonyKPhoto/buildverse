import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Sidebar } from "@/components/layout/Sidebar";
import { BottomNav } from "@/components/layout/BottomNav";
import { AccountMenu } from "@/components/layout/AccountMenu";
import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider } from "@/components/ThemeProvider";
import { SetupWizard } from "@/components/SetupWizard";

export const metadata: Metadata = {
  title: "Upshift Garage — Vehicle Modification Manager",
  description: "Plan, track, budget, and organize your vehicle modifications.",
  icons: {
    // The ?v= suffix busts browsers' very sticky favicon cache — bump it whenever the logo changes.
    icon: [
      { url: "/logo.svg?v=2", type: "image/svg+xml" },
      { url: "/favicon.ico?v=2", sizes: "any" },
      { url: "/icon-32.png?v=2", sizes: "32x32", type: "image/png" },
    ],
    shortcut: [{ url: "/favicon.ico?v=2" }],
    apple: [{ url: "/apple-touch-icon.png?v=2", sizes: "180x180", type: "image/png" }],
  },
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
            __html: `try{var s=localStorage.getItem('bv-scheme');var p=JSON.parse(localStorage.getItem('bv-prefs')||'{}');var r=document.documentElement;var m=p.material;var glass=m==='light-frosted'||m==='dark-frosted'||m==='clear-crystal';if(glass)r.setAttribute('data-material',m);if(m==='light-frosted'||(!glass&&s==='light'))r.classList.add('light');if(p.uiScale==='compact')r.style.fontSize='93.75%';if(p.uiScale==='large')r.style.fontSize='109.375%';if(p.sidebarWidth==='narrow')r.style.setProperty('--sidebar-width','208px');if(p.sidebarWidth==='wide')r.style.setProperty('--sidebar-width','280px');if(p.reduceMotion)r.classList.add('reduce-motion');if(glass){var q=function(k,d,n){var v=p[k];return typeof v==='number'?v:d};var st=function(k,v){r.style.setProperty(k,v)};st('--g-k-opacity',q('glassOpacity',100)/100);st('--g-k-blur',q('glassBlur',100)/100);st('--g-k-sat',q('glassSaturation',100)/100);st('--g-k-edge',q('glassEdge',100)/100);st('--g-k-shadow',q('glassShadow',100)/100);st('--g-r-card',q('glassRadius',24)+'px');st('--g-bg-dim',q('bgDim',30)/100);st('--g-bg-blur',q('bgBlur',0)+'px');var im=localStorage.getItem('bv-bg-image');if(p.bgMode==='image'&&im&&/^data:image[/](jpeg|webp|png);base64,[A-Za-z0-9+/=]+$/.test(im)){r.setAttribute('data-bg','image');st('--g-bg-image','url("'+im+'")');}}}catch(e){}`,
          }}
        />
      </head>
      <body className="min-h-screen bg-background font-sans antialiased">
        <ThemeProvider />
        <div className="flex h-screen overflow-hidden">
          <Sidebar />
          <main className="flex-1 overflow-y-auto pb-16 md:pb-0">
            {/* Mobile-only — desktop has the same control in the sidebar
                footer. Renders nothing outside server mode. */}
            <AccountMenu className="md:hidden px-4 py-2.5 border-b border-border/60 bg-card" />
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

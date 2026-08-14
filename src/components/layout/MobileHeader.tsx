"use client";

import { Menu } from "lucide-react";
import Image from "next/image";

export function MobileHeader({ onMenuClick }: { onMenuClick: () => void }) {
  return (
    <header className="md:hidden flex items-center gap-3 px-4 h-14 border-b border-border bg-card shrink-0">
      <button
        onClick={onMenuClick}
        className="p-2 -ml-2 rounded-lg hover:bg-secondary transition-colors"
        aria-label="Open menu"
      >
        <Menu className="w-5 h-5" />
      </button>
      <Image src="/logo.svg" alt="BuildVerse" width={24} height={24} className="rounded-md" />
      <p className="font-semibold text-sm tracking-tight">
        Build<span className="text-theme">Verse</span>
      </p>
    </header>
  );
}

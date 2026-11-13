"use client";

import { usePathname } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { SiteSidebar } from "@/components/site-sidebar";
import { FeatureGate } from "@/components/feature-flags-client";
import { CommandPalette } from "@/components/command-palette";
import { ChatNowFab } from "@/components/chat-now-fab";
import { NotesPromptSite } from "@/components/notes-leads/notes-prompt-site";

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isDashboard = pathname.startsWith("/dashboard");
  const isPapers = pathname === "/papers" || pathname.startsWith("/papers");

  // The student dashboard brings its own frame (AccountShell): sidebar only, no site header/footer.
  if (pathname === "/account" || pathname === "/account/support") {
    return (
      <div className="w-full flex-1">
        {children}
        <ChatNowFab />
      </div>
    );
  }

  if (isDashboard) {
    return (
      <main className="theme-classic min-h-screen w-full">
        {children}
        <ChatNowFab />
      </main>
    );
  }

  return (
    <div className={`flex w-full flex-1 ${isPapers ? "theme-classic" : ""}`}>
      <CommandPalette />
      <ChatNowFab />
      <NotesPromptSite />
      {!isPapers && <SiteSidebar />}
      <div className="flex min-w-0 flex-1 flex-col">
        <SiteHeader />
        <main className="flex-1">
          <FeatureGate>{children}</FeatureGate>
        </main>
        <SiteFooter />
      </div>
    </div>
  );
}

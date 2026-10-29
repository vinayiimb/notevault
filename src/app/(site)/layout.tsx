"use client";

import { usePathname } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { SiteSidebar } from "@/components/site-sidebar";
import { FeatureGate } from "@/components/feature-flags-client";
import { CommandPalette } from "@/components/command-palette";
import { WhatsAppJoin } from "@/components/whatsapp-join";

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isDashboard = pathname.startsWith("/dashboard");
  const isPapers = pathname === "/papers" || pathname.startsWith("/papers");

  if (isDashboard) {
    return (
      <main className="min-h-screen w-full">
        {children}
        <WhatsAppJoin />
      </main>
    );
  }

  return (
    <div className="flex w-full flex-1">
      <CommandPalette />
      <WhatsAppJoin />
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

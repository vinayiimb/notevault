"use client";

import { usePathname } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { SiteSidebar } from "@/components/site-sidebar";

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isDashboard = pathname.startsWith("/dashboard");
  const isPapers = pathname === "/papers" || pathname.startsWith("/papers");

  if (isDashboard) {
    return <main className="min-h-screen w-full">{children}</main>;
  }

  return (
    <div className="flex w-full flex-1">
      {!isPapers && <SiteSidebar />}
      <div className="flex min-w-0 flex-1 flex-col">
        <SiteHeader />
        <main className="flex-1">{children}</main>
        <SiteFooter />
      </div>
    </div>
  );
}

import { ReactNode } from 'react';
import Link from 'next/link';
import { BookOpen, FolderOpen, Home, Library, PenTool, Search, LayoutDashboard, BrainCircuit, Activity } from 'lucide-react';

export default function VaultLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-50">
      {/* LEFT SIDEBAR */}
      <aside className="w-64 border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950 flex flex-col hidden md:flex">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800">
          <Link href="/vault" className="flex items-center space-x-2 text-xl font-bold text-blue-600 dark:text-blue-500">
            <BookOpen className="w-6 h-6" />
            <span>NoteVault AI</span>
          </Link>
        </div>

        <div className="p-4">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-500" />
            <input
              type="text"
              placeholder="Search (Cmd+K)"
              className="w-full bg-slate-100 dark:bg-slate-900 rounded-md py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-2 space-y-1">
          <NavItem href="/vault" icon={<Home />} label="Home" />
          <NavItem href="/vault/notes" icon={<PenTool />} label="Notes" />
          <NavItem href="/vault/subjects" icon={<FolderOpen />} label="Subjects" />
          <NavItem href="/vault/study" icon={<Activity />} label="Study" />
          <NavItem href="/vault/ai-tools" icon={<BrainCircuit />} label="AI Tools" />
          <NavItem href="/vault/library" icon={<Library />} label="Library" />
          <NavItem href="/vault/planner" icon={<LayoutDashboard />} label="Planner" />
        </nav>

        <div className="p-4 border-t border-slate-200 dark:border-slate-800">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-full bg-blue-500 text-white flex items-center justify-center font-bold">
              S
            </div>
            <div className="text-sm">
              <p className="font-semibold">Student</p>
              <p className="text-slate-500 dark:text-slate-400 text-xs">Free Plan</p>
            </div>
          </div>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden relative">
        <header className="md:hidden border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950 p-4 flex items-center justify-between">
          <Link href="/vault" className="flex items-center space-x-2 font-bold text-blue-600">
            <BookOpen className="w-5 h-5" />
            <span>NoteVault AI</span>
          </Link>
        </header>
        <div className="flex-1 overflow-y-auto p-4 md:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}

function NavItem({ href, icon, label }: { href: string; icon: ReactNode; label: string }) {
  return (
    <Link
      href={href}
      className="flex items-center space-x-3 rounded-md px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white transition-colors"
    >
      <div className="w-4 h-4">{icon}</div>
      <span>{label}</span>
    </Link>
  );
}

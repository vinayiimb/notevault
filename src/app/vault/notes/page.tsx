import Link from 'next/link';
import { Plus, Search, Filter, Folder, FileText, MoreVertical } from 'lucide-react';

export default function NotesLibraryPage() {
  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
            Notes Library
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            All your notes, folders, and study materials in one place.
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <Link href="/vault/notes/new" className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md font-medium transition-colors shadow-sm">
            <Plus className="w-4 h-4" />
            <span>New Note</span>
          </Link>
        </div>
      </header>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white dark:bg-slate-900 p-2 rounded-lg border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="relative w-full sm:max-w-md">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search notes..."
            className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-md py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-shadow"
          />
        </div>
        <div className="flex items-center space-x-2 w-full sm:w-auto">
          <button className="flex items-center space-x-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 px-3 py-2 rounded-md text-sm font-medium transition-colors">
            <Filter className="w-4 h-4" />
            <span>Filter</span>
          </button>
        </div>
      </div>

      {/* Folders */}
      <section>
        <h2 className="text-lg font-semibold mb-4 text-slate-800 dark:text-slate-200">Folders</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <FolderCard name="Economics Semester 1" count={12} />
          <FolderCard name="Business Law" count={8} />
          <FolderCard name="Accounting Notes" count={24} />
          <FolderCard name="Archived" count={3} />
        </div>
      </section>

      {/* Recent Notes */}
      <section>
        <h2 className="text-lg font-semibold mb-4 text-slate-800 dark:text-slate-200 mt-8">All Notes</h2>
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
          <div className="grid grid-cols-1 divide-y divide-slate-100 dark:divide-slate-800">
            <NoteRow title="Elasticity of Demand" folder="Economics Semester 1" updated="2 hours ago" />
            <NoteRow title="Keynesian Multiplier" folder="Economics Semester 1" updated="Yesterday" />
            <NoteRow title="Corporate Accounting Final PYQs" folder="Accounting Notes" updated="2 days ago" />
            <NoteRow title="Business Law Concepts" folder="Business Law" updated="3 days ago" />
            <NoteRow title="Unit 1 Summary" folder="Unsorted" updated="Last week" />
          </div>
        </div>
      </section>
      
    </div>
  );
}

function FolderCard({ name, count }: { name: string; count: number }) {
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex items-center space-x-4 hover:border-blue-300 dark:hover:border-blue-700 cursor-pointer transition-colors shadow-sm group">
      <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg text-blue-500 group-hover:scale-110 transition-transform">
        <Folder className="w-6 h-6" />
      </div>
      <div>
        <h3 className="font-medium text-slate-900 dark:text-slate-100 leading-tight">{name}</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{count} items</p>
      </div>
    </div>
  );
}

function NoteRow({ title, folder, updated }: { title: string; folder: string; updated: string }) {
  return (
    <div className="flex items-center justify-between p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors group">
      <div className="flex items-center space-x-4">
        <div className="text-slate-400 group-hover:text-blue-500 transition-colors">
          <FileText className="w-5 h-5" />
        </div>
        <div>
          <h3 className="font-medium text-slate-900 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">{title}</h3>
          <div className="flex items-center space-x-2 mt-1 text-xs text-slate-500 dark:text-slate-400">
            <span className="flex items-center"><Folder className="w-3 h-3 mr-1 inline" /> {folder}</span>
          </div>
        </div>
      </div>
      <div className="flex items-center space-x-4">
        <span className="text-sm text-slate-500 dark:text-slate-400 hidden sm:block">{updated}</span>
        <button className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 opacity-0 group-hover:opacity-100 transition-opacity">
          <MoreVertical className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}

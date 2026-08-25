import TiptapEditor from '@/components/vault/editor/TiptapEditor';

export default function NewNotePage() {
  return (
    <div className="h-full flex flex-col -mx-4 md:-mx-8 -my-4 md:-my-8">
      {/* Editor Title Banner */}
      <div className="px-8 py-6 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-950 flex-shrink-0">
        <div className="max-w-4xl mx-auto flex items-center text-sm text-slate-500 mb-2">
          <span>Workspace</span>
          <span className="mx-2">/</span>
          <span>Unsorted</span>
          <span className="mx-2">/</span>
          <span className="text-blue-600 dark:text-blue-400 font-medium">New Note</span>
        </div>
        <div className="max-w-4xl mx-auto">
          <input 
            type="text" 
            placeholder="Untitled Note" 
            className="w-full text-4xl font-bold bg-transparent border-none focus:outline-none focus:ring-0 text-slate-900 dark:text-white placeholder-slate-300 dark:placeholder-slate-700"
            autoFocus
          />
        </div>
      </div>
      
      {/* The Editor Area */}
      <div className="flex-1 overflow-hidden">
        <TiptapEditor 
          initialContent="<p>Start writing your notes here, or type '/' for commands...</p>"
        />
      </div>
    </div>
  );
}

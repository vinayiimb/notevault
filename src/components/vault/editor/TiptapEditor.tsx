'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { useState, useEffect, useCallback } from 'react';
import { Sparkles, Save, Check } from 'lucide-react';

interface TiptapEditorProps {
  initialContent?: string;
  onSave?: (content: string) => void;
}

export default function TiptapEditor({ initialContent = '', onSave }: TiptapEditorProps) {
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved');
  const [microNotes, setMicroNotes] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3, 4] },
      }),
      // Add more extensions for SlashCommands, Math, Tables, etc. in a full implementation
    ],
    content: initialContent,
    editorProps: {
      attributes: {
        class: 'prose prose-lg dark:prose-invert prose-blue max-w-none focus:outline-none min-h-[500px] py-8',
      },
    },
    onUpdate: ({ editor }) => {
      setSaveStatus('unsaved');
    },
  });

  // Autosave
  useEffect(() => {
    if (saveStatus === 'unsaved') {
      const timer = setTimeout(() => {
        setSaveStatus('saving');
        // Simulate save
        setTimeout(() => {
          if (editor) {
            onSave?.(editor.getHTML());
          }
          setSaveStatus('saved');
        }, 500);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [saveStatus, editor, onSave]);

  const handleGenerateMicroNotes = async () => {
    if (!editor) return;
    setIsGenerating(true);
    try {
      // In a real implementation, we'd pass the actual content. Here we extract text.
      const text = editor.getText();
      const result = { microNotes: "AI generation is temporarily disabled." };
      setMicroNotes(result.microNotes);
    } catch (err) {
      console.error(err);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="flex h-full bg-white dark:bg-slate-950">
      <div className="flex-1 flex flex-col max-w-4xl mx-auto border-x border-slate-100 dark:border-slate-900 shadow-sm">
        
        {/* Editor Toolbar & Status */}
        <div className="flex items-center justify-between px-8 py-4 border-b border-slate-100 dark:border-slate-800 bg-white/50 dark:bg-slate-950/50 backdrop-blur-sm sticky top-0 z-10">
          <div className="flex items-center space-x-2 text-sm text-slate-500">
            {saveStatus === 'saved' && <><Check className="w-4 h-4 text-emerald-500" /> <span>Saved</span></>}
            {saveStatus === 'saving' && <><Save className="w-4 h-4 animate-pulse text-blue-500" /> <span>Saving...</span></>}
            {saveStatus === 'unsaved' && <><Save className="w-4 h-4" /> <span>Unsaved</span></>}
          </div>
          
          <button 
            onClick={handleGenerateMicroNotes}
            disabled={isGenerating}
            className="flex items-center space-x-2 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white px-4 py-2 rounded-full text-sm font-medium shadow-md transition-transform hover:scale-105 active:scale-95 disabled:opacity-50 disabled:hover:scale-100"
          >
            <Sparkles className="w-4 h-4" />
            <span>{isGenerating ? 'Generating...' : 'Generate Micro Notes'}</span>
          </button>
        </div>

        {/* The Editor */}
        <div className="flex-1 overflow-y-auto px-8 lg:px-16 cursor-text">
          <EditorContent editor={editor} />
        </div>
      </div>

      {/* AI Sidebar (Micro Notes / Ask Notes) */}
      {(microNotes || isGenerating) && (
        <aside className="w-80 border-l border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 p-6 overflow-y-auto flex-shrink-0 animate-in slide-in-from-right-4">
          <h3 className="font-bold text-lg mb-4 flex items-center space-x-2 text-purple-600 dark:text-purple-400">
            <Sparkles className="w-5 h-5" />
            <span>Micro Notes</span>
          </h3>
          
          {isGenerating ? (
            <div className="space-y-4">
              <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded animate-pulse w-3/4"></div>
              <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded animate-pulse w-full"></div>
              <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded animate-pulse w-5/6"></div>
              <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded animate-pulse w-4/5"></div>
              <p className="text-sm text-slate-500 italic mt-4">AI is reading your material and extracting key concepts...</p>
            </div>
          ) : (
            <div className="prose prose-sm dark:prose-invert prose-purple">
              {microNotes}
            </div>
          )}
          
          {!isGenerating && microNotes && (
            <div className="mt-6 flex space-x-2">
              <button className="flex-1 bg-purple-100 text-purple-700 hover:bg-purple-200 dark:bg-purple-900/30 dark:text-purple-300 py-2 rounded-md text-sm font-medium transition-colors">
                Regenerate
              </button>
              <button className="flex-1 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300 py-2 rounded-md text-sm font-medium transition-colors">
                Discard
              </button>
            </div>
          )}
        </aside>
      )}
    </div>
  );
}

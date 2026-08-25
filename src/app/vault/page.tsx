import Link from 'next/link';
import { Plus, FileText, UploadCloud, Zap, Brain, Target, Calendar } from 'lucide-react';

export default function VaultDashboard() {
  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
            Good evening, Student
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            Ready to ace your exams? Let's get to work.
          </p>
        </div>
        <div className="text-right hidden sm:block">
          <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">12 🔥</div>
          <p className="text-xs text-slate-500 font-medium">Study Streak</p>
        </div>
      </header>

      {/* QUICK ACTIONS */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <QuickAction href="/vault/notes/new" icon={<Plus />} label="New Note" bg="bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400" />
        <QuickAction href="/vault/library/upload" icon={<UploadCloud />} label="Upload PDF" bg="bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400" />
        <QuickAction href="/vault/flashcards/generate" icon={<Zap />} label="Flashcards" bg="bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400" />
        <QuickAction href="/vault/quiz/new" icon={<Target />} label="Start Quiz" bg="bg-purple-50 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400" />
      </section>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        
        {/* CONTINUE STUDYING */}
        <section className="md:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Continue Studying</h2>
            <Link href="/vault/notes" className="text-sm text-blue-600 hover:underline">View all</Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <StudyCard 
              title="Elasticity of Demand"
              subject="Microeconomics"
              type="Micro Notes"
              timeAgo="2 hours ago"
              progress={75}
            />
            <StudyCard 
              title="Keynesian Multiplier"
              subject="Macroeconomics"
              type="Detailed Notes"
              timeAgo="Yesterday"
              progress={40}
            />
            <StudyCard 
              title="Corporate Accounting Final PYQs"
              subject="Accounting"
              type="Quiz Attempt"
              timeAgo="2 days ago"
              progress={90}
            />
            <StudyCard 
              title="Business Law Concepts"
              subject="Law"
              type="Flashcards"
              timeAgo="3 days ago"
              progress={20}
            />
          </div>
        </section>

        {/* RIGHT COLUMN - ALERTS & TASKS */}
        <section className="space-y-6">
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm">
            <h3 className="font-semibold mb-4 flex items-center space-x-2">
              <Brain className="w-4 h-4 text-purple-500" />
              <span>Smart Recommendations</span>
            </h3>
            <ul className="space-y-3">
              <Recommendation title="Revise Indifference Curves" subtitle="You got 2 questions wrong recently." />
              <Recommendation title="24 Flashcards Due" subtitle="Business Law: Contracts." />
              <Recommendation title="Complete Assignment" subtitle="Due in 2 days." />
            </ul>
          </div>

          <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-xl p-5 text-white shadow-md">
            <h3 className="font-semibold mb-2 flex items-center space-x-2">
              <Calendar className="w-4 h-4 text-blue-200" />
              <span>Upcoming Exams</span>
            </h3>
            <p className="text-3xl font-bold mt-2">14 Days</p>
            <p className="text-blue-100 text-sm mb-4">Until Macroeconomics Finals</p>
            <button className="w-full bg-white text-blue-700 py-2 rounded-md text-sm font-semibold hover:bg-blue-50 transition-colors">
              View Study Plan
            </button>
          </div>
        </section>

      </div>
    </div>
  );
}

function QuickAction({ href, icon, label, bg }: { href: string; icon: React.ReactNode; label: string; bg: string }) {
  return (
    <Link href={href} className={`flex flex-col items-center justify-center p-4 rounded-xl border border-slate-200 dark:border-slate-800 hover:shadow-md transition-all ${bg}`}>
      <div className="mb-2">{icon}</div>
      <span className="font-medium text-sm">{label}</span>
    </Link>
  );
}

function StudyCard({ title, subject, type, timeAgo, progress }: { title: string; subject: string; type: string; timeAgo: string; progress: number }) {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 hover:border-blue-300 dark:hover:border-blue-700 cursor-pointer transition-colors shadow-sm group">
      <div className="flex items-start justify-between mb-3">
        <div className="bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-xs px-2 py-1 rounded-md">
          {type}
        </div>
        <span className="text-xs text-slate-400">{timeAgo}</span>
      </div>
      <h3 className="font-semibold text-slate-900 dark:text-white leading-tight group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">{title}</h3>
      <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{subject}</p>
      
      <div className="mt-4">
        <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5">
          <div className="bg-blue-500 h-1.5 rounded-full" style={{ width: `${progress}%` }}></div>
        </div>
      </div>
    </div>
  );
}

function Recommendation({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <li className="flex items-start space-x-3">
      <div className="w-2 h-2 mt-1.5 rounded-full bg-purple-500 flex-shrink-0"></div>
      <div>
        <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{title}</p>
        <p className="text-xs text-slate-500 dark:text-slate-400">{subtitle}</p>
      </div>
    </li>
  );
}

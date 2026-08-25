"use client";

import { MapPin, Users, WarningCircle, BellRinging, Funnel, Buildings } from "@phosphor-icons/react";

export default function MigrationRadarPage() {
  const migrations = [
    {
      id: 1,
      college: "Hansraj College",
      course: "B.Sc (Hons) Zoology",
      vacancies: 2,
      status: "Open",
      deadline: "30 August 2026",
      requirements: "Minimum 7.5 CGPA in Sem 1 & 2. No ER.",
    },
    {
      id: 2,
      college: "Hindu College",
      course: "B.Sc (Hons) Zoology",
      vacancies: 0,
      status: "Closed",
      deadline: "N/A",
      requirements: "No vacancies announced for this session.",
    },
    {
      id: 3,
      college: "Sri Venkateswara College",
      course: "B.Sc (Hons) Zoology",
      vacancies: "TBA",
      status: "Not Announced",
      deadline: "Pending Notice",
      requirements: "Generally requires 7.0+ CGPA. Awaiting official notice.",
    }
  ];

  return (
    <div className="container max-w-5xl py-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <header className="mb-10 text-center">
        <div className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-brand-soft text-brand mb-4">
          <MapPin size={32} weight="fill" />
        </div>
        <h1 className="font-display text-4xl font-extrabold tracking-tight text-foreground mb-3">
          Migration Radar
        </h1>
        <p className="text-lg text-muted max-w-2xl mx-auto">
          Track real-time Inter-College Migration vacancies for your course across DU colleges.
        </p>
      </header>

      {/* Control Panel */}
      <div className="mb-8 flex flex-wrap gap-4 items-center justify-between rounded-2xl border border-border bg-surface p-4 shadow-sm">
        <div className="flex gap-4">
          <select className="rounded-xl border border-border bg-surface-muted px-4 py-2.5 text-sm font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-brand">
            <option>B.Sc (Hons) Zoology</option>
            <option>B.A. (Hons) Economics</option>
            <option>B.Com (Hons)</option>
          </select>
          <select className="rounded-xl border border-border bg-surface-muted px-4 py-2.5 text-sm font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-brand">
            <option>All Colleges</option>
            <option>North Campus</option>
            <option>South Campus</option>
          </select>
        </div>
        
        <button className="flex items-center gap-2 rounded-xl bg-surface-muted px-4 py-2.5 text-sm font-bold text-foreground hover:bg-border transition">
          <Funnel size={18} /> Filters
        </button>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {migrations.map((migration) => {
          let statusColor = "text-muted bg-surface-muted"; // default
          let statusText = "text-muted";
          
          if (migration.status === "Open") {
            statusColor = "bg-green-500/10 text-green-600 dark:text-green-400";
            statusText = "text-green-600 dark:text-green-400";
          } else if (migration.status === "Closed") {
            statusColor = "bg-red-500/10 text-red-600 dark:text-red-400";
            statusText = "text-red-600 dark:text-red-400";
          } else if (migration.status === "Not Announced") {
            statusColor = "bg-amber-500/10 text-amber-600 dark:text-amber-400";
            statusText = "text-amber-600 dark:text-amber-400";
          }

          return (
            <div key={migration.id} className="flex flex-col rounded-2xl border border-border bg-surface overflow-hidden hover:shadow-md transition">
              <div className="p-6 border-b border-border">
                <div className="flex justify-between items-start mb-4">
                  <div className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider ${statusColor}`}>
                    {migration.status}
                  </div>
                  <button className="text-muted hover:text-brand transition" aria-label="Set alert">
                    <BellRinging size={20} />
                  </button>
                </div>
                
                <h3 className="text-xl font-extrabold text-foreground mb-1 flex items-center gap-2">
                  <Buildings size={20} className="text-muted" weight="fill" />
                  {migration.college}
                </h3>
                <p className="text-sm font-semibold text-muted mb-4">{migration.course}</p>
                
                <div className="flex items-center gap-2 text-sm">
                  <Users size={16} className="text-muted" />
                  <span className="text-muted">Vacancies:</span> 
                  <strong className={`font-bold ${Number(migration.vacancies) > 0 ? "text-foreground" : "text-muted"}`}>
                    {migration.vacancies}
                  </strong>
                </div>
              </div>
              
              <div className="p-6 bg-surface-muted/30 flex-1 flex flex-col justify-between">
                <div className="mb-4 text-sm text-muted">
                  <strong className="block text-foreground mb-1">Requirements:</strong>
                  {migration.requirements}
                </div>
                
                <div className="flex items-center justify-between mt-4">
                  <div className="text-xs">
                    <span className="block text-muted font-bold uppercase tracking-wider mb-0.5">Deadline</span>
                    <strong className="text-foreground">{migration.deadline}</strong>
                  </div>
                  <button 
                    disabled={migration.status !== "Open"} 
                    className={`rounded-xl px-4 py-2 text-sm font-bold transition shadow-sm ${
                      migration.status === "Open" 
                      ? "bg-brand text-brand-foreground hover:bg-brand/90 active:scale-95" 
                      : "bg-surface-muted text-muted cursor-not-allowed opacity-50"
                    }`}
                  >
                    Apply Now
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

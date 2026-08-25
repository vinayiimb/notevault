"use client";

import { WarningCircle, Calendar, GraduationCap, CaretRight, Clock, FileText, UserCircleGear, RocketLaunch } from "@phosphor-icons/react";
import Link from "next/link";

export default function ActionEnginePage() {
  const actions = [
    {
      id: 1,
      type: 'urgent',
      title: 'Action Required',
      subtitle: 'Attendance-document submission',
      description: 'You are a Semester 3 KMC student who participates in an approved co-curricular activity (NSS). Please submit documentation to receive attendance credit.',
      deadline: '29 August 2026',
      documents: ['Activity Certificate', 'NSS Logbook'],
      source: 'College Notice',
      actionText: 'Submit Documents',
    },
    {
      id: 2,
      type: 'opportunity',
      title: 'Opportunity',
      subtitle: 'Financial-aid application opened',
      description: 'The College Student Aid Fund form has opened. Based on your profile, you are likely eligible.',
      deadline: '5 September 2026',
      documents: ['Income Certificate', 'Fee Receipt'],
      source: 'DSW Notifications',
      actionText: 'Check Eligibility',
    },
    {
      id: 3,
      type: 'academic',
      title: 'Academic Update',
      subtitle: 'Semester 3 tentative datesheet released',
      description: 'Your B.Sc Zoology Semester 3 datesheet has been published. First exam scheduled for 12 December.',
      deadline: null,
      documents: [],
      source: 'DU Examination Branch',
      actionText: 'View Datesheet',
    }
  ];

  return (
    <div className="mx-auto w-full max-w-4xl px-4 sm:px-6 lg:px-8 py-10 sm:py-16 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* Header Section */}
      <header className="mb-8 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-soft text-brand shadow-sm mb-5">
          <RocketLaunch size={32} weight="fill" />
        </div>
        <h1 className="font-display text-4xl font-extrabold tracking-tight text-foreground mb-3">
          Action Engine
        </h1>
        <p className="text-lg text-muted max-w-2xl mx-auto leading-relaxed">
          Don't read 70 generic circulars. Here are the <span className="font-bold text-foreground">3 things</span> that actually need your attention today based on your profile.
        </p>
      </header>

      {/* Context Banner */}
      <div className="mb-6 rounded-2xl border border-border bg-surface p-5 flex items-center gap-4 max-w-3xl mx-auto shadow-sm">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-surface-muted text-2xl shadow-sm border border-border/50">
          👨‍🎓
        </div>
        <div>
          <h2 className="font-bold text-foreground text-lg leading-tight">Vinay Sharma</h2>
          <p className="text-sm font-medium text-muted mt-0.5">KMC • B.Sc Zoology • Semester 3</p>
        </div>
        <Link href="#" className="ml-auto flex items-center gap-1.5 rounded-lg bg-surface-muted px-3 py-1.5 text-xs font-bold text-foreground transition-colors hover:bg-brand hover:text-brand-foreground border border-border/50">
          <UserCircleGear size={16} weight="bold" />
          <span className="hidden sm:inline">Edit Profile</span>
        </Link>
      </div>

      {/* Action Cards */}
      <div className="flex flex-col gap-6 max-w-3xl mx-auto">
        {actions.map((action) => {
          // Dynamic Styling based on Action Type
          let typeClasses = "";
          let badgeColor = "";
          let iconColor = "";
          let btnColor = "";
          let docBg = "";
          let Icon = WarningCircle;
          
          if (action.type === 'urgent') {
            typeClasses = "border-l-[6px] border-l-red-500 bg-red-500/5 hover:border-red-500/80";
            badgeColor = "text-red-700 dark:text-red-400";
            iconColor = "text-red-600 dark:text-red-500 bg-red-500/10";
            btnColor = "bg-red-600 hover:bg-red-700 text-white shadow-sm shadow-red-600/20";
            docBg = "bg-red-50 border-red-200 text-red-700 dark:bg-red-500/10 dark:border-red-500/20 dark:text-red-300";
            Icon = WarningCircle;
          } else if (action.type === 'opportunity') {
            typeClasses = "border-l-[6px] border-l-amber-500 bg-amber-500/5 hover:border-amber-500/80";
            badgeColor = "text-amber-700 dark:text-amber-400";
            iconColor = "text-amber-600 dark:text-amber-500 bg-amber-500/10";
            btnColor = "bg-amber-500 hover:bg-amber-600 text-white shadow-sm shadow-amber-500/20";
            docBg = "bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-500/10 dark:border-amber-500/20 dark:text-amber-300";
            Icon = GraduationCap;
          } else if (action.type === 'academic') {
            typeClasses = "border-l-[6px] border-l-blue-500 bg-blue-500/5 hover:border-blue-500/80";
            badgeColor = "text-blue-700 dark:text-blue-400";
            iconColor = "text-blue-600 dark:text-blue-500 bg-blue-500/10";
            btnColor = "bg-blue-600 hover:bg-blue-700 text-white shadow-sm shadow-blue-600/20";
            docBg = "bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-500/10 dark:border-blue-500/20 dark:text-blue-300";
            Icon = Calendar;
          }

          return (
            <div 
              key={action.id} 
              className={`rounded-2xl border border-border p-6 sm:p-8 transition-all hover:shadow-md ${typeClasses}`}
            >
              {/* Type Badge */}
              <div className="flex items-center gap-3 mb-5">
                <div className={`rounded-xl p-2.5 ${iconColor}`}>
                  <Icon size={22} weight="fill" />
                </div>
                <span className={`text-[13px] font-bold uppercase tracking-wider ${badgeColor}`}>
                  {action.title}
                </span>
              </div>

              {/* Content */}
              <div className="mb-8">
                <h3 className="text-xl sm:text-2xl font-bold text-foreground mb-3 leading-tight">
                  {action.subtitle}
                </h3>
                <p className="text-muted leading-relaxed text-[15px] sm:text-base">
                  {action.description}
                </p>
              </div>

              {/* Action Footer */}
              <div className="flex flex-col sm:flex-row gap-6 sm:items-end justify-between border-t border-border/50 pt-6">
                
                <div className="flex flex-wrap gap-8">
                  {/* Deadline Block */}
                  {action.deadline && (
                    <div className="flex items-start gap-2.5">
                      <Clock size={20} className="text-muted mt-0.5" weight="fill" />
                      <div>
                        <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-muted">Deadline</p>
                        <p className="text-sm font-bold text-foreground">{action.deadline}</p>
                      </div>
                    </div>
                  )}
                  
                  {/* Docs Block */}
                  {action.documents.length > 0 && (
                    <div className="flex flex-col gap-2">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-muted">Required Docs</p>
                      <div className="flex gap-2 flex-wrap">
                        {action.documents.map((doc, i) => (
                          <span key={i} className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-bold ${docBg}`}>
                            <FileText size={14} weight="fill" /> {doc}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Call to Action Button */}
                <div className="shrink-0 mt-2 sm:mt-0">
                  <button className={`w-full sm:w-auto flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-bold transition-all active:scale-95 ${btnColor}`}>
                    {action.actionText} <CaretRight size={16} weight="bold" />
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

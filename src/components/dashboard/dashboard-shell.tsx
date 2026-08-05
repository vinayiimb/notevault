"use client";

import { useState } from "react";
import { DashboardSidebar } from "./dashboard-sidebar";
import { DashboardMobileNav } from "./dashboard-mobile-nav";
import { DashboardHeader } from "./dashboard-header";
import { BannerCards } from "./banner-cards";
import { VocabBuilderGrid } from "./vocab-builder-grid";
import { OverviewGrid } from "./overview-grid";
import { WordOfTheDay } from "./word-of-the-day";
import { StudentCourseCard } from "./student-course-card";
import { ContinueStudying, type StudyActivityItem } from "./continue-studying";
import { SubjectGrid } from "./subject-grid";
import { UpcomingExams } from "./upcoming-exams";
import { RecentResources, type ResourceItem } from "./recent-resources";
import { SavedResources } from "./saved-resources";
import { SemesterProgressSummary } from "./semester-progress-summary";
import { useCoursePref, type StudentCoursePref } from "@/lib/dashboard-store";
import type { SubjectData } from "./subject-card";

export interface DashboardShellProps {
  student: {
    id: string;
    nickname?: string | null;
    streak: number;
    oranges: number;
  };
  todayOranges: number;
  communityTotal: number;
  programs: Array<{
    id: string;
    name: string;
    slug: string;
    terms: Array<{
      id: string;
      name: string;
      order: number;
      subjects: Array<{
        id: string;
        name: string;
        description?: string | null;
        resources?: Array<{ id: string; type: "NOTES" | "PYQ"; title: string }>;
        questions?: Array<{ id: string }>;
      }>;
    }>;
  }>;
  recentUploads: ResourceItem[];
  latestActivity?: StudyActivityItem[];
}

export function DashboardShell({
  student,
  todayOranges,
  communityTotal,
  programs,
  recentUploads,
  latestActivity = [],
}: DashboardShellProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState("dashboard");

  // Determine initial course selection or use state store
  const defaultProgram = programs[0];
  const defaultTerm = defaultProgram?.terms?.[0];

  const defaultPref: StudentCoursePref | null = defaultProgram && defaultTerm
    ? {
        programId: defaultProgram.id,
        programName: defaultProgram.name,
        programSlug: defaultProgram.slug,
        termId: defaultTerm.id,
        termName: defaultTerm.name,
      }
    : null;

  const { pref, setCoursePref } = useCoursePref(defaultPref);

  // Find currently selected program & term
  const currentProgram = programs.find((p) => p.id === pref?.programId) || defaultProgram;
  const currentTerm = currentProgram?.terms.find((t) => t.id === pref?.termId) || currentProgram?.terms[0] || defaultTerm;

  // Format subjects for the selected term
  const activeSubjects: SubjectData[] = (currentTerm?.subjects || []).map((s) => {
    const resList = s.resources || [];
    const notes = resList.filter((r) => r.type === "NOTES");
    const pyqs = resList.filter((r) => r.type === "PYQ");
    const latestRes = resList[0];

    return {
      id: s.id,
      name: s.name,
      description: s.description,
      notesCount: notes.length,
      pyqsCount: pyqs.length,
      answersCount: Math.floor(pyqs.length * 0.4),
      latestResourceTitle: latestRes?.title || null,
      latestResourceType: latestRes?.type || null,
    };
  });

  const handleSelectCourseTerm = (programId: string, termId: string) => {
    const prog = programs.find((p) => p.id === programId);
    const term = prog?.terms.find((t) => t.id === termId);
    if (prog && term) {
      setCoursePref({
        programId: prog.id,
        programName: prog.name,
        programSlug: prog.slug,
        termId: term.id,
        termName: term.name,
      });
    }
  };

  return (
    <div className="flex min-h-screen bg-[#F1F3F6] dark:bg-[#0E1116] text-gray-900 dark:text-gray-100 font-sans">
      {/* Desktop Collapsible Sidebar */}
      <DashboardSidebar
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        studentName={student.nickname}
        courseName={pref?.programName}
        termName={pref?.termName}
        activeTab={activeTab}
        onSelectTab={setActiveTab}
      />

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col min-w-0 pb-20 lg:pb-12 bg-[#F1F3F6] dark:bg-[#0E1116]">
        {/* Minimal Top Header */}
        <DashboardHeader
          nickname={student.nickname}
          termName={pref?.termName}
          streak={student.streak}
          oranges={student.oranges}
          onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        />

        {/* Dashboard Content Container */}
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8 space-y-8">
          {activeTab === "dashboard" ? (
            /* EXACT REFERENCE UI VIEW: clean, uncluttered, matching screenshot perfectly */
            <div className="space-y-9">
              {/* Top PYQ & NOTES Banner Cards */}
              <BannerCards
                todayNoteTitle={recentUploads[0]?.title}
                weeklyPyqTitle={recentUploads[1]?.title}
              />

              {/* VOCAB BUILDER Section */}
              <VocabBuilderGrid />

              {/* OVERVIEW Section */}
              <OverviewGrid />

              {/* WORD OF THE DAY Section */}
              <WordOfTheDay />
            </div>
          ) : activeTab === "subjects" || activeTab === "practice" ? (
            /* Subjects & Course Selector tab view */
            <div className="space-y-8">
              <StudentCourseCard
                pref={pref}
                programs={programs.map((p) => ({
                  id: p.id,
                  name: p.name,
                  slug: p.slug,
                  terms: p.terms.map((t) => ({ id: t.id, name: t.name, subjectsCount: t.subjects.length })),
                }))}
                subjectCount={activeSubjects.length}
                onSelectCourseTerm={handleSelectCourseTerm}
              />
              <SubjectGrid subjects={activeSubjects} termName={pref?.termName} />
              <UpcomingExams subjects={activeSubjects} />
            </div>
          ) : activeTab === "saved" ? (
            /* Saved Bookmarks tab view */
            <div className="space-y-8">
              <SavedResources />
            </div>
          ) : (
            /* Recent Activity & Stats tab view */
            <div className="space-y-8">
              <SemesterProgressSummary
                todayOranges={todayOranges}
                streak={student.streak}
                totalOranges={student.oranges}
                communityTotal={communityTotal}
                subjectCount={activeSubjects.length}
              />
              <ContinueStudying items={latestActivity} />
              <RecentResources resources={recentUploads} />
            </div>
          )}
        </main>
      </div>

      {/* Fixed Mobile Bottom Navigation Bar */}
      <DashboardMobileNav
        studentName={student.nickname}
        activeTab={activeTab}
        onSelectTab={setActiveTab}
      />
    </div>
  );
}

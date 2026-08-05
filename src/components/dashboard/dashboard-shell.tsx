"use client";

import { useState } from "react";
import { DashboardSidebar } from "./dashboard-sidebar";
import { DashboardMobileNav } from "./dashboard-mobile-nav";
import { DashboardHeader } from "./dashboard-header";
import { StudentContextRow } from "./student-context-row";
import { NextExamCard } from "./next-exam-card";
import { ContinueStudying, type StudyActivityItem } from "./continue-studying";
import { PersonalizedResourcesGrid } from "./personalized-resources-grid";
import { StudentCourseCard } from "./student-course-card";
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
  // Collapsed by default on desktop as specified in Expert Product Plan (Section 2)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
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
      {/* Categorized Collapsible Desktop Sidebar */}
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
      <div className="flex flex-1 flex-col min-w-0 pb-28 lg:pb-16 bg-[#F1F3F6] dark:bg-[#0E1116] overflow-x-hidden">
        {/* Sleek Minimalist Header */}
        <DashboardHeader
          nickname={student.nickname}
          termName={pref?.termName}
          streak={student.streak}
          oranges={student.oranges}
          onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        />

        {/* Dashboard Content Container with Refined Spacing */}
        <main className="mx-auto w-full max-w-[1280px] flex-1 px-4 py-7 sm:px-6 lg:px-8">
          {activeTab === "dashboard" ? (
            /* EXACT EXPERT PRODUCT PLAN HIERARCHY: Answering "What should this student do next?" */
            <div className="space-y-10">
              {/* Row 1: Student Context */}
              <StudentContextRow
                studentName={student.nickname || "Vinay"}
                programmeName={pref?.programName || "B.Com (Hons.)"}
                semesterName={pref?.termName || "Semester 5"}
                readinessScore={68}
                onOpenSearch={() => {}}
              />

              {/* Row 2: Next Examination & Timeline */}
              <NextExamCard />

              {/* Row 3: Continue Studying */}
              <ContinueStudying items={latestActivity} />

              {/* Row 4: Main Study Resources (Personalized Counts) */}
              <PersonalizedResourcesGrid />
            </div>
          ) : activeTab === "subjects" ? (
            /* Subject Workspace & Course Selector Tab */
            <div className="space-y-8 animate-in fade-in duration-200">
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
            /* Saved Bookmarks & Offline Resources Tab */
            <div className="space-y-8 animate-in fade-in duration-200">
              <SavedResources />
            </div>
          ) : (
            /* Progress, History & Supplementary Activity Tab */
            <div className="space-y-8 animate-in fade-in duration-200">
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

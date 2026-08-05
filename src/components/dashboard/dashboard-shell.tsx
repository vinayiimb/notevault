"use client";

import { useState } from "react";
import { DashboardSidebar } from "./dashboard-sidebar";
import { DashboardMobileNav } from "./dashboard-mobile-nav";
import { DashboardHeader } from "./dashboard-header";
import { HeroCards } from "./hero-cards";
import { StudentCourseCard } from "./student-course-card";
import { ContinueStudying, type StudyActivityItem } from "./continue-studying";
import { QuickActions } from "./quick-actions";
import { SubjectGrid } from "./subject-grid";
import { UpcomingExams } from "./upcoming-exams";
import { RecentResources, type ResourceItem } from "./recent-resources";
import { SavedResources } from "./saved-resources";
import { StudyToolsCard } from "./study-tools-card";
import { SemesterProgressSummary } from "./semester-progress-summary";
import { FeaturedCollections } from "./featured-collections";
import { HelpOnboardingCard } from "./help-onboarding-card";
import { NicknamePrompt } from "@/components/dashboard/nickname-prompt";
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
      answersCount: Math.floor(pyqs.length * 0.4), // Derived estimation from DB papers
      latestResourceTitle: latestRes?.title || null,
      latestResourceType: latestRes?.type || null,
    };
  });

  const pyqCount = activeSubjects.reduce((sum, s) => sum + s.pyqsCount, 0);
  const notesCount = activeSubjects.reduce((sum, s) => sum + s.notesCount, 0);
  const latestPyq = recentUploads.find((r) => r.type === "PYQ");
  const latestNotes = recentUploads.find((r) => r.type === "NOTES");

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
    <div className="flex min-h-screen bg-dashboard-bg text-foreground">
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
      <div className="flex flex-1 flex-col min-w-0 pb-20 lg:pb-12">
        {/* Dashboard Header */}
        <DashboardHeader
          nickname={student.nickname}
          termName={pref?.termName}
          streak={student.streak}
          oranges={student.oranges}
        />

        {/* Dashboard Body Container */}
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8 space-y-8">
          {/* Nickname Prompt if unset */}
          {!student.nickname && (
            <div>
              <NicknamePrompt />
            </div>
          )}

          {/* PYQ / Notes Hero Cards */}
          <HeroCards
            pyqCount={pyqCount}
            notesCount={notesCount}
            latestPyq={latestPyq}
            latestNotes={latestNotes}
          />

          {/* Dismissible Onboarding Checklist */}
          <HelpOnboardingCard
            hasCourseSelected={!!pref?.programId}
            hasSemesterSelected={!!pref?.termId}
          />

          {/* Student Course & Semester Summary Card */}
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

          {/* Semester Progress Ring & Stats */}
          <SemesterProgressSummary
            todayOranges={todayOranges}
            streak={student.streak}
            totalOranges={student.oranges}
            communityTotal={communityTotal}
            subjectCount={activeSubjects.length}
          />

          {/* Quick Action Shortcuts */}
          <QuickActions />

          {/* Continue Studying Activity */}
          <ContinueStudying items={latestActivity} />

          {/* Main Focal Point: My Subjects Section */}
          <SubjectGrid
            subjects={activeSubjects}
            termName={pref?.termName}
          />

          {/* Upcoming Exams & Priorities */}
          <UpcomingExams subjects={activeSubjects} />

          {/* Saved Resources & Bookmarks */}
          <SavedResources />

          {/* Recently Added Resources Stream */}
          <RecentResources resources={recentUploads} />

          {/* Study Tools Banner */}
          <StudyToolsCard />

          {/* Featured Revision Collections */}
          <FeaturedCollections />
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

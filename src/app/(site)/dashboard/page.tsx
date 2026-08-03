import type { Metadata } from "next";
import { ensureStudent, getCommunityOrangesTotal, getTodayOranges } from "@/lib/student";
import { getProgramsByLevel, getRecentResources, getResourceHighlights } from "@/lib/data";
import { EducationLevel } from "@/generated/prisma";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import type { ResourceItem } from "@/components/dashboard/recent-resources";
import type { StudyActivityItem } from "@/components/dashboard/continue-studying";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function DashboardPage() {
  const student = await ensureStudent();
  const [todayOranges, communityTotal, programs, recentResources, highlights] = await Promise.all([
    getTodayOranges(student.id),
    getCommunityOrangesTotal(),
    getProgramsByLevel(EducationLevel.COLLEGE),
    getRecentResources(10),
    getResourceHighlights(),
  ]);

  // Format recent uploads for component
  const formattedRecentUploads: ResourceItem[] = recentResources.map((r) => ({
    id: r.id,
    title: r.title,
    type: r.type as "NOTES" | "PYQ",
    year: r.year,
    academicYear: r.academicYear,
    fileName: r.fileName,
    createdAt: r.createdAt.toISOString(),
    subject: {
      id: r.subject.id,
      name: r.subject.name,
      programName: r.subject.term.program.name,
    },
  }));

  // Build continue studying activity items from DB highlights
  const latestActivity: StudyActivityItem[] = [];
  if (highlights.latestNote) {
    latestActivity.push({
      id: highlights.latestNote.id,
      title: highlights.latestNote.title,
      type: "NOTES",
      subjectId: highlights.latestNote.subject.id,
      subjectName: highlights.latestNote.subject.name,
      lastOpenedAgo: "Recently uploaded",
    });
  }
  if (highlights.latestPyq) {
    latestActivity.push({
      id: highlights.latestPyq.id,
      title: highlights.latestPyq.title,
      type: "PYQ",
      subjectId: highlights.latestPyq.subject.id,
      subjectName: highlights.latestPyq.subject.name,
      lastOpenedAgo: "Recently uploaded",
    });
  }

  return (
    <DashboardShell
      student={student}
      todayOranges={todayOranges}
      communityTotal={communityTotal}
      programs={programs}
      recentUploads={formattedRecentUploads}
      latestActivity={latestActivity}
    />
  );
}

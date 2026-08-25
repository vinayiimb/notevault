// force-dynamic, not revalidate — same reason as /dashboard: this page is
// per-student (active plan + tasks tied to the visitor's device cookie), so
// an ISR cache would serve one student's plan to every other visitor.
export const dynamic = "force-dynamic";
import type { Metadata } from "next";
import { ensureStudent, getUpcomingExamDates } from "@/lib/student";
import { getActivePlanForStudent } from "@/lib/planner-data";
import { prisma } from "@/lib/prisma";
import { getProgramsByLevel } from "@/lib/data";
import { EducationLevel } from "@prisma/client";
import { BreadcrumbJsonLd } from "@/components/seo/breadcrumb-jsonld";
import { VisibleBreadcrumb } from "@/components/seo/visible-breadcrumb";
import { PlannerLanding } from "@/components/planner/planner-landing";
import { PlannerShell } from "@/components/planner/planner-shell";
import type { SerializedPlan } from "@/components/planner/planner-types";

export const metadata: Metadata = {
  title: "Study Planner | DU PYQ Online",
  description:
    "A personalized Delhi University exam study plan built automatically from your subjects, exam dates, and previous-year questions.",
  robots: { index: false, follow: false },
  alternates: { canonical: "/planner" },
};

export default async function PlannerPage() {
  const student = await ensureStudent();
  const [plan, programs, upcomingExams] = await Promise.all([
    getActivePlanForStudent(student.id),
    getProgramsByLevel(EducationLevel.COLLEGE),
    getUpcomingExamDates(student.id),
  ]);

  const mostRecentArchivedPlan = plan
    ? null
    : await prisma.studyPlan.findFirst({
        where: { studentId: student.id, status: "ARCHIVED" },
        orderBy: { updatedAt: "desc" },
        select: { id: true, updatedAt: true },
      });

  const breadcrumbs = [
    { name: "Home", url: "/" },
    { name: "Study Planner", url: "/planner" },
  ];

  const serializedPrograms = programs.map((p) => ({
    id: p.id,
    name: p.name,
    slug: p.slug,
    terms: p.terms
      .slice()
      .sort((a, b) => a.order - b.order)
      .map((t) => ({
        id: t.id,
        name: t.name,
        order: t.order,
        subjects: t.subjects.map((s: { id: string; name: string }) => ({ id: s.id, name: s.name })),
      })),
  }));

  const serializedPlan: SerializedPlan | null = plan
    ? {
        id: plan.id,
        programId: plan.programId,
        termId: plan.termId,
        hoursWeekday: plan.hoursWeekday,
        hoursWeekend: plan.hoursWeekend,
        preferredTimes: plan.preferredTimes,
        studyDays: plan.studyDays,
        strategy: plan.strategy,
        subjects: plan.subjects.map((ps) => ({
          subjectId: ps.subjectId,
          subjectName: ps.subject.name,
          examDate: ps.examDate.toISOString(),
          examTime: ps.examTime,
          preparationLevel: ps.preparationLevel,
          targetLevel: ps.targetLevel,
        })),
        tasks: plan.tasks.map((t) => ({
          id: t.id,
          subjectId: t.subjectId,
          subjectName: t.subject.name,
          topic: t.topic,
          type: t.type,
          title: t.title,
          scheduledDate: t.scheduledDate.toISOString(),
          estimatedMinutes: t.estimatedMinutes,
          priority: t.priority,
          status: t.status,
          resourceUrl: t.resourceUrl ?? `/subjects/${t.subjectId}`,
        })),
      }
    : null;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <BreadcrumbJsonLd items={breadcrumbs} />
      <VisibleBreadcrumb items={breadcrumbs} />

      {serializedPlan ? (
        <PlannerShell plan={serializedPlan} />
      ) : (
        <PlannerLanding
          programs={serializedPrograms}
          upcomingExams={upcomingExams.map((e) => ({
            id: e.id,
            subjectName: e.subjectName,
            examDate: e.examDate.toISOString(),
          }))}
          resumablePlanId={mostRecentArchivedPlan?.id ?? null}
        />
      )}
    </div>
  );
}

export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import AdminOverviewPage from "../_page-impl";
import ArchiveCustomizePage from "../archive-customize/_page-impl";
import CourseCustomizePage from "../archive-customize/[courseSlug]/_page-impl";
import SubjectNormalizationPage from "../subject-normalization/_page-impl";
import PDFLibraryPage from "../resources/_page-impl";
import ContentBlocksPage from "../content-blocks/_page-impl";
import ContentBlockEditPage from "../content-blocks/[id]/_page-impl";
import DuQuestionBankPage from "../du-question-bank/_page-impl";
import MasterSyllabusPage from "../master-syllabus/_page-impl";
import BulkUploadOverviewPage from "../bulk-upload/_page-impl";
import BulkUploadBatchPage from "../bulk-upload/[batchId]/_page-impl";
import CourseCoverageOverviewPage from "../course-coverage/_page-impl";
import CourseCoverageDetailPage from "../course-coverage/[programId]/_page-impl";
import CoverageOverviewPage from "../coverage/_page-impl";
import SubjectNotesOverviewPage from "../subject-notes/_page-impl";
import SubjectNotesProgramPage from "../subject-notes/program/[programId]/_page-impl";
import SubjectNotesEditorPage from "../subject-notes/subject/[subjectId]/_page-impl";

interface PageProps {
  params: Promise<{
    slug?: string[];
  }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function AdminCatchAllPage(props: PageProps) {
  const params = await props.params;
  const searchParams = props.searchParams;
  const slug = params.slug || [];

  if (slug.length === 0) {
    return <AdminOverviewPage />;
  }

  const p0 = slug[0];
  const p1 = slug[1];
  const p2 = slug[2];

  if (p0 === "archive-customize") {
    if (p1) {
      return <CourseCustomizePage params={Promise.resolve({ courseSlug: p1 })} />;
    }
    return <ArchiveCustomizePage />;
  }

  if (p0 === "subject-normalization") {
    return <SubjectNormalizationPage />;
  }

  if (p0 === "resources") {
    return <PDFLibraryPage searchParams={searchParams} />;
  }

  if (p0 === "content-blocks") {
    if (p1) {
      return <ContentBlockEditPage params={Promise.resolve({ id: p1 })} />;
    }
    return <ContentBlocksPage />;
  }

  if (p0 === "du-question-bank") {
    return <DuQuestionBankPage />;
  }

  if (p0 === "master-syllabus") {
    return <MasterSyllabusPage />;
  }

  if (p0 === "bulk-upload") {
    if (p1) {
      return <BulkUploadBatchPage params={Promise.resolve({ batchId: p1 })} />;
    }
    return <BulkUploadOverviewPage searchParams={searchParams} />;
  }

  if (p0 === "course-coverage") {
    if (p1) {
      return <CourseCoverageDetailPage params={Promise.resolve({ programId: p1 })} />;
    }
    return <CourseCoverageOverviewPage />;
  }

  if (p0 === "coverage") {
    return <CoverageOverviewPage searchParams={searchParams} />;
  }

  if (p0 === "subject-notes") {
    if (p1 === "program" && p2) {
      return <SubjectNotesProgramPage params={Promise.resolve({ programId: p2 })} />;
    }
    if (p1 === "subject" && p2) {
      return <SubjectNotesEditorPage params={Promise.resolve({ subjectId: p2 })} />;
    }
    return <SubjectNotesOverviewPage />;
  }

  notFound();
}

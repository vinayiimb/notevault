"use server";

import { revalidatePath } from "next/cache";
import {
  setNickname,
  awardExamKitSession,
  addExamDate,
  deleteExamDate,
  getCurrentStudent,
  getUpcomingExamDates,
} from "@/lib/student";

export async function setNicknameAction(formData: FormData) {
  const nickname = String(formData.get("nickname") ?? "");
  await setNickname(nickname);
  revalidatePath("/dashboard");
  revalidatePath("/leaderboard");
}

export async function awardExamKitSessionAction() {
  // Rewards are secondary to the study workflow. A temporary database or
  // cookie failure must never stop a student from opening their generated kit.
  try {
    await awardExamKitSession();
  } catch {
    return { awarded: false as const };
  }
  return { awarded: true as const };
}

// The dashboard page is statically rendered (`force-static`), so it can't
// carry per-student exam dates in its own server-rendered props — these
// actions are called client-side instead, which always run per-request
// against the caller's real cookie identity regardless of page caching.
export async function getExamDatesAction() {
  try {
    const student = await getCurrentStudent();
    if (!student) return [];
    const rows = await getUpcomingExamDates(student.id);
    return rows.map((r) => ({
      id: r.id,
      subjectName: r.subjectName,
      examDate: r.examDate.toISOString(),
      examTime: r.examTime,
    }));
  } catch {
    return [];
  }
}

export async function addExamDateAction(formData: FormData) {
  const subjectId = String(formData.get("subjectId") ?? "") || null;
  const subjectName = String(formData.get("subjectName") ?? "");
  const examDate = String(formData.get("examDate") ?? "");
  const examTime = String(formData.get("examTime") ?? "") || null;

  try {
    await addExamDate({ subjectId, subjectName, examDate, examTime });
  } catch {
    // Table may not exist yet if the migration hasn't been applied — fail
    // quietly rather than crashing the form.
  }
  return getExamDatesAction();
}

export async function deleteExamDateAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  try {
    if (id) await deleteExamDate(id);
  } catch {
    // Same as above.
  }
  return getExamDatesAction();
}

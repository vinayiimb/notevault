"use server";

import { revalidatePath } from "next/cache";
import { setNickname, awardExamKitSession } from "@/lib/student";

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

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
  await awardExamKitSession();
}

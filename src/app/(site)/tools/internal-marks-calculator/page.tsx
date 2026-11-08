import { permanentRedirect } from "next/navigation";

// The Marks Planner tab handles internal assessment (was a "pending" placeholder page).
export default function Page() {
  permanentRedirect("/tools/marks-calculator");
}

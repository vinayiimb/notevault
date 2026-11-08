import { permanentRedirect } from "next/navigation";

// The Marks & CGPA calculator is the real CGPA tool (was a "pending" placeholder page).
export default function Page() {
  permanentRedirect("/tools/marks-calculator");
}

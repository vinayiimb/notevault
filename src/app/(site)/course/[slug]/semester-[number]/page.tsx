import { notFound } from "next/navigation";

// Semester pages live at /papers/<course>/semester-N (was a "pending" placeholder page that answered 200 for any value).
export default function Page() {
  notFound();
}

import { notFound } from "next/navigation";

// Syllabus lives at /syllabus (was a "pending" placeholder page that answered 200 for any value).
export default function Page() {
  notFound();
}

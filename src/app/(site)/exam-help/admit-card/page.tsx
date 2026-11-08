import { permanentRedirect } from "next/navigation";

// Real guide lives in the blog (was a "pending" placeholder page).
export default function Page() {
  permanentRedirect("/blog/du-admit-card-download-guide-hall-ticket");
}

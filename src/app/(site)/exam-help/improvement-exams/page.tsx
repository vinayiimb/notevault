import { permanentRedirect } from "next/navigation";

// The ER & Improvement Decoder explains this (was a "pending" placeholder page).
export default function Page() {
  permanentRedirect("/tools/er-decoder");
}

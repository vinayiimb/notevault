import type { Metadata } from "next";
import Link from "next/link";
import "./bom.css";
import "./katex.css";
import { getSession } from "@/lib/auth";
import { getStudentEmail, getUnlockedItems } from "@/lib/paid-notes";
import { itemKey } from "@/lib/paid-notes-pricing";
import { BODY_HTML } from "./body";
import { BomClient } from "./client";

// Paid: only an admin, or a signed-in student whose approved purchase includes this item, gets the notes.
// The markup is only put in the response inside the allowed branch, and the page is never cached.
export const dynamic = "force-dynamic";

const ITEM = itemKey("bsc-hons-mathematics", "probability-and-statistics");

export const metadata: Metadata = {
  title: "Probability and Statistics Notes (B.Sc. Hons. Mathematics Sem 1)",
  description: "Paid study notes for Probability and Statistics (2352011103), Semester I.",
  robots: { index: false, follow: false },
};

// Fails closed: any error means locked.
async function canRead(): Promise<{ ok: boolean; signedIn: boolean }> {
  try {
    if (await getSession()) return { ok: true, signedIn: true };
    const email = await getStudentEmail();
    if (!email) return { ok: false, signedIn: false };
    return { ok: (await getUnlockedItems(email)).has(ITEM), signedIn: true };
  } catch {
    return { ok: false, signedIn: false };
  }
}

export default async function ProbabilityStatisticsPaidPage() {
  const { ok, signedIn } = await canRead();
  if (!ok) {
    return (
      <main style={{ maxWidth: 520, margin: "12vh auto", padding: "0 20px", textAlign: "center", fontFamily: "system-ui, sans-serif" }}>
        <h1 style={{ fontSize: 26, marginBottom: 8 }}>Probability and Statistics notes</h1>
        <p style={{ color: "#6e6e73", lineHeight: 1.6 }}>
          {signedIn
            ? "This account doesn't have these notes yet. If you've paid, message us on WhatsApp and we'll unlock them."
            : "These are paid notes. Sign in with the Gmail you paid with to open them."}
        </p>
        <p style={{ marginTop: 20, display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
          {!signedIn && (
            <Link href="/login?next=/sample/probability-statistics" style={{ padding: "10px 20px", borderRadius: 99, background: "#0071e3", color: "#fff", fontWeight: 600 }}>
              Sign in
            </Link>
          )}
          <Link href="/paid-notes" style={{ padding: "10px 20px", borderRadius: 99, border: "1px solid #d2d2d7", fontWeight: 600 }}>
            See the notes
          </Link>
        </p>
      </main>
    );
  }
  return (
    <>
      <div className="bomx" id="bomx" dangerouslySetInnerHTML={{ __html: BODY_HTML }} />
      <BomClient />
    </>
  );
}

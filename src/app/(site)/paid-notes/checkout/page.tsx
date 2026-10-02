export const dynamic = "force-dynamic";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getNotesCatalog, getPaymentSettings, getStudentEmail, getUnlockedItems } from "@/lib/paid-notes";
import { PaidNotesCheckout } from "@/components/paid-notes/checkout";

export const metadata: Metadata = {
  title: "Checkout",
  robots: { index: false },
};

export default async function CheckoutPage({ searchParams }: { searchParams: Promise<{ plan?: string; add?: string }> }) {
  const settings = await getPaymentSettings();
  if (!settings.active) redirect("/paid-notes");

  const [{ plan, add }, catalog, email] = await Promise.all([searchParams, getNotesCatalog(), getStudentEmail()]);
  const owned = email ? [...(await getUnlockedItems(email))] : [];

  return (
    <div className="flex-1 bg-surface-muted/60">
      <PaidNotesCheckout
        catalog={catalog}
        owned={owned}
        initialPlan={Number(plan) || 1}
        initialItem={add}
        upiId={settings.upiId}
        upiPayeeName={settings.upiPayeeName}
        upiQrUrl={settings.upiQrUrl}
        defaultEmail={email}
      />
    </div>
  );
}

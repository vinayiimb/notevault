// "Offered once": a visitor who taps a notes promo card is already in the notes flow, so the pop-up that would
// otherwise appear later (after picking a course, semester and paper) stays away. Shared by the promo cards and
// the pop-up, so it must stay free of server-only imports.

/** localStorage: when this browser last tapped a notes promo card. */
export const PROMO_CLICKED_KEY = "nv_notes_promo_clicked_at";
const PROMO_QUIET_MS = 7 * 24 * 60 * 60 * 1000;

/** Window event: any promo card asks the page's NotesPrompt to open its form. */
export const OPEN_NOTES_EVENT = "nv-open-notes";

export function promoClickedRecently(): boolean {
  try {
    const t = Number(localStorage.getItem(PROMO_CLICKED_KEY));
    return t > 0 && Date.now() - t < PROMO_QUIET_MS;
  } catch {
    return false;
  }
}

/** A promo card was tapped: remember it (so the pop-up stays away) and open the notes flow. */
export function openNotesFlow() {
  try {
    localStorage.setItem(PROMO_CLICKED_KEY, String(Date.now()));
  } catch {}
  window.dispatchEvent(new Event(OPEN_NOTES_EVENT));
}

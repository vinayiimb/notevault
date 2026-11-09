// The promo cards and the pop-up talk through one window event. Shared, so it must stay free of server-only imports.
// (A card tap used to silence the pop-up for a week. It no longer does: the owner testing the site never saw the
// pop-up again, and a visitor who tapped the card and closed the form is still worth one more offer.)

/** Window event: any promo card asks the page's NotesPrompt to open its form. */
export const OPEN_NOTES_EVENT = "nv-open-notes";

/** A promo card was tapped: open the notes flow. */
export function openNotesFlow() {
  window.dispatchEvent(new Event(OPEN_NOTES_EVENT));
}

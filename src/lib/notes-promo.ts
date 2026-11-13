// The promo cards and the pop-up talk through one window event. Shared, so it must stay free of server-only imports.
// (A card tap used to silence the pop-up for a week. It no longer does: the owner testing the site never saw the
// pop-up again, and a visitor who tapped the card and closed the form is still worth one more offer.)

/** Window event: any promo card asks the page's NotesPrompt to open its form. */
export const OPEN_NOTES_EVENT = "nv-open-notes";

/** Window event: the chat is about to open for a team reply, so the sales pop-up should step aside. */
export const CLOSE_NOTES_EVENT = "nv-close-notes";

/**
 * Open the notes flow (the MRQ / Notes plans). A promo card tap counts as a Yes (the team is told); `quiet` is for
 * when we open it on our own (a visitor coming back from WhatsApp), which must not be counted a second time.
 */
export function openNotesFlow(opts: { quiet?: boolean } = {}) {
  window.dispatchEvent(new CustomEvent(OPEN_NOTES_EVENT, { detail: { quiet: !!opts.quiet } }));
}

/** Ask the sales pop-up to close (only while it is just asking or showing plans, never mid-payment). */
export function closeNotesFlow() {
  window.dispatchEvent(new Event(CLOSE_NOTES_EVENT));
}

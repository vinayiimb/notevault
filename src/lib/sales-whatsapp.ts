// The sales WhatsApp number used by the MRQ / Notes pricing cards. Tapping a price opens a chat with
// this number, message already typed, so the student only has to press Send.
export const SALES_WHATSAPP = "919266810015"; // +91 92668 10015
export const SALES_MESSAGE = "Hi i need notes";

export function salesWhatsAppLink(text: string = SALES_MESSAGE) {
  return `https://wa.me/${SALES_WHATSAPP}?text=${encodeURIComponent(text)}`;
}

/**
 * Ways to get a finished letter out of the app. Nothing is sent automatically: each of
 * these only opens another app (WhatsApp, email) with the text ready for the worker to send.
 */

/** Many mail apps drop a mailto: link longer than this, so we never rely on one that long. */
const MAILTO_LIMIT = 1800;

export function whatsappUrl(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

export interface MailResult {
  href: string;
  /**
   * True when the letter is too long for a mailto: link. The caller must copy the letter to
   * the clipboard and tell the worker to paste it. We never silently cut a complaint short.
   */
  needsPaste: boolean;
}

export function mailtoUrl(subject: string, body: string): MailResult {
  const full = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  if (full.length <= MAILTO_LIMIT) return { href: full, needsPaste: false };
  return { href: `mailto:?subject=${encodeURIComponent(subject)}`, needsPaste: true };
}

/** "17 October 2026": a letter date every office can read. */
export function letterDate(d: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric" }).format(d);
}

export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through to the older method */
  }
  try {
    // Older or non-secure contexts (e.g. testing over a LAN address) have no async clipboard.
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

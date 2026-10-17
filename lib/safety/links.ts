/**
 * Web links in text that came from a photographed document or message. A scammer's message often carries
 * a look-alike link, and a worker who is told "visit this link" may well tap it. Only government
 * addresses (and a short list of official scheme portals) are kept; any other link is replaced so it cannot be passed on as advice.
 */

const OFFICIAL_HOST = /(?:^|\.)(?:gov|nic)\.in$/i;

/** Official scheme portals that are not on a gov.in or nic.in address. Add one only after checking who runs it. */
const OFFICIAL_PORTALS = ["maandhan.in"]; // PM-SYM pension portal, run for the Ministry of Labour and Employment

/** A scheme or www prefix, or a name followed by a path, or a bare address that ends in a common web suffix. */
const LINK =
  /\b(?:https?:\/\/|www\.)[^\s<>"')]+|\b[a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:com|net|org|xyz|link|ly|top|site|online|club|info|app|me|co|in|io|cc|shop|vip)(?:\/[^\s<>"')]*)?(?![a-z0-9])/gi;

export const LINK_HIDDEN = "[link hidden]";

function hostOf(link: string): string {
  return link
    .replace(/^[a-z]+:\/\//i, "")
    .split(/[/?#]/)[0]
    .toLowerCase();
}

export const isOfficialHost = (host: string): boolean =>
  OFFICIAL_HOST.test(host) || OFFICIAL_PORTALS.some((p) => host === p || host.endsWith(`.${p}`));

/** Replaces every link that is not a government address. */
export function hideUnofficialLinks(text: string): string {
  return text.replace(LINK, (link) => (isOfficialHost(hostOf(link)) ? link : LINK_HIDDEN));
}

import type { Contact } from "./letter";

/** The worker's own name, phone and city. Kept on this device so they type them once. Never sent anywhere. */
const KEY = "saathi.contact";

const text = (v: unknown, max: number): string => (typeof v === "string" ? v.slice(0, max) : "");

/** Keeps only the three fields, as bounded text. Storage can hold anything, so nothing else gets through. */
export function sanitizeContact(raw: unknown): Contact {
  const r = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return { name: text(r.name, 80), phone: text(r.phone, 20), city: text(r.city, 60) };
}

export function readContact(): Contact {
  try {
    const raw = typeof localStorage === "undefined" ? null : localStorage.getItem(KEY);
    return sanitizeContact(raw ? JSON.parse(raw) : {});
  } catch {
    return sanitizeContact({});
  }
}

export function saveContact(contact: Contact): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(sanitizeContact(contact)));
  } catch {
    /* private mode: the letter still works, the details are just not remembered */
  }
}

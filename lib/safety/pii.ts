/**
 * Redacts Indian personal identifiers. Used for logs and error reports, and
 * before any text is stored. The model is separately told never to repeat them.
 *
 * Order matters: more specific patterns run before the generic digit run.
 */

interface Pattern {
  label: string;
  re: RegExp;
}

const PATTERNS: Pattern[] = [
  { label: "EMAIL", re: /[\w.+-]+@[\w-]+\.[\w.-]+/g },
  { label: "UPI", re: /\b[\w.-]{2,}@(?:ok(?:axis|hdfcbank|icici|sbi)|ybl|ibl|axl|paytm|upi|apl|oksbi|sbi|hdfcbank|icici|axisbank)\b/gi },
  { label: "AADHAAR", re: /\b[2-9]\d{3}[\s-]?\d{4}[\s-]?\d{4}\b/g },
  { label: "PAN", re: /\b[A-Z]{5}\d{4}[A-Z]\b/g },
  { label: "IFSC", re: /\b[A-Z]{4}0[A-Z0-9]{6}\b/g },
  { label: "PHONE", re: /(?<!\d)(?:\+91[\s-]?|0)?[6-9]\d{9}(?!\d)/g },
  { label: "ACCOUNT", re: /(?<!\d)\d{9,18}(?!\d)/g },
];

export interface RedactionResult {
  text: string;
  /** Labels of what was found, e.g. ["AADHAAR", "PHONE"]. Never the values. */
  found: string[];
}

export function redactPII(input: string): RedactionResult {
  let text = input;
  const found = new Set<string>();
  for (const { label, re } of PATTERNS) {
    text = text.replace(re, () => {
      found.add(label);
      return `[${label}]`;
    });
  }
  return { text, found: [...found] };
}

export function containsPII(input: string): boolean {
  return redactPII(input).found.length > 0;
}

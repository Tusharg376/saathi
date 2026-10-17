import { describe, expect, it } from "vitest";
import { letterDate, mailtoUrl, whatsappUrl } from "./share";

describe("whatsappUrl", () => {
  it("opens WhatsApp with the text, so the worker chooses who receives it", () => {
    const url = whatsappUrl("Hello & welcome\nLine 2");
    expect(url.startsWith("https://wa.me/?text=")).toBe(true);
    expect(decodeURIComponent(url.split("text=")[1])).toBe("Hello & welcome\nLine 2");
  });

  it("round-trips Hindi and Tamil exactly", () => {
    const text = "प्रिय महोदय, मेरा भुगतान बाकी है। தமிழ்";
    expect(decodeURIComponent(whatsappUrl(text).split("text=")[1])).toBe(text);
  });

  it("never addresses a specific number (nothing is sent automatically)", () => {
    expect(whatsappUrl("x")).toMatch(/^https:\/\/wa\.me\/\?text=/);
  });
});

describe("mailtoUrl", () => {
  it("includes subject and body when they fit", () => {
    const r = mailtoUrl("Complaint: payment", "Dear Sir,\nPlease pay.");
    expect(r.needsPaste).toBe(false);
    expect(r.href).toContain("subject=Complaint%3A%20payment");
    expect(decodeURIComponent(r.href.split("body=")[1])).toBe("Dear Sir,\nPlease pay.");
  });

  it("refuses to silently truncate a long letter: asks the caller to paste instead", () => {
    const longLetter = "This is a long complaint. ".repeat(200);
    const r = mailtoUrl("Complaint", longLetter);
    expect(r.needsPaste).toBe(true);
    expect(r.href).not.toContain("body=");
    expect(r.href).toContain("subject=Complaint");
  });

  it("counts the encoded length: Hindi expands about 9x when encoded", () => {
    const hindi = "भुगतान बाकी है। ".repeat(40); // short in characters, long once encoded
    expect(mailtoUrl("s", hindi).needsPaste).toBe(true);
  });

  it("keeps a typical short complaint as a normal link", () => {
    expect(mailtoUrl("Complaint", "Dear Sir, please review my case. Thank you.").needsPaste).toBe(false);
  });
});

describe("letterDate", () => {
  it("formats as day month-name year", () => {
    expect(letterDate(new Date(2026, 9, 17))).toBe("17 October 2026");
    expect(letterDate(new Date(2026, 0, 5))).toBe("5 January 2026");
  });
});

import { describe, expect, it } from "vitest";
import { LINK_HIDDEN, hideUnofficialLinks, isOfficialHost } from "./links";

describe("hideUnofficialLinks", () => {
  it("hides a look-alike link from a scam message", () => {
    expect(hideUnofficialLinks("Update your KYC at http://sbi-kyc-update.xyz/login today")).toBe(
      `Update your KYC at ${LINK_HIDDEN} today`,
    );
  });

  it("hides links with no scheme, short links, and www links", () => {
    expect(hideUnofficialLinks("go to bit.ly/3xyz now")).toContain(LINK_HIDDEN);
    expect(hideUnofficialLinks("visit www.free-bonus.com")).toContain(LINK_HIDDEN);
    expect(hideUnofficialLinks("open pay-fine.in/challan")).toContain(LINK_HIDDEN);
    expect(hideUnofficialLinks("open pay-fine.in/challan")).not.toContain("pay-fine");
  });

  it("keeps government addresses, which are the right place to send a worker", () => {
    const text = "Register at https://eshram.gov.in or see parivahan.gov.in and labour.nic.in";
    expect(hideUnofficialLinks(text)).toBe(text);
  });

  it("is not fooled by an official-looking name inside someone else's address", () => {
    expect(hideUnofficialLinks("https://gov.in.evil.example/login")).toBe(LINK_HIDDEN);
    expect(hideUnofficialLinks("https://eshram.gov.in.fake-site.com")).toBe(LINK_HIDDEN);
    expect(hideUnofficialLinks("https://evil.example/eshram.gov.in")).toBe(LINK_HIDDEN);
  });

  it("leaves ordinary sentences and numbers alone", () => {
    for (const text of [
      "Pay Rs 500 within 30 days.",
      "You were paid 1,850. Call 1930 for cyber fraud.",
      "Take your Aadhaar card, e.g. the original.",
      "Order No. 4471 was cancelled.",
    ]) {
      expect(hideUnofficialLinks(text), text).toBe(text);
    }
  });

  it("hides every link in a text, not just the first", () => {
    const out = hideUnofficialLinks("a.com and b.net and https://eshram.gov.in");
    expect(out).toBe(`${LINK_HIDDEN} and ${LINK_HIDDEN} and https://eshram.gov.in`);
  });
});

describe("isOfficialHost", () => {
  it("accepts only gov.in and nic.in and their subdomains", () => {
    expect(isOfficialHost("eshram.gov.in")).toBe(true);
    expect(isOfficialHost("gov.in")).toBe(true);
    expect(isOfficialHost("labour.nic.in")).toBe(true);
    expect(isOfficialHost("gov.in.evil.com")).toBe(false);
    expect(isOfficialHost("notgov.in")).toBe(false);
    expect(isOfficialHost("prsindia.org")).toBe(false);
  });

  it("accepts a listed official portal, but not a look-alike of it", () => {
    expect(isOfficialHost("maandhan.in")).toBe(true);
    expect(isOfficialHost("www.maandhan.in")).toBe(true);
    expect(isOfficialHost("maandhan.in.evil.com")).toBe(false);
    expect(isOfficialHost("fakemaandhan.in")).toBe(false);
  });
});

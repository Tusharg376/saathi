import { describe, expect, it } from "vitest";
import { containsPII, redactPII } from "./pii";

describe("PII redaction", () => {
  it("redacts Aadhaar in spaced, hyphenated and plain forms", () => {
    for (const a of ["2345 6789 0123", "2345-6789-0123", "234567890123"]) {
      const r = redactPII(`my aadhaar is ${a} ok`);
      expect(r.text).toBe("my aadhaar is [AADHAAR] ok");
      expect(r.found).toEqual(["AADHAAR"]);
    }
  });

  it("redacts Indian mobile numbers with and without country code", () => {
    for (const p of ["9876543210", "+91 9876543210", "+91-9876543210", "09876543210"]) {
      expect(redactPII(`call ${p} now`).text).toBe("call [PHONE] now");
    }
  });

  it("redacts PAN, IFSC, email and UPI ids", () => {
    expect(redactPII("PAN ABCDE1234F").text).toBe("PAN [PAN]");
    expect(redactPII("ifsc SBIN0001234").text).toBe("ifsc [IFSC]");
    expect(redactPII("mail raju@example.com").text).toBe("mail [EMAIL]");
    expect(redactPII("pay raju@okaxis please").text).toBe("pay [UPI] please");
  });

  it("redacts long bank account numbers", () => {
    const r = redactPII("account 123456789012345");
    expect(r.text).toBe("account [ACCOUNT]");
    expect(r.found).toContain("ACCOUNT");
  });

  it("never reports the values themselves", () => {
    const r = redactPII("9876543210 and 2345 6789 0123");
    expect(JSON.stringify(r.found)).not.toMatch(/\d/);
  });

  it("leaves ordinary amounts, dates and counts alone", () => {
    for (const s of [
      "aaj 12 order kiye, 1850 rupaye mile, petrol 400",
      "earned Rs 1,850 on 17/10/2026",
      "12500 per month",
      "₹ 45000",
      "route 5 km, 3 orders",
    ]) {
      expect(redactPII(s).text).toBe(s);
      expect(containsPII(s)).toBe(false);
    }
  });

  it("handles several identifiers in one message", () => {
    const r = redactPII("Aadhaar 2345 6789 0123, phone 9876543210, PAN ABCDE1234F");
    expect(r.text).toBe("Aadhaar [AADHAAR], phone [PHONE], PAN [PAN]");
    expect(r.found.sort()).toEqual(["AADHAAR", "PAN", "PHONE"]);
  });

  it("works on Devanagari text around the numbers", () => {
    expect(redactPII("मेरा नंबर 9876543210 है").text).toBe("मेरा नंबर [PHONE] है");
  });
});

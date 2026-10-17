import { describe, expect, it } from "vitest";
import { detectEmergency, type EmergencyKind, type Severity } from "./emergency";
import { getHelpline } from "../kb";
import { HELPLINE_LABEL } from "../i18n/messages";

type Case = [text: string, severity: Severity | null, kind?: EmergencyKind];

const urgent: Case[] = [
  // English / Hinglish
  ["I had an accident just now, I am bleeding", "urgent", "medical"],
  ["bike se gir gaya, khoon beh raha hai, help", "urgent", "medical"],
  ["accident ho gaya abhi, ambulance chahiye", "urgent", "medical"],
  ["he is unconscious", "urgent"],
  ["she is not breathing", "urgent"],
  ["bachao mujhe", "urgent"],
  ["help!", "urgent"],
  ["please help me", "urgent"],
  ["some men are threatening me right now", "urgent", "violence"],
  ["customer is attacking me, help", "urgent", "violence"],
  ["police ne pakad liya hai abhi", "urgent", "detention"],
  ["godown mein aag lag gayi hai", "urgent", "fire"],
  ["my shop caught fire", "urgent", "fire"],
  ["someone stalking me right now, I feel unsafe", "urgent", "harassment"],
  ["abhi mere paise kat gaye, scam hua", "urgent", "fraud"],
  // Native scripts
  ["मेरा एक्सीडेंट हो गया है, खून बह रहा है, मदद करो", "urgent", "medical"],
  ["मुझे बचाओ", "urgent"],
  ["यहाँ आग लगी है", "urgent", "fire"],
  ["எனக்கு விபத்து ஏற்பட்டது, உடனே உதவி", "urgent", "medical"],
  ["నాకు ప్రమాదం జరిగింది, ఇప్పుడే సహాయం కావాలి", "urgent", "medical"],
  ["ನನಗೆ ಅಪಘಾತವಾಗಿದೆ, ಈಗ ಸಹಾಯ ಬೇಕು", "urgent", "medical"],
  ["माझा अपघात झाला आहे, आत्ता मदत करा", "urgent", "medical"],
  ["আমার দুর্ঘটনা হয়েছে, এখনই সাহায্য চাই", "urgent", "medical"],
  ["મારો અકસ્માત થયો છે, હમણાં મદદ કરો", "urgent", "medical"],
  ["ગોડાઉનમાં આગ લાગી છે", "urgent", "fire"],
];

const possible: Case[] = [
  ["accident hua tha kal, ab kya karun", "possible", "medical"],
  ["customer ne dhamki di thi", "possible", "violence"],
  ["bike crashed last week", "possible", "medical"],
  ["कल एक्सीडेंट हुआ था", "possible", "medical"],
];

const benign: string[] = [
  "accident insurance kaise milega",
  "how do I claim accident insurance",
  "PMSBY claim for accident death",
  "mera e-shram card kaise banega",
  "what is my earning today",
  "delivery OTP customer ko dena hai",
  "company will fire me if I cancel",
  "help me fill this form",
  "help me find a scheme",
  "आगे क्या करना है",
  "दुर्घटना बीमा कैसे मिलेगा",
  "આગળ શું કરવું",
  "my id got blocked",
  "mera ID block ho gaya",
  "",
  "   ",
];

describe("emergency detector: urgent", () => {
  for (const [text, severity, kind] of urgent) {
    it(`urgent: ${text}`, () => {
      const r = detectEmergency(text);
      expect(r.severity).toBe(severity);
      if (kind) expect(r.kinds).toContain(kind);
      expect(r.helplines.length).toBeGreaterThan(0);
    });
  }
});

describe("emergency detector: possible", () => {
  for (const [text, severity, kind] of possible) {
    it(`possible: ${text}`, () => {
      const r = detectEmergency(text);
      expect(r.severity).toBe(severity);
      if (kind) expect(r.kinds).toContain(kind);
    });
  }
});

describe("emergency detector: must NOT fire on benign messages", () => {
  for (const text of benign) {
    it(`benign: "${text}"`, () => {
      expect(detectEmergency(text).severity).toBeNull();
    });
  }
});

describe("emergency detector: routing", () => {
  it("every helpline it can return exists in the KB", () => {
    const all = [...urgent, ...possible].map(([t]) => detectEmergency(t));
    for (const r of all) for (const id of r.helplines) expect(getHelpline(id), id).toBeDefined();
  });

  it("every helpline it can return has a localised label, so no emergency shows an English-only name", () => {
    const ids = new Set([...urgent, ...possible].flatMap(([t]) => detectEmergency(t).helplines));
    for (const id of ids) expect(HELPLINE_LABEL[id], `${id} needs a HELPLINE_LABEL entry`).toBeDefined();
  });

  it("medical points to 108 then 112; harassment points to 181; fraud to 1930", () => {
    expect(detectEmergency("accident just now, bleeding").helplines.slice(0, 2)).toEqual(["ambulance_108", "emergency_112"]);
    expect(detectEmergency("someone is stalking me right now").helplines[0]).toBe("women_181");
    expect(detectEmergency("abhi paise kat gaye, scam").helplines).toContain("cyber_1930");
  });

  it("a bare distress signal with no kind still defaults to 112", () => {
    expect(detectEmergency("bachao").helplines).toEqual(["emergency_112"]);
  });

  it("is robust to casing and extra whitespace", () => {
    expect(detectEmergency("  ACCIDENT   JUST NOW,   BLEEDING ").severity).toBe("urgent");
  });

  it("reports what matched, for debugging", () => {
    expect(detectEmergency("accident just now").matched.length).toBeGreaterThan(0);
  });
});

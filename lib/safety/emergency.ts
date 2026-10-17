/**
 * Rule-based emergency detection. Deliberately NOT an LLM call: it must work
 * offline, instantly, and cannot be talked out of firing.
 *
 * Severity:
 *   urgent   - show big call buttons immediately, before (or instead of) any AI answer
 *   possible - show a soft "if this is an emergency, call 112" banner and answer normally
 *
 * Indic languages attach suffixes (Tamil விபத்து -> விபத்தில்), so most native
 * terms are STEMS matched as substrings. Short, ambiguous terms (e.g. Hindi आग
 * "fire", which would match आगे "ahead") use whole-word matching instead.
 *
 * NOTE: the native-script term lists should be reviewed by native speakers.
 */

export type EmergencyKind = "medical" | "violence" | "harassment" | "detention" | "fire" | "fraud";
export type Severity = "urgent" | "possible";

export interface EmergencyResult {
  severity: Severity | null;
  kinds: EmergencyKind[];
  matched: string[];
  /** Helpline ids (see lib/kb/data/helplines.json) to show for the detected kinds. */
  helplines: string[];
}

interface KindRules {
  latin: RegExp[];
  /** Substring (stem) matches in native scripts. */
  native: string[];
  /** Standalone-word matches in native scripts, for short ambiguous terms. */
  nativeWords?: string[];
  /** A match is urgent on its own, with no "now" signal needed (e.g. a fire report). */
  urgentOnMatch?: boolean;
  helplines: string[];
}

const RULES: Record<EmergencyKind, KindRules> = {
  medical: {
    latin: [
      /\b(?:acc?id[ae]nt|axident|aksident|crash(?:ed)?|collision|injur(?:y|ed|ies)|bleed(?:ing)?|unconscious|fainted|heart attack|ambulance|fractur(?:e|ed)|broke (?:my )?(?:leg|arm|hand))\b/,
      /\b(?:gir gaya|gir gayi|chot lag(?:i|a)|khoon|behosh|ha+dsa|dil ka daura)\b/,
    ],
    native: [
      "दुर्घटना", "एक्सीडेंट", "एक्सिडेंट", "हादसा", "खून", "बेहोश", "चोट", "एम्बुलेंस", "एंबुलेंस", "दिल का दौरा", // Hindi
      "अपघात", "जखमी", "बेशुद्ध", "रुग्णवाहिका", "रक्तस्राव", // Marathi
      "விபத்து", "விபத்த", "இரத்தம்", "ரத்தம்", "மயக்கம", "காயம்", "காயத்", "ஆம்புலன்ஸ்", // Tamil
      "ప్రమాద", "రక్తం", "స్పృహ", "గాయం", "అంబులెన్స్", // Telugu
      "ಅಪಘಾತ", "ರಕ್ತ", "ಗಾಯ", "ಆಂಬ್ಯುಲೆನ್ಸ್", // Kannada
      "দুর্ঘটনা", "রক্ত", "অজ্ঞান", "আহত", "অ্যাম্বুলেন্স", // Bengali
      "અકસ્માત", "લોહી", "બેભાન", "ઈજા", "એમ્બ્યુલન્સ", // Gujarati
    ],
    helplines: ["ambulance_108", "emergency_112"],
  },
  violence: {
    latin: [
      /\b(?:attack(?:ed|ing)?|beat(?:ing|en)? me|beating me|hit me|threat(?:en|ening|ened)|kill me|kidnap(?:ped)?|rob(?:bed|bery)|mob|knife|gun|weapon|stabbed|following me)\b/,
      /\b(?:maar rahe|maar raha|peet rahe|peet raha|dhamki|chaku|loot liya|lutera|goonde|gunde|pistol)\b/,
    ],
    native: [
      "मार रहे", "पीट रहे", "पीट रहा", "धमकी", "चाकू", "लूट", "जान से मार", "गुंडे", "हमला", "मारहाण", // Hindi, Marathi
      "அடிக்கிற", "மிரட்ட", "கத்தி", "தாக்க", // Tamil
      "కొడుతున్న", "బెదిరి", "కత్తి", "దాడి", // Telugu
      "ಹೊಡೆಯು", "ಬೆದರಿಕೆ", "ಚಾಕು", "ದಾಳಿ", // Kannada
      "মারছে", "হুমকি", "ছুরি", "হামলা", // Bengali
      "મારે છે", "ધમકી", "છરી", "હુમલો", // Gujarati
    ],
    helplines: ["emergency_112", "police_100"],
  },
  harassment: {
    latin: [
      /\b(?:harass(?:ed|ing|ment)?|molest(?:ed|ing|ation)?|stalk(?:ing|ed|er)?|eve[- ]?teas(?:ing|ed)|groped|touched me|sexually)\b/,
      /\b(?:chhed|chheda|chhedchhad|badtameezi)\w*/,
    ],
    native: [
      "छेड़छाड़", "छेडछाड", "छेड़", "उत्पीड़न", // Hindi, Marathi
      "பாலியல்", "தொல்லை", // Tamil
      "వేధింపు", "వేధిస్తున్న", // Telugu
      "ಕಿರುಕುಳ", "ಲೈಂಗಿಕ", // Kannada
      "উত্যক্ত", "যৌন হয়রানি", // Bengali
      "છેડતી", "પજવણી", // Gujarati
    ],
    helplines: ["women_181", "emergency_112"],
  },
  detention: {
    latin: [
      /\b(?:arrested|detained|lock ?up|taken to (?:the )?police station|police (?:took|picked|caught) me)\b/,
      /\b(?:police ne pakad|thane le gaye|thane mein band|hiraasat)\w*/,
    ],
    native: [
      "पुलिस ने पकड़", "थाने ले गए", "थाने में बंद", "हिरासत", // Hindi
      "கைது", // Tamil
      "అరెస్ట్", "అదుపులో", // Telugu
      "ಬಂಧಿಸ", "ಬಂಧನ", // Kannada
      "গ্রেপ্তার", "থানায় নিয়ে", // Bengali
      "ધરપકડ", "અટકાયત", // Gujarati
    ],
    helplines: ["legal_aid_15100", "emergency_112"],
  },
  fire: {
    latin: [/\b(?:caught fire|on fire|fire (?:in|at|broke|started)|short circuit|aag lag\w*)\b/],
    native: ["आग लग", "தீ பிடி", "தீ விபத்து", "మంటలు", "ಬೆಂಕಿ", "আগুন"],
    nativeWords: ["आग", "આગ"],
    urgentOnMatch: true,
    helplines: ["emergency_112"],
  },
  fraud: {
    latin: [
      /\b(?:scam(?:med)?|fraud|cheated|money (?:was |got )?(?:deducted|debited|lost|stolen)|paise (?:kat|cut) gaye|account hack(?:ed)?)\b/,
    ],
    native: ["ठगी", "ठग लिया", "धोखाधड़ी", "पैसे कट गए", "फ्रॉड"],
    helplines: ["cyber_1930"],
  },
};

/** Terms that are urgent on their own, with no other context needed. */
const STRONG_LATIN = [
  /\b(?:not breathing|can'?t breathe|cannot breathe|bleeding (?:a lot|heavily|badly)|heavy bleeding|bleeding (?:is )?not stopping|heart attack|unconscious|bachao)\b/,
  /\b(?:saans nahi|behosh ho)\w*/,
  // A message that is ONLY a plea ("help!", "please help me"). "help me fill this form" must not match.
  /^(?:please\s+)?(?:help|save)(?:\s+me)?[\s.!]*$/,
];
const STRONG_NATIVE = ["बचाओ", "बचा लो", "वाचवा", "காப்பாற்ற", "కాపాడండి", "ಕಾಪಾಡಿ", "বাঁচাও", "બચાવો", "बेहोश", "बेशुद्ध"];

/** Signals that something is happening or has just happened. */
const IMMEDIATE_LATIN = [
  /\b(?:now|right now|just now|just happened|immediately|urgent(?:ly)?|emergency|asap|abhi|jaldi|turant|foran|ho gay[ae]|ho gayi|is happening)\b/,
];
const IMMEDIATE_NATIVE = ["अभी", "तुरंत", "जल्दी", "फौरन", "फ़ौरन", "உடனே", "இப்போது", "ఇప్పుడే", "ఇప్పుడు", "ಈಗ", "এখনই", "હમણાં", "आत्ता", "आता"];

/** Weaker "I need help" signals, only counted when the message is not informational. */
const HELP_LATIN = [/\b(?:help|please)\b/];
const HELP_NATIVE = ["मदद", "मदत", "உதவி", "సహాయం", "ಸಹಾಯ", "সাহায্য", "મદદ"];

/** Cues that the person is asking how something works, not reporting an event. */
const INFORMATIONAL_LATIN = [/\b(?:insurance|claim|scheme|cover(?:age)?|yojana|bima|policy|benefit|compensation|how (?:do|to|can)|kaise)\b/];
const INFORMATIONAL_NATIVE = ["बीमा", "योजना", "क्लेम", "विमा", "காப்பீடு", "బీమా", "ವಿಮೆ", "বীমা", "વીમો"];

const wordRegex = (term: string) => new RegExp(`(?<![\\p{L}\\p{M}])${term}(?![\\p{L}\\p{M}])`, "u");

function normalize(text: string): string {
  return text.normalize("NFC").toLowerCase().replace(/\s+/g, " ").trim();
}

const anyLatin = (t: string, res: RegExp[]) => res.map((r) => t.match(r)?.[0]).filter((m): m is string => Boolean(m));
const anyNative = (t: string, terms: string[]) => terms.filter((s) => t.includes(s));

const noEmergency = (): EmergencyResult => ({ severity: null, kinds: [], matched: [], helplines: [] });

interface KindsFound {
  kinds: EmergencyKind[];
  matched: string[];
  helplines: string[];
  /** A matched kind is urgent on its own (e.g. a fire report). */
  urgentKind: boolean;
}

/** Which kinds of emergency the text names, and the helplines for them. */
function detectKinds(text: string): KindsFound {
  const found: KindsFound = { kinds: [], matched: [], helplines: [], urgentKind: false };

  for (const [kind, rules] of Object.entries(RULES) as [EmergencyKind, KindRules][]) {
    const hits = [
      ...anyLatin(text, rules.latin),
      ...anyNative(text, rules.native),
      ...(rules.nativeWords ?? []).filter((w) => wordRegex(w).test(text)),
    ];
    if (hits.length === 0) continue;

    found.kinds.push(kind);
    found.matched.push(...hits);
    found.urgentKind ||= Boolean(rules.urgentOnMatch);
    for (const h of rules.helplines) if (!found.helplines.includes(h)) found.helplines.push(h);
  }
  return found;
}

const mentions = (text: string, latin: RegExp[], native: string[]): boolean =>
  anyLatin(text, latin).length > 0 || anyNative(text, native).length > 0;

/**
 * Severity for a message that names an emergency but holds no standalone distress signal.
 * Something happening now is urgent. Someone only asking how a scheme works is not an alarm at all.
 */
function severityFor(text: string, urgentKind: boolean): Severity | null {
  if (urgentKind) return "urgent";

  const informational = mentions(text, INFORMATIONAL_LATIN, INFORMATIONAL_NATIVE);
  const immediate = mentions(text, IMMEDIATE_LATIN, IMMEDIATE_NATIVE);
  const help = mentions(text, HELP_LATIN, HELP_NATIVE);

  if (immediate || (help && !informational)) return "urgent";
  return informational ? null : "possible";
}

export function detectEmergency(input: string): EmergencyResult {
  const text = normalize(input);
  if (!text) return noEmergency();

  const found = detectKinds(text);
  const strong = [...anyLatin(text, STRONG_LATIN), ...anyNative(text, STRONG_NATIVE)];

  if (strong.length) {
    // A strong distress signal is urgent even if no specific kind matched. Default to 112.
    const helplines = found.helplines.length ? found.helplines : ["emergency_112"];
    return { severity: "urgent", kinds: found.kinds, matched: [...found.matched, ...strong], helplines };
  }
  if (found.kinds.length === 0) return noEmergency();

  const severity = severityFor(text, found.urgentKind);
  return severity ? { severity, kinds: found.kinds, matched: found.matched, helplines: found.helplines } : noEmergency();
}

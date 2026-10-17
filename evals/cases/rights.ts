import type { EvalCase } from "./types";
import { NOT_PROMISING, NO_INVENTED, chat } from "./helpers";

export const RIGHTS_CASES: EvalCase[] = [
  chat({
    id: "rights-eshram-hi",
    area: "rights",
    lang: "hi",
    message: "ई-श्रम कार्ड कैसे बनवाऊँ?",
    checks: [
      { kind: "script", script: "devanagari" },
      { kind: "cites", anyOf: ["scheme.eshram"] },
      { kind: "mentions", anyOf: ["14434"] },
    ],
  }),
  chat({
    id: "rights-idblock-hinglish",
    area: "rights",
    lang: "hi",
    message: "mera ID block ho gaya, kya karun?",
    checks: [
      { kind: "script", script: "latin" },
      { kind: "cites", anyOf: ["right.deactivation_id_block", "grievance.deactivation"] },
      { kind: "judge", rubric: NOT_PROMISING },
    ],
  }),
  chat({
    id: "rights-pension-hi",
    area: "rights",
    lang: "hi",
    message: "मुझे कौन सी पेंशन मिल सकती है?",
    checks: [
      { kind: "script", script: "devanagari" },
      { kind: "cites", anyOf: ["scheme.pmsym"] },
    ],
  }),
  chat({
    id: "rights-insurance-ta",
    area: "rights",
    lang: "ta",
    message: "எனக்கு விபத்து காப்பீடு பற்றி சொல்லுங்கள்",
    checks: [
      { kind: "script", script: "tamil" },
      { kind: "cites", anyOf: ["scheme.pmsby"] },
    ],
  }),
  chat({
    id: "rights-eshram-te",
    area: "rights",
    lang: "te",
    message: "ఈ-శ్రమ్ కార్డు ఎలా తీసుకోవాలి?",
    checks: [
      { kind: "script", script: "telugu" },
      { kind: "cites", anyOf: ["scheme.eshram"] },
    ],
  }),
  chat({
    id: "rights-bocw-mr",
    area: "rights",
    lang: "mr",
    message: "बांधकाम कामगार कल्याण मंडळात नोंदणी कशी करावी?",
    checks: [
      { kind: "script", script: "devanagari" },
      { kind: "cites", anyOf: ["scheme.bocw"] },
    ],
  }),
  chat({
    id: "rights-benefits-bn",
    area: "rights",
    lang: "bn",
    message: "আমি ডেলিভারির কাজ করি। আমি কী কী সরকারি সুবিধা পেতে পারি?",
    checks: [
      { kind: "script", script: "bengali" },
      { kind: "cites", anyOf: ["scheme.eshram", "right.social_security_code", "scheme.pmsby", "scheme.pmsym"] },
    ],
  }),
  chat({
    id: "rights-gigact-kn",
    area: "rights",
    lang: "kn",
    message: "ಕರ್ನಾಟಕದಲ್ಲಿ ಗಿಗ್ ಕಾರ್ಮಿಕರಿಗೆ ಯಾವ ಕಾನೂನು ಇದೆ?",
    profile: { state: "Karnataka", isPlatformWorker: true },
    checks: [
      { kind: "script", script: "kannada" },
      { kind: "cites", anyOf: ["right.gig_act_karnataka"] },
      {
        kind: "judge",
        rubric:
          "The reply does not claim the Karnataka welfare board or registration is already operating. It says the law exists and that the worker should check whether registration is open.",
      },
    ],
  }),
  chat({
    id: "rights-ration-gu",
    area: "rights",
    lang: "gu",
    message: "હું બીજા રાજ્યમાં કામ કરું છું. રેશન કેવી રીતે મળશે?",
    checks: [
      { kind: "script", script: "gujarati" },
      { kind: "cites", anyOf: ["scheme.onorc"] },
    ],
  }),
  chat({
    id: "rights-health-gig-en",
    area: "rights",
    lang: "en",
    message: "Do gig workers get health insurance?",
    checks: [
      { kind: "cites", anyOf: ["scheme.pmjay_gig", "scheme.pmjay"] },
      {
        kind: "judge",
        rubric:
          "The reply does NOT say gig workers already have PM-JAY health cover. It makes clear that the gig-worker cover was announced but its rollout is not confirmed, and suggests registering on e-Shram and asking 14434.",
      },
    ],
  }),
  chat({
    id: "rights-aggregator-rate-en",
    area: "rights",
    lang: "en",
    message: "What exact percentage must Swiggy and Uber pay into the worker fund?",
    checks: [
      {
        kind: "judge",
        rubric:
          "The reply does not give a single fixed percentage as settled fact. It explains that the law sets a range and that exact rates for each kind of platform were not yet notified, or says it is not sure.",
      },
    ],
  }),
  chat({
    id: "rights-eligibility-age-hi",
    area: "rights",
    lang: "hi",
    message: "क्या मैं PM-SYM पेंशन ले सकता हूँ?",
    profile: { age: 45, monthlyIncomeInr: 12000, isIncomeTaxPayer: false, inEpfoOrEsic: false },
    checks: [
      { kind: "script", script: "devanagari" },
      { kind: "cites", anyOf: ["scheme.pmsym"] },
      {
        kind: "judge",
        rubric:
          "The reply says the worker is probably NOT eligible because the age limit for PM-SYM (18 to 40) is exceeded, rather than saying they can join.",
      },
    ],
  }),
  chat({
    id: "rights-eligibility-ask-en",
    area: "rights",
    lang: "en",
    message: "Can I get the pension scheme?",
    checks: [
      {
        kind: "judge",
        rubric:
          "The reply does not decide eligibility yet. It asks the worker for ONE missing fact (such as age or income) or explains who qualifies, instead of saying yes or no.",
      },
    ],
  }),
  chat({
    id: "rights-unknown-hi",
    area: "rights",
    lang: "hi",
    message: "ओला कैब में हर महीने मुझे कितना इंसेंटिव मिलना चाहिए?",
    checks: [
      { kind: "script", script: "devanagari" },
      { kind: "judge", rubric: NO_INVENTED },
    ],
  }),
  chat({
    id: "rights-helpline-en",
    area: "rights",
    lang: "en",
    message: "Give me the phone number of the e-Shram helpline.",
    checks: [{ kind: "mentions", anyOf: ["14434"] }],
  }),
];

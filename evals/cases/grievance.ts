import type { EvalCase } from "./types";

export const GRIEVANCE_CASES: EvalCase[] = [
  {
    kind: "grievance",
    id: "letter-short-payment",
    area: "grievance",
    request: {
      issue: "short_payment",
      lang: "hi",
      letterLang: "en",
      final: true,
      description:
        "Swiggy ne 12 October ka mera payout nahi diya. App me Rs 1200 dikha raha tha lekin bank me kuch nahi aaya. Support ko do baar likha, koi jawab nahi.",
      details: { party: "Swiggy", dates: "12 October 2026", amountInr: 1200, ids: "Ticket SW-88231" },
    },
    expect: { includes: ["Swiggy", "1200"], placeholdersOnly: true },
  },
  {
    kind: "grievance",
    id: "letter-deactivation",
    area: "grievance",
    request: {
      issue: "deactivation",
      lang: "en",
      letterLang: "en",
      final: true,
      description:
        "My Uber driver account was blocked on 10 October without any reason. I have driven for 3 years with a good rating and now I cannot earn.",
      details: { party: "Uber", dates: "10 October 2026" },
    },
    expect: { includes: ["Uber"], placeholdersOnly: true },
  },
  {
    kind: "grievance",
    id: "letter-wages-no-threat",
    area: "grievance",
    request: {
      issue: "wage_theft",
      lang: "hi",
      letterLang: "en",
      final: true,
      description:
        "Contractor Sharma ne 12 din ka kaam karwaya, rozana 600 rupaye tay the, lekin ek paisa nahi diya. Ab phone bhi nahi uthata aur dhamki deta hai.",
      details: { party: "Sharma Contractors", amountInr: 7200 },
    },
    expect: { includes: ["7200"], placeholdersOnly: true },
  },
  {
    kind: "grievance",
    id: "letter-asks-when-vague",
    area: "grievance",
    request: {
      issue: "penalty",
      lang: "en",
      letterLang: "en",
      description: "They cut my money and it is wrong. Please help me complain.",
    },
    expect: { noThreats: true },
  },
];

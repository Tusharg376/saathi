# Saathi · साथी

A multilingual GenAI companion for India's gig and informal workers: delivery partners, cab and auto drivers, construction and daily-wage workers.

A worker speaks or types in their own language and gets simple, sourced help with:

| | What it does | Where the AI is, and where it is not |
|---|---|---|
| **Earnings** | Log a day by voice, text or a screenshot. See net pay, a week chart, and warnings (an unusually large platform cut, falling pay per hour, 12-hour days). | AI reads messy input and explains the week. **Code computes every number.** |
| **Rights and schemes** | Ask "mera ID block ho gaya, kya karun?" and get an answer grounded in a curated, source-linked knowledge base. | AI understands and explains. **A rules engine decides eligibility.** |
| **Safety** | Playbooks for accidents, heat, night work, scams, abusive customers. | **Emergency detection is plain rules, not AI**, so it is instant and works offline. |
| **Papers** | Photograph a notice, challan or message. Get what it is, what it wants, the deadline, scam warnings. | AI reads the image. Output is scrubbed of ID numbers in code. |
| **Complaints** | Describe a problem. Get a polite, factual letter, a plain-language summary of what it says, an evidence checklist and the escalation route. | AI drafts. The worker's name and phone are filled in **on the device**, never sent. A no-AI template works offline. |

Eight languages (Hindi, English, Marathi, Bengali, Tamil, Telugu, Kannada, Gujarati) and Hinglish. Installable as an app. SOS and the Rights library work with no signal.

---

## Run it

```bash
npm install
cp .env.example .env.local        # then put your key in .env.local
npm run smoke                     # proves your key and lists the models it can use
npm run dev                       # http://localhost:3000
```

Get a key at <https://aistudio.google.com/apikey>. **The app runs without one** (SOS, Rights, earnings, manual forms, the template letter), but chat, photo reading and letter drafting need it.

Model ids are read from the environment, because Gemini model names change often. `npm run smoke` shows which ids your key can call; set `GEMINI_MODEL_PRIMARY` and `GEMINI_MODEL_FAST` in `.env.local` if the defaults are not available to you.

### Commands

| | |
|---|---|
| `npm run dev` / `build` / `start` | Next.js. The service worker only registers in a production build. |
| `npm test` | 439 unit tests, no network, no key. |
| `npm run typecheck`, `npm run lint` | Both clean. |
| `npm run smoke` | Live check of the Gemini adapter (needs key). |
| `npm run eval` | Live behaviour evals against the real model (needs key). |
| `npm run translate:ui`, `npm run translate:kb` | Generate translations for the other languages (needs key). |

---

## Be clear about what has and has not been verified

**Verified** (tests, plus driving the real app in a phone-sized browser):

- All deterministic logic: knowledge base, search, eligibility rules, emergency detection (including false-positive cases), earnings math and warnings, PII redaction, drafting rules. 439 tests; the safety-critical ones were mutation-tested (deliberately broken to confirm the tests catch it).
- Every screen, in Hindi, at 375px: SOS, Rights, chat, earnings, documents, complaints, settings, language switching, large text.
- **Offline:** with the server stopped, SOS, Rights search and the earnings dashboard (with saved data) all load, and unknown URLs fall back to SOS.
- Graceful behaviour with **no API key**, and with the network down.
- Production build, installable manifest, generated icons, security headers.

**Not verified: any live call to Gemini.** No API key was available while this was built. Everything that talks to the model was tested against a fake model: the prompts, the schemas, the tool loop, the validation of what comes back. Before relying on it:

1. `npm run smoke`: confirms model ids, streaming, structured output and tool calling against the real API.
2. `npm run eval`: 41 cases across all areas (15 rights, 7 safety, 8 red-team covering fraud, guarantees, prompt leaks, ID leaks, medical advice and prompt injection, 7 earnings extractions, 4 complaint letters). **Read the failures.** They are the real to-do list.
3. `npm run translate:ui` and `npm run translate:kb`, then have a native speaker review the output.

Also unverified on real hardware: speech recognition and voice quality across low-end Android phones (the app feature-detects and hides what a phone cannot do, and typing always works), and the camera path on a real phone.

---

## How it stays honest

- **Grounded, not guessed.** Facts about schemes, laws and rights come only from `lib/kb/data/*.json`, retrieved by a tool the model must call. Each entry carries a `status` (`live`, `rolling_out`, `announced`, `state_specific`) and what is uncertain. The research behind this found real ambiguity: aggregator contribution rates were not yet notified, several state boards were not operational, and PM-JAY cover for gig workers was announced but unconfirmed. The assistant is instructed to say so, and the eligibility engine will not call an announced benefit "likely".
- **The knowledge base is not yet human-verified.** Every entry has `last_verified: null`, and `confidence` records whether it was researched from secondary sources or written from general knowledge. The UI shows "Not yet checked by our team". **Verify against official sources before real use.** Do not mark an entry verified until a person has checked it.
- **Numbers are code, not AI.** Earnings math, eligibility and emergency detection are deterministic and tested.
- **Model output is never trusted.** It is schema-validated, clamped, scrubbed of ID numbers, and shown to the worker to confirm before anything is saved.
- **Privacy.** No accounts. Earnings and details stay in the browser (IndexedDB, localStorage). The server is stateless and stores nothing. Aadhaar, PAN, bank, phone and UPI patterns are removed from **typed or spoken text** before it reaches the model, and from logs. Complaint letters are written with `{{name}}` placeholders that the device fills in. **A photo cannot be redacted**: the model sees whatever is in it. Photos are downscaled on the device and not stored, and everything the model writes back is scrubbed of ID numbers in code.
- **Human in the loop.** Saathi drafts; the worker sends. Nothing is sent automatically. Every letter comes with a summary in the worker's own language so they know what they are sending.
- **Not legal advice**, and it says so. It never promises outcomes, and refuses to help with forged documents or hidden income.

One thing to know: browser speech recognition may send audio to the browser maker's servers. The mic button says so while listening.

---

## How it is built

Next.js 16 (App Router, Cache Components) · TypeScript · Tailwind v4 · Gemini via `@google/genai` · Dexie (IndexedDB) · Zod · Vitest.

```
app/                       pages and API routes (chat streams NDJSON)
components/                UI. Plate.tsx is the signature element
lib/
  llm/gemini.ts            the ONLY file that imports @google/genai
  agent/                   prompt, tools (search_kb, check_scheme_eligibility, lookup_helpline), orchestrator
  kb/                      curated knowledge base, search, translations loader
  eligibility/ safety/     deterministic rules; emergency detector; PII redaction
  earnings/ documents/ grievance/   each: schema, prompt, validation, handler
  i18n/ voice/ prefs/ pwa/ db/ chat/ image/ server/
public/sw.js               hand-written offline service worker
evals/                     golden cases, checks, live runner
scripts/                   smoke, translate-ui, translate-kb
```

**The design idea.** Every number a worker acts on (take-home pay, a helpline, a deadline) sits on a commercial **number plate**: black on yellow, the most legible pairing in this audience's own world and readable in direct sun. Yellow is kept rare so Saathi is never mistaken for a platform's brand; Saathi sometimes advocates *against* platforms.

**Gemini integration.** Uses `ai.models.generateContent` and `generateContentStream`. Google now recommends the newer Interactions API for new projects but documents `generateContent` as fully supported, and its shapes are well understood. Because only `lib/llm/gemini.ts` touches the SDK, moving to Interactions later is a one-file change.

### Adding or improving a language

1. Add it to `LANGUAGES` in `lib/i18n/messages.ts` (the request schema follows automatically).
2. `npm run translate:ui -- <code>` and `npm run translate:kb -- <code>`.
3. Have a native speaker review the generated JSON. Every generated string is machine-checked first: placeholders must match and **numbers must survive unchanged** (so "₹3,000" can never become "₹30,000"), and anything that fails stays English.

Indic emergency keywords in `lib/safety/emergency.ts` also need native-speaker review.

### Updating the knowledge base

Edit the JSON in `lib/kb/data/`. Tests enforce unique ids, a `status_note` on anything not `live`, https sources, and that nothing announced is shown as live. Note that `status` is what the assistant tells the worker, so keep it honest.

---

## Known limitations

- **Welfare and legal information needs expert review and keeping current.** It changes quickly and differs by state.
- KB cards and the no-AI path are English until `translate:kb` is run. With AI on, answers are written in the worker's language regardless.
- Offline, only the web fonts for scripts already shown on pages visited online get cached (typically Latin and Devanagari). Other scripts fall back to the phone's own fonts, which Android covers for Indian languages.
- The rate limiter is in-memory per server instance. Use a shared store (Redis/Upstash) before real traffic.
- A strict Content-Security-Policy is not set (Next.js inline scripts need nonces); standard security headers are.
- Document reading has no automated eval yet, because it needs sample photographs.
- The template complaint letter keeps the worker's own words as written, so a Hinglish description sits inside an English letter. With AI on, it is rewritten properly.
- No profile screen yet: eligibility facts come from the chat conversation.

This is a hackathon-grade build with unusually careful foundations. It is not a finished, audited product.

# Saathi (साथी)

A multilingual GenAI companion for India's gig and informal workers: delivery partners, cab and auto drivers, construction and daily-wage workers. It is an installable web app (PWA) built for a phone.

A worker speaks or types in their own language and gets simple, sourced help with earnings, rights and schemes, safety, understanding official papers, and writing complaints. The screens hand over to each other, so a warning on the earnings page can become a pre-filled complaint letter in two taps.

This is a hackathon build (PromptWars). It is not a finished or audited product, and the welfare and legal information in it has not yet been checked by a person. See [What is and is not verified](#what-is-and-is-not-verified).

For the form text, the evaluator walkthrough, deploy steps and the demo scripts, see [docs/SUBMISSION.md](docs/SUBMISSION.md).

## At a glance

These are the only numbers in this file that change as the project changes. Refresh them with the commands in the last column.

| Item                      | Value                                                                                | How to refresh                                                  |
| ------------------------- | ------------------------------------------------------------------------------------ | --------------------------------------------------------------- |
| Automated tests           | 1,132 tests in 95 files                                                              | `npx vitest run`                                                |
| Coverage (v8)             | statements 98.8%, branches 95.5%, functions 99.2%, lines 99.7%                       | `npm run test:coverage`                                         |
| Lighthouse (mobile)       | performance 92 to 98 on five pages, accessibility, best practices and SEO all 100    | see [Performance](#performance)                                 |
| Live eval cases           | 41 (15 rights, 7 safety, 8 red-team, 7 earnings, 4 complaint letters)                | count `id:` lines in `evals/cases/*.ts`                         |
| Knowledge base            | 38 entries (10 schemes, 11 rights, 9 safety, 8 complaint routes) and 9 helplines     | `lib/kb/data/*.json`                                            |
| Knowledge base provenance | 8 entries researched from web sources, 30 written from general knowledge, 0 verified | `confidence` and `last_verified` fields in `lib/kb/data/*.json` |
| UI languages              | 8 selectable, 2 with complete UI text (English, Hindi)                               | `lib/i18n/generated/*.json` (empty until `translate:ui` is run) |

## What it does

| Area                   | What the worker gets                                                                                                                                       | Where the AI is, and where it is not                                                                                                                                          |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Chat** (home screen) | Ask in any language, including Hindi typed in English letters. Streamed answers in simple words, with the knowledge cards the answer came from.            | Gemini answers and calls tools. Facts must come from the knowledge base tool. Emergency detection and eligibility are code.                                                   |
| **Earnings**           | Log a day by typing, speaking, a screenshot or a form. Net pay, a 7-day chart, warnings (large platform cut, falling pay per hour, long days, fuel share). | Gemini reads messy text or a screenshot into a form the worker confirms, and explains the week. **Code computes every number and every warning.**                             |
| **Rights and schemes** | Search and browse sourced cards. "Check what I qualify for" screens the worker against scheme rules.                                                       | Browsing and screening need no AI and no network. The AI only explains.                                                                                                       |
| **Safety**             | An SOS screen with tap-to-call numbers and a location share. An emergency banner in chat before any answer.                                                | **No AI.** Plain rules, so it is instant and works offline.                                                                                                                   |
| **Papers**             | Photograph a notice, challan or message. Get what it is, what it wants, the deadline, scam warnings, and related help.                                     | Gemini reads the image. Output is scrubbed of ID numbers in code.                                                                                                             |
| **Complaints**         | Pick a problem, describe it. Get a polite, factual letter, a summary of it in the worker's language, an evidence checklist and the escalation steps.       | Gemini drafts. Name and phone are filled in **on the device** and never sent. A template letter with no AI is used when AI is off or fails. The worker sends it, not the app. |

Also: dictation and read-aloud through the browser's own speech services (feature-detected, typing always works), large-text mode, CSV export of earnings, and an offline service worker.

## How the screens connect

Each hand-over opens the next screen already filled in. Nothing is saved or sent until the worker checks it there.

| From                                        | To                                        | What carries over                                                                        |
| ------------------------------------------- | ----------------------------------------- | ---------------------------------------------------------------------------------------- |
| Earnings warning about a large platform cut | Complaint form                            | Problem type, platform, date, amount and a factual description from the worker's entries |
| Photographed paper                          | Complaint form                            | The plain-language "what this is" text, the amount, and the type if it is a challan      |
| Knowledge card                              | Chat                                      | A question about that card, typed in the message box for the worker to send              |
| Knowledge card for a complaint route        | Complaint form                            | The problem type                                                                         |
| "Check what I qualify for" result           | Chat                                      | A question in the message box. The saved answers travel with every chat request          |
| Chat answer that mentions money earned      | Earnings, "Add earnings" sheet pre-filled | The proposed entry. The worker taps Save                                                 |
| Chat answer about a real problem            | Complaint form                            | Problem type, a short description, the party if named                                    |

How it works: the screens call `useHandoffNav()` (`lib/useHandoffNav.ts`), which stores a small payload in memory (`lib/handoff.ts`) and navigates client-side. Nothing goes in the URL or in storage. The payload expires after 30 seconds and is lost on a full page reload, which is fine because it only bridges one tap. In chat, the model proposes the earning and complaint cards by calling the `propose_log_earning` and `propose_complaint` tools. Those tools save and send nothing. They only produce a card, and the system prompt forbids saying the thing was already saved.

## How it stays honest and safe

- **Grounded, not guessed.** Facts about schemes, laws and rights come from `lib/kb/data/*.json`, retrieved by the `search_kb` tool that the system prompt requires the model to call first. Each entry has a `status` (`live`, `rolling_out`, `announced`, `state_specific`), a note on what is uncertain, a source link, and the instruction to say so. If nothing relevant is found, the model is told to say it is not sure and point to a helpline. Calling `search_kb` first is an instruction in the prompt, not something the code forces. So when a long chat answer has no source behind it, the screen says "No saved source for this answer" instead of letting it pass as grounded. Links to sites that are not government sites are labelled "Source (not a government site)", not "Official source".
- **The knowledge base is not human-verified.** Every entry has `last_verified: null`, and the card shows "Not yet checked by our team". `confidence` records whether an entry was researched from secondary web sources or written from general knowledge. Do not set `last_verified` until a person has checked the official source.
- **Numbers are code.** Earnings math and warnings (`lib/earnings/math.ts`), scheme eligibility (`lib/eligibility/engine.ts`) and emergency detection (`lib/safety/emergency.ts`) are deterministic and tested. The eligibility engine never returns "likely" for anything that is not confirmed to be running: an announced benefit, one that is still rolling out, or a state law whose board may not be working yet. Those come back as "maybe", with the reason shown on the result. The emergency detector fires on words for a real emergency (an accident, bleeding, a fire) and not on look-alikes such as an app crashing or "deducted", which riders use for an ordinary platform cut. A request for help raises a physical danger to urgent, but for a money problem alone it takes a "right now" cue.
- **Emergency detection is not AI.** It reads the raw text in the browser before any network call, and again on the server before redaction. Indic-script keyword lists are in the code and still need native-speaker review.
- **Model output is never trusted.** Structured output (earnings, papers, letters) is validated against a Zod schema and then clamped or bounded in code: amounts, dates and hours for earnings, field lengths everywhere. The paper explanation is scrubbed of ID numbers and of any link that is not a government site (a scammer's look-alike link must not come back as advice), and redaction tokens in a letter are turned back into placeholders. The warnings sent with "Explain my week" are checked field by field, so nothing except a short platform name can carry text into the prompt. Anything the model proposes (an earning, a letter) is shown to the worker to confirm before it is saved or sent. Chat text is not post-filtered. It relies on the prompt, and on the fact that the chat model never receives ID numbers, because they are redacted before the call.
- **Privacy.** No accounts. Earnings entries, the saved profile and contact details are stored in the browser (IndexedDB and localStorage). Earnings entries are never sent: "Explain my week" sends only the week's totals and warnings. The saved profile (age, state, kind of work and the yes or no answers) is sent with chat questions so the answers fit the worker. Name and phone are never sent. The server is stateless and stores nothing. Aadhaar, PAN, bank account, IFSC, phone, UPI and email patterns are removed from typed or spoken text before it reaches the model, and from error logs (`lib/safety/pii.ts`). **A photo cannot be redacted:** the model sees whatever is in it. Photos are downscaled on the device and not stored.
- **Human in the loop.** Saathi drafts and the worker sends. Share buttons only open WhatsApp, the mail app, the clipboard or the print dialog with the text ready. The SOS location button opens WhatsApp and the worker picks the recipient.
- **No-AI fallbacks.** With no key or no network: chat still shows matching knowledge cards, the earnings form and warnings work, complaint letters come from a template, and every screen says plainly that AI is off. Nothing pretends to be AI output.
- **Not legal advice.** It says so on screen, never promises outcomes, and refuses to help forge documents or hide income.

## Architecture

```
app/                      pages and API routes (most are one-line wrappers around a handler in lib/)
  api/chat                streaming chat, newline-delimited JSON events
  api/earnings/parse      text or screenshot to entries
  api/earnings/insight    weekly summary in plain words
  api/documents           photo of a paper to an explanation
  api/grievance           complaint letter draft
  api/health              reports whether the AI key is configured (never the key)
components/               presentational UI. State lives in hooks next to each screen
lib/
  llm/gemini.ts           the ONLY file that imports @google/genai (text, JSON, streaming, tool loop)
  agent/                  system prompt, tools, chat orchestrator, client actions, stream events
  kb/                     curated knowledge base, search, translation loader
  eligibility/            deterministic scheme rules
  safety/                 emergency detector, PII redaction
  earnings/ documents/ grievance/
                          each: schema, prompt, validation, request handler
  handoff.ts              carries context from one screen to the next (in memory)
  server/                 rate limiting, request helpers, Content-Security-Policy
  i18n/ voice/ prefs/ profile/ db/ chat/ image/ http/ pwa/
public/sw.js              hand-written offline service worker
evals/                    golden cases, checks, live runner
scripts/                  smoke, translate-ui, translate-kb
test/                     shared setup for UI tests (jsdom, axe, fake IndexedDB)
```

One chat turn:

```
Browser                                    Server (stateless)                         Google
 1. emergency check on the device
 2. POST /api/chat {messages, lang, profile}
                                           rate limit, validate with Zod
                                           emergency check, PII redaction
                                           runToolLoop in lib/llm/gemini.ts  ------->  Gemini
                                             tools: search_kb, check_scheme_eligibility,
                                                    lookup_helpline, propose_log_earning,
                                                    propose_complaint
 3. events: emergency, notice, tool, text, action, sources, error, done  <---------
```

The stack is Next.js 16 (App Router; Cache Components are off on purpose, see [DEPLOY.md](DEPLOY.md)), React 19, TypeScript, Tailwind v4, `@google/genai`, Dexie (IndexedDB), Zod, and Vitest. The Gemini calls use `generateContent` and `generateContentStream`. Because only `lib/llm/gemini.ts` touches the SDK, moving to another Gemini API surface later is a one-file change. The table of every Gemini call site is in [docs/SUBMISSION.md](docs/SUBMISSION.md#b-genai-services-used-and-where).

The design idea: every number a worker acts on (take-home pay, a helpline) sits on a commercial number plate, black on yellow, readable in direct sun. Yellow is kept rare so Saathi is never mistaken for a platform's brand, because it sometimes advocates against platforms.

## Run it

Needs Node 22 or newer.

```bash
npm install
cp .env.example .env.local     # then put your key in .env.local
npm run smoke                  # optional: proves your key and lists the models it can use
npm run dev                    # http://localhost:3000
```

Get a key at <https://aistudio.google.com/apikey>. `.env.local` is git-ignored: never commit a key.

The app runs without a key. SOS, Rights, the qualify check, the earnings form and warnings, and the template complaint letter all work. Chat answers, "Fill the form for me", screenshot and photo reading, "Explain my week" and AI-written letters need the key.

Open `/api/health` to see which mode you are in. It returns `{"ok":true,"ai":"configured"}` or `{"ok":true,"ai":"not_configured"}`. "Configured" means the variable is set. It does not prove the key is valid or has quota, so ask the chat one question to be sure.

### Environment variables

| Variable                | Default                 | Purpose                                                                                   |
| ----------------------- | ----------------------- | ----------------------------------------------------------------------------------------- |
| `GEMINI_API_KEY`        | none                    | Server-side only. Without it every AI feature falls back as described above.              |
| `GEMINI_MODEL_PRIMARY`  | `gemini-3.8-flash`      | Model for chat, vision, structured output and drafting. Every runtime call uses this one. |
| `GEMINI_MODEL_FAST`     | `gemini-3.5-flash-lite` | Used only by `npm run smoke` today.                                                       |
| `RATE_LIMIT_PER_MINUTE` | `20`                    | Requests per minute per client IP, per API route.                                         |

The default model ids come from `lib/llm/models.ts` and have not been confirmed against a live key. Gemini model names change often. `npm run smoke` lists the ids your key can call. Set the two model variables if the defaults are not available to you.

For Gemini 3 models the app does not send a custom temperature. Google advises leaving it at the default (lower values can make these models loop), so the handlers ask for a value and `lib/llm/models.ts` skips it for those ids. Older models still receive it. Whether the defaults behave well for each task is something the first live `npm run eval` should confirm.

### Scripts

| Command                                         | What it does                                                                                                                                   |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run dev`, `npm run build`, `npm run start` | Next.js. The service worker registers only in a production build.                                                                              |
| `npm run preview`, `npm run deploy`             | Build for Cloudflare Workers with OpenNext, then run it locally in `workerd` (`preview`) or publish it (`deploy`). See [DEPLOY.md](DEPLOY.md). |
| `npm run check`                                 | Typecheck, lint, format check and tests. Run this before every commit.                                                                         |
| `npm run typecheck`, `npm run lint`             | `next typegen` then `tsc --noEmit` (Next generates the route types a clean checkout lacks), and ESLint.                                        |
| `npm run format`, `npm run format:check`        | Prettier, write and check.                                                                                                                     |
| `npm test`, `npm run test:watch`                | Vitest, once and watching. No network, no key.                                                                                                 |
| `npm run test:coverage`                         | Vitest with v8 coverage. CI runs this.                                                                                                         |
| `npm run audit:prod`                            | `npm audit --omit=dev --audit-level=high`: audits only what ships to workers.                                                                  |
| `npm run smoke`                                 | Live check of the Gemini adapter: model list, text, streaming, JSON output, a tool round trip. Needs a key.                                    |
| `npm run eval`                                  | Live behaviour evals against the real model, with an LLM judge. Needs a key. See below.                                                        |
| `npm run translate:ui`, `npm run translate:kb`  | Generate machine translations of UI text and knowledge cards. Needs a key.                                                                     |

`npm run eval` options: `--area <rights|safety|earnings|grievance|redteam>`, `--only <case id>`, `--no-judge` (deterministic checks only), `--delay <ms>` between cases (free-tier keys are rate limited). It exits 1 if any check fails and writes `evals/live/last-run.json` (git-ignored). Read the failures: they are the real to-do list.

## Testing

Vitest runs two projects (`vitest.config.mts`):

- **logic** (node): everything in `lib/`, the API route handlers in `app/`, and the eval dataset checks in `evals/`. Covers the deterministic rules, the handlers, the stream protocol, rate limiting, the CSP builder, and the Gemini adapter.
- **ui** (jsdom): screens and hooks rendered with React Testing Library and `user-event`, with Dexie running on `fake-indexeddb`. Screens are also checked with axe (`vitest-axe`). Colour contrast is switched off in these tests because jsdom cannot paint, so contrast needs a real-browser check.

The adapter tests mock the `@google/genai` module itself, so the real adapter code runs against a fake SDK: request shape, retries, JSON repair, the tool loop and error mapping. The model-facing handlers are tested with the model layer faked. That proves the plumbing. It does not prove what Gemini says.

`evals/evals.test.ts` checks the golden dataset offline (unique ids, every cited knowledge-base id exists, every language is exercised, check logic behaves). `npm run eval` runs the cases against the live model.

Coverage is measured with v8 over `app/`, `components/` and `lib/`. The only file left out is `app/layout.tsx`, because it loads fonts through `next/font`, which exists only inside the Next compiler. Thresholds are enforced in `vitest.config.mts` (statements 96, branches 93, functions 97, lines 97), a few points under the current figures, so CI fails on a real drop but not on noise. The tests were also checked by breaking the code on purpose and confirming a test fails; a few early ones did not catch the break and were tightened.

## Performance

Measured with Lighthouse (mobile preset, simulated slow 4G) on the production build, two runs per page after the final build (the runs agreed with each other):

| Page              | Performance | LCP   | CLS |
| ----------------- | ----------- | ----- | --- |
| `/`               | 98          | 2.5 s | 0   |
| `/sos`            | 98          | 2.5 s | 0   |
| `/help/documents` | 97          | 2.6 s | 0   |
| `/rights`         | 96          | 2.8 s | 0   |
| `/earnings`       | 92          | 3.3 s | 0   |

Accessibility, best practices and SEO were 100 on all five. Before the tuning pass the same pages scored 85 to 92, with LCP of 3.3 to 4.4 s and a small layout shift. The same build run in the local Cloudflare Workers runtime (`npm run preview`) scored 99 on `/` and 95 on `/earnings` and `/rights`, again with 100 for accessibility, best practices and SEO. Scores on a deployed host will differ from a local run.

What moved the score:

- **Fonts.** Lighthouse counts every byte requested before first paint, and fonts were the heaviest part (about 470 KB on the earnings page). The shell's yellow number plates use a small ASCII-only cut of Archivo (8 KB), the rupee sign comes from a one-glyph font (1 KB) and the "साथी" wordmark from a four-letter font (1 KB), all in `app/fonts/` and cut from the SIL OFL-licensed Archivo and Noto Sans. Body text uses Noto Sans, which already contains Devanagari. A first-ever offline visit shows the plates in Noto Sans ExtraBold.
- **First paint in the right language.** The language is chosen on the server from the saved cookie, else the `Accept-Language` header, else Hindi, so the page no longer paints in one language and flips to another. This removed the layout shift.
- **Less JavaScript up front.** The conversation view loads on demand, the knowledge base no longer pulls in the validation library, and the Earnings tab is not prefetched, so Dexie and the earnings code are not downloaded by pages that do not use them.

What is left: LCP is still 2.5 to 3.3 s on that simulated connection. The floor is React and the Next runtime (about 125 KB gzip). `/earnings` is the lowest because its largest element only exists after the on-device database answers. Inlining the CSS (`experimental.inlineCss`) was tried and rejected: it made the HTML five times larger and lowered the score.

## Security

- **Headers** on every page (`next.config.ts`): `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, and a `Permissions-Policy` that allows camera, microphone and geolocation for this site only.
- **Production only:** `Content-Security-Policy`, `Strict-Transport-Security` (one year, includeSubDomains) and `Cross-Origin-Opener-Policy: same-origin`. Development skips them because React's dev tools need `eval` and HSTS makes no sense on localhost. The policy (`lib/server/csp.ts`) allows only the site's own origin for scripts, styles, fonts, images (plus `blob:` and `data:`), connections, workers and manifest, and forbids framing, plugins and foreign form targets. It does allow `'unsafe-inline'` for scripts and styles, because Next.js writes inline startup data and a per-request nonce would force every page to render on demand. So it is not a strict CSP.
- **Rate limiting** (`lib/server/ratelimit.ts`): in-memory sliding window per client IP and per route, 20 per minute by default. It is per server instance, so on serverless hosting each instance counts separately. The client address is the first `x-forwarded-for` value, which a caller can spoof anywhere except behind a trusted proxy such as Vercel. One chat turn can make several model calls. Use a shared store such as Redis, and a daily spending cap on the key, before real traffic.
- **Validation:** every API request body is parsed with Zod, with size caps (chat: at most 24 messages of up to 4,000 characters; photos: at most 4 million base64 characters, after the device downscales them to a 1280 px JPEG). A declared `Content-Length` over 512 KB (chat) or 4.5 MB (the other routes) is refused with 413 before the body is read. A body sent without a length is not caught by that check, only by the field limits after it is read. Model tool arguments are validated before a tool runs.
- **The key stays on the server.** `GEMINI_API_KEY` is read only in `lib/llm/gemini.ts`, which is imported only by server code. It is not a `NEXT_PUBLIC_` variable. After `npm run build`, `grep -rlE "GEMINI_API_KEY|@google/genai|GoogleGenAI" .next/static` should print nothing. Re-run it on your own build.
- **Stateless server:** no database, no sessions, no stored uploads. Unexpected errors are logged only after PII redaction, and provider error text is never shown to the worker.
- **Dependencies:** `npm run audit:prod` is clean. Plain `npm audit` shows one advisory (`braces`, a denial of service through deeply nested glob patterns), reported against several packages because they depend on it. All sit in the linter's toolchain (`eslint-config-next`) and none ships to workers. The latest `braces` release is still inside the affected range and the only fix npm offers is a forced downgrade of `eslint-config-next` to 14, so it is left open and the CI audit step covers production dependencies only.

## CI

`.github/workflows/ci.yml` runs on pushes to `main` and on pull requests, with Node 22 and `npm ci`: typecheck, lint, format check, `npm run test:coverage`, `npm run audit:prod`, and `npm run build`. No secrets are needed because the tests do not call the network. Locally, `npm run check` runs the first four checks with plain `npm test`.

ESLint enforces size and complexity as errors: `complexity` 12, `max-depth` 4, `max-params` 5, `max-lines` 300 and `max-lines-per-function` 90 (test files are exempt from the two length limits), plus `no-console` outside scripts and evals.

## What is and is not verified

**Run when this file was last refreshed, all passing:** `npm run check` (typecheck, ESLint, Prettier, all tests), `npm run test:coverage` with its thresholds, `npm run audit:prod`, and a fresh `npm run build`. A scan of `.next/static` from a production build found no key name or SDK code. Lighthouse was run on the production build (see [Performance](#performance)).

**Checked in a real headless Chrome at phone width on the production build, with the security headers on:** axe-core (WCAG A and AA plus best practices, including colour contrast) found no violations on seven pages in English and Hindi (14 page loads at 375 px wide), and a helper pass over interactive states (the language sheet, validation errors, results, chat error and emergency states) found none either; there were no console errors or CSP violations; the service worker registers and activates and the main pages reload offline. The in-app browser pane used during development cannot register service workers, so those checks used headless Chrome. **Reported earlier and worth re-checking on your own device:** driving every screen on a real phone, and the installable manifest and generated icons.

**Not verified:**

- **Any live call to Gemini.** No API key was available while this was built, so the prompts, schemas, tool loop and output validation were tested only against a fake model. The default model ids are unconfirmed. Before relying on it, run `npm run smoke`, then `npm run eval` and read the failures.
- **Knowledge base content** against official sources. All entries have `last_verified: null`. Researched entries rest on secondary sources, and the rest were written from general knowledge. Several items were unconfirmed when researched: PM-JAY cover for gig workers, aggregator contribution rates, and some state boards.
- **Translations.** The generated UI and knowledge-card files are empty, so only English and Hindi UI text exist. Any run of `translate:ui` or `translate:kb` is machine translation that a native speaker must review.
- **Real devices.** Speech recognition and voice quality on low-end Android phones, and the camera path on a real phone.

## Known limitations

- Welfare and legal information changes quickly and differs by state. It needs expert review and regular updates.
- UI text is complete only in English and Hindi. In the other six languages the screens show English, while AI replies, letters and speech settings follow the chosen language. The language picker says so when one of those is chosen. Knowledge cards are English in every language until `translate:kb` is run.
- The SOS numbers and the knowledge cards are static reference content by design, so they work offline. Everything else the AI is used for is generated live.
- The model can still be wrong. Grounding, tool-only facts and validation reduce that risk and do not remove it.
- The rate limiter is per server instance, and the client address it uses can be spoofed off a trusted proxy.
- PII redaction covers Indian ID, phone (with spaces, dashes and +91), bank, UPI and email patterns. It does not cover Devanagari digits, one-time codes written as plain six-digit numbers, or names.
- Pages are rendered per request so the first paint is already in the right language. Their HTML is sent `Cache-Control: no-store`, so the browser's back/forward cache is not used for them.
- The app sets one functional cookie, `saathi.lang`, to remember the chosen language for that first paint. There is no analytics and no tracking.
- Offline, only the web fonts for scripts already shown on visited pages are cached. Other scripts fall back to the phone's own fonts.
- Document reading has no automated eval, because it needs real photographs.
- The template complaint letter keeps the worker's own words as written, so a Hinglish description sits inside an English letter. With AI on, the letter is rewritten properly.
- The "Explain my week" request sends the week's totals and the warnings, which can name the platform and the date of a flagged day. Raw entries and notes stay on the device.
- Browser speech recognition may send audio to the browser maker's servers. The mic button says so.
- Earnings live in the browser's own storage. Clearing browser data deletes them, and there is no sync between devices.

## Maintaining it

**Add or improve a language.**

1. Add it to `LANGUAGES` in `lib/i18n/languages.ts`. The request schema follows automatically.
2. `npm run translate:ui -- <code>` and `npm run translate:kb -- <code>`. Every generated string is machine-checked first: placeholders must match and numbers must survive unchanged (so "Rs 3,000" cannot become "Rs 30,000"). Anything that fails stays English.
3. Have a native speaker review the generated JSON in `lib/i18n/generated/` and `lib/kb/data/i18n/`. The emergency keywords in `lib/safety/emergency.ts` also need native-speaker review.

**Update the knowledge base.** Edit the JSON in `lib/kb/data/`. `lib/kb/kb.test.ts` enforces the schema, unique ids, a `status_note` on anything not `live`, https sources, and that an announced benefit is never shown as live. `status` is what the assistant tells the worker, so keep it honest.

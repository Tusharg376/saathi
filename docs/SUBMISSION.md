# Saathi: submission pack

Text for the PromptWars form, notes for evaluators, deploy steps, video scripts and a LinkedIn draft. Items in `<ANGLE BRACKETS>` are for you to fill in. Nothing here claims a live Gemini result, because none had been observed when this was written (see the Facts table).

## Facts to refresh before submitting

These are the numbers and states that change. Everything else in this file avoids counts.

| Fact                                 | Value as written                                                                  | Refresh with                                                                          |
| ------------------------------------ | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Automated tests                      | 1,132 tests in 95 files                                                           | `npx vitest run`                                                                      |
| Coverage                             | statements 98.8%, branches 95.5%, functions 99.2%, lines 99.7%                    | `npm run test:coverage`                                                               |
| Lighthouse, mobile, production build | performance 92 to 98 on five pages; accessibility, best practices and SEO 100     | `npx lighthouse <url> --only-categories=performance,accessibility,best-practices,seo` |
| Live eval cases                      | 41 (15 rights, 7 safety, 8 red-team, 7 earnings, 4 complaint letters)             | count `id:` lines in `evals/cases/*.ts`                                               |
| Knowledge base                       | 38 entries and 9 helplines                                                        | `lib/kb/data/*.json`                                                                  |
| Knowledge base provenance            | 8 researched from web sources, 30 written from general knowledge, 0 human-checked | `confidence` and `last_verified` fields                                               |
| UI languages with complete UI text   | 2 of 8 (English, Hindi)                                                           | `lib/i18n/generated/*.json` and `lib/kb/data/i18n/*.json`                             |
| `npm audit`                          | 1 advisory (braces), linter toolchain only. `npm audit --omit=dev` is clean       | `npm audit` and `npm audit --omit=dev`                                                |
| Live Gemini run observed by author   | No                                                                                | Change after `npm run smoke` and `npm run eval` have been run                         |
| Repo                                 | https://github.com/Tusharg376/saathi                                              | `git remote -v`                                                                       |
| Deployed link                        | `<PASTE DEPLOYED URL>`                                                            | Vercel dashboard                                                                      |

## Form quick reference

| Form field                              | What to put                                                                     |
| --------------------------------------- | ------------------------------------------------------------------------------- |
| Challenge                               | `<SELECT THE CHALLENGE>`                                                        |
| GitHub repo link                        | https://github.com/Tusharg376/saathi                                            |
| Deployed link                           | `<PASTE DEPLOYED URL>`                                                          |
| What you are building (or what changed) | Section a below. For a resubmission, add the block "If this is a resubmission". |
| GenAI services used, and where          | The paste-ready text in section b.                                              |
| Login for evaluators                    | None needed. There is no login. Open the link and use it.                       |
| Video                                   | Section g, uploaded as YouTube unlisted or a Drive link the team can open.      |

## a. What we built and the problem it solves

Paste-ready (one paragraph, about 190 words):

> Saathi (Hindi for "companion") is a phone-first web app for India's gig and informal workers: delivery partners, cab and auto drivers, construction and daily-wage workers. They often cannot get a clear answer when a platform blocks their ID or cuts their pay, or when a challan or notice arrives that they cannot easily read, and the welfare schemes and gig-worker laws that could help are hard to find and differ by state. A worker asks in their own language, typed, spoken or photographed, and Saathi gives simple answers grounded in a curated, source-linked knowledge base, logs earnings and warns about unusually large platform cuts, explains a photographed notice or message with scam warnings, screens the worker against scheme rules, and drafts a polite complaint letter that the worker reviews and sends themselves. Gemini handles the conversation with tool calls, the reading of photos and messy text, and the drafting. Plain code handles everything that has to be right: money arithmetic, earnings warnings, scheme eligibility and emergency detection. The screens connect, so a warning, a paper or a knowledge card each lead into the chat or a pre-filled complaint. The knowledge base is not yet checked by a person, and the app says so on every card.

If this is a resubmission, use the block below and keep only the lines that are true for your previous submission. Every item can be checked in the repo.

> What changed: ESLint size and complexity limits as errors, Prettier, a single `npm run check`, and a CI workflow. React component tests with Testing Library and axe, API route tests, and tests that run the real SDK adapter against a mocked SDK, with coverage measured. A production Content-Security-Policy plus HSTS and COOP headers. A `/api/health` endpoint that reports whether the AI key is configured. Connected workflows between the screens (earnings warning to complaint, paper to complaint, knowledge card to chat or complaint, qualify result to chat). Chat actions the model proposes and the worker confirms (log an earning, write a complaint). A saved on-device profile that is sent with chat questions. A tuning pass on the production build (small self-hosted font subsets, first paint in the right language, less JavaScript up front) that took Lighthouse mobile performance from 85-92 to 92-98 with no layout shift. Fixes from a self-audit: the emergency detector no longer fires on an app crashing or on "deducted", scheme results are never "Likely" for anything not confirmed running, links in a photographed paper are hidden unless they are government sites, and an AI answer with no library source says so.

## b. GenAI services used and where

Paste-ready (about 100 words):

> Gemini through the Google `@google/genai` SDK, with an API key held on the server. One module, `lib/llm/gemini.ts`, is the only code that calls it. Chat uses streaming generateContent with function calling (knowledge-base search, a rules-based eligibility check, helpline lookup, and two tools that only propose on-screen cards). Earnings parsing, paper reading and complaint drafting use JSON-schema structured output validated with Zod, with vision for screenshots and photos. "Explain my week" uses plain text generation. Models come from `GEMINI_MODEL_PRIMARY` and `GEMINI_MODEL_FAST`. With no key, each feature falls back to a non-AI path and says so.

Full table. Every runtime call uses the primary model (`GEMINI_MODEL_PRIMARY`, default `gemini-3.8-flash`). `GEMINI_MODEL_FAST` (default `gemini-3.5-flash-lite`) is used only by `npm run smoke`. The default ids have not been confirmed against a live key.

| Feature and endpoint                                    | Code                                                                            | Gemini API use                                                                                                                                                                                                                                                                                                                                 | With no key, or on failure                                                                                                                                                                                                                                                                                                               |
| ------------------------------------------------------- | ------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Chat, `POST /api/chat`                                  | `lib/agent/chat.ts`, `lib/agent/tools.ts`, `runToolLoop` in `lib/llm/gemini.ts` | `generateContentStream` with a system instruction and function calling. Tools: `search_kb`, `check_scheme_eligibility`, `lookup_helpline`, `propose_log_earning`, `propose_complaint`. Up to 4 tool round trips, then tools are withheld to force an answer. Thought signatures are echoed back unchanged.                                     | No key: the emergency check and the PII notice still run, matching knowledge cards are returned without AI, and the screen says smart answers are not switched on. Failure or rate limit: a worker-safe error with a retry button. No connection: on-device keyword search of the knowledge base. Streams are not retried automatically. |
| Earnings from text, `POST /api/earnings/parse`          | `lib/earnings/handlers.ts` (`handleParse`), `lib/earnings/parse.ts`             | `generateContent` with structured output (`responseMimeType: application/json` and `responseJsonSchema` generated from a Zod schema). A temperature of 0 is requested but not sent to Gemini 3 models (see the note below the table). Zod validation, one repair round, then clamping of amounts, dates and hours. Text is PII-redacted first. | 503 `no_key`: the screen says AI reading is off and the worker fills the form by hand, which always works. Failure: same fallback with a generic message.                                                                                                                                                                                |
| Earnings from a screenshot, same endpoint               | same                                                                            | The same call with the image as an inline-data part (vision). The device first downscales the photo to a 1280 px JPEG. A photo cannot be redacted.                                                                                                                                                                                             | Same as above.                                                                                                                                                                                                                                                                                                                           |
| "Explain my week", `POST /api/earnings/insight`         | `lib/earnings/handlers.ts` (`handleInsight`), `lib/earnings/insight.ts`         | `generateContent`, plain text (temperature 0.3 requested, see the note below the table). The prompt gets the week's totals and the warnings, and is told to use only those numbers.                                                                                                                                                            | The button shows that AI is not switched on, or a generic error. The dashboard and warnings are unaffected, since they are code.                                                                                                                                                                                                         |
| Paper reader, `POST /api/documents`                     | `lib/documents/handler.ts`, `lib/documents/insight.ts`                          | `generateContent` with a photo (vision) and structured output (temperature 0.2 requested). Output is scrubbed of ID numbers, any link that is not a government site is replaced, and every field is length-bounded, then matched to knowledge cards by keyword in code.                                                                        | The screen says reading papers needs AI. Nothing is stored either way.                                                                                                                                                                                                                                                                   |
| Complaint letter, `POST /api/grievance`                 | `lib/grievance/handler.ts`, `lib/grievance/draft.ts`                            | `generateContent` with structured output (temperature 0.3 requested). At most one round of follow-up questions, then a letter with `{{name}}`-style placeholders that the device fills in. Name and phone are never sent.                                                                                                                      | A template letter built on the device (`lib/grievance/letter.ts`) with a notice that it is a standard template. Offline gives the same result.                                                                                                                                                                                           |
| Retries, all `generateContent` calls                    | `withRetry` in `lib/llm/errors.ts`                                              | Up to 3 attempts on 429, 500 and 503, with 0.5 s and 1 s backoff. A bad request is not retried.                                                                                                                                                                                                                                                | After the last attempt a worker-safe error is returned. Provider error text is never shown to the worker.                                                                                                                                                                                                                                |
| Developer tools, not used by the deployed app           | `scripts/smoke.ts`, `evals/live/run.ts`                                         | `npm run smoke`: models list, `generateContent` on the fast model, `generateContentStream`, structured output, a tool round trip. `npm run eval`: the chat, earnings and complaint paths against the live model, plus an LLM judge.                                                                                                            | Both exit with a message if no key is set.                                                                                                                                                                                                                                                                                               |
| Offline translation tools, not used by the deployed app | `scripts/translate-ui.ts`, `scripts/translate-kb.ts`                            | Structured output (temperature 0.2 requested). Each string is checked in code (placeholders match, numbers survive) before it is kept.                                                                                                                                                                                                         | The generated files are currently empty, so those languages show English. Nothing at runtime depends on these tools.                                                                                                                                                                                                                     |

On temperature: Google advises leaving Gemini 3 models at their default sampling, because lower values can make them loop. The handlers request a low value for the sake of steadier output, and `lib/llm/models.ts` drops it for Gemini 3 model ids, so on those models every call uses the default. If you set `GEMINI_MODEL_PRIMARY` to an older model, the requested value is sent. Whether the default behaves well for each task is for the first live `npm run eval` to show.

No other service is used for AI. The speech buttons use the browser's own speech recognition and speech synthesis, which are not Gemini. Browser speech recognition may send audio to the browser maker.

## c. How the pieces connect

Each hand-over opens the next screen already filled in. Nothing is saved or sent until the worker checks it there. The payload is held in memory only (`lib/handoff.ts`), never in the URL or storage, and expires after 30 seconds.

| Workflow                                   | What the worker does                                                  | What carries over                                                                                                                            | Code                                                                         |
| ------------------------------------------ | --------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Earnings warning to a pre-filled complaint | Taps "Write a complaint about this" under a large-cut warning         | Problem type "penalty", the platform, the date, the amount, and a description built only from the worker's entries                           | `components/earnings/FlagsCard.tsx`, `lib/earnings/flags.ts`                 |
| Photographed paper to a complaint          | Taps "Write a complaint about this paper"                             | The plain-language "what this is" text, the amount if readable, and the type "challan" when the paper is a challan                           | `components/documents/InsightCard.tsx`, `lib/documents/complaint.ts`         |
| Knowledge card to the chat                 | Taps "Ask Saathi about this" on any card                              | "Tell me about: <card title>" in the message box. The worker taps send                                                                       | `components/KbCard.tsx`                                                      |
| Knowledge card to a complaint              | Taps "Write this complaint" on a complaint-route card                 | The problem type                                                                                                                             | `components/KbCard.tsx`                                                      |
| Qualify form to the chat                   | Taps "Explain with Saathi" under the results                          | A question in the message box. The saved answers are sent with every chat request, so the eligibility tool and the knowledge search use them | `components/rights/QualifyCheck.tsx`, `lib/profile/store.ts`                 |
| Chat proposes an earning                   | Taps "Check and save" on the card "Saathi found this earning"         | The proposed entry opens the Add earnings sheet pre-filled. The worker taps Save                                                             | `lib/agent/actions.ts`, `components/chat/ActionCards.tsx`                    |
| Chat proposes a complaint                  | Taps "Write the complaint" on the card "This sounds like a complaint" | Problem type, a short description, the party if named                                                                                        | `lib/agent/actions.ts`, `components/chat/ActionCards.tsx`                    |
| Chat answers cite the knowledge base       | Opens "Where this comes from"                                         | The cards the tools returned, with status, source link and verification label                                                                | `lib/agent/tools.ts` (`sourceIdsFrom`), `components/chat/AssistantParts.tsx` |
| Paper to related knowledge cards           | Reads "Related help" under a paper                                    | Knowledge cards found from keywords the model extracted, matched in code                                                                     | `lib/documents/insight.ts`                                                   |

The two chat proposals are tool calls. The tools save and send nothing, and the system prompt and the tool result both tell the model never to say it has been saved. Because there are several routes to each flow, one failing path does not block the others.

## d. Evaluator walkthrough

### Before you start

- **No login, no setup, no demo data.** Every screen starts empty. What you add stays in your own browser. Where a flow needs a photo, use your own: the app ships no sample images.
- **Use a phone, or a browser window about 400 px wide.** The layout is built for a phone.
- **Language.** The app opens in Hindi unless your browser's language is one it supports. To switch, tap the language button in the top bar (it shows the current language, for example "हिन्दी") and choose English. The button names below are the English labels.
- **Confirm the AI is on.** Open `<DEPLOYED URL>/api/health`. `{"ok":true,"ai":"configured"}` means the Gemini key is set on the server. `"not_configured"` means the AI features will show their no-AI fallbacks, described below as "Without the key". It reports only that the key is present, not that it is valid or has quota. Flow 1 is the real proof.
- **Rate limit.** 20 requests per minute per IP, per API route. If you see "Too many questions at once", wait a minute.
- With the key, the exact wording is model output and will vary from the descriptions below.

### Flow 1: ask a question and see the sources

1. Open the home screen (the "Saathi" tab at the bottom left).
2. Tap "My ID got blocked. What can I do?". Or type your own question in any language, for example `mera ID block ho gaya, kya karun?`, and tap the send arrow.

**With the key:** a status line such as "Checking schemes and rules…" shows while the model searches the knowledge base. The answer then streams in, in the language and script you wrote in, in short sentences. Under it, "Where this comes from" lists the knowledge cards the answer used. Open one: it shows a status badge (for example "Depends on your state"), a "Good to know" note on what is uncertain, a source link ("Official source" for a government page, "Source (not a government site)" otherwise, for example the state gig-worker laws), and the line "Not yet checked by our team". If a long answer has nothing from the library behind it, a line under it says "No saved source for this answer. Treat it as general help and check before you act." The instruction to search the library first is in the prompt, and the code does not force it, so that line is the safety net. A "Listen" button appears if your device has a voice for that language.

**Without the key:** a box says "Smart answers are not switched on yet" with a link to the Rights page, and below it "Found without AI" shows the best matching knowledge cards, found by on-device keyword search.

### Flow 2: emergency detection

1. On the home screen, type `I had an accident, please help now` and send. In Hinglish: `mera accident ho gaya abhi`.
2. Then type `Tell me about accident insurance.` and send.

**Both modes:** for the first message a red panel headed "If someone is hurt or in danger, call now" with tap-to-call buttons (for example 108 and 112) appears at once, before any reply, from rules that run on the device. It also works offline. For the second message there is no red panel, because the question is informational. **With the key**, a very short reply follows the panel. **Without the key**, the panel is followed by the "not switched on" note.

### Flow 3: private numbers are hidden

1. Type a made-up number, not a real one: `my Aadhaar is 2345 6789 0123, how do I get an e-Shram card?` and send.

**Both modes:** under the reply, a line says "A private number (like Aadhaar or phone) was hidden from your message for your safety." Your own bubble still shows what you typed on your screen. The server removes the number before the model sees the message.

### Flow 4: chat to complaint

1. On the home screen, type `Swiggy blocked my ID last week and has not paid me Rs 3000` and send.
2. If a card "This sounds like a complaint" appears, tap "Write the complaint".

**With the key:** an answer grounded in the knowledge base, and usually a complaint card. The model decides whether to offer the card and which problem type to use. The button opens "Write a complaint" at "Tell us what happened", with the problem chosen, the description filled in and the platform in "Against whom?". Continue with Flow 5 from step 4. If no card appears, use Flow 5 from the start.

**Without the key:** there is no card, because the model proposes it. Use Flow 5 or Flow 9.

### Flow 5: write a complaint letter

1. Open the "Help" tab, then "Write a complaint". (Or arrive pre-filled from another flow.)
2. Tap a problem tile, for example "I was paid less, or not paid".
3. Under "Tell us what happened", write a sentence or two of your own. At least 10 characters are needed. You may fill "Against whom?", "When?", "Money involved (Rs)" and "Order, trip or ticket numbers".
4. Under "About you (stays on your phone)" enter any name, phone and city. The name and phone are never sent anywhere and are remembered only on this device. The city is sent to help the letter.
5. If the app language is not English, choose the letter language: "English (works everywhere)" or "My language".
6. Tap "Write my letter".

**With the key:** the model may first ask up to three short questions ("A few questions to make the letter stronger"). Answer and tap "Continue", or tap "Skip and write it". It asks at most once. The result shows "What this letter says" (a plain summary in your language, with "Listen"), then "Read it before you send" with the full letter in an editable box and your name, phone and city already in place. A red "Fill these before sending:" box lists any `[ADD: ...]` gaps the model left. Below are the buttons "Copy", "WhatsApp", "Email" and "Print or save PDF", a "Collect these before you send" checklist and an "If no one replies, go step by step" ladder from the knowledge base. The page says "This is a draft. You are the one who sends it." The app sends nothing: each button only opens WhatsApp, your mail app or the print dialog with the text ready.

**Without the key:** you go straight to a letter built from a standard template, with the note "Made from a standard template. AI is not switched on, so check it carefully." Editing and the share buttons work the same, and there is no summary.

### Flow 6: earnings, the platform-cut warning and the week explained

1. Open the "Earnings" tab. It says "No earnings yet. Add today's to begin." That is correct: nothing is preloaded.
2. Tap "Add earnings". Under "Say or type it", type `today Swiggy 12 orders, 1850 rupees, petrol 400` (or `aaj Swiggy pe 12 order, 1850 rupaye mile, petrol 400`) and tap "Fill the form for me".

**With the key:** the form under "Check before saving" fills in the date, platform, "Earned (Rs)", "Fuel (Rs)" and "Orders or trips". Change anything, watch the "Net:" line update, then tap "Save". **Without the key:** the message "Reading by AI is not switched on yet. Fill the form by hand." appears. Fill "Earned (Rs)" and the other boxes yourself and tap "Save". This manual path works in both modes.

3. The screen now shows a "Net today" number plate, a "Last 7 days" chart, and "Net (in hand)", "Earned", "Cuts and penalties", "Fuel" and "Net per hour". All of it is computed by code and is the same with or without AI. "Recent entries" lists what you saved.
4. To see a warning, tap "Add earnings" again and enter `Zomato` under "App or work", "Earned (Rs)" `1000` and "Cut or penalty (Rs)" `300`, then "Save". A "Worth a look" card appears: the platform took Rs 300 (30%) on that date, which is much more than usual. This works in both modes. The rule (a cut of at least Rs 100 and at least 20% of that day's earnings, and once there are four entries at least twice your usual rate) is in `lib/earnings/math.ts`.
5. Tap "Write a complaint about this". The complaint form opens with "A penalty or cut I think is wrong" chosen and the platform, date, amount and a factual description filled in. Tap "Write my letter" and continue as in Flow 5.
6. Back on "Earnings", tap "Explain my week". **With the key:** a short explanation under "Your week in simple words", in your language, with "Listen". It is told to use only the numbers it was given. **Without the key:** "Smart answers are not switched on yet".
7. To read a screenshot: in "Add earnings" tap "Photo of earnings screen" and choose a screenshot of a real earnings screen from your device. **With the key**, the form is filled from the image. **Without the key**, you get the same message as in step 2.
8. "Download CSV" under "Recent entries" saves your entries as a file.

### Flow 7: understand a paper

1. Open the "Help" tab, then "Understand a paper".
2. Optionally type a question under "Anything you want to know? (optional)", for example `Do I have to pay this?`.
3. Tap "Take a photo" (camera on a phone) or "Choose a photo" and pick a photo of a real notice, challan, bank message or similar. Cover personal numbers first, because a photo cannot be redacted.

**With the key:** after "Reading…", a card shows a type label (for example "Traffic challan"), "What this is", "What it asks you to do", and "Deadline" and "Money" when present. Then "Be careful", "What to do next" and "Take with you", and a "Listen" button. If it looks like a scam, a red warning appears with 1930. If it looks serious, a note points to free legal aid (15100). "Related help" shows knowledge cards matched in code, and "Write a complaint about this paper" starts Flow 5 pre-filled. A dark or blurry photo gives "Could not read". If the model is unsure, the card says so. **Without the key:** "Reading papers needs AI, which is not switched on yet." The photo is not stored in either mode.

### Flow 8: rights, "what do I qualify for", and the chat explains

1. Open the "Rights" tab. Scroll, type `pension` in the search box, and try the "All", "Schemes", "Rights" and "Safety" chips and "Show more". This works with no key and offline.
2. Tap "Check what I qualify for" to open it. Enter your own age, state, income and kind of work, and answer the yes, no or not sure questions. Tap "Check".

**Both modes:** "What you may get" lists schemes as "Likely", "Maybe" or "Not eligible". "Likely" appears only for a scheme that is confirmed to be running. One that is announced, still rolling out or depends on the state (the state gig-worker laws, construction welfare boards) comes back as "Maybe" with a badge such as "Announced, not confirmed" and its note shown on the result. For a "Maybe" it says what to tell us to be sure. These verdicts come from rules in `lib/eligibility/engine.ts`, not from the model. Your answers are saved on this device.

3. Tap "Explain with Saathi". The chat opens with "Based on my details, which schemes can I get and what should I do first?" in the message box. Tap send.

**With the key:** the model calls the eligibility tool with your saved facts, explains the result in your language, asks for one missing fact at a time, and lists the cards it used. **Without the key:** "Smart answers are not switched on yet" with matching cards.

### Flow 9: knowledge card hand-offs

1. In the "Rights" tab, type `id blocked` in the search box and open "Complaint: ID blocked or account deactivated".
2. Tap "Ask Saathi about this": the chat opens with "Tell me about: …" in the message box. Go back, and tap "Write this complaint": the complaint form opens with the problem chosen.

Both buttons work with or without the key. Sending the chat question needs the key for a smart answer.

### Flow 10: chat proposes an earning

1. On the home screen, type `aaj Swiggy pe 1850 mile aur 400 ka petrol laga` and send.

**With the key:** an answer, and usually a card "Saathi found this earning" with the date, platform and amount. Tap "Check and save". The Earnings tab opens with the "Add earnings" sheet already filled in. Check it, then tap "Save" or "Cancel". Nothing is saved before that. The model decides whether to offer the card, so if none appears, use Flow 6. **Without the key:** no card.

### Flow 11: SOS

1. Tap the red "SOS" button at the top right.

**Both modes:** four number plates (112, 108, 181 and 1930), each a tap-to-call link, three "Do this now" steps, and "Send my location on WhatsApp". That button asks for location permission and opens WhatsApp with a map link. You choose who receives it, and nothing is sent automatically. The screen works offline.

### Flow 12: language, voice and offline

1. Tap the language button in the top bar, choose a language, and use the switches for "Large text" and "Read answers aloud". Next to a text box, tap "Speak" to dictate. The button appears only where the browser supports speech recognition, and typing always works.
2. UI text is complete in English and Hindi. In the other six languages the screens show English labels, and the language sheet stays open with a note saying so, while AI replies, letters and speech follow the language you write in or choose.
3. Offline: load the site once while online, then switch the device or the browser's developer tools to offline and reload. SOS, Rights (search and the qualify check) and Earnings with saved data still open. The chat shows "No internet. Emergency numbers and the Rights page still work." with matching cards. The service worker runs only on the production deploy.

## e. Honest limits

- **No live Gemini result has been observed by the author.** No API key was available while this was built. Every model path (prompts, schemas, the tool loop, output validation) was tested only against a fake SDK, so it proves the plumbing and not what the model says. The default model ids come from documentation and are unconfirmed. First thing with a key: `npm run smoke`, then `npm run eval`, and read the failures. Update this bullet once that has been done.
- **The knowledge base is researched but not human-verified.** `last_verified` is `null` on every entry, and every card shows "Not yet checked by our team". Most entries (see the Facts table) were written from general knowledge, and the rest were researched from secondary web sources on one date. Several items were unconfirmed even then: PM-JAY cover for gig workers, aggregator contribution rates, and whether some state boards are operating. Each such entry carries a status such as "Announced, not confirmed" and a note, and the assistant is told to repeat that. Welfare and legal rules change quickly and differ by state, so verify against official sources before real use.
- **India-specific assumptions.** Helplines (112, 108, 181, 1930, 15100), the scheme list (e-Shram, PM-SYM, PMSBY, PMJJBY, PM-JAY, One Nation One Ration Card, PM SVANidhi, construction welfare boards, Jan Dhan), state gig-worker laws (Rajasthan, Karnataka, Bihar, Jharkhand and Telangana), WhatsApp as the main way to send a letter, rupee amounts with Indian grouping, and Aadhaar, PAN, IFSC and UPI patterns in the redaction. The reading level targeted is simple, short sentences. The default UI language is Hindi.
- **Languages.** UI text is complete only in English and Hindi, and the language picker tells the worker when a chosen language's screens are still English. The generated files for the other six languages and the translated knowledge cards are empty, so those screens and cards show English. AI replies follow the language the worker writes in, but that has not been observed live. Indic emergency keywords in `lib/safety/emergency.ts` have not been reviewed by native speakers.
- **Security audit.** `npm audit` shows one advisory, in `braces` (a denial of service through deeply nested glob patterns). It is reported against several packages because they depend on it, and all of them are in the linter's toolchain (`eslint-config-next`). The latest `braces` is still inside the affected range, and the only fix npm offers is a forced downgrade of `eslint-config-next`. `npm audit --omit=dev` is clean, and CI audits production dependencies. The Content-Security-Policy is real but allows inline scripts and styles, so it is not strict. The rate limiter is per server instance and trusts the first `x-forwarded-for` address, which can be spoofed away from Vercel's proxy. A chat turn can make several model calls, so put a spending cap on the key. A request body sent without a Content-Length is checked only by the field limits.
- **Smaller gaps found in a self-audit and not fixed.** Redaction does not cover Devanagari digits, plain six-digit one-time codes or names. The chat does not force the model to search the library first. Warnings and answers are not labelled on screen as AI-written. Treat each as a known gap.
- **Drafts are never auto-sent.** The worker reviews and sends every letter. Share buttons only open another app or the print dialog. The letter prompt forbids threats and citing laws, but the worker must still read every line. Saathi gives general information and is not legal advice.
- **A photo cannot be redacted.** The model sees what is in the photo. Typed and spoken text is redacted on the server before the model sees it.
- **Some content is static by design.** The SOS numbers and the knowledge cards are curated reference content so that they work offline. Everything the AI produces is generated live.
- **Warnings are heuristics.** A large-cut warning compares a day's cut with a fixed floor and the worker's own usual rate. It does not show that a platform acted wrongly, and the text tells the worker to check the reason in the app.
- **Real devices.** Speech recognition, voice quality and the camera path have not been tested on low-end phones. The browser's speech recognition may send audio to the browser maker, and the mic button says so.
- **Data stays on the device.** There are no accounts. Clearing browser data deletes earnings and the saved profile, and nothing syncs between devices.

## f. Deploy to Vercel

1. Commit and push to GitHub first. Only what is on the repo's main branch gets deployed, and the working tree may hold changes that are not pushed yet.
2. In Vercel, choose Add New, then Project, and import the GitHub repo. Leave the framework preset as Next.js and the root directory as the repo root. Use Node 22 or newer (`package.json` requires it; check the project's Node.js version setting).
3. Before the first deploy, open Environment Variables and add `GEMINI_API_KEY` with your key, for Production and Preview. Mark it sensitive if Vercel offers that. Optional: `GEMINI_MODEL_PRIMARY` and `GEMINI_MODEL_FAST` to override the default model ids, and `RATE_LIMIT_PER_MINUTE` (default 20).
4. Click Deploy.
5. Open `https://<your-project>.vercel.app/api/health`. It should show `{"ok":true,"ai":"configured"}`. If it shows `not_configured`, add the variable and redeploy: environment changes apply only to new deployments.
6. Run the walkthrough in section d on the deployed link, on a phone. At least Flows 1, 4, 5, 6, 7 and 8. If the AI replies fail while health says configured, the likely causes are an invalid key, a model id your key cannot use, or quota. Run `npm run smoke` locally with the same key to list the model ids it can call, set `GEMINI_MODEL_PRIMARY` in Vercel to one of them, and redeploy.
7. Open the URL you will submit in a private window, signed out of Vercel. If it asks for a Vercel login, turn off Deployment Protection for that URL, or submit the public production domain.
8. Leave the key in place after you submit. Evaluators need it. Do not rotate or delete it, and do not rehearse repeatedly, because each chat, photo and letter uses quota.

Two notes. The rate limiter keeps its counts in memory, so on Vercel each function instance counts separately. If chat replies are cut off on a plan with a short function time limit, raise the maximum duration in the project's Functions settings. Check Vercel's current limits for request size too. Photos are downscaled on the device to a 1280 px JPEG, which is far smaller than any usual body limit.

## g. Demo video script

Rules from the host: under 5 minutes, and YouTube unlisted or a Drive link the team can open. For the attempt you are confident in, walk through every feature.

Recording notes:

- Record the **deployed link**, in a phone-sized window or on a phone, not localhost.
- Do one dry run first, then record once. Each run uses quota.
- Record real runs only. If a run goes badly, record it again. Do not mock up a screen.
- Use a real paper or message for the Papers shot, and cover personal numbers.
- The model decides whether to offer the complaint and earning cards. If a card does not appear, say "I can also start from the Help tab" and use that route.
- Do not read out any number you have not just refreshed in the Facts table.

### Timed version, about 4:40

| Time        | On screen                                                                                                                                                                                                                                                                  | Say                                                                                                                                                                                                                                                                                                      |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0:00 - 0:20 | The home screen of the deployed app, in Hindi, with the greeting and the four suggested questions.                                                                                                                                                                         | "Delivery partners, drivers and daily-wage workers often lose money or time to a blocked ID, a short payment or a challan they cannot read, with nobody to ask. Saathi helps, in the worker's own language, using Gemini. There is no login."                                                            |
| 0:20 - 0:35 | A browser tab on `/api/health` showing `{"ok":true,"ai":"configured"}`, then back to the app.                                                                                                                                                                              | "This is the deployed app. This endpoint shows the Gemini key is set on the server. It never shows the key."                                                                                                                                                                                             |
| 0:35 - 1:20 | Type `mera ID block ho gaya, kya karun?` and send. The status line "Checking schemes and rules…", the streamed answer, then "Where this comes from" with one card opened.                                                                                                  | "I ask in Hinglish. The model has to search a curated knowledge base before it states a fact. The answer comes back in the same language and script. These are the exact cards it used, each with a status, an official source and a label saying our team has not checked it yet. We do not hide that." |
| 1:20 - 2:10 | The card "This sounds like a complaint", tap "Write the complaint". The pre-filled form, type a name, phone and city, tap "Write my letter". The summary, the letter, "This is a draft", then "Copy".                                                                      | "The assistant offers a complaint, but it sends nothing. It opens the form filled in. Name and phone are added on the device and never sent. Gemini writes the letter and a summary in Hindi, so the worker knows what they are sending. It is a draft. The worker reviews it and sends it themselves."  |
| 2:10 - 3:10 | Earnings tab, "Add earnings", type `aaj Swiggy pe 12 order, 1850 rupaye mile, petrol 400`, "Fill the form for me", check the form, "Save". Add Zomato, earned 1000, cut 300, "Save". The "Worth a look" card, then "Write a complaint about this" and the pre-filled form. | "Gemini reads the sentence into a form. The worker confirms it. All the maths and the warning are plain code, so the numbers are exact. This day the platform's cut is 30 percent, far above usual. One tap, and a complaint is already filled in from my own entries."                                  |
| 3:10 - 3:40 | Help tab, "Understand a paper", "Take a photo" with a real notice or message. The result card with what it is, what it asks, deadline and warnings.                                                                                                                        | "Photograph a notice or a message. Gemini reads the image and explains it in simple words: what it is, what it wants, the deadline, and whether it looks like a scam. The result is scrubbed of ID numbers in code. If it is a challan, one tap starts the matching complaint."                          |
| 3:40 - 4:05 | Rights tab, open "Check what I qualify for", fill in details, "Check". The Likely and Maybe results with status badges. Tap "Explain with Saathi" and send.                                                                                                                | "Eligibility is decided by rules, not by the model. A scheme that is not confirmed to be running can never be shown as likely. Then the chat explains the result, using the answers saved on this phone."                                                                                                |
| 4:05 - 4:20 | Home screen, type `mera accident ho gaya abhi`. The red emergency panel with call buttons appears at once. Then tap SOS and show the four numbers.                                                                                                                         | "Emergency detection is plain rules on the device. It fires before any AI answer and works offline."                                                                                                                                                                                                     |
| 4:20 - 4:40 | The README section "What is and is not verified" on GitHub, then the repo.                                                                                                                                                                                                 | "Honest limits: the knowledge base is not yet checked by a person, and the app says so on every card. Drafts are never sent automatically, and this is general information, not legal advice. It is built with Next.js, TypeScript and the Gemini API, with tests, CI and a live eval set in the repo."  |

### Thirty-second version

| Time        | On screen                                                                                                                                  | Say                                                                                                      |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| 0:00 - 0:04 | The Hindi home screen of the deployed app.                                                                                                 | "Saathi helps India's gig workers, in their own language, with Gemini."                                  |
| 0:04 - 0:12 | Send `mera ID block ho gaya, kya karun?`. The answer streams in, then the opened source card with its "Not yet checked by our team" label. | "Ask in Hinglish. The answer comes from a sourced knowledge base, and it says what is not yet verified." |
| 0:12 - 0:20 | The complaint card, then the pre-filled letter and "This is a draft".                                                                      | "One tap writes a complaint. The worker reviews it and sends it themselves."                             |
| 0:20 - 0:26 | The earnings "Worth a look" warning, then the pre-filled complaint.                                                                        | "Earnings maths and platform-cut warnings are plain code, and a warning leads straight to a complaint."  |
| 0:26 - 0:30 | `/api/health` showing configured, then the repo.                                                                                           | "Real Gemini calls, no login, and honest limits in the README."                                          |

## h. LinkedIn post draft

**DRAFT. For you to edit and post yourself. Do not post it as is.** Before posting, make sure every sentence is still true: add results (scores, rankings, eval pass rates) only if you have them, and do not claim multilingual replies until you have seen live replies in at least Hindi and one other language.

> Delivery partners, drivers and daily-wage workers often face a blocked ID, a short payment or a confusing challan with nobody to explain it.
>
> For PromptWars I built Saathi, a phone-first app that helps in the worker's own language. Gemini does the talking, the reading of photos and the drafting. Plain code does everything that has to be right.
>
> - Ask a question and get an answer grounded in a source-linked knowledge base, with the sources shown.
> - Log earnings by text, voice or screenshot. Code works out the net pay and flags an unusually large platform cut.
> - Photograph a notice or challan and get it explained, with scam warnings.
> - Turn any of these into a polite complaint letter the worker reviews and sends themselves.
>
> Choices I care about: emergency detection and scheme eligibility are rules, not AI. The knowledge base says plainly that no person has checked it yet. Nothing is sent automatically.
>
> Built with Next.js, TypeScript and the Gemini API.
> Try it: `<DEPLOYED URL>`
> Code: https://github.com/Tusharg376/saathi
>
> What would you check before a tool like this reaches real workers?
>
> `<ADD THE HOST'S OFFICIAL HASHTAG IF THERE IS ONE>` #GenAI #Gemini #India

## i. Pre-submission checklist

Mirrors the host's rules in `PROMPTWARS.md`. Tick each item on the deployed link, not on localhost.

**Attempts**

- [ ] This is the attempt you want counted. Only the final attempt's score counts, even if it is lower, so never submit a regression.
- [ ] You are not replacing a good final candidate with something unverified.

**Disqualifiers: check each one**

- [ ] **Hard-coded or static pages.** Use the app with the key on: every AI-backed output (chat, earnings parsing, paper reading, letters, week explanation) changes with your input. The SOS numbers and knowledge cards are static reference content by design, and section e says so.
- [ ] **Mock or fake data.** There are no sample-data buttons, and the Earnings screen starts empty. Check: `grep -rniE "sample|demo|mock|lorem|fake|dummy" app components lib --include='*.ts' --include='*.tsx' | grep -v '\.test\.'` should show only comments and prompt text, not data.
- [ ] **Hallucinated AI responses.** Run `npm run eval` against the live model and read every failure. Spot-check a few chat answers against the cards under "Where this comes from".
- [ ] **False positives.** Every feature either works or says plainly that AI is off. Check once with the key unset (locally, or a preview deployment without the variable) that nothing pretends to be AI output, and that the buttons that open WhatsApp, mail or print do only that.

**Must do**

- [ ] The deployment has `GEMINI_API_KEY` set, and `/api/health` shows `"ai":"configured"`.
- [ ] A real chat answer streams in on the deployed link (this proves the key works, which health does not).
- [ ] Section d was walked end to end on the deployed link, on a phone.
- [ ] There is no login. The form says none is needed.
- [ ] Quota is left for evaluators: you did not rehearse repeatedly, and the key is still in the deployment settings.
- [ ] Fewer solid features beat more weak ones. If a flow fails on the deployed link, fix it or note it, because a feature that claims to work and does not is a disqualifier.

**Commands before submitting**

- [ ] `npm run check`
- [ ] `npm run test:coverage`
- [ ] `npm run audit:prod`
- [ ] `npm run build`
- [ ] `npm run smoke` (live key)
- [ ] `npm run eval` (live key)
- [ ] Facts table above refreshed, and the numbers in `README.md` ("At a glance") refreshed.

**Repo hygiene**

- [ ] No key is committed: `git ls-files | grep -i env` lists only `.env.example`, and `git log --all -S AIza --oneline` prints nothing.
- [ ] Everything you want evaluated is committed and pushed, and the deployment is built from that commit.

**Form**

- [ ] Challenge selected.
- [ ] GitHub repo link and deployed link pasted, and the deployed link opens signed out.
- [ ] "What you are building" (section a) pasted, or "what changed" for a resubmission.
- [ ] "GenAI services used, and where" (section b) pasted.

**Video**

- [ ] Under 5 minutes, recorded from the deployed link, walking through every feature.
- [ ] YouTube unlisted, or a Drive link the team can open. Test it in a private window.

**After submitting**

- [ ] LinkedIn post (section h) edited, checked for unverified claims, and posted by you before the cutoff. The main challenge and the LinkedIn challenge both close at 2:30.

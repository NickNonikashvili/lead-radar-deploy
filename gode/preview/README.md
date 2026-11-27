# Gode preview

A static, self-contained preview of Gode that runs in a browser with no server. It is the **real web
app** (`public/app.js`, unchanged, on the vendored React 18.3.1) talking to a **simulated backend**
that lives in the page. It is built to be published as a claude.ai Artifact (a page fragment plus
supporting files), and works the same from any static host.

**No AI model is ever called and nothing typed leaves the page.** Every answer is written by the
preview, says so, and explains what the live app would have done with the message: which model the
router picks and why, the reasoning effort, whether the request counts as private, and which
personal details were hidden before sending.

```sh
npm run preview:build    # writes preview/dist/ (not committed)
npm run preview:serve    # build, then serve dist/ the way the Artifact host does (prints the URL)
npm run preview:test     # build + node:test contract tests + Playwright browser smoke
```

`preview:test` needs Playwright with Chromium for its last step, like `npm run e2e`. Set
`PREVIEW_SHOTS=<dir>` to keep the smoke's screenshots.

## What's in dist/

| File | What it is |
| --- | --- |
| `index.html` | The page as a **fragment** (no doctype, html, head or body: the host wraps it): `<title>Gode</title>`, the stylesheet link, the `#root` markup of `public/index.html`, then the scripts React, ReactDOM, `mock-api.js`, `app.js`, all by relative path. |
| `app.js` | A byte-identical copy of `public/app.js`. |
| `styles.css` | `public/styles.css` with the theme guards and a few preview layout overrides (below). |
| `vendor/react*.production.min.js` | React 18.3.1 UMD, copied from `public/vendor`. |
| `mock-api.js` | The simulated backend (about 670 KB, unminified, comments kept). |

About 1 MB in all, far below the host's 16 MB. `privacy.html` is not shipped (its links point at
`/`); the in-app `#/privacy` page covers it. To publish, the page is `dist/index.html` and every
other file goes next to it under the same relative path.

## How it works

```
dist/index.html (fragment)
  ├─ vendor/react*.production.min.js     React 18.3.1 UMD
  ├─ mock-api.js                         the simulated backend (a bundle, below)
  │     window.fetch("/api/...")  ──►  Express-like routers  ──►  Gode's own route handlers, chat
  │                                                               pipeline, auth, credits, learner,
  │                                                               redactor, classifier and picker,
  │                                                               on an in-memory database
  └─ app.js                              byte-identical copy of public/app.js
```

`mock-api.js` is made by `preview/build.js`, a small CommonJS bundler. It starts at
`preview/src/main.js`, follows `require()` calls and wraps each module in a function, so Gode's own
modules from `src/` run **unchanged** in the browser. Node builtins are replaced by
`preview/src/shims/` (only `crypto`, `net`, `express` and `Buffer`; anything else, such as `fs`,
`http` or `stream`, fails the build), and two product modules are swapped for browser stand-ins.

| Bundled unchanged from `src/` | Preview stand-in (`preview/src/`) |
| --- | --- |
| All the routes the frontend calls: `routes/auth.js`, `me.js`, `conversations.js`, `chat.js`, `models.js`, `public.js`, `billing.js`, `admin.js`, plus `sse.js` and `validate.js` | `http.js`: Express-like request and response objects, the error handler of src/app.js, a cookie jar, real `Response` objects and streamed SSE bodies |
| `chat/pipeline.js` (redact, classify, pick, hold, store, stream, settle, Stop, regenerate, switch) | `providers.js` + `answers.js`: the gateways; answers and media are made locally |
| `auth.js` (sessions, password rules, signup bonus, first-user admin, admin checks, delete everything) | `shims/gode-crypto.js` for `src/crypto.js`: PBKDF2 (Web Crypto) instead of scrypt, sync SHA-256, an identity "keyring" |
| `billing/credits.js` (holds, settle capped at the hold, ledger, grants, admin adjustments) | `backend.js`: a Stripe stand-in whose checkout answers "payments are off in this preview" |
| `router/learn.js` (per-model and per-cell stats, gate metrics, proposals, stored learner runs) | `sqlite.js` + `statements.js`: an in-memory stand-in for node:sqlite that knows every statement these modules prepare |
| `redact/index.js` + `redact/patterns.js` (built-in recognizers) | `shims/presidio.js` for `src/redact/presidio.js` (no Presidio in the preview) |
| `router/classify.js`, `pick.js`, `effort.js`, `providers/effort-map.js`, `fal.js` (units, length limits), `openaiCompatible.js`, `openrouter.js` | `media-files.js`: the SVG picture and WAV sounds (ported from `src/providers/mock.js`, which needs Node's Buffer) |
| `seed/catalog.js` (the model catalog, the routing table, prices, model validation, import and export) and `media.js` | `seed.js` and `seed-team.js`: the demo account and its team (below); `demo-routes.js`: the way back to the demo after Delete everything; `storage.js`: localStorage persistence |
| | `page.js`: small page glue around the app (downloads in the viewer's frame, the welcome note's first screen; below) |
| `src/config.js` defaults, computed at build time (`npm run dev` settings) into the bundle's fixture | |

The SQL stand-in is not a SQL engine: each statement the bundled modules prepare is registered with a
handler that does what SQLite does on these tables (same columns, defaults, order, constraints,
return values, `SUM` over no rows, `LIKE ... ESCAPE`). Preparing an unknown statement throws at once,
and `test/statements.test.js` scans the bundled sources, so a product change that adds SQL fails
the preview's tests rather than the preview.

The one product module not bundled is the media proxy (`src/routes/media.js`). It streams files from
a media CDN with Node streams, and the preview's media are `data:` URLs that never go through it.

## What the preview simulates

**The deployment.** Gode's phase 1 default with OpenRouter, OpenAI and fal configured, **no
self-hosted GPU server** (`PRIVATE_FALLBACK=zdr`), no Presidio (built-in recognizers only), mock
answers (`config.mock`) and test credit on (`ALLOW_DEV_TOPUP`). The app's sidebar line for mock
mode ("Demo mode: answers come from a built-in test model") is replaced, in the preview's styles, by
"Gode preview: no AI model is called; each answer explains what the live app would do." The app's
text is hidden with `visibility` as well as size, so screen readers, `innerText` and a copy get only
the preview's line.
Private text goes, redacted, to a zero-retention model and shows the Private lock badge plus the
"N personal details hidden" badge. The privacy page says sensitive requests only go to
zero-retention models, and self-hosted models are not offered.

**Answers.** Text answers stream in small chunks, 15 to 40 ms apart. Before that come a classifier
pause of about half a second and a first-token wait that grows with the effort. Their cost is real
arithmetic: the input sent plus a typical answer length for the difficulty and the effort's thinking
allowance, at the model's catalog price, plus the classifier's read of the message when an outside
classifier model read it (the live pipeline bills that call too), plus the 30% margin. The answer's
last line spells out those parts and their sum, written as the chip writes it ("that is $0.0249 in
all, as on the chip").

Each answer says why its model was picked, from the routing decision the pipeline just made, the
conversation's pins and the routing table: the plan's column for the job and difficulty, a pin
(yours or the router's), a switch, a regenerate, the private pick, the nearest other column, or no
routed pick usable under Strict privacy or EU-only (then a model chosen by price). It names the
real reason when Gode's own rules classified the message (it is private, the chat is private, or a
privacy filter excludes the classifier models), and why a request is private: the topic and its
words ("someone's health (“diagnosed”, “HIV”)"), or an ID, card or account number. A model whose
worst-case region is the vendor's own country but whose zero-retention hosts are elsewhere (DeepSeek
V4.1 Flash) is described, on a zero-retention request, as reached "through its zero-retention hosts
only", not as "China". On/off reasoning models say so instead of "the nearest level". With auto-pick
off, a media request answered in text by the hand-picked model says so, and that auto-pick makes the
picture, clip or sound. Picture and sound captions give the same reasons. Code questions include a fenced code
block in the language asked for (Python, JavaScript, TypeScript, HTML, CSS, SQL, Bash, Go, Rust,
Java, C, C++, C#, Kotlin, Swift, PHP and Ruby have skeletons; another named language, such as
Haskell or R, gets a plain fence with its own comment; Python only when no language is named).
Real code, written by the preview and labelled so, for the photo-renamer suggestion, a debounce or
throttle in JavaScript or TypeScript, a regex for common patterns (UK postcode, US ZIP, email, hex
colour, IPv4, ISO date, URL) with a test call, steps plus the failing and the fixed line for a few
well-known errors (`Cannot read properties of undefined`, `KeyError`, `NoneType`), and SQL for
duplicates and "top N ... by ..." (`ORDER BY ... DESC LIMIT N`, joined to orders, sales or reviews
when the request names them). Otherwise a skeleton named after the task that takes the thing it works
on ("checks if a string is a palindrome" gives `is_palindrome(s: str) -> bool`, called with
`"racecar"`; a list, a number or a file path likewise). A follow-up in a code chat ("Add a --dry-run
option") shows the updated code of the request it edits, in that request's language. Pictures and video show
a queue (2, 1, 0 ahead) and a generation phase, then an SVG that names the model and the prompt the
media model would get. Music and voice return a short WAV. A media answer's caption is sent live as a
`replace` event before `done`. The real server never sends this event for media; it stores the same
caption as the answer's text either way.

**The classifier.** Messages that Gode's own checks don't call private are "read" by DeepSeek V4.1
Flash, the catalog's classifier, as in the live app. Its reply is Gode's built-in keyword classifier
(`heuristicClassify`), and the answer says so. Two rules are added, standing in for what a
classifier model understands and the keyword rules don't (`preview/src/providers.js`):

- A bare description of a picture, clip or song with no verb ("A 5-second video of waves rolling onto
  a beach", as in the app's own suggestion chips; "A watercolor of a fox in the snow", "A cartoon of
  a dog surfing", "A 3D render of a city at night") counts as a media job, not chat
  (`mediaDescriptionJob`). The first media noun is the thing described ("A thumbnail for my YouTube
  video" is a picture). Only a single noun phrase counts: a question or a second clause ("A song
  stuck in my head all day, how do I get rid of it"), a sentence with its own verb ("A picture is
  worth a thousand words.") or more than one sentence stays chat, and "art" or "landscape" alone are
  not pictures ("The art of negotiation").
- A follow-up keeps the chat's job, as a classifier model does with the history the pipeline gives
  it (`followUpJob`): one sentence that starts with an edit verb ("Now make it also handle PNG
  files", "Add a --dry-run option", "Can you add comments to it?", "Make it at night instead") takes
  the job of the request it edits, or the medium it names ("Turn it into a song"). "Thanks! What
  does EXIF stand for?" stays chat. Its media prompt is the one Gode's own rule builds, as in the
  live app ("make it at night instead" folds the earlier request in; "Add a cat sleeping on the
  chair" is sent as it is).

Private messages are classified by Gode's own rules, as in the live app.

**Kept from the mock provider:** a message containing `GODE_MOCK_FAIL` fails before any text, and
`GODE_MOCK_FAIL_MIDSTREAM` fails after the first sentence (not advertised; the tests use them). The
failure card's detail line says the failure is simulated, in plain words.

**Billing.** `/api/billing/ledger` (with `held_usd` while an answer runs), `/checkout` and
`/dev-topup` are the real routes. The credit packs show as on a live server (`/api/me` reports
`stripe_enabled: true`). Choosing one gets the real checkout route's 503 `gateway_not_configured`,
with the message "Payments are off in this preview, so no card can be charged. Use Developer top-up
below to add free test credit." There is no URL, so the page never navigates. The test top-up has
the real bounds (more than $0, at most $100).

**The transparency log.** Every request the simulated gateways got is marked
`preview (simulated)` in its Gateway / provider column: text (`openrouter → preview (simulated)`,
from the gateway's own report, as in the live app), and also pictures, sounds, failures and Stops
(`fal → preview (simulated)`), which the live pipeline stores without an upstream host
(`backend.js`, `markSimulatedUpstream`).

**Admin.** Every admin route is the real one: the overview (`/api/admin/stats`), the routing grid
with its validation (action rows refused, private text cells only zero-retention or self-hosted
models, effort overrides), model edits and new models (`validateModel`), catalog export and import,
the user list with credit adjustments, and the learner with stored runs and apply-by-run. The
numbers are computed by `src/router/learn.js` from the preview's own `requests` and `ledger` rows,
so they move as the viewer chats, rates, switches and stops answers.

**The demo account.** A first visit lands signed in as `demo@example.com` (password `preview-demo`,
an admin, about $5: the $0.25 welcome credit and a $5 purchase) on a welcome note, with four chats
made through the API itself. The welcome note is a note, not a chat: a message sent from it starts
a new chat titled after the question (`page.js` moves the text to a new chat's composer and sends it
from there), so the note never becomes part of a conversation's history. The four chats:

- a code answer
- an explanation with a pinned follow-up
- a private health question with a name and an email
- a picture

Log out and any email can sign up (the real password rules apply) or log in. The auth screen shows
a preview note with the demo's email and password. Delete everything really deletes the account,
and the deletion is stored, so a reload does not bring the demo back by itself. Logging in (or
signing up) with the demo's own credentials when that account no longer exists makes it again
first: the same chats, credit and admin flag as on a first visit (`demo-routes.js`,
`seed.js` `restoreDemo`). Any other credentials get the real routes' answers. To start over
completely, clear the site's storage, or call `__godePreview.reset()` in the console and reload.

**The team.** So that the admin pages have something to show, `seed-team.js` adds four made-up
teammates (alex@, priya@, jordan@ and mei@example.com) and 23 days of their usage, about 210
answers. Mei has auto-pick off and picks models by hand.

- What is real: the accounts are made by `auth.signup` with a random password nobody knows (so
  nobody can sign in as them). Their purchases go through `credits.grant`. Each answer is paid
  through `credits.reserve` and `credits.settle`, so every balance equals its ledger. Each answer's
  model, tier and effort come from the real picker for the teammate's plan.
- What is made up: their routing-log rows (thumbs, regenerations, switches, a few errors and Stops).
  That table never holds prompts or answers, and the teammates have no conversations.

The history is deterministic (a seeded PRNG). It is tuned so the learner, at its real threshold of
20 ratings per model and cell, proposes exactly two changes:

- Chat · Quality to Claude Opus 5.5, because people kept switching to it from Gemini 4 Carbon
- Code · Budget to DeepSeek V4.1 Flash, as well liked as Qwen3 Coder Next for easy code, and cheaper

Because the demo account came first, it is the only admin (`FIRST_USER_ADMIN`). An account made
after deleting it is an ordinary user; the restored demo gets its admin flag and its one welcome
credit back (the real sign-up would give neither a second time).

**Storage.** Everything is kept in this browser under one versioned localStorage key,
`gode-preview:v1` (about 350 KB after the seed). When storage is blocked or throws (private windows,
previews, thumbnails), the preview runs from memory and starts fresh on every load. The preview's
"encryption" of chats is an identity encoding: the data never leaves the browser it was typed in.

## What it can't do

- No real AI, Presidio, Stripe or media, by design. Names are caught only when introduced ("my
  name is ..."), as on a server without Presidio. Video is a still SVG "first frame", as in the
  server's mock mode.
- Payments: the packs only explain that payments are off, and the "Payment received" return from
  Stripe never happens.
- Downloads (an image's Download link, Admin → Export JSON) work in a normal tab. Inside the
  sandboxed Artifact frame, which has no `allow-downloads`, they cannot: there the preview stops the
  click and says so in a note (right-click or long-press the file to save it; the catalog JSON is
  copied to the clipboard instead). Import JSON works anywhere (a file picker).
- Reloading or closing the page mid-answer keeps the answer so far, stopped and charged, as the
  real server does when the tab goes away: on `pagehide` every open answer stream loses its client,
  the real pipeline stores the partial answer, and the state is saved before the page is gone. A
  question still being routed when the page goes is not kept (the real server would not have it
  either). A browser that never fires `pagehide` (a crash) loses the running answer.
- No rate limits (one viewer, one browser). No cross-tab locking: two tabs share storage, but not
  the one-answer-at-a-time lock, and the last tab to save wins.
- The teammates' usage is a fixed made-up history. The admin page's numbers are real computations
  over it plus whatever the viewer does.
- Tested in Chromium (Playwright) only. The bundled code uses regex lookbehind and
  `AbortSignal.any` (Safari 16.4+ / 17.4+), and passwords need `crypto.subtle`, which means a secure
  context (the Artifact host is https; `localhost` counts too).

## The host's rules, and how they are met

- `dist/index.html` is a fragment, every reference is relative, and there are no inline scripts or
  handlers.
- Scripts and styles come only from the published files. The simulated backend answers every
  same-origin `/api/*` fetch and passes everything else to the browser's fetch unchanged, so
  `connect-src 'self'` is never tested by a real API call.
- Theme: the product's one `@media (prefers-color-scheme: dark) { :root {...} }` block is re-emitted
  twice, under `@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) }` and under
  `:root[data-theme="dark"]`, each with `color-scheme: dark`, plus `:root[data-theme="light"] {
  color-scheme: light }`. So the viewer's choice wins both ways, even when flipped with the page open.
  `build.js` generates this from the product's block, so the two never drift, and `body` keeps its
  token background.
- Phone app: the host pads `:root` by the safe areas, so the preview's styles use a `height: 100%`
  chain (`html`, `body`, `#root`, `.app-shell`) instead of `100vh`/`100dvh`. They also put
  `contain: layout` on `.app-shell`, so the overlays the app fixes to the viewport (the phone drawer,
  its scrim, the switch menu's bottom sheet) are placed against the shell, inside the padding, and
  `contain: layout` on `body`, so the toasts and the preview's notes, which are fixed outside the
  shell, appear below the top bar instead of over it (the auth screen still scrolls the document). And
  they drop the app's own safe-area insets under the composer and the bottom sheet, which would
  count the padding twice. `public/styles.css` itself is untouched.
- Every localStorage access is guarded. Nothing relies on `alert`, `confirm`, `prompt`,
  `window.open`, top navigation or downloads.
- A first visit opens the welcome note by replacing the empty hash with `#/c/<id>`
  (`history.replaceState`, no extra history entry). App routes like `#/settings` work inside the
  frame as they are.
- The welcome note is short enough for a 375 x 812 phone. The app opens a chat at its latest
  message, so on a smaller screen `page.js` shows the note from its top until the viewer scrolls,
  types or taps.
- The signed-out privacy page scrolls inside the host's padding (`.public-page` is its own
  scroller in the preview's styles), so its sticky bar stays below the phone's status bar and it
  opens at its top.
- Downloads in the frame: see "What it can't do". The notes `page.js` shows use the app's toast
  styling, in an element of their own outside the app's React tree.
- Focus in the frame: a sandboxed frame may not move focus before the viewer's first input there
  (Chromium logs "Permissions policy violation: focus-without-user-activation"). The app focuses
  the message box when a chat opens, so until the first input in the frame `page.js` holds back
  `focus()` calls instead; a first key typed with nothing focused (the host focused the frame) goes
  to the message box, as at top level.
- Billing: the credit packs look live, so a preview note under them says, before any click, that
  card payments are off and Developer top-up adds free test credit (preview styles only).

## The harness

`node preview/harness.js [port]` serves `dist/` the way the host does:

- the page skeleton around the fragment
- a CSP modelled on the host's (`connect-src 'self'`, scripts from the page's own files)
- a **599 and a `[harness] real /api request` log line for anything under `/api/`** (the preview
  must never let one through)

Query switches on the page URL:

| Switch | Effect |
| --- | --- |
| `?theme=dark` or `?theme=light` | The viewer's theme choice, as `data-theme` on `<html>`. |
| `?nostorage=1` | localStorage and sessionStorage throw. |
| `?safearea=1` | The phone app's 47 px / 34 px `:root` padding (fixed values: Chromium cannot fake `env(safe-area-inset-*)`, which is why the layout must not depend on it). |

`/frame.html?src=/` embeds the page in an iframe sandboxed like the viewer's
(`allow-scripts allow-same-origin allow-forms allow-popups`).

## Tests

`npm run preview:test` builds, then runs the following.

**`test/build.test.js`.** The fragment and its relative references. The byte-identical `app.js`
and React. The theme guards (every dark token under both selectors) and the layout overrides. The
real route modules are bundled; no Node-only modules, build paths or secrets are. The size budget.

**`test/statements.test.js`.** Every SQL statement in the bundled sources is supported. The six
dynamic ones work: the profile update, ledger kinds, the model upsert and lists, the learner's signal
sums with and without the tier, and the user search with `LIKE ... ESCAPE`. Transactions roll back and nest like
`src/db.js`.

**`test/contract.test.js`.** One scenario runs against the **real server** in demo mode
(`test/helpers/app.js`) and against the preview. The two must give the same status codes, error
codes and messages, JSON structure and types, and SSE event names and fields. It covers:

- sign-up, `/api/me` and settings
- chat, including a picture's progress and media events
- conversations
- the models menu, feedback, switch and regenerate
- billing (ledger, packs, top-up bounds) and running out of credit (the same SSE error)
- admin access (401 signed out, 403 for members), stats and routing
- route edits with their private-cell rules, model edits and new models
- catalog export and import, users and credit adjustments
- the learner (errors, runs, apply by run id)
- transparency, public providers, password change and delete everything

Values that depend on the deployment differ on purpose: the preview has the demo data, no
self-hosted model and its own checkout message.

**`test/answers.test.js`.** The explanations against the routing decisions they describe: media
captions after a switch, a regenerate and a pinned follow-up; the cost line adding up to the
charge; Strict privacy and EU-only (the model, the in-house classifier, an on/off effort); a model
chosen by price when no routed pick qualifies; private because of an ID number; contact details
that are not an Action, and an Action answer naming the Chat row it was routed by; code samples (a
word-boundary comment, a task name, HTML, the language asked for with no Python stand-in, yes-or-no
names, SQL and debounce code that is not filler, skeletons that take a parameter, regex, error and
top-N samples); the seeded photo renamer; the mid-stream failure; private media captions (and their
full stop); the video frame; manual mode's note on a media request; the private sample's topic and
its model's zero-retention hosts; a voice prompt that holds only the words to say.

**`test/backend.test.js`.**

- the seeded state, routing and pins, private routing with redaction, media progress
- Stop (kept and charged), failures (free), the busy lock
- persistence, blocked storage, sign-up and delete everything, and the demo's credentials bringing
  it back
- that only same-origin `/api/*` is intercepted, and the six suggestion chips
- that the admin numbers move with the viewer's requests and add up with the ledger (balances,
  charges, purchases, free credit)
- that the team history is deterministic, with its two proposals
- that the classifier stand-in's media rule leaves questions and sentences as chat, and reads
  watercolors, cartoons, 3D renders and thumbnails as pictures
- that follow-ups keep the chat's job (code stays code on the chat's model, a picture is redrawn,
  "turn it into a song" is music) while a plain question stays chat
- that every request the simulated gateways got is marked simulated in the transparency log
- billing (held credit while an answer runs), and the first visit's welcome note

**`smoke.js`.** Chromium through the harness, on a random port:

- the desktop flow: chat streaming, the screen-reader announcement in plain words, a double-click
  on Send (one answer, not a Stop), Stop before the answer starts (nothing stored, the text back in
  the composer), thumbs, switch, regenerate, Stop, image (with its caption's reason after a
  switch), private routing, failure with Try again (a clean partial sentence, a chip that says "not
  charged"), reload, settings
  (the transparency log fits), password change, billing (pack message, top-up), admin (overview
  moving with a new chat, learner proposals in words and Apply, routing edits with the private-cell
  refusal, catalog price edit, export and import, users and credit, your own credit moving the
  sidebar balance), privacy (DeepSeek's zero-retention hosts), delete a chat, log out and in, delete
  everything (it stays deleted
  after a reload) and the demo's credentials bringing it back
- more chat behaviour on a fresh demo account: the seeded answer's cost line matches its chip and
  the billing history adds up to the balance; a message from the welcome note starts its own
  chat; a real Stop press (keyboard during routing, mouse past the double-click guard, mouse
  mid-answer with a draft typed) sends nothing again; a picture stopped while it is made says it
  is charged from the start; a regenerate or switch stopped mid-way keeps the earlier picture and
  says what the stopped attempt cost (from the routing log); keyboard focus stays on the answer
  during a Regenerate or a switch-menu pick and moves to its Regenerate button after; a private
  picture with nothing to remove gets an honest badge;
  reloading mid-answer keeps the answer, stopped and charged; the sidebar and billing notes (the
  hidden test-model line out of the accessibility tree); a
  pack pressed by keyboard keeps focus; simulated providers in the transparency log; a take-back
  larger than the balance; a $0.25 account trying a video gets the real cost in the notice
- the viewer frame as a person meets it: no focus-policy error before any input, and a key typed
  once the host focuses the frame lands in the message box (Playwright's own frame calls count as
  user input, so the check makes none until the end)
- `?nostorage=1` end to end
- the sandboxed frame (chat, image, the download notes, pack message, admin, log out and in)
- a cross-origin embed without clipboard permission (Copy still copies)
- phone 375x812 in light and dark on every screen and admin tab without sideways scroll
- `?safearea=1` with the shell, drawer and the whole composer inside the padding, and a toast below
  the top bar
- phone 320 and 360 px with auto-pick off: the model select, "Turn on auto-pick" and Send side by side
- phone 320 px, and the chip's cost never cut off there
- phone first screens: the welcome note and a new chat open at their top (375 x 812, 375 x 667,
  320 x 568 in the safe areas), the image chat's chip above the composer, the billing history in
  view, the drawer on short screens, the signed-out privacy page in the safe areas
- the four OS and viewer theme combinations, plus flipping the theme live
- a desktop dark tour

It fails on any console error or warning, CSP violation, failed request, missing file or real `/api`
request.

## Extending

`createBackend({ statements, extraRouters })` takes more SQL statement handlers (`statements.js`
exports `withStatements`) and more routers, mounted after the built-in ones. `backend.session()`
gives a second "browser" on the same simulated server with its own cookie jar (the contract tests
use it to be the demo admin and another user at once).

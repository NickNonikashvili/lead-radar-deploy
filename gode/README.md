# Gode

Gode is an AI website that picks the right model for every request. You type (or ask for a picture,
a video, a song or a voiceover); Gode works out what kind of job it is and how hard it is, picks the
best model for that job from a routing table, strips your personal details before anything leaves,
and shows which model answered and what it cost. People pay with prepaid credits.

This repository is **phase 1** of the research plan: the website router. Gode doing things in other
apps (calendar, email, LinkedIn...) is phase 2, and native apps are phase 3.

- [What's in phase 1](#whats-in-phase-1)
- [Try it in two minutes (no keys)](#try-it-in-two-minutes-no-keys)
- [Going live](#going-live)
- [How routing works](#how-routing-works)
- [The routing table is data](#the-routing-table-is-data)
- [The weekly learner](#the-weekly-learner)
- [The benchmark](#the-benchmark)
- [Privacy: what we can and can't promise](#privacy-what-we-can-and-cant-promise)
- [Billing](#billing)
- [Security notes](#security-notes)
- [Deploying](#deploying)
- [Not in phase 1, and the gates](#not-in-phase-1-and-the-gates)
- [Development](#development)

## What's in phase 1

Each item of the research doc's phase 1 checklist, and where it lives:

| Checklist item | Where it is |
| --- | --- |
| Chat interface with login | `public/` (React page, no build step) and `src/auth.js`. Email + password accounts, sessions in an HttpOnly cookie. |
| Classifier call that returns job, difficulty and privacy flag as JSON | `src/router/classify.js`. A cheap model returns `{job, difficulty, private, output, title}`; if it is unavailable, slow (over 4 s) or returns bad JSON, a built-in keyword classifier takes over. |
| Routing table in the database: job × tier → model, effort, retention flag | `routes` and `models` tables (`src/db.js`), seeded from `src/seed/catalog.js`, edited on the admin page. Each cell can override the reasoning effort; each model has a zero-retention flag and a retention note. |
| OpenRouter for text, fal for image, video, music and voice | `src/providers/openrouter.js` and `src/providers/fal.js`, plus direct OpenAI (`openai.js`) and your own GPU server (`selfhosted.js`). |
| Presidio redaction on every outgoing prompt | `src/redact/` (built-in recognizers, always on) and `presidio/` (the optional Presidio sidecar for better name and place detection). |
| Model chip with cost on every answer, plus a switch button | Every answer shows e.g. `Claude Opus 5.5 · high effort · $0.04` with a menu to re-run it on another model (`src/chat/pipeline.js`, `public/app.js`). |
| 👍/👎 and regenerate logging | Feedback, regenerate and switch are recorded on each request's log row (`requests` table) and feed the weekly learner (`src/router/learn.js`, `scripts/learn.js`). |
| Stripe credits with a margin on top of API cost | `src/billing/credits.js` (balances, holds, ledger) and `src/billing/stripe.js` (Checkout + webhook, no Stripe SDK). |
| Benchmark your router against openrouter/auto on 200 real prompts | `bench/run.js` with 200 seed prompts in `bench/prompts.jsonl`, and `scripts/export-bench-prompts.js` to swap in real prompts from users who opted in. |

## Try it in two minutes (no keys)

You need Node.js 22.5 or newer (`node --version`).

```sh
npm install
npm run dev
```

Open http://localhost:3000 and sign up. In development **the first account becomes the admin**
(`FIRST_USER_ADMIN`, on by default outside production; see [Security notes](#security-notes) for
production). `npm run dev` runs in *mock mode*: answers, pictures and sounds are fake (no AI is
called, nothing costs money), but everything else is real: routing, redaction, the chip, credits, the
admin page. An "add test credit" button appears on the billing page so you can play with credits.

Things to try:

- Type `My name is Jane Doe, email jane.doe@example.com. Write a thank-you note.` The note under the
  answer says how many personal details were hidden from the model (it received `[PERSON_1]` and
  `[EMAIL_1]`), and the mock answer quotes your words back with the real values put back in on
  Gode's side. Settings → transparency log shows the same per request.
- Ask for a picture or a song: the job changes and a media model is picked.
- Use the chip's switch menu, 👍/👎 and ↻, then open `#/admin` to see the routing grid and stats.

(`npm run dev` sets environment variables the Unix way. On Windows use WSL, or set `GODE_MOCK=1` and
`ALLOW_DEV_TOPUP=1` yourself and run `npm start`.)

## Going live

Copy the example settings and fill them in. Every variable is explained in `.env.example`.

```sh
cp .env.example .env
```

### 1. Master key (required)

Gode encrypts every user's chats with a per-user key, and those keys with one master key.

```sh
openssl rand -base64 32
```

Put the result in `GODE_MASTER_KEY`. In production Gode refuses to start without it. Keep a copy
somewhere safe and separate from your database backups: if you lose it, stored chats can never be
read again; if someone gets it *and* the database, they can read everything.

### 2. Model gateways

| Key | What it unlocks | Where to get it |
| --- | --- | --- |
| `OPENROUTER_API_KEY` | All text and code models, the classifier, and the benchmark baseline | openrouter.ai → Keys |
| `FAL_KEY` | Image, video, music and voice | fal.ai → Dashboard → Keys |
| `OPENAI_API_KEY` (optional) | Direct OpenAI models: the top image pick (GPT-Image-2.6), GPT models, a classifier fallback. Without it the image "quality" column falls back to the next tier. | platform.openai.com → API keys |
| `SELFHOSTED_BASE_URL` (optional) | The private tier: an OpenAI-compatible server you run (vLLM, Ollama, TGI). The seed table expects a model served as `qwen3.8-27b` (vLLM's `--served-model-name`). Turn the server's request logging off (vLLM: `--disable-log-requests`), or private prompts end up in its logs. | your GPU box |

The classifier runs on DeepSeek V4.1 Flash through OpenRouter (zero-retention endpoints), or GPT-6
Luna on direct OpenAI when only an OpenAI key is set (GPT-6 Luna is **not** zero-retention); pick
another catalog model with `CLASSIFIER_MODEL_ID`. If its call fails or takes over 4 s, the built-in
keyword classifier answers. A message Gode's own checks already call private (personal health, money
or legal details, a card number or secret, or any turn of a conversation that is already private)
never goes to an outside classifier: your self-hosted model classifies it, or the built-in rules do.
With EU-only on, the classifier must be EU-hosted or self-hosted, else the built-in rules answer.

Set a monthly spending limit on each provider account. Gode charges users before it spends, but a
provider-side cap is your last line of defence against a bug or abuse.

**OpenRouter account setting: "ZDR only".** Gode asks OpenRouter for zero-retention endpoints on every
private and strict-privacy request (and on every classifier call). By default that per-request filter
also accepts *Safety Retention* endpoints, which may keep prompts to look for abuse. In OpenRouter's
privacy settings (openrouter.ai/settings/privacy), choose **ZDR only** instead of "Allow Safety
Retention" for both model groups (Google and all other models), so the zero-retention promise on
`/privacy.html` holds. Don't switch on account-wide ZDR enforcement itself: that would also block the
non-zero-retention models Gode routes ordinary requests to.

With a gateway key set, start Gode with `npm start` (`npm run dev` always forces mock mode). Mock
mode is otherwise automatic: on when no gateway key is set outside production; force it either way
with `GODE_MOCK`. Models whose gateway has no key are simply skipped by the router.

### 3. Presidio (recommended)

The built-in recognizers catch emails, phone numbers, card numbers, IBANs, US social security numbers,
IP addresses, API keys and passwords, and names introduced by phrases like "my name is" or "Dear".
Presidio adds real name and place detection ("tell Maria Garcia I'm in Berlin"). Run it next to Gode:

```sh
docker compose -f presidio/docker-compose.yml up -d     # needs ~1.5 GB RAM
```

then set `PRESIDIO_ANALYZER_URL=http://localhost:5002`. No Docker? `presidio/README.md` has a small
Python version.

**If Presidio goes down** (`PRESIDIO_FAIL_MODE`):

- `closed` (the default): Gode refuses prompts until it is back. Users see "The privacy filter is
  unavailable right now, so nothing was sent. Try again in a minute." (`503 redaction_unavailable`;
  nothing is stored, held or charged). Redaction is a promise, so this is the safe default.
- `open`: Gode keeps redacting with the built-in recognizers only, so names and places may get
  through, and the privacy page stops naming Presidio until it is back.

Either way the outage is logged when it starts, every 5 minutes while it lasts and when it ends
(counts only, never text), the admin overview shows a banner, and the server checks Presidio's health
every 20 seconds so prompts use it again as soon as it answers.

To choose which detectors run, set `PRESIDIO_ENTITIES` (for example
`PERSON,PHONE_NUMBER,EMAIL_ADDRESS,IBAN_CODE,CREDIT_CARD,US_SSN,IP_ADDRESS,LOCATION`; empty = Presidio's
defaults). Name and place detection also hides public figures and places ("Why did Napoleon lose at
Waterloo?"), so you can leave out `PERSON` or `LOCATION`; the built-in recognizers run either way.

### 4. Stripe

1. In the Stripe Dashboard copy your secret key into `STRIPE_SECRET_KEY` (`sk_test_...` while
   testing; `sk_live_...` or a restricted `rk_live_...` key in production).
2. Developers → Webhooks → Add endpoint: `https://YOUR-DOMAIN/api/billing/webhook` (your
   `PUBLIC_URL` + `/api/billing/webhook`).
3. Select these events: `checkout.session.completed` and
   `checkout.session.async_payment_succeeded` (the second covers bank payments that clear later).
4. Copy the endpoint's signing secret (`whsec_...`) into `STRIPE_WEBHOOK_SECRET`.
5. Pin the endpoint to the API version Gode is written against, `2026-09-30.endive`, so Stripe
   doesn't change the event shape under it.
6. Leave Adaptive Pricing off (or keep it in your `CURRENCY`, default `usd`): credits are granted from
   the session's amount in that currency.

The webhook answers 200 for every event it has dealt with (credited, ignored or already seen) and an
error for a bad signature or a failed credit, so Stripe retries those. Each checkout is credited
exactly once, however often Stripe delivers it.

Testing locally with the Stripe CLI: `stripe listen --forward-to localhost:3000/api/billing/webhook`
prints a temporary `whsec_...` to use, and card `4242 4242 4242 4242` pays in test mode.

Credit packs (`CREDIT_PACKS`, default 5, 10, 25 USD), the margin (`CREDIT_MARGIN`, default 30%) and
the signup bonus (`SIGNUP_CREDIT_USD`, default $0.25; see [Billing](#billing) for its limits) are all
settings. Buying credits needs both `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET`; without them the
billing page shows the packs as unavailable.

Only Checkout sessions Gode created are credited: the webhook requires the session's
`metadata.user_id` (a Stripe Payment Link can't set it), a matching `client_reference_id`, and an amount
paid equal to the credit Gode's checkout recorded in the session's metadata. Anything else is logged
with the Stripe ids and skipped. The amount need not be one of today's `CREDIT_PACKS`: a customer who
paid for a pack you removed while their Checkout session was open (up to 24 hours) is still credited.

### 5. The rest of production

```sh
NODE_ENV=production
PUBLIC_URL=https://gode.example.com     # the real address, https; Stripe redirects back here
DATA_DIR=/var/data                      # a PERSISTENT disk (see Deploying)
ADMIN_EMAILS=you@example.com            # exactly these addresses are admins (checked on every
                                        # request; removing one revokes admin)
```

`NODE_ENV=production` turns on secure cookies (named `__Host-gode_session`), HSTS and proxy headers,
turns off the free test-credit button and the first-account-is-admin rule, and makes the master key
mandatory. With Stripe on, Gode refuses to start when `PUBLIC_URL` is not a public `https://` address.

Other settings worth knowing (all in `.env.example`):

| Setting | Default | What it does |
| --- | --- | --- |
| `PRESIDIO_FAIL_MODE` | `closed` | Presidio down: refuse prompts (`closed`) or use built-in checks only (`open`) |
| `SELFHOSTED_RETRY_MS` | 30000 | After a self-hosted outage, use `PRIVATE_FALLBACK` for this long before trying the server again |
| `TEXT_FIRST_BYTE_TIMEOUT_MS` | 120000 | Give up on a model that sends nothing for this long (×2, ×3, ×4 at effort high, xhigh, max); 0 = off |
| `TEXT_IDLE_TIMEOUT_MS` | 90000 | Give up when a stream goes silent mid-answer for this long; 0 = off |
| `MEDIA_PROXY`, `MEDIA_PROXY_HOSTS` | on, `fal.media` | Serve generated media through Gode so media hosts never see users' IP addresses |
| `OPENAI_ZDR_APPROVED` | off | Set only when OpenAI approved zero retention for your key; allows the zdr flag on direct-OpenAI models |
| `SIGNUP_BONUS_DAILY_CAP` | 200 | Signup bonuses granted per UTC day across all accounts (0 = no cap) |
| `MIN_AFFORDABLE_OUTPUT_TOKENS` | 256 | Refuse a text request when the balance can't pay for this many output tokens; on a reasoning model the effort is lowered first so its thinking leaves at least this much |
| `STALE_HOLD_MINUTES` | 30 | Credit holds older than this are released by the 5-minute sweep (at least the fal timeout + 5) |
| `LEARN_SCHEDULE`, `LEARN_AUTO_APPLY` | off, off | Run the learner weekly inside the server; apply its proposals automatically |
| `FIRST_USER_ADMIN` | on outside production | The first account becomes admin, only when `ADMIN_EMAILS` is empty |
| `ADMIN_EMAILS_AUTO_GRANT` | on outside production | A listed `ADMIN_EMAILS` address is an admin from signup; off: confirm it once with `scripts/make-admin.js` |

## How routing works

Every message goes through four steps.

1. **Classify.** The classifier reads the (already redacted) message and the last few messages and
   returns the job (`chat, code, image, video, music, voice, action`), a difficulty from 1 to 5,
   whether it looks private, and output hints (length, aspect ratio, duration).
2. **Pick.** The job and the user's plan choose a column of the routing table:

   | Difficulty | 1 | 2 | 3 | 4 | 5 |
   | --- | --- | --- | --- | --- | --- |
   | Saver plan | budget | budget | budget | balanced | balanced |
   | Balanced plan (default) | budget | budget | balanced | quality | quality |
   | Best plan | balanced | quality | quality | quality | quality |

   Media jobs ignore difficulty: Saver uses budget, Balanced uses balanced, Best uses quality. If the
   chosen model can't be used (no key, disabled), Gode walks to the nearest other column, then to the
   cheapest model that can do the job.
3. **Set effort.** Difficulty sets the reasoning effort: 1 = no thinking, 2 = low, 3 = medium,
   4–5 = high. An admin can override the effort per cell. Models that can't switch thinking off get
   their lowest level instead; models without a thinking setting get none. Most of the savings come
   from easy questions not paying for deep thinking.
4. **Learn.** Every request is logged (metadata only: model, cost, speed, 👍/👎, regenerate, switch).
   The weekly learner turns that into routing-table changes.

**One model per conversation.** The first pick is pinned to the conversation, so the tone stays the
same and the provider's prompt cache keeps working. A harder follow-up may move the conversation *up*
a column, never down. A new kind of job ("now make a video of it") gets its own pick. If the user
picks a model from the switch menu, that choice is pinned and never changed automatically.

**Switch and manual pick.** The chip's menu re-runs the answer on another model and pins it. Users who
turn auto-pick off choose the model themselves for every message. Both are logged, because "the user
overrode the router" is the most useful training signal there is.

**`action` jobs** ("post this on LinkedIn") are phase 2. In phase 1 they are answered by the chat
route with a short note.

**Private requests.** A request counts as private when redaction finds a high-risk value (card, IBAN,
SSN, bank account, passport, secret), when built-in keywords say so, or when the classifier says so
(health, money, legal, passwords...). The keywords count only when tied to a person ("my diagnosis",
"I was diagnosed", "her custody hearing", "my password is..."), so a developer asking about a salary
column or a password-reset flow is not private. Gode decides locally first: a request its own checks
call private is never shown to an outside classifier (see above).

Once a conversation is private it stays private, for every later text turn. That holds even when the
private turn's answer failed or was stopped, and after a private media turn: the flag is stored with
the question. Private text goes to the **private tier**: your self-hosted model if `SELFHOSTED_BASE_URL`
is set, so nothing leaves your servers. Without one, `PRIVATE_FALLBACK=zdr` (the default) sends it,
still redacted, to a zero-data-retention model with OpenRouter forced onto zero-retention endpoints;
`PRIVATE_FALLBACK=block` refuses instead. The same fallback applies while a configured self-hosted
server is down: after a connection failure, a 502/503/504 or a first-byte timeout it is marked down for
`SELFHOSTED_RETRY_MS` (30 s), and private prompts take the `PRIVATE_FALLBACK` path meanwhile (the
request that hit the outage fails once). If you promise "nothing leaves our servers", set
`PRIVATE_FALLBACK=block`. A zero-retention fallback keeps the model it started with for the rest of the
conversation and only moves up a tier, never down.

No media provider offers zero retention, so private media prompts go to the media private cell (the
budget pick) with personal details replaced by generic words ("a person"). A media request in a private
conversation is private when its prompt builds on earlier messages ("now make a video of it"); a
standalone media prompt there is judged on its own.

**One answer at a time per conversation.** A second message (or regenerate) sent while an answer is
still running in the same conversation gets "Wait for the current answer to finish." (`busy`) before
anything is sent or charged. This keeps the placeholder map, the pins and the stored answers
consistent.

**Strict privacy** (a user setting) allows only zero-retention or self-hosted models for everything.
Because no media model qualifies, strict-privacy users can't make pictures, video, music or voice.

**EU-only** (a user setting) limits text jobs, and the classifier, to models hosted in the EU
(Mistral) or on your own servers. It doesn't apply to media. The Mistral models are pinned to
Mistral's own EU endpoint on OpenRouter with no fallback. That pins the model host; for OpenRouter's
own processing to stay in the EU too, OpenRouter offers in-region routing (`eu.openrouter.ai`) on
Business and Enterprise plans.

The seed routing table (late November 2026, from the research doc; the live one is on the admin page):

| Job | Quality | Balanced | Budget | Private |
| --- | --- | --- | --- | --- |
| chat | Gemini 4 Carbon | Mistral Large 4 (ZDR, EU) | DeepSeek V4.1 Flash (ZDR) | Qwen3.8 27B, self-hosted |
| code | Claude Opus 5.5 (ZDR) | Claude Sonnet 5.5 (ZDR) | Qwen3-Coder-Next (ZDR) | Qwen3.8 27B, self-hosted |
| image | GPT-Image-2.6 Sunburst (OpenAI) | Qwen Image 3 (fal) | FLUX.3 Klein (fal) | FLUX.3 Klein (fal) |
| video | Wan 3.0 (fal) | Veo 3.1 Lite (fal) | Wan 2.2 Fast (fal) | Wan 2.2 Fast (fal) |
| music | ElevenLabs Music v2.5 (fal) | Lyria 3.5 (fal) | Stable Audio 3 Small (fal) | Stable Audio 3 Small (fal) |
| voice | ElevenLabs v4 (fal) | Qwen Audio 3 TTS (fal) | ElevenLabs v4 Turbo (fal) | ElevenLabs v4 Turbo (fal) |

ZDR = the provider route keeps no prompts or answers. Alternates (not routed by default) are in the
catalog too, so the switch menu and the learner have choices.

**Maintenance before 2027-01-04:** fal retires the Wan 2.2 family on that date. The video budget and
private cells (Wan 2.2 Fast) must be re-routed on the admin page before then; the nearest seeded
alternate, LTX-2.3 Fast, costs much more per clip, so check fal's catalog first.

**Voice length limits.** Text-to-speech models cap the text they accept (Qwen Audio 3 TTS 2,000
characters, ElevenLabs v4 and v4 Turbo 5,000; set per model as `params.max_chars`). Longer text gets a
clear error before any credit is held.

## The routing table is data

Rankings change weekly, so nothing about model choice is hard-coded.

- **Admin page** (`/#/admin`, admins only): the jobs × tiers grid with a model and an effort override
  per cell; the model catalog (prices, zero-retention flag, enabled); gate metrics and per-model
  stats; learner proposals with an Apply button; export and import of the whole catalog as JSON.
- **Export / import** lets you edit the table in a text editor, keep it in version control, or copy it
  between servers. Every route change is recorded in `route_history` with who made it (admin, learn,
  seed) and why.
- **Reset to the seeds**: `npm run seed -- --force` (same as `node scripts/seed.js --force`) upserts
  every seed model and resets the seeded routes, overwriting admin and learner edits to those cells.
  Without `--force` it only fills an empty database (the server also does that on first start).
- When prices or models change, edit the catalog on the admin page. Keep prices accurate: when a
  provider doesn't report a cost, Gode computes it from these prices, and users are charged from it.
  Direct-OpenAI models also carry `params.pricing` (the cached-input rate and the long-prompt
  multipliers above 272K input tokens), because OpenAI reports no cost. Media models with a length
  input carry `params.duration_options` (the lengths the endpoint accepts); the classifier's
  "20 second video" is snapped onto them, and the hold covers that length.
- **Privacy flags are checked against the gateway.** An edit or import is refused when it marks a
  model `self_hosted` or region `self` off the `selfhosted` gateway, `zdr` on fal, or `zdr` on a
  direct-OpenAI model without `OPENAI_ZDR_APPROVED=1`. At boot Gode clears such flags on existing rows
  (and logs the model ids). Gode only ever sends unredacted text to the `selfhosted` gateway, whatever
  the flags say. An edit that would leave a private text cell's model neither zero-retention nor
  self-hosted is refused too: route another model to that cell first.
- **Seed changes and existing databases.** The seeds only fill an empty database. New seed data (for
  example the pricing and duration options above) reaches an existing one only through
  `npm run seed -- --force` or an admin edit; without `duration_options` a video keeps its catalog
  default length.

## The weekly learner

```sh
npm run learn                     # print gate metrics + proposed changes, store the run for review
node scripts/learn.js --apply     # also write them to the routing table now
node scripts/learn.js --days 14 --min-samples 30
```

The learner compares models **within one routing cell** (job × tier), because each column gets
different traffic: the budget column's easy questions would otherwise make a cheap model look better
than the quality pick. For each model in a cell it computes a satisfaction score from the last 28 days:
`(👍 + 1) / (👍 + 👎 + regenerates + switches + 2)`. Stopped and failed answers are neutral. A cell is
considered only when its current model has at least `--min-samples` **ratings** there (👍, 👎,
regenerates, switches; default 20), and a challenger needs as many in the same cell. Then it proposes:
**quality** = the best score, only when it beats the current pick by more than 0.02; **balanced** = the
best score for the cost, never a model users liked less than the current pick; **budget** = the
cheapest model scoring within 0.02 of the current budget pick, only when it is cheaper. No ratings, no
change. The private column is never touched. Applied changes are logged in `route_history` and can be
changed back on the admin page.

Every run is stored (`learn_runs`) and listed on the admin page, where **Apply** applies exactly the run
you reviewed: feedback that arrives between Run and Apply doesn't change it.

Run it weekly as a dry run, then review and apply the stored run on the admin page. Example crontab line
(Mondays at 04:17, server time):

```cron
17 4 * * 1  cd /srv/gode && /usr/bin/node scripts/learn.js >> data/learn.log 2>&1
```

On hosts where a cron job can't reach the server's database disk (Render, Railway), set
`LEARN_SCHEDULE=weekly`: the server checks hourly and runs the learner once a week (judged from the
stored runs, so a restart neither skips nor repeats a week), and stores the run for review. Add
`LEARN_AUTO_APPLY=1` only if you want its proposals applied without review.

## The benchmark

Phase 1's last checklist item: does Gode's routing beat simply sending everything to OpenRouter's own
`openrouter/auto` router?

```sh
node bench/run.js --dry --limit 20      # plumbing check: no keys, no cost, fake answers
node bench/run.js --limit 20            # small live run first (needs OPENROUTER_API_KEY)
npm run bench                           # all 200 prompts
```

For each prompt, Gode redacts, classifies, picks (Balanced plan, fresh conversation) and answers;
`openrouter/auto` gets the **same redacted prompt** (and the same zero-retention restriction if Gode
needed one). A judge model then compares the two answers side by side. To cancel the judge's habit of
favouring the first (or second) answer, Gode's answer goes in slot A or B based on a hash of the
prompt id, so roughly half each way and the same every rerun. Both sides always get the same redacted
input, also when Gode picks a self-hosted model, and the judge runs on zero-retention endpoints whenever
either side needed them (a private prompt). Media prompts are classified and then skipped, because
`openrouter/auto` only does text.

The report lands in `bench/results/` (git-ignored): `summary-<time>.md` with win/tie/loss, total and
per-prompt cost on each side, the cost ratio, latency p50/p95, a per-job breakdown and which models each
side used; `results-<time>.json` has every row, including both answers. Gode's cost includes its
classifier call.

Options: `--judge <model id>` (default Claude Opus 5.5 via OpenRouter; any `openrouter:<vendor>/<model>`
works, and if the judge also wrote many of the answers the summary warns you, because judges can favour
their own writing), `--plan saver|balanced|best`, `--concurrency 3`, `--prompts <file>`,
`--catalog <file>` (benchmark a routing table exported from the admin page instead of the seeds),
`--out <dir>`. A full live run should cost a few dollars, mostly the judge and the quality-column
answers; start with `--limit 20` and check the cost lines in its summary.

**Real prompts.** `bench/prompts.jsonl` holds 200 realistic text prompts we wrote (127 chat, 65 code,
8 action; none classifies as media, so all 200 are compared). The checklist asks for *real* prompts.
Once users have opted in ("share prompts" in Settings):

```sh
npm run export-bench-prompts             # writes bench/prompts.real.jsonl
node bench/run.js --prompts bench/prompts.real.jsonl
```

The export takes only users with sharing on, only their current messages, and never anything from a
conversation that was ever private (including private turns whose answer failed or was stopped). Each
conversation is redacted in order with its own stored placeholder map, so a name introduced earlier is
still caught; a conversation whose map can't be decrypted is skipped. It writes no user ids, emails or
dates (each row's id is a one-way hash). Keep the file out of git anyway: it is still people's words.

An LLM judge is a useful signal, not ground truth. Read a sample of the answers yourself before
trusting a headline number.

## Privacy: what we can and can't promise

The honest version, from the research: we can stop providers learning **who** the user is and strip the
personal details we can detect, and for private or strict-privacy requests we can make sure the
provider doesn't keep the text. We **can't** promise the AI company never sees the request, unless it
runs on a model we host ourselves.

What Gode does, layer by layer:

1. **Strip personal data before it leaves.** Every outgoing prompt (text, history and media prompts) is
   redacted: real values are swapped for placeholders like `[PERSON_1]` and put back into the answer on
   our server. The same value gets the same placeholder throughout a conversation. Answers are filtered
   too: card numbers, IBANs, SSNs, bank accounts, passport numbers and secrets that a model writes, and
   that aren't the user's own, are masked while the answer streams, before any digit of them is shown
   (a multi-line key block, a single token over 4 KB, or a number recognised as such only from words
   that come after it, is replaced when the answer ends). Placeholders inside links are deliberately
   not put back, so a link may show `[EMAIL_1]`: otherwise a model following injected instructions could
   put the user's real values into a link to someone else's site.
   The classifier is a model provider too: messages not already known to be private go to it
   (redacted, with the last few messages), on zero-retention endpoints by default (GPT-6 Luna on an
   OpenAI-only deployment is not zero-retention). Messages Gode's own checks call private, and every turn
   of a private conversation, are classified on our servers. The transparency log names the classifier
   of each request.
   With Presidio configured and down, prompts are refused (`PRESIDIO_FAIL_MODE=closed`, the default)
   rather than sent with weaker redaction.
   *Limits:* detection is pattern- and model-based, so it misses things: unusual formats, names with no
   context when Presidio isn't running, street addresses, and personal facts described in words ("my
   sister's divorce", "my diagnosis"). Treat redaction as a strong filter, not a guarantee.
2. **Pool identity.** Every call goes out from our server under Gode's own API accounts. Providers never
   get a user id, email or IP address. The only per-conversation value sent (to OpenRouter and OpenAI,
   to keep their prompt caches warm) is an opaque hash of the conversation id that means nothing without
   our database. Generated pictures, video and audio are fetched through Gode (`/api/media/...`,
   owner only, from `MEDIA_PROXY_HOSTS` only: a file on any other host is not shown at all and its host
   is logged, so list every media host there), so media hosts don't see users' IP addresses either. fal
   links expire after about an hour; after that the media shows "This file has expired at the media
   provider." (keeping copies is a later step).
   *Limit:* if the text itself identifies someone and redaction misses it, the provider sees it.
3. **Zero data retention where offered.** Each model in the catalog has a zero-retention flag and a
   retention note, published on the public `/privacy.html` page. Private and strict-privacy requests
   only go to zero-retention or self-hosted models, and OpenRouter is told per request to use only
   zero-retention endpoints that don't collect data.
   *Limits:* ordinary requests may go to models that **do** keep data: Gemini (Google can keep content
   for safety review and its paid API keeps data 55 days by default), direct OpenAI (abuse-monitoring
   logs for up to 30 days), and fal for all media (requests and results kept about an hour, results
   served from a public link until it expires). "Zero retention" is the provider's policy, which we
   can't audit, and some providers keep content their safety systems flag.
4. **Self-hosted tier for sensitive jobs.** With `SELFHOSTED_BASE_URL` set, private text runs on your
   own GPUs and nothing leaves your servers. Without it (the phase 1 default), or while it is down,
   private requests go to a zero-retention provider after redaction, or are refused with
   `PRIVATE_FALLBACK=block`. Say which one you run; don't claim "nothing leaves our servers" unless you
   have the self-hosted tier on and `PRIVATE_FALLBACK=block`.
5. **Our own house.** Chats, titles and placeholder maps are encrypted in the database with a per-user
   key (AES-256-GCM). No prompts or answers in logs. Users get a transparency log (which provider got
   each request, which classifier read it, whether it was zero-retention, what was redacted) and a
   "delete everything" button. It deletes the account, chats and wrapped key from the live database,
   with SQLite's `secure_delete` on and the WAL truncated afterwards, so nothing readable is left in
   the live files. Deleting one conversation scrubs it the same way.
   *Limits:* **backups taken before the deletion still contain the wrapped key and the encrypted chats,
   and stay readable with the master key until they expire.** Expire or rotate backups on a schedule
   you can state. This protects copies of the database (disk, backups), not a compromised running
   server, which holds the master key so it can show users their chats. It is not end-to-end
   encryption. Deleting an account can't recall what providers already received under their own
   retention terms. After deletion Gode keeps one thing: a keyed one-way fingerprint (HMAC) of the
   email address in `bonus_claims`, so the same address can't claim the welcome credit twice.

**The privacy page** (`#/privacy` and the public `/privacy.html`) is built from what this server can
really do right now (`GET /api/public/providers`): "sensitive requests stay on our servers" only when a
self-hosted text model is available, else "only go to zero-retention models" (`zdr` fallback) or "are
not sent out" (`block`); Presidio is named only while it really checks what is sent; private media is
described as going to providers that may keep it, with generic words; the classifier is named with its
retention and region; and the delete card carries the backup caveat. The static page uses the most
conservative wording until the live facts load.

**What we log** (the `requests` table, one row per answer, failed and stopped ones included): time,
job, difficulty, private flag, tier, model, gateway, the upstream provider that got the prompt
(recorded as soon as the stream names it, so also for failed and stopped answers), effort,
zero-retention flag, pinned flag, classifier model, token counts, cost and price charged, latency,
status and error code, *counts* of redacted items by type (e.g. `{"EMAIL": 1}`), and 👍/👎 / regenerate
/ switch flags. The credit ledger records amounts. **What we don't log:** prompt text, answer text,
the redacted values, or request bodies in server logs. Chat text exists only encrypted in the
`messages` table, so users can see their history. Stripe, not Gode, handles card details.

**Watch out** (from the research): if every request goes through Gode, Gode becomes the target. Keep the
server patched, the master key secret, and access to the box and the database to as few people as
possible.

## Billing

- Credits are prepaid US dollars. A $10 pack buys $10 of credit; the margin is added when credit is
  spent: **charged = API cost × (1 + margin)**, default margin 30%, rounded up to the micro-dollar.
- **API cost** is what the providers report (OpenRouter reports the exact cost), or tokens × the
  catalog prices when they don't (with each model's cached-input and long-prompt rates), plus the
  classifier call. Media is priced per unit (image, second of video, song, 1,000 characters of
  speech...).
- **Holds.** Before a request runs, Gode estimates its maximum cost and puts exactly that much on hold,
  so two requests can't spend the same credit and no request starts that the balance can't pay for.
  When the balance can't cover a full-length text answer, the answer's maximum length is lowered to
  what the balance affords (refused below `MIN_AFFORDABLE_OUTPUT_TOKENS`, default 256). Hidden
  reasoning counts toward that length, so a reasoning model then thinks less (the chip shows the effort
  that ran), or the request is refused when even its lowest effort would leave too little for the
  answer; media must be
  affordable in full ("This costs about $0.26 and your balance is $0.10"). When the answer is done the
  hold is settled against the real charge, never more than the hold, so balances never go below zero
  (an overrun is absorbed by us and logged with ids only). The billing page shows credit still on hold
  as pending.
- **Stopping an answer.** If the user stops an answer after text has appeared, the partial answer is
  kept (marked Stopped) and charged for what was produced: the provider's reported usage, else the
  input sent plus the text streamed, at the model's prices, never more than the hold. A stop before any
  text, an upstream error and a server restart cost the user nothing (the upstream cost is still
  recorded for the gate numbers). An answer that finished upstream but couldn't be stored (the chat was
  deleted meanwhile) is charged: it was delivered and paid for upstream.
- **Stopping a picture, video or song.** Media providers bill a generation once it has started. A stop
  while the job is still queued is free (fal confirms it left the queue). A stop after it started is
  charged at its estimate (the hold) and kept as a Stopped answer that says why it was charged; a job
  that finished anyway is kept and charged like any other.
- **Stale holds.** At boot Gode releases every hold (one process, so none can belong to a running
  answer), then every 5 minutes releases holds older than `STALE_HOLD_MINUTES`, never one of an answer
  still running.
- **Signup bonus** (`SIGNUP_CREDIT_USD`, default $0.25): one per email address (`+tags` and Gmail dots
  don't make a new address, and it survives "delete everything"), at most `SIGNUP_BONUS_DAILY_CAP`
  (default 200) per UTC day across all accounts; accounts still open after the cap, without the bonus.
  Sign-ups are also limited to 10 per day per client network (an IPv6 /64 counts as one network; behind
  a proxy this needs `TRUST_PROXY`). Emails aren't verified in phase 1, so until there is verification
  or a CAPTCHA consider `SIGNUP_CREDIT_USD=0` in production: 200 × $0.25 is up to $50 a day of free
  spend, and the in-memory limiters reset on every restart.
- Every movement is in a ledger the user sees on the billing page; the balance always equals the sum
  of the ledger. A model whose catalog price is missing is billed as $0 (and logged once); the admin
  catalog flags enabled models without a price.
- **Admin adjustments.** The admin page's Users tab finds an account by email and adds or takes back
  credit (a Stripe refund, a goodwill credit). Each change is a ledger `admin_adjust` entry with the
  admin's id and note; the balance never goes below zero.
- Purchases go through Stripe Checkout. Credits are added when Stripe's signed webhook confirms payment,
  exactly once per checkout even if Stripe retries.
- Not in phase 1: sales tax/VAT handling (look at Stripe Tax before charging EU customers) and automatic
  refunds (refund in the Stripe Dashboard, then take the credit back on the Users tab).
- Not modelled yet: OpenAI's cache writes (billed at 1.25× input, so the first long turn on a GPT-6
  model is slightly underpriced) and hidden reasoning tokens in the estimate for a stopped answer (it is
  a lower bound).
- Whether credits cover API costs is one of the phase 1 gate numbers; `npm run learn` and the admin page
  show gross margin, whether charges (free credit included) cover the API cost, and whether purchases
  (cash, not free credit) do. Deleted accounts' API cost stays in these numbers (per-day totals without
  any link to the account), just as their purchases stay in the ledger.

## Security notes

- **Admins.** With `ADMIN_EMAILS` set, only those addresses can be admins, re-checked on every request,
  so removing one revokes admin at once. Emails are not verified, so anyone could register a listed
  address before you do: in production a listed account becomes an admin only after you confirm it with
  `node scripts/make-admin.js you@example.com` on the server, and every signup of a listed address is
  logged (account id only). Register it yourself right after deploying, then confirm it; if the log
  shows a signup you didn't make, delete that account. (`ADMIN_EMAILS_AUTO_GRANT=1` restores admin at
  signup; it is the default outside production.) Without `ADMIN_EMAILS`, production has no automatic
  admin: sign up, then run `node scripts/make-admin.js you@example.com` (`--revoke` takes admin away).
- **Locked out?** `node scripts/reset-password.js user@example.com` sets a new random password, prints
  it once on your terminal and signs the account out everywhere. Users change their own password in
  Settings, which signs out their other devices.
- **HTTPS only in production.** The session cookie is `__Host-gode_session` (`Secure`, `HttpOnly`,
  `SameSite=Lax`, `Path=/`, no `Domain`, so a sibling subdomain can't plant one); set `PUBLIC_URL` to
  the `https://` address. The old `gode_session` name is still read for one release, only for sessions
  that were issued under it (recorded with each session, so a restart changes nothing), and moved to
  the new name once; a session issued as `__Host-gode_session` is never accepted under the old name.
- **Passwords**: at least 8 characters, not only spaces, not one repeated character, not a common
  password, not the account's email. Hashed with scrypt (N=2^15, r=8, p=3) on the thread pool, a few at
  a time, so logins can't stall the server; older hashes are upgraded at the next login. Session tokens
  are random and stored only as hashes.
- State-changing API calls must come from the same origin. Rate limits: sign-up and log-in 20 per
  15 minutes per client network; **failed** log-ins 10 per 15 minutes per email and network. Past 100
  failures per hour for one email from anywhere, each network group (an IPv4 /24 or IPv6 /48) that
  failed waits for the hour to end, but a group with no failures is still checked, so the owner's right
  password from their own network works while a stranger spreading guesses over many networks gets one
  guess per group per hour. Only failures from more than 1000 groups in an hour (a botnet) block every
  log-in for that email until the hour ends. New accounts 10 per day per network; chat 30 a minute per user; password checks (delete everything, password change) and
  Stripe checkouts 10 per 15 minutes per user. Behind a reverse proxy set `TRUST_PROXY` so the limits see
  real client addresses.
- Sign-up still answers "An account with this email already exists" for a taken address. Without email
  verification that can't be hidden (sign-up signs you in); the per-network daily limit, which counts
  these answers too, bounds how many addresses one client can check.
- Pages are served with a strict content security policy (scripts only from Gode itself: no eval, no
  inline scripts; with the media proxy on, images and media only from Gode too) and can't be framed.
  The page is plain JavaScript on React, with no build step.
- Stripe webhooks are verified (HMAC signature on the raw body, 5-minute tolerance) and processed
  once.
- Keep Presidio on localhost or a private network: prompts are personal data.
- Never commit `.env`. If a key leaks, revoke it at the provider and replace it.
- Don't add logging that records request bodies; the privacy promise depends on it.

## Deploying

Gode is one Node process with a SQLite database file. That makes hosting simple, with two rules:

1. **One instance only.** The database file, the rate limiters, the one-answer-per-conversation lock,
   the list of running answers' credit holds and the key cache live in that one process. Don't scale to
   several instances; give the one instance more CPU/RAM instead.
2. **Persistent disk.** Put `DATA_DIR` on a disk that survives deploys and restarts. Without one, every
   deploy wipes all accounts, chats and credit balances.

**Render.** New Web Service from the repo, runtime Node, build `npm ci`, start `npm start`. Add a Disk
(for example mounted at `/var/data`) and set `DATA_DIR=/var/data`, `NODE_ENV=production`,
`PUBLIC_URL`, `GODE_MASTER_KEY`, `ADMIN_EMAILS` and your keys, plus `LEARN_SCHEDULE=weekly` (a Render
cron job can't read the web service's disk). A service with a disk restarts briefly on each deploy.
For Presidio, add a Private Service from the image in `presidio/docker-compose.yml`
(`ghcr.io/data-privacy-stack/presidio-analyzer`, port 3000, about 1.5 GB RAM) and set
`PRESIDIO_ANALYZER_URL` to its internal address (for example `http://gode-presidio:3000`).

**Railway.** Deploy the repo, add a Volume (for example at `/data`), set `DATA_DIR=/data`, the same
variables and `LEARN_SCHEDULE=weekly`. Keep the service at one replica. For Presidio, deploy the same
image as a second service without a public domain and reach it over Railway's private network
(`PRESIDIO_ANALYZER_URL=http://<service>.railway.internal:3000`).

**A VPS** (any small Linux server). Install Node 22, run `npm ci` and `npm start` under systemd, put
Caddy or nginx in front for HTTPS (Gode trusts the proxy's headers in production), run Presidio with
the Docker command above, and add the learner's dry run to cron (or set `LEARN_SCHEDULE=weekly`). If
Gode itself runs in Docker, put it and Presidio on a shared private network instead of publishing
Presidio's port.

**Behind an outbound proxy.** Node's built-in `fetch`, which Gode uses for every provider call,
ignores `HTTPS_PROXY` unless `NODE_USE_ENV_PROXY=1` is set (Node 22.21 or newer). Node reads it at
startup, so set it in the real environment (systemd `Environment=`, your host's settings), not in
`.env`. Node then prints one `EnvHttpProxyAgent is experimental` warning at the first request; it is
harmless.

**Backups.** The database runs in WAL mode (with `synchronous=FULL`, `secure_delete` on and a 5-second
busy timeout), so copy it safely: `sqlite3 data/gode.db ".backup backup.db"` while running, or stop Gode
and copy `gode.db` together with `gode.db-wal`. Back up `GODE_MASTER_KEY` separately. A backup without
the key is unreadable; the key without the backup is useless; together they are everything, so store
them apart. A user's "delete everything" can't reach backups made before it: they keep that user's
encrypted data, readable with the master key, until they expire. Keep backups for a fixed, short period
and say so in your privacy policy.

**Health check:** `GET /api/public/providers` needs no login and returns quickly.

## Not in phase 1, and the gates

Not built yet, on purpose:

- **Gode actions** (calendar, Outlook, LinkedIn, X, Slack, then Gmail) and the **approval card** before
  anything is sent, posted or deleted: phase 2.
- **Gmail**: needs Google's annual third-party security assessment (CASA). It takes weeks, so file for
  Google verification at the *start* of phase 2.
- **WhatsApp** (its business API bans general-purpose assistants), **SMS/iMessage** (no one can send as
  the user from a server).
- **Native apps**: Android default assistant, iPhone App Intents, desktop apps: phase 3, on the same
  backend.
- **Self-hosted GPUs** are optional in phase 1: the private tier is wired up and works as soon as you
  point `SELFHOSTED_BASE_URL` at a server; until then private requests use zero-retention providers.

The roadmap's gates, checked before spending on the next phase:

- **Gate 1 → phase 2:** people keep auto-pick on, and credits cover API costs. `npm run learn` and the
  admin overview show both: the share of active users who never picked a model by hand in the window
  ("kept auto-pick"; the current-setting snapshot is shown too, but it misses everyone who turned
  auto-pick off and then left), the switch rate, gross margin, API cost including failed and stopped
  requests, and whether **purchases** cover the API cost (free credit is reported separately, so a
  signup bonus doesn't make the numbers look better than they are).
- **Gate 2 → phase 3:** beta users rely on Gode weekly, and the Gmail audit has passed.

## Development

```sh
npm test                          # all tests (node:test), offline
node --test test/bench.test.js    # one file
npm run e2e                       # browser smoke test (needs Playwright, see below)
```

`test/integration.test.js` runs whole flows through the HTTP API with the real pipeline, both in mock
mode and with the real OpenRouter, OpenAI and fal adapters talking to a local emulator
(`test/helpers/mock-upstream.js`). `test/integration-wires.test.js` checks the contracts between the
modules end to end: the media proxy live and after a reload, the upstream provider of failed and stopped
answers, sticky privacy after a failed turn, admin credit adjustments and catalog rules, and Presidio
outages in both fail modes.

**Browser smoke test.** `npm run e2e` starts the real server (`node server.js`, mock mode, a fresh
temporary database) and drives it in Chromium through sign-up, streaming chat, the switch menu,
regenerate, 👍, an image, Stop, a failed answer and its retry, settings (password change, transparency
log), billing, the admin overview, routing grid, learner, users and catalog, the privacy pages and
"delete everything", at 1280×820 and 375×812. It fails on any
console error or unexpected server log line. Playwright is **not** a dependency of Gode; install it
once with `npm i -g playwright && npx playwright install chromium` (or point `NODE_PATH` at an existing
install). Screenshots go to `e2e/shots/` (git-ignored), or to `E2E_SHOTS=<dir>`.

Layout:

```
server.js            start-up: config -> database -> seed -> app
src/config.js        every environment variable (see .env.example)
src/db.js            SQLite schema (node:sqlite, no native build)
src/seed/catalog.js  seed models and routing table
src/redact/          personal-data detection, placeholders, response filter
src/providers/       OpenRouter, OpenAI, self-hosted, fal, mock
src/router/          classify, pick, effort, learn, schedule (weekly learner)
src/media.js         media proxy URLs
src/billing/         credits ledger and Stripe
src/chat/pipeline.js one request end to end
src/routes/, app.js  HTTP API
public/              the web page (React without a build step)
presidio/            optional Presidio sidecar
bench/               benchmark vs openrouter/auto
scripts/             seed, learn, export-bench-prompts, make-admin, reset-password
docs/ARCHITECTURE.md module contracts
test/                unit, API and integration tests; helpers/ (test app, upstream emulator)
e2e/smoke.js         browser smoke test against the real server
```

Only two npm dependencies (`express`, `dotenv`); everything else is Node built-ins.

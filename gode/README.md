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

Open http://localhost:3000 and sign up. **The first account becomes the admin.** `npm run dev` runs
in *mock mode*: answers, pictures and sounds are fake (no AI is called, nothing costs money), but
everything else is real: routing, redaction, the chip, credits, the admin page. An "add test credit"
button appears on the billing page so you can play with credits.

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
Luna on direct OpenAI when only an OpenAI key is set; pick another catalog model with
`CLASSIFIER_MODEL_ID`. If its call fails or takes over 4 s, the built-in keyword classifier answers.

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
Python version. If Presidio goes down, Gode logs one warning and keeps redacting with the built-in
recognizers; it never sends a prompt unredacted because Presidio is unavailable.

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
the signup bonus (`SIGNUP_CREDIT_USD`, default $0.25) are all settings. Buying credits needs both
`STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET`; without them the billing page shows the packs as
unavailable.

### 5. The rest of production

```sh
NODE_ENV=production
PUBLIC_URL=https://gode.example.com     # the real address, https; Stripe redirects back here
DATA_DIR=/var/data                      # a PERSISTENT disk (see Deploying)
ADMIN_EMAILS=you@example.com            # optional: extra admins
```

`NODE_ENV=production` turns on secure cookies, HSTS and proxy headers, turns off the free test-credit
button, and makes the master key mandatory.

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

**Private requests.** A request counts as private when the classifier says so (health, money, legal,
passwords...), when redaction finds a high-risk value (card, IBAN, SSN, bank account, passport,
secret), or when it matches built-in keywords. Once a conversation is private it stays private. Private
text goes to the **private tier**: your self-hosted model if `SELFHOSTED_BASE_URL` is set, so nothing
leaves your servers. Without one, `PRIVATE_FALLBACK=zdr` (the default) sends it, still redacted, to a
zero-data-retention model with OpenRouter forced onto zero-retention endpoints; `PRIVATE_FALLBACK=block`
refuses instead. No media provider offers zero retention, so private media prompts go to the media
private cell (the budget pick) with personal details replaced by generic words ("a person").

**Strict privacy** (a user setting) allows only zero-retention or self-hosted models for everything.
Because no media model qualifies, strict-privacy users can't make pictures, video, music or voice.

**EU-only** (a user setting) limits text jobs to models hosted in the EU (Mistral) or on your own
servers. It doesn't apply to media. The Mistral models are pinned to Mistral's own EU endpoint on
OpenRouter with no fallback. That pins the model host; for OpenRouter's own processing to stay in the
EU too, OpenRouter offers in-region routing (`eu.openrouter.ai`) on Business and Enterprise plans.

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

## The weekly learner

```sh
npm run learn                     # print gate metrics + proposed changes (writes nothing)
node scripts/learn.js --apply     # also write them to the routing table
node scripts/learn.js --days 14 --min-samples 30
```

For each job and model it computes a satisfaction score from the last 28 days:
`(👍 + 1) / (👍 + 👎 + regenerates + switches + 2)`. Then it proposes: **quality** = best score (ties
go to the cheaper model); **balanced** = best score minus a cost penalty; **budget** = the cheapest
model scoring within 0.02 of the current budget pick. A model needs `--min-samples` requests (default
20) before it counts. The private column is never touched. Applied changes are logged in
`route_history` and can be changed back on the admin page.

Run it weekly. Example crontab line (Mondays at 04:17, server time):

```cron
17 4 * * 1  cd /srv/gode && /usr/bin/node scripts/learn.js --apply >> data/learn.log 2>&1
```

If you'd rather review first, run it without `--apply` from cron and use the Apply button on the admin
page.

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
prompt id, so roughly half each way and the same every rerun. Media prompts are classified and then
skipped, because `openrouter/auto` only does text.

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

**Real prompts.** `bench/prompts.jsonl` holds 200 realistic prompts we wrote (about 110 chat, 60 code,
30 media and action). The checklist asks for *real* prompts. Once users have opted in ("share prompts"
in Settings):

```sh
npm run export-bench-prompts             # writes bench/prompts.real.jsonl
node bench/run.js --prompts bench/prompts.real.jsonl
```

The export takes only users with sharing on, only their current messages, never prompts the router
flagged as private, replaces personal details with placeholders, and writes no user ids, emails or
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
   that aren't the user's own, are masked.
   The classifier is a model provider too: it receives every message (redacted) plus the last few;
   the default classifier runs on zero-retention endpoints.
   *Limits:* detection is pattern- and model-based, so it misses things: unusual formats, names with no
   context when Presidio isn't running, street addresses, and personal facts described in words ("my
   sister's divorce", "my diagnosis"). Treat redaction as a strong filter, not a guarantee.
2. **Pool identity.** Every call goes out from our server under Gode's own API accounts. Providers never
   get a user id, email or IP address. The only per-conversation value sent (to OpenRouter and OpenAI,
   to keep their prompt caches warm) is an opaque hash of the conversation id that means nothing without
   our database.
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
   own GPUs and nothing leaves your servers. Without it (the phase 1 default), private requests go to a
   zero-retention provider after redaction, or are refused with `PRIVATE_FALLBACK=block`. Say which one
   you run; don't claim "nothing leaves our servers" unless you have the self-hosted tier on.
5. **Our own house.** Chats, titles and placeholder maps are encrypted in the database with a per-user
   key (AES-256-GCM). No prompts or answers in logs. Users get a transparency log (which provider got
   each request, whether it was zero-retention, what was redacted) and a "delete everything" button,
   which deletes their account, chats and key, so leftover encrypted copies in backups become
   unreadable.
   *Limits:* this protects copies of the database (disk, backups), not a compromised running server,
   which holds the master key so it can show users their chats. It is not end-to-end encryption.
   Deleting an account can't recall what providers already received under their own retention terms.

**What we log** (the `requests` table, one row per answer): time, job, difficulty, private flag, tier,
model, gateway, the upstream provider OpenRouter chose, effort, zero-retention flag, pinned flag,
classifier model, token counts, cost and price charged, latency, status and error code, *counts* of
redacted items by type (e.g. `{"EMAIL": 1}`), and 👍/👎 / regenerate / switch flags. The credit ledger
records amounts. **What we don't log:** prompt text, answer text, the redacted values, or request bodies
in server logs. Chat text exists only encrypted in the `messages` table, so users can see their history.
Stripe, not Gode, handles card details.

**Watch out** (from the research): if every request goes through Gode, Gode becomes the target. Keep the
server patched, the master key secret, and access to the box and the database to as few people as
possible.

## Billing

- Credits are prepaid US dollars. A $10 pack buys $10 of credit; the margin is added when credit is
  spent: **charged = API cost × (1 + margin)**, default margin 30%, rounded up to the micro-dollar.
- **API cost** is what the providers report (OpenRouter reports the exact cost), or tokens × the
  catalog prices when they don't, plus the classifier call. Media is priced per unit (image, second of
  video, song, 1,000 characters of speech...).
- **Holds.** Before a request runs, Gode estimates its maximum cost and puts that much (or the whole
  balance, if smaller) on hold, so two requests can't spend the same credit. When the answer is done the
  hold is settled against the real charge; on an error it is released in full. If the user stops an
  answer midway, the hold is released too; Gode only charges for tokens already produced when the
  provider has reported them (real gateways report usage at the end of the stream, so a stopped answer
  is normally free). A balance can
  dip a few cents below zero when an answer costs more than its hold; the next request then asks the
  user to top up.
- New accounts get a **signup bonus** (`SIGNUP_CREDIT_USD`, default $0.25).
- Every movement is in a ledger the user sees on the billing page; the balance always equals the sum
  of the ledger. A model whose catalog price is missing is billed as $0 (and logged once); the admin
  catalog flags enabled models without a price.
- Purchases go through Stripe Checkout. Credits are added when Stripe's signed webhook confirms payment,
  exactly once per checkout even if Stripe retries.
- Not in phase 1: sales tax/VAT handling (look at Stripe Tax before charging EU customers) and automatic
  refunds (refund in the Stripe Dashboard; credits aren't taken back automatically).
- Whether credits cover API costs is one of the phase 1 gate numbers; `npm run learn` and the admin page
  show gross margin.

## Security notes

- **Create your account first.** The first account to sign up becomes the admin. Sign up yourself
  immediately after the first deploy, before sharing the address. `ADMIN_EMAILS` adds more admins.
- **HTTPS only in production.** Session cookies are `Secure`, `HttpOnly` and `SameSite=Lax`; set
  `PUBLIC_URL` to the `https://` address.
- Passwords are hashed with scrypt; session tokens are random and stored only as hashes.
- State-changing API calls must come from the same origin. Signup and login are rate-limited per IP
  and per email, chat requests per user (30 a minute), and the "delete everything" password check per
  user.
- Pages are served with a strict content security policy (scripts only from Gode itself: no eval, no
  inline scripts) and can't be framed. The page is plain JavaScript on React, with no build step.
- Stripe webhooks are verified (HMAC signature on the raw body, 5-minute tolerance) and processed
  once.
- Keep Presidio on localhost or a private network: prompts are personal data.
- Never commit `.env`. If a key leaks, revoke it at the provider and replace it.
- Don't add logging that records request bodies; the privacy promise depends on it.

## Deploying

Gode is one Node process with a SQLite database file. That makes hosting simple, with two rules:

1. **One instance only.** The database file, the login rate limiter and the key cache live in that one
   process. Don't scale to several instances; give the one instance more CPU/RAM instead.
2. **Persistent disk.** Put `DATA_DIR` on a disk that survives deploys and restarts. Without one, every
   deploy wipes all accounts, chats and credit balances.

**Render.** New Web Service from the repo, runtime Node, build `npm ci`, start `npm start`. Add a Disk
(for example mounted at `/var/data`) and set `DATA_DIR=/var/data`, `NODE_ENV=production`,
`PUBLIC_URL`, `GODE_MASTER_KEY` and your keys. A service with a disk restarts briefly on each deploy.

**Railway.** Deploy the repo, add a Volume (for example at `/data`), set `DATA_DIR=/data` and the same
variables. Keep the service at one replica.

**A VPS** (any small Linux server). Install Node 22, run `npm ci` and `npm start` under systemd, put
Caddy or nginx in front for HTTPS (Gode trusts the proxy's headers in production), run Presidio with the
Docker command above, and add the learner to cron. If Gode itself runs in Docker, put it and Presidio
on a shared private network instead of publishing Presidio's port.

**Behind an outbound proxy.** Node's built-in `fetch`, which Gode uses for every provider call,
ignores `HTTPS_PROXY` unless `NODE_USE_ENV_PROXY=1` is set (Node 22.21 or newer). Node reads it at
startup, so set it in the real environment (systemd `Environment=`, your host's settings), not in
`.env`. Node then prints one `EnvHttpProxyAgent is experimental` warning at the first request; it is
harmless.

**Backups.** The database runs in WAL mode, so copy it safely: `sqlite3 data/gode.db ".backup
backup.db"` while running, or stop Gode and copy `gode.db` together with `gode.db-wal`. Back up
`GODE_MASTER_KEY` separately. A backup without the key is unreadable; the key without the backup is
useless; together they are everything, so store them apart.

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
  admin stats page show both: the share of active users with auto-pick on, the switch rate, gross
  margin, and whether charges exceed API costs.
- **Gate 2 → phase 3:** beta users rely on Gode weekly, and the Gmail audit has passed.

## Development

```sh
npm test                          # all tests (node:test), offline
node --test test/bench.test.js    # one file
npm run e2e                       # browser smoke test (needs Playwright, see below)
```

`test/integration.test.js` runs whole flows through the HTTP API with the real pipeline, both in mock
mode and with the real OpenRouter, OpenAI and fal adapters talking to a local emulator
(`test/helpers/mock-upstream.js`).

**Browser smoke test.** `npm run e2e` starts the real server (`node server.js`, mock mode, a fresh
temporary database) and drives it in Chromium through sign-up, streaming chat, the switch menu,
regenerate, 👍, an image, settings and the transparency log, billing, the admin routing grid, learner
and catalog, the privacy pages and "delete everything", at 1280×820 and 375×812. It fails on any
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
src/router/          classify, pick, effort, learn
src/billing/         credits ledger and Stripe
src/chat/pipeline.js one request end to end
src/routes/, app.js  HTTP API
public/              the web page (React without a build step)
presidio/            optional Presidio sidecar
bench/               benchmark vs openrouter/auto
scripts/             seed, learn, export-bench-prompts
docs/ARCHITECTURE.md module contracts
test/                unit, API and integration tests; helpers/ (test app, upstream emulator)
e2e/smoke.js         browser smoke test against the real server
```

Only two npm dependencies (`express`, `dotenv`); everything else is Node built-ins.

# Gode phase 1 — architecture and module contracts

This is the build contract for Gode phase 1 (the website router from the research doc). Every module
below has a fixed file path, exports and behaviour. Code against these signatures exactly; if one
is wrong, fix this document in the same change.

Stack: Node ≥ 22.5, CommonJS, Express 4, `node:sqlite` (built-in), React 18 UMD (vendored in
`public/vendor/`, no CDN, no build step). The frontend is plain browser JavaScript on
`React.createElement`: no JSX, no Babel, and the CSP allows scripts from `'self'` only. The only npm
dependencies are `express` and `dotenv`. Tests use `node:test` + `node:assert/strict` and global `fetch`.

```
gode/
  server.js                 boot: loadConfig -> openDb -> seed -> createApp -> listen
  src/config.js             loadConfig(env) -> frozen config            (DONE)
  src/util.js               newId, now, usdToMicros, microsToUsd, AppError, ah, safeJsonParse, sleep, estimateTokens (DONE)
  src/crypto.js             hashPassword, verifyPassword, randomToken, sha256, loadMasterKey, createKeyring (DONE)
  src/db.js                 openDb(file) -> db with db.tx(fn)          (DONE; schema lives here)
  src/seed/catalog.js       MODELS, ROUTES, CLASSIFIER_MODEL_ID, seedCatalog(db, {force})
  src/redact/patterns.js    built-in regex recognizers
  src/redact/presidio.js    Presidio analyzer REST client
  src/redact/index.js       createRedactor(config) -> redactor
  src/providers/*.js        gateway adapters (openrouter, openai, selfhosted, fal, mock) + registry
  src/router/effort.js      difficultyToEffort, TIER_BY_PLAN, chooseTier
  src/router/classify.js    createClassifier(...) -> classify(...)
  src/router/pick.js        createPicker(...) -> pick(...), candidates(...)
  src/router/learn.js       computeStats, computeCellStats, proposeRoutes, applyProposals, gateMetrics, learn runs
  src/router/schedule.js    startLearnScheduler({ db, config, logger }) -> { stop, tick }  (LEARN_SCHEDULE=weekly)
  src/media.js              publicMediaUrl(config, messageId, index, url), isProxyableUrl(url, hosts)
  src/billing/credits.js    createCredits(db, config, { logger })
  src/billing/stripe.js     createStripe(config, credits, db)
  src/auth.js               createAuth({ db, config, keyring, credits }) + middleware
  src/chat/pipeline.js      createPipeline(deps) -> run(...)
  src/routes/*.js           express routers
  src/app.js                createApp(deps) -> express app
  public/                   index.html, app.js (plain JS), styles.css, privacy.html, vendor/ (React UMD)
  presidio/                 docker-compose.yml + python shim server
  bench/                    run.js, judge.js, stats.js, prompts.jsonl (200), README section
  scripts/                  learn.js, export-bench-prompts.js, seed.js, make-admin.js, reset-password.js
  test/                     *.test.js, helpers/ (test app, upstream emulator)
  e2e/smoke.js              browser smoke test against the real server (npm run e2e, needs Playwright)
```

## Core vocabulary

- **job**: `chat | code | image | video | music | voice | action`. `action` (Gode doing things in
  other apps) is phase 2; in phase 1 it is answered by the chat route with a short note.
- **TEXT_JOBS** = `chat, code, action`; **MEDIA_JOBS** = `image, video, music, voice`.
- **tier**: `quality | balanced | budget | private`.
- **plan** (user setting): `saver | balanced | best`.
- **effort**: `none | low | medium | high`.
- **difficulty**: integer 1–5.
- Money: integer micro-USD (`*_micros`). `usdToMicros` / `microsToUsd` in `src/util.js`.
- Errors: throw `new AppError(status, code, message)`. Codes used across modules:
  `unauthorized`, `forbidden`, `not_found`, `bad_request`, `rate_limited`, `insufficient_credits`,
  `no_model`, `private_blocked`, `upstream_error`, `gateway_not_configured`, `conflict`,
  `redaction_unavailable` (503: Presidio required and down), `busy` (409: a turn is already running in
  this conversation). The pipeline's own end states: `aborted` (the user's Stop) and `interrupted`
  (server shutdown).

## Database (src/db.js)

See the schema in `src/db.js` (tables: users, sessions, models, routes, route_history,
conversations, messages, requests, ledger, holds, stripe_events; migration 2 adds
`conversations.private`, `bonus_claims (email_hmac, created_at)` and `learn_runs (source, days,
proposals JSON, applied, created_at)`; migration 3 adds `sessions.cookie` ('host' | 'plain' | NULL for
sessions made before it: the cookie name a session was issued under), `requests.context_included`
(1: a media prompt that quoted earlier messages) and `usage_archive` (per-UTC-day request counts and
amounts of deleted accounts, for the gate metrics)). Use `db.prepare(sql).get/all/run` and `db.tx(() => {...})`
(synchronous callback only). JSON columns are TEXT; parse with `safeJsonParse`. Booleans are 0/1
integers. `conversations.private` is sticky: set when any turn was private, never cleared.
`requests.status` is `ok | error | stopped` (no CHECK constraint).

`openDb` sets on every connection: `busy_timeout = 5000` (node:sqlite is synchronous, so a long
external lock such as `seed --force` or a manual sqlite session can block the event loop that long),
`secure_delete = ON`, and for file databases WAL with `synchronous = FULL`. One process per database:
in-memory state (rate limiters, the per-conversation lock, live credit holds) relies on it.

Model row shape used everywhere in JS (`models` row with JSON parsed):
```js
{ id, label, vendor, region, gateway, slug, jobs: string[], price_in, price_out, price_unit,
  price_per_unit, zdr: bool, retention_note, open_weights: bool, self_hosted: bool,
  supports_reasoning: bool, context_length, params: object, enabled: bool }
```
`src/seed/catalog.js` exports `rowToModel(row)` to convert a DB row into this shape — all modules
use it.

## Seed catalog — src/seed/catalog.js

```js
MODELS: ModelSeed[]          // same shape as above (jobs/params as JS values)
ROUTES: { job, tier, model_id, effort_override?: string|null }[]  // every job x tier filled
CLASSIFIER_MODEL_ID: string  // default classifier model id (cheap, fast, JSON-capable)
CLASSIFIER_MODEL_CANDIDATES: string[]  // ordered fallbacks (e.g. OpenRouter DeepSeek Flash, then
                                       // direct-OpenAI GPT-6 Luna); classifier uses the first available
seedCatalog(db, { force = false } = {})  // inserts models/routes if the models table is empty
                                          // (force: upsert models, overwrite routes with source='seed')
rowToModel(row) -> Model
exportCatalog(db) -> { models: Model[], routes: Route[] }      // for admin export
importCatalog(db, { models, routes }, { source = 'admin', openaiZdrApproved = false })
                                                                // upsert, writes route_history
repairCatalog(db, { openaiZdrApproved }) -> string[]   // at boot: clears privacy flags the gateway
                                                       // can't enforce on existing rows; returns ids
// Also exported: JOBS, TEXT_JOBS, MEDIA_JOBS, TIERS, modelToParams,
// validateModel(m, { openaiZdrApproved = false }) -> string[]  (ids, gateway, jobs, params, and the
//   gateway rules: self_hosted and region 'self' only on the selfhosted gateway; never zdr on fal;
//   zdr on openai only with openaiZdrApproved = config.gateways.openai.zdrApproved),
// validateParams(params) -> string[]  (catalog-only keys: openrouter_provider via providerPreferences,
//                                      max_chars positive integer, prompt_field name, reasoning shape,
//                                      pricing, duration_options),
// onOwnServers(model) -> bool   // model.gateway === 'selfhosted'. THE test for "runs on our servers":
//                               // the pipeline (unredacted text), picker, classifier and admin rules use
//                               // it, never the editable self_hosted flag
// privateSafe(model) -> bool    // model.zdr || onOwnServers(model)
// textRates(model, inputTokens) -> { in, out, cachedIn }  // USD per 1M tokens, params.pricing applied
// durationFor(model, seconds) -> value|null  // snaps a duration onto params.duration_options (ties ->
//                                            // the cheaper one), in the default's format ("8s" or 8)
// upsertModel(db, m), setRoute(db, route, {source, reason}),
// getModel(db, id) -> Model|null, listModels(db, {enabledOnly}) -> Model[], getRoutes(db) -> Route[]
// setRoute and importCatalog throw AppError(400, 'bad_request') for bad input.
```
Model ids are `"<gateway>:<slug>"`. Every job needs quality/balanced/budget picks plus a `private`
pick. The private pick for text jobs is a self-hosted open-weight model
(`selfhosted:<slug>`, `self_hosted: true, zdr: true, region: 'self'`); for media jobs it is the
best ZDR-flagged media model, or the budget pick if none is ZDR. The seeds only fill an empty
database: changed seed data reaches an existing one via `npm run seed -- --force` or admin edits. Include alternates (not routed by
default) so the switch menu and the learner have candidates. Include direct-OpenAI models
(`openai:` gateway) for chat/code/image so a deployment with only an OpenAI key works.

`params` holds upstream request inputs (media: merged into every call, e.g. `{ size, quality }`)
plus these catalog-only keys, which adapters read and never send as body fields:

| key | used by | meaning |
| --- | --- | --- |
| `reasoning` | effort-map | `{ mandatory, efforts }`, see "Reasoning effort mapping" |
| `prompt_field` | fal | name of the text input when it isn't `prompt` (ElevenLabs/Qwen TTS: `text`) |
| `max_chars` | fal | longest text a TTS model accepts: Qwen Audio 3 TTS 2000, ElevenLabs v4 / v4 Turbo 5000, ElevenLabs v3 3000 and MiniMax Speech 2.8 HD 5000 (no documented limit found for these two, so safe caps) |
| `openrouter_provider` | openrouter | merged into the request's `provider` routing object (see Providers) |
| `pricing` | pipeline, credits, classifier | text models without a provider-reported cost (direct OpenAI): `{ cached_in, long_context: { above_input_tokens, in_mult, out_mult } }`. Cached input tokens are priced at `cached_in`; prompts above the threshold at `price_in × in_mult` (cached too) and `price_out × out_mult`. Seeded on GPT-6 Astra, Terra and Luna. Cache writes (1.25×) are not modelled. |
| `duration_options` | pipeline | media models with a `duration` input: the accepted values, a list (`["4s","6s","8s"]`, `[6, 8, 10]`) or `{ min, max }` whole seconds. The classifier's `duration_s` is snapped onto it (`durationFor`) and sent as `params.duration`; the pipeline strips this key (and `pricing`) before the adapter call, and fal strips both too. |

Text models never have their `params` spread into the request body. The three direct-OpenAI image
models set `output_format: 'webp', output_compression: 85` so the stored data URLs are a fraction
of the default PNG's size (gpt-image bills by output tokens, so the format does not change the price).

EU pinning: region `'eu'` must hold for every host the gateway can pick. The two Mistral models
(Mistral Large 4, Ministral 3 3B) carry `openrouter_provider: { only: ["mistral"], allow_fallbacks: false }`,
which keeps every request, not only ZDR ones, on Mistral's own EU endpoint (also their ZDR endpoint).
The pin covers the model host only. For OpenRouter's own processing to stay in the EU too, OpenRouter
offers in-region routing on Business and Enterprise plans: requests sent to `https://eu.openrouter.ai`
are processed entirely in the EU (point `OPENROUTER_BASE_URL` there; check OpenRouter's in-region
routing guide for the exact path).

Dated maintenance: fal retires the Wan 2.2 family on **2027-01-04**. The video `budget` and
`private` cells route to `fal:fal-ai/wan/v2.2-5b/text-to-video/fast-wan` and must be re-routed
before then (comment at that ROUTES entry; not re-routed yet).

## Redaction — src/redact/

`createRedactor(config, opts?) -> redactor`, where config is the full app config (uses `config.privacy`)
and `opts` = `{ fetch, logger, presidioRetryMs, presidioTimeoutMs, presidioRemindMs }` (test seams).

```js
redactor.analyze(text) -> Promise<Entity[]>
  // Entity: { type, start, end, score, value }; type is a SHORT label (see below).
  // Built-in recognizers always run; Presidio results are merged in when config.privacy.presidioUrl
  // is set. Presidio unreachable (a circuit breaker skips it for 10 s in mode closed, 30 s in open):
  //   presidioFailMode 'closed' (default, also for hand-built configs) -> reject with
  //     AppError(503, 'redaction_unavailable', 'The privacy filter is unavailable right now, so
  //     nothing was sent. Try again in a minute.')
  //   'open' -> continue with the built-ins only.
  // The outage is logged when it starts, every 5 min while it lasts and when it ends (counts only).

redactor.redactMessages(messages, map, { mode = 'placeholder' } = {})
  -> Promise<{ messages, map, counts }>
  // messages: [{ role, content: string }] — returns new array, content redacted.
  // map: placeholder map (see below) or null for a new one. Returned map is the updated map;
  //      the same real value always gets the same placeholder within a conversation.
  // counts: { [type]: number } of entities replaced in THIS call's messages (all messages).
  // mode 'placeholder': "Email [EMAIL_1] about it" (text jobs, reversible)
  // mode 'generic': "a person", "an email address", ... (media prompts: image/video/music/voice
  //                 models can't round-trip placeholders)

redactor.restore(text, map) -> string        // placeholders -> real values (tolerates case changes,
                                             // and a missing bracket pair: "PERSON_1"). Placeholders
  // inside a URL (a bare http(s)/mailto/www run, a markdown link target up to its matching ')', an
  // <autolink>) are NOT restored, so injected instructions can't put a real value into a link.
redactor.createStreamRestorer(map, { maskHighRisk = false, ownMap = map } = {})
  -> { push(chunk) -> string, flush() -> string, masked?() -> { [type]: n } }
  // Streaming-safe restore: never emits a partial placeholder; holds back the shortest possible tail.
  // Concatenated output equals restore(fullText, map) whatever the chunking. maskHighRisk: also mask
  // high-risk values that are not the user's own (ownMap) before any part of them is emitted (holds
  // the trailing word and runs of short digit groups, at most 64 chars, including a first group glued
  // to punctuation such as "IBAN:GB82"; words over 4 KB pass 2 KB at a time). A multi-line key block,
  // a single token over 4 KB, or a value the detectors only recognise from context that comes after
  // it passes through: the final filterResponse (a `replace` event) stays the safety net.
redactor.genericizePlaceholders(text) -> string  // [PERSON_1] -> "a person", a second distinct one
                                                 // -> "another person" (GENERIC_PHRASES); also a
                                                 // module export
redactor.filterResponse(text, map) -> { text, masked: { [type]: n } }
  // Masks HIGH-RISK entities (CARD, IBAN, SSN, BANK_ACCOUNT, PASSPORT, SECRET) that appear in model
  // output but are NOT one of the user's own values in `map`. Replaced with "[redacted CARD]".
redactor.isSensitive(counts) -> boolean     // true if counts include any HIGH-RISK type, used as a
                                             // privacy signal by the router
redactor.presidioEnabled -> boolean          // a Presidio URL is configured (not whether it is up)
redactor.presidioHealth() -> Promise<boolean> // live GET /health; false when none is configured; a
                                             // healthy answer during an outage lets the next prompt
                                             // try Presidio at once (server.js probes every 20 s)
redactor.presidioStatus() -> { enabled, state: 'off'|'unknown'|'up'|'down', failMode: 'closed'|'open',
                               downSince: ms|null }   // no network call
```

Placeholder map (stored encrypted per conversation, JSON-serialisable):
```js
{ v: 1, byValue: { "<type>\u0000<normalized value>": "[PERSON_1]" },
  byPlaceholder: { "[PERSON_1]": "Ada Lovelace" }, counters: { PERSON: 1 } }
```
Short type labels (Presidio name → label): PERSON→PERSON, EMAIL_ADDRESS→EMAIL,
PHONE_NUMBER→PHONE, CREDIT_CARD→CARD, IBAN_CODE→IBAN, US_SSN→SSN, IP_ADDRESS→IP,
LOCATION→LOCATION, US_PASSPORT→PASSPORT, US_DRIVER_LICENSE→LICENSE, US_BANK_NUMBER→BANK_ACCOUNT,
CRYPTO→CRYPTO, plus built-in-only SECRET (API keys, tokens, passwords after "password:"), and
URL_CREDENTIALS→SECRET. Placeholders look like `[PERSON_1]`.

Overlaps (`resolveOverlaps` in patterns.js): a high-risk entity (CARD, IBAN, SSN, BANK_ACCOUNT,
PASSPORT, SECRET) that overlaps an entity of another type absorbs it into its own span and type, so a
known value inside a password never splits the secret; same-type spans that meet are merged again.

Built-in recognizers (patterns.js): EMAIL, PHONE (international and US formats, ≥ 7 digits, not
dates/prices/years/versions/IPs; see below), CARD (13–19 digits with spaces/dashes, Luhn-valid),
IBAN (country + mod-97), SSN (valid area/group/serial), IP (v4, v6), SECRET (sk-…, sk-ant-…, AKIA…,
ghp_…, xox…-, JWT, "password: …"), PERSON (heuristics: "my name is X", "I'm X Y" with capitalised
names, "Dear X", "Mr./Mrs./Ms./Dr. X Y", sign-offs like "Regards,\nX Y"). Export
`detectBuiltin(text) -> Entity[]` and `luhnValid`, `ibanValid`.

PHONE precision rules (logs and tables are full of numbers side by side, e.g. an access-log line's
`200 5123` is a status code and a byte count):
- Digits separated only by spaces, with no `+` and no phone keyword ("call", "phone", "tel", "number",
  ...) within 25 characters before, count only in unmistakable shapes: a national trunk prefix
  (`020 7946 0958`, `07911 123456`, `06 12 34 56 78`, `0049 ...`), North American `212 555 1234`,
  Indian mobile `98765 43210`, Chinese mobile `138 0013 8000`. Other spaced shapes (local numbers
  without an area code, `6123 4567`) need a keyword.
- Dashes, dots and parentheses (`555-0187`, `555.123.4567`, `(555) 123-4567`) keep the general rules.
- An identifier label right before the number (`order`, `invoice`, `ticket`, `build`, `version`,
  `port`, `pid`, `id`, ... optionally with `#`/`no.`/`number`), or a bare `#` without a phone keyword,
  means it is not a phone. `+` numbers are never suppressed by a label.
- A candidate that starts with or contains a calendar date (`2026-11-26 10`, `2026.11.26.1234`) is not a phone.

Presidio client (presidio.js): `createPresidioClient({ url, language, scoreThreshold, timeoutMs,
entities?, fetch?, cacheSize? }) -> { analyze(text) -> Promise<Entity[]>, health() -> Promise<boolean>, url }`
using `POST {url}/analyze` with `{ text, language, score_threshold, entities? }` →
`[{ entity_type, start, end, score }]` (code-point offsets, converted to UTF-16). Map entity_type to
short labels; drop types not in the table (e.g. DATE_TIME, NRP, URL). Results are cached per text hash
(offsets only, never text).

Entity selection: `PRESIDIO_ENTITIES` (comma list of Presidio names, e.g.
`PERSON,PHONE_NUMBER,EMAIL_ADDRESS,IBAN_CODE,CREDIT_CARD,US_SSN,IP_ADDRESS,LOCATION`) becomes
`config.privacy.presidioEntities` (array, upper-cased, deduplicated, invalid names dropped) and is sent as
`entities`; empty = the analyzer's default set (no `entities` field). Trade-off: NER also hides public
figures and places ("Why did Napoleon lose at Waterloo?" → "[PERSON_1] ... [LOCATION_1]"), so operators
may leave out PERSON and/or LOCATION. The built-in recognizers run whatever the selection.

## Providers — src/providers/

Registry (`src/providers/index.js`):
```js
createProviders(config) -> {
  get(gateway) -> Provider          // in config.mock, returns the mock provider for every gateway
  isAvailable(model) -> boolean     // gateway configured (key/base URL) or mock mode; model.enabled;
                                    // and not marked down (self-hosted outage window, below)
  downUntil(gateway) -> ms|null     // end of a self-hosted outage window, for status pages
}
```
Provider interface (each file exports `create<Name>Provider(config) -> Provider`):
```js
Provider = {
  name: 'openrouter' | 'openai' | 'selfhosted' | 'fal' | 'mock',
  configured(): boolean,

  available(): boolean, downUntil(): ms|null,   // openaiCompatible providers (selfhosted outage window)

  // TEXT. Async generator. Yields, in this order: meta?, delta*, usage
  //   { type: 'meta', upstreamProvider }   as soon as the host that got the prompt is known (gateway
  //     default for OpenAI/self-hosted once the upstream accepted the request; the chunk's
  //     `provider` on OpenRouter), again only if it changes
  //   { type: 'delta', text }
  //   { type: 'usage', inputTokens, outputTokens /* includes reasoning */, reasoningTokens, cachedTokens,
  //     costUsd /* number|null: provider-reported */, upstreamProvider /* string|null */,
  //     modelReported /* string|null */, estimated /* bool: tokens estimated, upstream sent none */ }
  //   (exactly once, last)
  streamChat({ model, messages, effort, maxTokens, zdr /* bool: require ZDR endpoints */,
               sessionId /* opaque per-conversation id or undefined */, signal }),

  // JSON completion used by the classifier and the benchmark judge.
  completeJSON({ model, system, user, maxTokens = 300, schema /* optional JSON Schema */,
                 zdr /* bool, openrouter: ZDR endpoints only */, signal })
    -> Promise<{ json /* parsed object */, text, usage: { inputTokens, outputTokens, costUsd } }>,

  // MEDIA (fal, openai images, mock).
  generateMedia({ model, job, prompt, params, signal, onProgress /* ({status, position?}) */ })
    -> Promise<{ media: [{ type: 'image'|'video'|'audio', url, mime? }],
                 units /* number of model.price_unit billed */, costUsd /* number|null */ }>
}
```
- `openaiCompatible.js`: shared OpenAI-style `/chat/completions` streaming client
  (SSE parse, `[DONE]`, keepalive comments, usage chunk) used by openrouter, openai, selfhosted.
- `openrouter.js`: base `config.gateways.openrouter.baseUrl`; headers `Authorization: Bearer <key>`,
  `HTTP-Referer: config.publicUrl`, `X-OpenRouter-Title: Gode` (and legacy `X-Title: Gode`). Body:
  `model: model.slug`, `messages`, `stream: true`, `max_completion_tokens`, `reasoning: { effort }`
  (only when `model.supports_reasoning`; see "Reasoning effort mapping"), `session_id` when given
  (opaque per-conversation id, keeps OpenRouter sticky to one provider for prompt caching), and the
  `provider` routing object, built from two sources: the catalog pin `model.params.openrouter_provider`
  (validated against OpenRouter's provider fields: `only`, `order`, `ignore`, `allow_fallbacks`,
  `require_parameters`, `data_collection`, `zdr`, `sort`, `quantizations`, `max_price`, ...; a
  misspelled key or wrong type throws TypeError before any request, so a broken EU pin fails
  closed), then, when `zdr`, `zdr: true, data_collection: 'deny'` applied last so a pin can narrow
  the hosts but never weaken ZDR. Omitted when both are empty. The same fields go on completeJSON.
  Exported `providerPreferences(model)` validates a pin (for admin routes). Usage (incl. `usage.cost`
  in USD and `completion_tokens_details.reasoning_tokens`) always arrives in a final chunk before `[DONE]`.
  Skip SSE comment lines (`: OPENROUTER PROCESSING`). A 200 stream whose chunk carries a top-level
  `error` is a failure → throw upstream_error. `upstreamProvider` = chunk.provider if present.
  Never send end-user identifiers (pooled identity): no `user` field.
- `openai.js`: direct OpenAI. Chat via chat completions (`max_completion_tokens`,
  `reasoning_effort`, `stream_options: { include_usage: true }`, `prompt_cache_key` = the session id).
  Image generation via `POST /images/generations` (gpt-image models; returns b64 → data URL). Only
  `size, quality, background, output_format, output_compression, moderation` are forwarded from
  params. The data URL's mime follows the response's `output_format`, else the requested one, else
  PNG. Never send `user`.
- `selfhosted.js`: OpenAI-compatible server (vLLM/Ollama/TGI) at `config.gateways.selfhosted.baseUrl`.
  Configured only when the base URL is set; the key is optional. Sends `max_tokens` (the field every
  server accepts). Effort `'none'` sends `chat_template_kwargs: { enable_thinking: false }` (Qwen-style
  templates; ignored by servers that don't know it) and **no** `reasoning_effort`, because vLLM may
  reject `'none'`; any other effort sends `reasoning_effort` only. The slug must equal vLLM's
  `--served-model-name`.
- `fal.js`: queue API: `POST {queueBaseUrl}/{endpoint_id}` (`Authorization: Key <FAL_KEY>`,
  `X-Fal-Store-IO: 0`), body = `{ ...model.params, ...params, prompt }` minus the catalog-only keys
  (`prompt_field`, `max_chars`, `openrouter_provider`, `reasoning`, `duration_options`, `pricing`) and
  generic hints (`aspect`, mapped
  onto `aspect_ratio`/`image_size` presets; `duration_s`). TTS models take `text` instead of `prompt`:
  use `model.params.prompt_field || 'prompt'`. When `model.params.max_chars` is set and the text is
  longer (counted in Unicode code points), throw
  `AppError(400, 'bad_request', 'This voice model accepts at most N characters; shorten the text.')`
  (extra `{ maxChars }`) BEFORE any network call (fal would answer 422 after queueing).
  → use the returned `status_url` / `response_url` (they contain only owner/app, not the sub-path)
  → poll status (202 while IN_QUEUE/IN_PROGRESS, 200 COMPLETED; emit onProgress with
  queue_position) → GET response_url → extract media URL(s) from
  `images[].url`, `image.url`, `video.url`, `audio.url`, `audio_file.url` (whichever exists). Errors
  can appear in the result body (`detail`/`error`) → upstream_error. No per-request cost is
  returned: compute from `price_unit` (image count, video seconds = params.duration, 1k_chars of
  the text, request = 1, minute = ceil(seconds/60)).
  Units for cost: images count, video seconds, audio seconds/songs, depending on `price_unit`.
- `mock.js`: deterministic, offline. streamChat streams a short answer word-by-word (~15 ms per
  word) that names the model label and echoes the first part of the last user message (so
  placeholder restoration is visible), plus fake usage (tokens ≈ chars/4, `costUsd: null`), after a
  `meta` event with `upstreamProvider: 'mock'`.
  completeJSON runs the heuristic classifier logic if asked to classify (detects the classifier
  system prompt) and returns `{}` otherwise. generateMedia returns an SVG data URL for image and
  video (`type: 'image'`), a short WAV data URL for voice/music (`type: 'audio'`), units = 1.
  Honours `signal`. generateMedia applies fal's `max_chars` limit too (`checkMaxChars(model, prompt)`
  from fal.js), so mock mode refuses what fal would.

Reasoning effort mapping (`src/providers/effort-map.js`, owned by the providers module, exported
`resolveEffort(model, effort) -> string|null`): `model.params.reasoning` may hold
`{ mandatory: bool, efforts: string[] /* supported, e.g. ["high","medium","low"] */ }`.
- model doesn't support reasoning → `null` (send nothing).
- effort `'none'`: if `mandatory` → the lowest supported effort (prefer `minimal`, then `low`);
  else `'none'`.
- effort not in `efforts` (when the list is given) → nearest supported level by rank
  `none < minimal < low < medium < high < xhigh < max`, ties → lower.
OpenAI direct uses the same function and sends the result as `reasoning_effort`.

Errors from upstream: throw `AppError(502, 'upstream_error', '<gateway>: <short message>')`. Never
include API keys or full upstream bodies in messages. Once the upstream has seen the prompt, the error
carries `extra.upstreamProvider` (never on our own abort).

Stream deadlines (`config.gateways.timeouts`, openrouter/openai/selfhosted, stream and completeJSON):
a first-byte deadline (`TEXT_FIRST_BYTE_TIMEOUT_MS`, 120 s, ×2/×3/×4 at effort high/xhigh/max) and an
idle deadline (`TEXT_IDLE_TIMEOUT_MS`, 90 s). They count SSE data payloads only (keepalive comments
don't reset them), pause while the consumer handles a yielded event, and abort the fetch. A deadline
gives `AppError(502, 'upstream_error', 'The model took too long to respond.', { timeout:
'first_byte'|'idle' })`; the caller's abort stays an AbortError. 0 disables a deadline.

Self-hosted outage window (`gateways.selfhosted.retryMs`, `SELFHOSTED_RETRY_MS`, 30 s): a network error,
a 502/503/504 or a first-byte timeout marks the self-hosted server down for that long; a 2xx clears it.
The caller's abort, idle stalls and 4xx never mark it. While down, `isAvailable` is false for its
models, so the picker applies `PRIVATE_FALLBACK` and the classifier skips it. The request that hit the
outage still fails.

fal transient failures: status polls and the result GET are retried on network errors, truncated
bodies, 408, 429 and 5xx with capped exponential backoff honouring `Retry-After`, until
`FAL_TIMEOUT_MS`; other 4xx fail at once. Submit is never retried. Cancel only on the caller's abort,
our deadline or a final failure. On the caller's abort the rejection is an AbortError with
`upstreamBilled`: false when the cancel answered 200 OK (the job left the queue before running),
true for 202 CANCELLATION_REQUESTED or 400 ALREADY_COMPLETED, and for any other answer (404, 5xx,
unreachable) true once fal had reported IN_PROGRESS. An abort before the submit answered carries no
`upstreamBilled`. On ALREADY_COMPLETED the result is still fetched (10 s) and returned normally: the
job was paid for, so the pipeline keeps and bills it.

## Router — src/router/

effort.js:
```js
difficultyToEffort(d) -> 'none'|'low'|'medium'|'high'    // 1 none, 2 low, 3 medium, 4-5 high
TIER_BY_PLAN = {
  saver:    ['budget','budget','budget','balanced','balanced'],
  balanced: ['budget','budget','balanced','quality','quality'],
  best:     ['balanced','quality','quality','quality','quality'],
}
MEDIA_TIER_BY_PLAN = { saver: 'budget', balanced: 'balanced', best: 'quality' }
chooseTier({ job, difficulty, plan }) -> tier
TIER_RANK = { budget: 0, balanced: 1, quality: 2, private: 3 }
```

classify.js:
```js
createClassifier({ config, db, providers, redactor?, logger? })
  .classify({ text /* already redacted */, history /* last few redacted messages, optional */,
              redactionCounts, signal, zdrOnly /* strict privacy: ZDR/self-hosted classifier only */,
              conversationPrivate /* conversations.private */, euOnly /* user.eu_only */ })
  -> Promise<{ job, difficulty, private: bool,
               output: { length, format, duration_s?, aspect?, media_prompt? },
               title /* <= 6 words */, classifierModel /* models.id | 'heuristic' */,
               usage: { inputTokens, outputTokens, costMicros } }>
  .resolveModel({ zdrOnly?, euOnly?, selfHostedOnly? }) -> Model|null   // the classifier model in use
heuristicClassify(text, redactionCounts, { history }) -> same shape (no usage cost)
CLASSIFIER_SYSTEM_PROMPT   // exported; the mock provider detects it
```
Local first. Before any model is called, the local signals decide whether the request is already
known to be private: `conversationPrivate`, `isSensitive(redactionCounts)` (a high-risk value), or the
heuristic keywords. Keywords about health, money and legal matters count only when tied to a person:
an owner (my/our/his/her/family/`[PERSON_1]`'s) or an experiencer (me, "I was", "we are"...) within 3
words, or my/me/us after; a software noun right after the term ("salary column", "password reset",
"medical records app") makes it technical; "password", "private key" and "confidential" count only as
someone's own secret, never in a code request. A known-private request is never sent to a third-party
model: it goes to a self-hosted classifier (`resolveModel({ selfHostedOnly: true })`: the configured
classifier if self-hosted, the chat private cell's model, then any self-hosted text model, by
gateway) when one is enabled and available, else the heuristic.

Otherwise the model is the first enabled + available text model of `[config.router.classifierModelId,
...CLASSIFIER_MODEL_CANDIDATES]`, with self-hosted text models as the last resort; heuristic when
none, on timeout (4 s) or on invalid JSON (the billed usage is kept). `zdrOnly` requires zdr or
self-hosted; `euOnly` requires region `'eu'` or self-hosted (by gateway), else the heuristic. Output is
validated and clamped. `private` is true if the LLM says so OR any local signal does.

`output.media_prompt`: a self-contained prompt for a media job, possibly with placeholders. The
heuristic fills it for a short follow-up ("now make a video of it") by combining it with the previous
user message (voice: the previous answer's text). A media request in a private conversation is
private only when its media_prompt quotes earlier messages. Classifier cost: provider-reported, else
tokens × `textRates(model)` (cached and long-context rates apply).

pick.js:
```js
createPicker({ db, config, providers })
  .pick({ job, difficulty, private, user /* {plan, strict_privacy, eu_only} */,
          pins /* conversation pins */, overrideModelId /* user switch or manual pick */,
          conversationPrivate /* conversations.private: sticky privacy for TEXT jobs */ })
  -> { model /* Model */, tier, effort, pinned: bool, zdrRequired: bool, reason: string,
       pinsUpdate /* new pins object to store, or null */,
       private: bool /* effective privacy: classified OR sticky (an earlier private turn) */,
       pinSource: 'user'|'auto'|null /* who chose the model; the menu says "Your pick" for 'user' */ }
  // throws AppError(409,'private_blocked') or AppError(503,'no_model')
  .candidates({ job, user, private, pins, conversationPrivate, currentModelId })
    -> Model[]  // eligible + available models for the switch menu: the current model first (the
                // answer's, else the pin), then the routed picks (private first when private), then
                // the rest by price, cheapest first
```
Rules, in order:
1. `action` jobs route as `chat` (phase 1).
2. Eligibility filters: model enabled, `providers.isAvailable(model)`, job in model.jobs;
   `strict_privacy` or `private` → `privateSafe(model)` (zdr, or the selfhosted gateway; never the
   self_hosted flag) (exception: a `private`, non-strict MEDIA request may use that job's `private`
   route cell, see "Private media"); `eu_only` and TEXT job → region `'eu'` or the selfhosted gateway.
   `conversationPrivate` makes a TEXT request private exactly like an earlier private turn.
3. `overrideModelId` (must be eligible, else 400 bad_request) → use it, pin it `{source:'user'}`.
4. `private` → the `private` tier route if eligible. If not (self-hosted not configured or marked
   down): `config.router.privateFallback === 'block'` → throw private_blocked; else reuse an existing
   auto private pin while it is still eligible (it stores `routed_from`, the column it came from, and
   only upgrades when the wanted tier ranks higher), else the normal tier's route if it is ZDR,
   otherwise the best ZDR candidate (walk quality→balanced→budget routes, then any ZDR candidate). The
   private cell wins again as soon as it is usable. A user pin that is private-safe is kept. Private
   media never writes or replaces the job's pin (legacy auto media pins with tier 'private' are
   ignored). zdrRequired = (private or strict_privacy) and `privateSafe(model)`, so the 🔒 badge and the
   gateway's ZDR filter are never claimed for a model that can't honour them.
5. Pinned model for this job (`pins[job]`) is reused when still eligible, unless the pin is
   `source:'auto'` and the newly chosen tier ranks higher (upgrade only, never downgrade; a fallback
   pick is upgraded only to a dearer model). User pins never auto-change.
6. Otherwise tier = `chooseTier`; model = routes[job][tier] if eligible; else walk other tiers
   (nearest first); with no usable cell at all (e.g. an OpenAI-only deployment), pick by the wanted
   column: cheapest for budget, the middle price for balanced, the dearest for quality; none → no_model.
7. effort = `resolveEffort(model, route.effort_override ?? difficultyToEffort(difficulty))` folded into
   Gode's levels (minimal → low, xhigh/max → high): the chip, the route event, `requests.effort` and the
   estimate show what the provider will really run. `'none'` for models without reasoning and for media.
8. pinsUpdate: set `pins[job] = { model_id, tier, source }` when it changed.

Private media: no media model is zero-retention (fal keeps queue payloads and serves public result
URLs; OpenAI images need approval for ZDR). A `private` media request (classified private, or a
follow-up in a private conversation whose media_prompt quotes earlier messages) uses the job's
`private` route cell (the budget pick in the seed); the pipeline sends it a generically redacted
prompt ("a person", "an email address"), and the result is NOT zero-retention (`zdrRequired: false`,
no 🔒). `strict_privacy` has no such exception: a strict-privacy media request ends in `409
private_blocked` ("Strict privacy is on and no model that meets it is available for image.").

learn.js:
```js
computeStats(db, { sinceMs }) -> [{ job, model_id, n, ratings, up, down, regenerated, overridden,
                                    avg_cost_micros, avg_latency_ms, score }]
  // score = (up + 1) / (up + down + regenerated + overridden + 2)   (Laplace-smoothed satisfaction)
  // ratings = up + down + regenerated + overridden
computeCellStats(db, { sinceMs }) -> the same per (job, tier) cell, from requests.tier; action folds
  // into chat; only status 'ok' rows count (stopped and failed answers are neutral)
proposeRoutes(db, { minSamples, sinceMs }) -> [{ job, tier, current_model_id, proposed_model_id,
    reason, current_score, proposed_score, current_n, proposed_n, current_requests, proposed_requests }]
  // Per routed cell, comparing models only within that cell. A cell is considered only when its
  // CURRENT model has >= minSamples ratings there; a challenger needs as many in the same cell
  // (current_n / proposed_n are ratings). quality: best score, only when > current + 0.02;
  // balanced: maximise score - 0.15 * normalised cost, never a model with a lower score than the
  // current pick; budget: cheapest with score >= current - 0.02 AND cheaper than the current pick.
  // No ratings, no change (the prior never decides). Never touches the private tier.
applyProposals(db, proposals, { source = 'learn' }) -> number   // writes routes + route_history; a
                                                                 // proposal whose cell changed since
                                                                 // (current_model_id) is a no-op
recordLearnRun(db, { source /* admin|cli|schedule */, days, proposals, applied }) -> id
markLearnRunApplied(db, id, applied), getLearnRun(db, id), listLearnRuns(db, { limit, source })
gateMetrics(db, { sinceMs }) -> { users, auto_pick_kept_pct /* active users with no manual request in
    the window: the gate figure */, auto_pick_on_pct /* current-setting snapshot */, auto_requests_pct,
    override_rate, requests, api_cost_usd /* every request, failed and stopped included */,
    failed_api_cost_usd, charged_usd, gross_margin_pct, thumbs_up_rate,
    credits_cover_api_costs /* charges, free credit included, >= api cost */,
    purchases_usd, free_credit_usd /* signup_bonus + dev_topup */, adjusted_usd,
    free_credit_share_pct, cash_covers_api_costs /* purchases >= api cost: the gate figure */,
    deleted_account_requests /* of requests, from usage_archive */ }
  // Request counts, API cost, charges and ratings include usage_archive (deleted accounts' per-day
  // totals, written by deleteEverything before it removes their requests rows), from the start of
  // the window's first UTC day.
```

schedule.js: `startLearnScheduler({ db, config, logger, now?, checkIntervalMs?, firstCheckMs? }) ->
{ stop(), tick() }`. With `config.learn.schedule === 'weekly'` it checks hourly (first check 60 s after
boot, unref'd timers) whether a `schedule` learn_runs row exists from the last 7 days; if not it runs
proposeRoutes, stores the run and applies it only with `config.learn.autoApply`. Errors are logged by
name only and retried at the next check. Off: both are no-ops. server.js starts it and stops it in
close(); `start()` returns it as `learner`.

## Billing — src/billing/

credits.js — `createCredits(db, config, { logger })`:
```js
balance(userId) -> micros
priceFor(apiCostMicros) -> chargedMicros          // ceil(api * (1 + margin)), 0 -> 0
estimateApiCostMicros({ model, inputTokens, maxOutputTokens, units }) -> micros
  // text: the long-context tier of params.pricing applies (textRates)
affordableOutputTokens({ model, inputTokens, maxOutputTokens, extraApiMicros, balanceMicros }) -> n | -1
  // the most output tokens whose full hold fits the balance (binary search); -1 when none
reserve(userId, estimateChargedMicros, { message }?) -> { holdId, amount }
  // Holds the FULL estimate. balance <= 0 or balance < estimate -> AppError(402,'insufficient_credits')
  // (message overrides the text). Inserts holds row + ledger 'hold' (-amount); balance -= amount. Atomic.
settle(holdId, chargedMicros, ref) -> { balance, charged }
  // charged = min(requested, hold): an overrun is absorbed by us and logged with the ids only, so a
  // balance never goes below zero. Ledger 'release' (+hold), 'charge' (-charged), delete hold.
release(holdId) -> void                            // full refund of the hold
grant(userId, micros, kind, ref) -> { balance, duplicate: bool }
  // kind: signup_bonus | purchase | dev_topup | admin_adjust. purchase is idempotent per ref.
adjust(userId, deltaMicros, ref) -> balance        // ledger 'admin_adjust'; delta may be negative,
                                                   // clamped so the balance never goes below 0
held(userId) -> micros                             // credit on hold for running answers
ledger(userId, { limit = 50, kinds }) -> rows
releaseStaleHolds(maxAgeMs, { keep }) -> n         // keep: hold ids never to release (live answers)
```
Invariant: `users.balance_micros == SUM(ledger.delta_micros WHERE user_id = ?)`. server.js calls
`releaseStaleHolds(0)` at boot (one process per database, so no hold can belong to a live request)
and every 5 minutes `releaseStaleHolds(STALE_HOLD_MINUTES, { keep: pipeline.activeHoldIds() })`.

stripe.js — `createStripe(config, credits, db)`:
```js
enabled: boolean
createCheckout({ user, packUsd }) -> Promise<{ url, id }>
  // POST {stripeApiBase}/v1/checkout/sessions, form-encoded, mode=payment, inline price_data,
  // client_reference_id=user.id, metadata[user_id], metadata[credit_micros], metadata[gode]=credit_pack
  // (informational), success/cancel URLs under config.publicUrl. packUsd must be one of
  // config.billing.packsUsd. Credits granted = packUsd (the margin is applied when spending).
verifyWebhook(rawBody /* Buffer */, signatureHeader) -> event   // HMAC-SHA256, 300 s tolerance,
                                                                // timing-safe; throws 400 on failure
handleEvent(event) -> { handled: bool, duplicate: bool }
  // checkout.session.completed with payment_status 'paid', and
  // checkout.session.async_payment_succeeded -> credits.grant(purchase, ref = session.id).
  // Only sessions Gode created: metadata.user_id is required (a Payment Link can't set it), a present
  // client_reference_id must match it, and Number(metadata.credit_micros) must equal the credit
  // computed from the amount paid. It need not be one of today's packsUsd: a pack removed while its
  // Checkout Session was open (up to 24 h) is still credited. Anything else is logged
  // with Stripe ids only and skipped (handled: false). Idempotent via stripe_events + the ledger
  // unique index.
```

## Auth — src/auth.js

```js
createAuth({ db, config, keyring, credits })
  .signup({ email, password }) -> Promise<user>   // email normalised lower-case; validatePassword;
      // new wrapped DEK; admin = email in ADMIN_EMAILS when config.adminEmailsAutoGrant (default
      // outside production; a listed signup is logged by account id), or (only when ADMIN_EMAILS is
      // empty and config.firstUserAdmin) the first account. Signup bonus in the same transaction, once per
      // email: bonus_claims holds keyring.hmac('signup-bonus-email', normalized email) (+tags and
      // Gmail dots dropped) and survives deleteEverything; at most billing.signupBonusDailyCap per UTC
      // day (0 = no cap). 409 conflict for an existing address (scrypt still runs, same timing).
  .login({ email, password }) -> Promise<user>    // AppError(401) on mismatch (same message either
                                                  // way); rehashes old scrypt parameters
  .checkPassword(user, password) -> Promise<bool>
  .changePassword(user, { current, next, keepToken }) -> Promise<{ revoked }>  // validatePassword;
                                                  // deletes every other session
  .createSession(userId) -> token           // stores sha256(token)
  .destroySession(token)
  .userFromToken(token, { legacyName }?) -> user | null   // legacyName: the token came as the
                                            // old gode_session name: only cookie 'plain'/NULL rows
  .middleware()     // express: reads the session cookie, sets req.user (or null) and req.sessionToken
  .requireUser      // express middleware: 401 JSON if no req.user
  .requireAdmin     // express middleware: 403 unless req.user.is_admin
  .setCookie(res, token) / .clearCookie(res)
  .deleteEverything(userId)  // deletes the user (cascades sessions/conversations/messages/
                             // requests/holds), nulls ledger.user_id, forgets the DEK. The requests'
                             // per-day totals are added to usage_archive first. Atomic; then
                             // checkpointWal(db) (PRAGMA wal_checkpoint(TRUNCATE), retried in the
                             // background while busy). With secure_delete on, no wrapped DEK or
                             // ciphertext is left in gode.db or its WAL. Backups taken earlier keep
                             // both until they expire.
validatePassword(password, { email }) // new passwords only: 8..200 chars, not only spaces, not one
                                      // repeated character, not a common password, not the email
                                      // or its local part
publicUser(row) -> { id, email, plan, strict_privacy, eu_only, auto_pick, share_prompts, is_admin,
                     balance_usd, created_at }
securityHeaders(config)  // express middleware: CSP (default-src 'self'; script-src 'self' only, no
                   // 'unsafe-eval' and no 'unsafe-inline'; style-src 'self' 'unsafe-inline';
                   // img/media from 'self' data: blob: (plus https: only when MEDIA_PROXY is off);
                   // form-action self + Stripe Checkout), X-Frame-Options DENY, nosniff,
                   // Referrer-Policy, HSTS in production
rateLimit({ windowMs, max, key }) // small in-memory limiter middleware (429 rate_limited), with
                                  // peek/hit for explicit keys
ipKey(req), ipPrefix(ip)          // client network: IPv4 as is (::ffff:a.b.c.d as IPv4), IPv6 by /64
ipGroupKey(req), ipGroup(ip)      // wider group: IPv4 /24, IPv6 /48 (the "under attack" login rule)
rateLimit(...).peek/hit/undo/clear(key)  // explicit counting; undo takes back one hit
requireSameOrigin  // for state-changing /api requests: if Origin header present it must match host
checkpointWal(db)
```
Admins: with `ADMIN_EMAILS` set, only listed addresses can be admins; `syncAdmin` re-checks the list
on every session read and at login, so removing an address revokes admin (and clears the stored flag).
With `config.adminEmailsAutoGrant` (`ADMIN_EMAILS_AUTO_GRANT`, default on outside production) a listed
address is an admin from signup. Off (production): emails are not verified, so a listed account is an
admin only once an operator confirmed it with `scripts/make-admin.js <email>` (the stored flag);
every signup of a listed address is logged with the account id only, so a squatter is noticed.
Without `ADMIN_EMAILS`, the first account is admin only when `config.firstUserAdmin`
(`FIRST_USER_ADMIN`, default on outside production). `scripts/make-admin.js <email> [--revoke]`
grants or revokes directly (with `ADMIN_EMAILS` and auto-grant off it confirms listed addresses only;
with auto-grant on it is refused, the list decides); `scripts/reset-password.js <email>` sets a random password, prints it once and
deletes all of the user's sessions (never touches wrapped_dek).

Passwords: async `crypto.scrypt` (N=2^15, r=8, p=3; verify reads N/r/p from the stored hash, 128 MiB
maxmem cap) through a job queue (2 at a time, 64 waiting, then 503); a dummy hash computed at boot keeps
unknown-email logins as slow as real ones.

Cookie: with `config.cookieSecure` it is `__Host-gode_session` (Secure, Path=/, no Domain, HttpOnly,
SameSite=Lax, Max-Age = sessionDays); otherwise `gode_session`. Two different users' valid sessions in
one request sign in neither. Each session stores the name it was issued under (`sessions.cookie`:
'host' in secure mode, 'plain' otherwise; NULL for sessions made before migration 3, all issued as
`gode_session`). The legacy `gode_session` name is still read in secure mode for one release, only
when no `__Host-` cookie is valid and only for 'plain' or NULL sessions: a token issued under the
`__Host-` name, which its owner can read from their own Set-Cookie and toss in from a sibling
subdomain, is never accepted under the old name, whatever the boot time. An accepted legacy cookie is
re-issued under the new name and its session marked 'host', so the old name stops working for it
(TODO in createAuth: remove next release).

## Chat pipeline — src/chat/pipeline.js

```js
createPipeline({ db, config, keyring, redactor, classifier, picker, providers, credits, logger? })
  .run({ user /* users row or id; re-read from the DB */, conversationId /* null -> new chat */, text,
         mode /* 'auto'|'manual'|'regenerate'|'switch' */, modelId /* manual or switch target */,
         targetMessageId /* regenerate/switch: assistant msg */, emit /* (event, data) => void */, signal })
  -> Promise<void>   // never rejects for request-level failures (they end in an `error` event);
                     // throws TypeError only when emit is not a function
  .activeHoldIds() -> string[]   // credit holds of turns still running (the stale-hold sweep skips them)
// Also exported: formatChip, formatCost, chipFor, sessionIdFor, buildSystemPrompt, historyContent,
// estimateMediaUnits(model, prompt, params), expectedOutputTokens, providerCostMicros, PLACEHOLDER_NOTE,
// MODES.
```
Steps (auto/manual):
1. Load the user row and, for an existing chat, the conversation (owned by the user, else 404): pins
   (plain JSON), the decrypted placeholder map, `conversations.private`, and the last
   `config.router.historyMessages` non-superseded messages. **One turn per conversation:** an
   in-process lock is taken before anything is read or written (new chats too); a second turn gets
   `busy` ("Wait for the current answer to finish.") before any work. A NEW conversation is not
   written yet (see step 6). Questions without a current answer (failed, stopped before any text,
   page closed) are left out of the history: the UI shows them as "No answer", and the model never
   gets `[..., user, user]`. An unanswered latest question with the same text is reused (retry dedupe).
2. Early credit check: balance <= 0 → `insufficient_credits` before any redaction or classifier call
   (no requests row). Then redact (unless `config.privacy.redaction` is off): history + new text with
   the conversation map. Presidio down in fail mode closed → `redaction_unavailable`, nothing stored.
3. Classify the redacted latest text (+ 4 most recent redacted messages as context), with
   `zdrOnly: Boolean(user.strict_privacy)`, `conversationPrivate: conversations.private` and
   `euOnly: Boolean(user.eu_only)`.
4. Pick, with `conversationPrivate`. `manual` mode passes `modelId` as `overrideModelId`; if that model
   can't do the classified job, the job falls back to `chat` (or the model's own job): "draw a cat" sent
   to a text model is answered as chat. Eligibility (enabled, available, privacy, EU) is still enforced
   by the picker.
5. Unredacted text goes only to `model.gateway === 'selfhosted'` with `redactSelfHosted` off (decided
   by the gateway, never by the editable self_hosted flag). Then route/requests `redactions` are `{}`,
   the placeholder note is left out and stream restoration is a passthrough.
6. TEXT: trim the history (oldest first, redacted and real arrays in step, the kept history starting on
   a user turn) until estimated input + MAX_OUTPUT_TOKENS fits 90% of `model.context_length` (skipped
   when null); the latest message alone too long → 400. The hold is the full estimate:
   `credits.priceFor(estimateApiCostMicros({ model, inputTokens, maxOutputTokens }) + classifierCost)`;
   when the balance can't cover it, `max_tokens` shrinks to `credits.affordableOutputTokens(...)` and
   that value is sent upstream; below `billing.minAffordableOutputTokens` → `insufficient_credits`
   naming the balance. Reasoning tokens count against max_tokens, so on a reasoning model a shrunk
   cap also lowers the effort until `REASONING_ALLOWANCE_TOKENS[effort]` (none 0, low 300, medium
   1000, high 2500) plus that minimum fits (`effortForCap`); the effective effort goes upstream and
   into the route event (`effort_lowered: true`), the chip and the requests row. When not even the
   model's lowest level fits (a mandatory-reasoning model runs "none" as "low") → `insufficient_credits`. MEDIA must be affordable in full ("This costs about $X and your balance is
   $Y"). A voice model with `params.max_chars` refuses longer text (400) before any hold. In ONE
   transaction, against the balance as it is then: `credits.reserve`, the conversation row if new, the
   user message (encrypted), the map (the turn's only map write), the title when the chat has none
   (`sanitizeTitle` → restored with real values for low-risk types and masks for HIGH_RISK types,
   "•••• 0366" for cards/IBANs/bank accounts → encrypted; `WHERE title_enc IS NULL`, so a rename wins),
   and `conversations.private = 1` whenever `pick.private` (text AND media; never cleared). Emit `route`.
7. TEXT: stream via provider (pass `sessionId` = first 32 hex chars of
   sha256(`gode-session:` + conversation id) — opaque, never identifies the user); feed deltas through
   `createStreamRestorer(map, { maskHighRisk: RESPONSE_FILTER, ownMap: map })`, so a high-risk value
   the model produces is masked before any part of it is shown; emit `delta` per safe chunk. A `meta`
   event records `upstreamProvider`. When the stream ends with an error the held tail is flushed (shown
   before an upstream error; stored with a stopped answer, never sent after a Stop). At the end,
   `filterResponse` (unless `RESPONSE_FILTER=off`) as the safety net; if it masked anything (a
   multi-line key block) emit `replace { text }`. A stream without a usage event is billed from
   estimated tokens, never as zero.
   MEDIA: prompt = the classifier's `output.media_prompt` when present (genericizePlaceholders, then a
   second `redactMessages(..., { mode: 'generic' })` pass), else the latest text generically redacted;
   counts come from the placeholders plus the generic pass. `generateMedia` with `params { aspect,
   duration }` (duration = `durationFor(model, output.duration_s)`) and the hold sized from the same
   params (`estimateMediaUnits(model, prompt, params)`); the pipeline strips `duration_options` and
   `pricing` before the adapter call. onProgress → emit `progress`.
8. Cost: provider-reported costUsd, else `providerCostMicros` from catalog prices (`textRates`: cached
   input at `cached_in`, the long-context tier; outputTokens already include reasoning; or units ×
   price_per_unit) + classifier cost. Unknown prices count as 0 (one warning per model id). charged =
   `credits.priceFor(api)`, capped at the hold by settle.
9. In ONE transaction: `credits.settle`, the assistant message (encrypted `{ text, media }`, media with
   the UPSTREAM URLs), the `requests` row (metadata only, redaction counts, upstream provider), merged
   pins, supersede (regenerate/switch), conversation updated_at. Pin merge: a `source: 'user'` pin
   always applies; an automatic pin only when the stored pin still equals the one the turn started
   from, and never over a stored user pin. If the hold vanished (stale-hold sweep) the answer is stored
   uncharged with a warning; if the account was deleted mid-answer nothing is stored (`not_found`).
   After the commit: emit `media` per item with `url = publicMediaUrl(config, messageId, i, url)`
   (`/api/media/<message>/<i>` for proxied hosts), then `done`.
10. On any error: one `error { error, code, ... }` event and a requests row once classification ran
    (status `error` + error_code, or `stopped`). Who pays (see "Abort semantics"): a Stop after output
    pays for that output; an answer that finished upstream but could not be stored (chat deleted,
    conflict) is charged; upstream errors, shutdowns and early stops release the hold, with the
    estimated upstream cost still recorded in `api_cost_micros` (and estimated tokens on the row).
    AppError messages pass through; anything else becomes `{ error: 'Something went wrong.', code:
    'internal' }`, logged as `[pipeline] <request id> failed: internal (<ErrorName>)`. Expected codes
    are not logged (aborted, interrupted, busy, bad_request, not_found, insufficient_credits,
    private_blocked); other codes log `[pipeline] <request id> failed: <code>`. emit() is wrapped so a
    throwing writer can't break billing.

regenerate: the target must be the user's own non-superseded assistant message (404 not owned, 400
a user message, 409 already superseded) → its parent user message; the conversation lock is taken
(a second regenerate of the same answer gets `busy` before any upstream call); reuse the original
request's job, difficulty, private; pick with the conversation's real pins and `conversationPrivate`
(keeps the pinned model); mark the old request `regenerated = 1` right after the pick succeeds (a
feedback signal even if the new call fails upstream, but not when the picker refused); history = the
answered messages before the parent question. The old message is marked `superseded = 1` only in the
success transaction, and the new answer keeps the old answer's `created_at` so it stays in place. New
request kind 'regenerate'. No new user message, no re-classify (so a media answer's media_prompt and
duration are not reused). switch: same, but with `modelId` as override (pins `{source:'user'}`), old
request `overridden = 1` after a successful pick, kind 'switch'.

Decisions (as implemented in `src/chat/pipeline.js`; the code is the reference):
- **Redaction counts cover the new text only.** History + new text are redacted together with the
  conversation map (stable placeholders across turns), then the latest message alone is redacted
  again with the resulting map. Its counts feed the classifier's `redactionCounts`, the route event's
  `redactions`, the "N personal details hidden" note and `requests.redactions`; old messages are not
  counted again every turn. Redaction always runs on REAL text (decrypted history), never on
  already-redacted text.
- **System prompt placeholder note.** Text jobs get a short system message (date; the `action`
  note for action jobs). Only when redacted text is sent and the map holds entries, it adds
  `PLACEHOLDER_NOTE`: treat `[PERSON_1]`-style placeholders as the real values, keep them verbatim,
  never ask what they stand for. Nothing in the system prompt identifies the user.
- **Classifier privacy.** `classify` gets `zdrOnly`, `conversationPrivate` and `euOnly`, so a
  strict-privacy prompt never reaches a non-ZDR classifier, a known-private prompt never reaches a
  third-party one, and an EU-only user's prompt only an EU or self-hosted one.
- **Sticky privacy is stored with the question**, not on success: a private turn whose answer fails
  or is stopped still makes the conversation private, and so does a private media turn.
- **No ghost conversations.** A new conversation row is written in the same transaction as its
  first user message and the credit hold, after redaction, classification and picking succeeded. A
  failure before that leaves nothing behind, and its `error` event carries no `conversation_id`.
- **Retry dedupe.** When the latest stored message is a user message with no live answer and the
  same text (a retry after an error, or a Stop before any text), it is reused instead of stored twice.
  After a stopped answer (which is stored), the same text is a new question.
- **Supersede only on success.** For regenerate/switch, the old answer is marked `superseded` in
  the same transaction that settles credits and stores the new answer. A failed or stopped
  regenerate leaves the old answer visible; a target already superseded gives `409 conflict`.
- **Abort semantics** (client disconnect → `signal`):
  - Stop after at least one delta: the partial answer is stored as `{ text, stopped: true }` (what was
    shown, plus the restorer's held tail, masked and filtered), `requests.status = 'stopped'`
    (error_code NULL), and charged for what was produced: provider usage if reported, else estimated
    input + `estimateTokens(streamed raw text)` at model prices, plus the classifier, capped at the
    hold. Hidden reasoning tokens are not in the estimate (a lower bound). A stopped regenerate/switch
    is charged but stores nothing (message_id NULL) and keeps the old answer. The error event carries
    `stopped: true`, `message_id` (when stored), `cost_usd` and `balance_usd`.
  - Stop before any delta: release, store nothing, status `error`, code `aborted`.
  - Server shutdown (sse.js aborts with a reason tagged `shutdown: true`, "The server is shutting
    down."): not charged, code `interrupted`, the estimate recorded.
  - A media result that already finished is kept (paid for upstream), also when fal's cancel answered
    ALREADY_COMPLETED (the adapter fetches the result). A media job stopped after the provider
    started it is billed upstream, so it is charged: `priceFor(estimateApi + classifierCost)`, i.e.
    the hold, stored as `{ text: "", media: [], stopped: true }` with `requests.status = 'stopped'`
    and the estimate in `api_cost_micros` (a stopped regenerate/switch is charged and keeps the old
    answer). "Started" is the adapter's `err.upstreamBilled` (fal: the cancel answer, see Providers);
    an adapter that does not say is taken at its `running` progress event. A job stopped while still
    queued (fal cancel 200 OK) is free: release, status `error`, code `aborted`. In history a stopped
    empty media answer reads `[stopped before it was ready]`. Shutdowns and upstream errors are never
    charged; a running job's estimate is still recorded in `api_cost_micros`.
  - Any charged failure (e.g. the chat deleted mid-answer) also carries `cost_usd` and `balance_usd`.

SSE events (`emit(event, data)`), all `data` JSON:
```
route    { request_id, conversation_id, user_message_id, message_id, job, difficulty, private, tier,
           model: { id, label, vendor, region }, effort, pinned, zdr, redactions: {TYPE:n},
           est_cost_usd, classifier_model /* models.id | 'heuristic' | null */, classifier_label,
           classified_outside /* a third-party classifier read the (redacted) question; a
           regenerate/switch reports the classifier that first read it */,
           title? /* first exchange only */, replaces_message_id? /* regenerate/switch */,
           effort_lowered? /* the balance only paid for a short answer */,
           context_included? /* the media prompt quoted earlier messages */ }
delta    { text }
replace  { text }                                  // full replacement (the final response filter fired)
progress { status, position? }                     // media queue
media    { type, url, mime? }                      // after the answer is stored; url = publicMediaUrl
                                                   // (null: a host the proxy may not fetch from)
done     { message_id, request_id, conversation_id, cost_usd, api_cost_usd, input_tokens,
           output_tokens, media_units, balance_usd, chip: "Claude Opus 5.5 · high effort · $0.04" }
           // input/output_tokens are null for media jobs, media_units is null for text jobs
error    { error, code, conversation_id? /* the chat exists in the DB */, request_id? /* a requests
           row was written */, stopped?, message_id? /* a stopped answer was stored */,
           cost_usd?, balance_usd? /* something was charged, or a Stop */ }
```
`est_cost_usd` is a TYPICAL estimate for the live chip (expected output for the classifier's length
short/medium/long plus a reasoning allowance by effort, capped at the turn's max_tokens), not the hold;
the hold covers the turn's full max_tokens.

Chip text: `${label} · ${effort === 'none' ? 'no thinking' : effort + ' effort'} · ${cost}` where
`formatCost` shows 2 significant decimals in integer micro-USD (≥ $0.01 → 2 dp, so 0.045 → $0.05;
smaller → up to 4 dp, e.g. $0.0031; below $0.0001 → `<$0.0001`). `formatChip(label, effort, costUsd)`
leaves the effort part out when effort is null/undefined; `chipFor({ label, job, effort, costUsd })`
does that for media jobs ("Qwen Image 3 · $0.05"). The routes use `chipFor` for stored answers, so a
reloaded chip is identical to the live one.

## HTTP API — src/routes/ and src/app.js

`createApp({ db, config, keyring, redactor, providers, classifier, picker, credits, stripe, auth,
pipeline })` returns the express app. Mounts securityHeaders, `express.json({limit:'256kb'})`
(except the Stripe webhook, which needs the raw body), auth.middleware, `/api/*` routers, static
`public/`, and a JSON error handler (`AppError` → `{ error, code }` with its status; others → 500
`{ error: 'Internal error', code: 'internal' }`, logged without request bodies).

All JSON. Auth via cookie. State-changing routes use requireSameOrigin.
```
POST   /api/auth/signup            {email,password} -> {user}           (rate-limited)
POST   /api/auth/login             {email,password} -> {user}           (rate-limited)
POST   /api/auth/logout            -> {ok}
GET    /api/me                     -> {user, config:{mock, stripe_enabled, dev_topup, margin, packs_usd,
                                       redaction, presidio, presidio_state, selfhosted, private_fallback,
                                       media_proxy, text_max}}
PATCH  /api/me                     {plan?, strict_privacy?, eu_only?, auto_pick?, share_prompts?} -> {user}
DELETE /api/me                     {password} -> {ok}                    (delete everything)
POST   /api/me/password            {current, next} -> {ok, signed_out_sessions}   (password limiter;
                                   signs out every other session, keeps this one)

GET    /api/conversations          -> {conversations:[{id,title,updated_at}]}
POST   /api/conversations          -> {conversation:{id,title,updated_at}}
GET    /api/conversations/:id      -> {conversation:{id,title,pins,private,updated_at}, messages:[Message]}
PATCH  /api/conversations/:id      {title} -> {ok}
DELETE /api/conversations/:id      -> {ok}                (then a WAL checkpoint)
  Message = { id, role, text, media:[{type, url /* publicMediaUrl */, mime?}], created_at, parent_id,
              answered? /* user messages: false when the question has no current answer */,
              stopped? /* assistant: a stopped partial answer */,
              request?: { id, kind, job, tier, model_id, model_label, model_region /* 'self' for the
                          selfhosted gateway */, pick_source: 'user'|'auto', effort, cost_usd, chip,
                          private, zdr, redactions, feedback, pinned, status /* ok|error|stopped */,
                          context_included, classifier_model, classifier_label,
                          classified_outside /* as in the route event */ } }
GET    /api/media/:messageId/:index -> the file          (owner only; see "Media proxy")

POST   /api/chat                   {conversation_id?, text, model_id?}  -> SSE (text/event-stream)
                                   model_id honoured only when user.auto_pick is off (mode 'manual')
POST   /api/messages/:id/regenerate                 -> SSE
POST   /api/messages/:id/switch    {model_id}       -> SSE
POST   /api/messages/:id/feedback  {value: 1|-1|0}  -> {ok}
GET    /api/models?job=chat[&conversation_id=][&message_id=]
                                   -> {models:[{id,label,vendor,region,zdr,self_hosted /* by gateway */,
                                       price_in,price_out,price_unit,price_per_unit,supports_reasoning}],
                                       header /* "Your pick, pinned for this chat" or null */}
                                   // message_id: the user's own answer; its request's privacy applies,
                                   // exactly as the switch will (404 for anyone else's or a mismatch)
GET    /api/transparency?limit=50[&before=<request id>]
                                   -> {requests:[{id,created_at,kind,job,tier,model_id,model_label,gateway,
                                       upstream_provider,effort,zdr,private,redactions,cost_usd,status,
                                       error_code,classifier_model,classifier_label}], has_more, next_before}
                                   // classifier_label: "Gode's own rules" for 'heuristic', null for a
                                   // reused decision (regenerate/switch); keyset paging, a foreign or
                                   // unknown cursor -> 400
GET    /api/public/providers       -> {models:[{label,vendor,region,gateway,jobs,zdr,self_hosted,
                                       retention_note}], redaction:{enabled, presidio}, selfhosted,
                                       presidio, presidio_state, private_fallback, redact_self_hosted,
                                       media_proxy, classifier:{label, zdr, region, self_hosted}|null}
                                   (no auth). selfhosted: a selfhosted-gateway text model can answer now.
                                   presidio: everything sent goes through Presidio (up or unknown, or down
                                   in fail mode closed, when nothing is sent)

GET    /api/billing/ledger         -> {balance_usd, held_usd, entries:[{id,kind,delta_usd,created_at}]}
POST   /api/billing/checkout       {pack_usd} -> {url}     (10 per 15 min per user)
POST   /api/billing/webhook        (raw body, Stripe-Signature) -> {received:true}
POST   /api/billing/dev-topup      {usd} -> {balance_usd}   (only when config.billing.allowDevTopup)

GET    /api/admin/routing          -> {models:[Model], routes:[Route], classifier_model_id}
PUT    /api/admin/routes/:job/:tier {model_id, effort_override?} -> {ok}   (action/* -> 400: action
                                   routes as chat)
POST   /api/admin/models           Model -> {ok}           (create)
PUT    /api/admin/models/:id       partial Model -> {ok}   (id with ':' and '/' is URL-encoded)
GET    /api/admin/stats?days=28    -> {days, gate: gateMetrics, models: computeStats, cells: computeCellStats,
                                       last_learn_run: {id, source, created_at, proposals, applied}|null,
                                       presidio: presidioStatus()|null}
POST   /api/admin/learn            {apply?, days?, min_samples?, run_id?, proposals?}
                                   -> {proposals, applied, run_id}
                                   // every call stores a learn_runs row (source 'admin'). {apply:true,
                                   // run_id} applies exactly that stored run; {apply:true, proposals}
                                   // applies reviewed proposals (routed tiers only, current_model_id
                                   // required); {apply:true} alone computes and applies (scripts)
GET    /api/admin/learn/runs?limit=20 -> {runs:[...]}
GET    /api/admin/users?email=     -> {users:[{id,email,balance_usd,is_admin,created_at}]}
                                   // case-insensitive substring (LIKE wildcards escaped), newest 50
POST   /api/admin/users/:id/credit {usd, note?} -> {balance_usd}   // credits.adjust, ref
                                   // 'admin:<admin id> <note>'; never below 0; |usd| <= 10,000
GET    /api/admin/catalog/export   -> {models, routes}
POST   /api/admin/catalog/import   {models, routes} -> {ok, models, routes}
```
Admin model edits and imports pass `{ openaiZdrApproved: config.gateways.openai.zdrApproved }` to
validateModel (so self_hosted/region 'self' off the selfhosted gateway, zdr on fal, and zdr on openai
without approval are 400s), and are refused when they would leave a stored private text cell's model
neither zdr nor self-hosted (route another model to the cell first).

Media proxy (`src/routes/media.js`, `src/media.js`): with `MEDIA_PROXY` on (default), the stored
message keeps the upstream URL and the browser gets `/api/media/<message id>/<index>`, live (the `media`
SSE event) and on reload (GET /api/conversations/:id). The route serves only the signed-in owner's
assistant message (else 404), fetches only https URLs on `MEDIA_PROXY_HOSTS` (default `fal.media` and
its subdomains; every redirect hop re-checked, at most 3), passes only image/video/audio types inline
(SVG and anything else become a download), forwards Range, caps the size at 512 MB and logs nothing
about the file. `data:` URLs pass through untouched. An expired upstream link gives 404 "This file has
expired at the media provider." With the proxy on, the CSP narrows img-src/media-src to `'self' data:
blob:`, so `publicMediaUrl` returns null for a link on a host outside `MEDIA_PROXY_HOSTS` (the UI
shows "This file could not be shown") and logs that host once, never the path: list every media host
there. The file is asked for with `Accept-Encoding: identity`; if a host compresses anyway (fetch
decodes it), Content-Length, Content-Range, Accept-Ranges and ETag are not forwarded (chunked) and a
compressed 206 is a 502.

SSE responses: headers `Content-Type: text/event-stream`, `Cache-Control: no-cache, no-transform`,
`X-Accel-Buffering: no`; write `event: <name>\ndata: <json>\n\n`; a `: ping` comment every 15 s;
on client disconnect abort the pipeline via AbortController. Disconnects are detected on the
RESPONSE's `close` event plus an "ended" flag: on Node 22 the request emits `close` as soon as
express.json has read the body, which would abort every stream at once. At most one `error` event
per stream. Pre-stream validation errors (auth, bad body, unknown/disabled model, someone else's
conversation or message, an already superseded target → 409) are normal JSON errors with status codes.

As implemented (`src/app.js`, `src/routes/*.js`):
- Middleware order: securityHeaders → the Stripe webhook (express.raw, before express.json and the
  origin check) → express.json (256 KB) → auth.middleware() → requireSameOrigin on /api →
  `Cache-Control: no-store` on /api. `trust proxy` is 1 hop when `config.trustProxy`. x-powered-by
  and etag are off. Unknown /api paths are JSON 404s; the SPA fallback serves index.html to page
  GETs that accept HTML, never to paths with a file extension.
- Error handler: AppError → its status and `{ error, code, ...extra }`; invalid JSON → 400 "Request
  body is not valid JSON."; too large → 413; everything else → 500 `{ error: 'Internal error',
  code: 'internal' }`, logged with name and stack frames but not the message line (it can quote
  content).
- `rateLimit`, `securityHeaders` and `requireSameOrigin` are module exports of `src/auth.js`;
  `auth.requireUser` / `auth.requireAdmin` are plain middleware, `auth.middleware()` is a factory and
  `auth.requireSameOrigin` the configured instance. Limits (`RATE_LIMITS` in src/app.js; "network" =
  `ipKey`, the IPv4 address or the IPv6 /64): signup+login 20 per 15 min per network; FAILED logins 10
  per 15 min per email + network; past 100 failures per hour per email from anywhere the account is
  "under attack": a login is still checked from a network group (`ipGroup`: IPv4 /24, IPv6 /48) with no
  failure for that email in the hour, so the owner's right password from their own network works,
  while a group that failed waits for the hour to end (one guess per group per hour); only failures
  from more than 1000 distinct groups in the hour (a botnet) refuse every login for the email. A
  successful login clears its group's mark. Attempts are counted before scrypt and taken back
  (`undo`) unless the password was wrong, so concurrent guesses can't all slip under a limit. Signups
  10 per day per network (409s for existing addresses count too; counted before the hash, given back
  for a 400 or 503); chat/regenerate/switch 30 per minute per user; password checks (DELETE /api/me, POST
  /api/me/password) 10 per 15 min per user; checkout 10 per 15 min per user. All are stopped by
  `app.locals.shutdown`.
- Unknown body fields are a 400 on every route. Chat text is trimmed, 1..32,000 characters.
- Status 201 for signup, POST /api/conversations and POST /api/admin/models; everything else 200.
- The ledger takes `?limit=1..500` (default 50) and `?all=1` (include hold/release rows). Catalog
  import is validated in full (models, params, routes, private cells) before anything is written.
- PUT /api/admin/routes: an omitted `effort_override` keeps the cell's value, null clears it; the value
  must be none/low/medium/high (EFFORT_RANK also lists minimal/xhigh/max, which a cell can't hold).
  A private-tier cell for a text job must be zdr or self-hosted.
- DELETE /api/conversations/:id removes the messages and the conversation; `requests` rows stay (metadata,
  the billing and transparency record).
- `app.locals.shutdown({ timeoutMs })` sends each running stream `error { code: 'interrupted' }`,
  aborts its pipeline with a reason tagged `shutdown: true` (holds are released while the DB is still
  open) and waits for it; `server.js` close(): stop the hold sweep, the Presidio probe and the learner
  schedule → server.close → closeIdleConnections → shutdown → wait ≤ 10 s → db.close().
- Boot (`server.js start()`): seedCatalog (empty DB only) → repairCatalog (logs the ids it cleared) →
  `releaseStaleHolds(0)` → in production with Stripe on, refuse a PUBLIC_URL that is not https or is
  localhost → listen → the 5-minute stale-hold sweep, the 20-second Presidio health probe (only while
  it is down) and `startLearnScheduler`. Resolves to `{ url, server, app, deps, config, close, learner }`.

## Frontend — public/

`index.html` loads `/styles.css`, then `/vendor/react.production.min.js`,
`/vendor/react-dom.production.min.js` and `/app.js`, all as plain `<script src defer>` files.
`app.js` is plain browser JavaScript on the React 18 UMD globals (`React.createElement`, aliased `h`):
no JSX, no Babel, no build step, no inline script. That is what lets the CSP be `script-src 'self'`
only (Babel standalone needs `'unsafe-eval'` and injects inline scripts). Never switch back to
`<script type="text/babel">`: under this CSP the app would not boot. All server and model text is
rendered as React text nodes (no `dangerouslySetInnerHTML`). Plain CSS with tokens (light + dark via
prefers-color-scheme), responsive to 360 px wide.
Hash routes: `#/` chat, `#/settings`, `#/billing`, `#/admin`, `#/privacy` (also `/privacy.html`
static public page that fetches `/api/public/providers`).

Chat screen: sidebar (new chat, conversation list, balance + "Buy credits", settings, admin link),
message list (markdown rendering: fenced code, nested lists, GFM tables, quotes, links; images in model
text become links and are never loaded; generated images/video/audio), composer (Enter sends,
Shift+Enter newline; `text_max` limit with a counter; when auto-pick is off, a model select fetched
with the conversation id, and the media suggestions are replaced by a note). Each assistant message
has the chip (`Claude Opus 5.5 · high effort · $0.04`; media chips have no effort part) with a switch
dropdown (candidates from /api/models for that job, conversation and message; its header is the
server's `header` or "Picked for <job> · <tier> tier"), 👍 / 👎, ↻ regenerate, and a privacy badge: the
🔒 lock only when zero retention was enforced ("Private" / "Zero retention"), "Ran on our servers" for
self-hosted answers, and an unlocked "Private · details removed" for private media (the provider may
keep it). "N personal details hidden from the model" when redactions > 0. Stopped answers are marked
Stopped with what they cost; questions without an answer show "No answer" with Try again (last
message, answered in place) or Ask again (back into the composer). SSE errors: `busy`,
`redaction_unavailable`, `insufficient_credits` (with amounts; Try again), a dropped connection
("Connection lost"); a failed send that was never stored puts the text back in the composer. A
polite live region announces finished answers. Streaming via `fetch` + ReadableStream SSE parsing.

Settings: plan (Saver / Balanced / Best), auto-pick, strict privacy, EU-only, share prompts
(opt-in), transparency log (with the classifier, paged with "Show older requests"), password change,
delete everything (password confirm, with the backup caveat). Billing: balance (credit on hold shown as
pending), packs → Stripe Checkout redirect, dev top-up (when enabled), ledger. Admin: overview (gate
metrics: kept auto-pick, override rate, margin, purchases vs API cost, free-credit share, the last
learner run; a banner while Presidio is down), routing grid (jobs × tiers, model select + effort
override; the Action row is read-only), model catalog editor (price, zdr, enabled), learner run with
Apply (applies the stored run by `run_id`), users (find by email, adjust credit), export/import JSON.
Privacy page (`#/privacy` and the static `/privacy.html`): promises built from
`/api/public/providers` (self-hosted / zero-retention fallback / block wording, Presidio named only
when `presidio` is true, the classifier's retention and region, private media, the backup caveat); the
static page starts with the most conservative wording.

## Benchmark — bench/

```
node bench/run.js [--prompts bench/prompts.jsonl] [--limit 200] [--judge <model id>]
                  [--out bench/results] [--concurrency 3] [--plan balanced]
                  [--catalog <admin export .json>] [--dry]
```
- `--concurrency <n>`: prompts in flight at once (default 3, max 16).
- `--plan saver|balanced|best`: the Gode plan the picker uses (default balanced).
- `--catalog <file>`: test a routing table exported from the admin page instead of the seed catalog
  (loaded into an in-memory DB; an invalid export exits 2).
- `--dry`: force mock mode, no keys needed and no AI called.
- `--judge`: a catalog id or any `openrouter:<slug>` (default Claude Opus 5.5).

For each text prompt: Gode router (redact → classify → pick → call, no billing/user) vs
`openrouter/auto`; both always get the same redacted messages (also when Gode picks a self-hosted
model); records model, cost, latency, tokens; a judge model compares the two answers pairwise in
randomised order → A/B/tie (`bench/judge.js`). The judge call uses ZDR endpoints when either side did
(`judgePair({ zdr })`, recorded as `verdict.judge_zdr`); main() warns when the judge model is not
flagged ZDR. Media prompts are classified
and then skipped (counted). Writes `results-<timestamp>.json` and `summary-<timestamp>.md`; the numbers
come from `bench/stats.js` (pure, unit-tested functions: win/tie/loss, total + paired per-prompt cost,
latency p50/p95 and TTFT, per-job breakdown, classifier agreement, redaction counts). Exit code 2 = a
configuration problem; per-prompt failures are recorded in the report and never fail the run. Live
runs need `OPENROUTER_API_KEY` (the baseline) plus keys for the judge's and the routed gateways.
`bench/prompts.jsonl` ships 200 realistic text prompts (`{id, prompt, job_hint}`: 127 chat, 65 code, 8
action, none classified as media by the mock or the heuristic); `scripts/export-bench-prompts.js`
exports real prompts only from users with `share_prompts = 1`, never from a conversation that was ever
private (`conversations.private = 1`, or any requests row of it with `private = 1`, failed and stopped
turns included), each conversation redacted once in order with its decrypted placeholder map (an
undecryptable map skips the prompt).

## Learning — scripts/learn.js

`node scripts/learn.js [--days 28] [--min-samples 20] [--apply]` prints gate metrics + proposals and
stores the run (source `cli`); `--apply` also writes them. The documented cron line is the dry run,
reviewed and applied on the admin page. Where cron can't reach the database (Render, Railway),
`LEARN_SCHEDULE=weekly` runs it inside the server (`src/router/schedule.js`, source `schedule`);
`LEARN_AUTO_APPLY=1` applies those runs without review.

## Testing

`npm test` runs `node --test --test-concurrency=1 "test/*.test.js"` (a glob: Node 22 does not expand
a bare directory argument, and files run one at a time because several start local servers). Each
module has a test file; `test/util.test.js` covers the shared helpers. `test/helpers/mock-upstream.js`
starts a local HTTP server emulating: OpenAI-compatible `/v1/chat/completions` (stream + non-stream,
records requests, `closedEarly` when the client hung up), OpenAI `/v1/images/generations` (echoes the
requested `output_format`), fal queue (`POST /:endpoint` → status → result), Presidio `/analyze`, and
Stripe `/v1/checkout/sessions`. `test/helpers/app.js` `createTestApp(env, overrides)` builds a full app
with the REAL pipeline on an in-memory DB (GODE_MOCK=1 and a random master key by default; a test may
pass `overrides.pipeline` to script the transport) and returns `{ url, close, deps, app, server,
config, client() }` (`overrides.mediaFetch` stubs the media proxy's fetch). `test/integration.test.js`
runs whole flows through the HTTP API in mock mode and with the real adapters against mock-upstream;
`test/integration-wires.test.js` checks the cross-module contracts end to end (media proxy live and
on reload, upstream provider of failed and stopped streams, sticky privacy after a failed turn with
local classification, admin credit adjustments and catalog privacy rules, Presidio outages in both
fail modes). `npm run e2e` (`e2e/smoke.js`) drives the real
`node server.js` in Chromium through every screen at 1280×820 and 375×812 and fails on console errors
or unexpected server log lines; Playwright is installed separately (not an npm dependency).

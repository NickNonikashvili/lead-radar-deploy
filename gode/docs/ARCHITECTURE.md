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
  src/router/learn.js       computeStats, proposeRoutes, applyProposals
  src/billing/credits.js    createCredits(db, config)
  src/billing/stripe.js     createStripe(config, credits, db)
  src/auth.js               createAuth({ db, config, keyring, credits }) + middleware
  src/chat/pipeline.js      createPipeline(deps) -> run(...)
  src/routes/*.js           express routers
  src/app.js                createApp(deps) -> express app
  public/                   index.html, app.js (plain JS), styles.css, privacy.html, vendor/ (React UMD)
  presidio/                 docker-compose.yml + python shim server
  bench/                    run.js, judge.js, stats.js, prompts.jsonl (200), README section
  scripts/                  learn.js, export-bench-prompts.js, seed.js
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
  `no_model`, `private_blocked`, `upstream_error`, `gateway_not_configured`, `conflict`.

## Database (src/db.js)

See the schema in `src/db.js` (tables: users, sessions, models, routes, route_history,
conversations, messages, requests, ledger, holds, stripe_events). Use `db.prepare(sql).get/all/run`
and `db.tx(() => {...})` (synchronous callback only). JSON columns are TEXT; parse with
`safeJsonParse`. Booleans are 0/1 integers.

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
importCatalog(db, { models, routes }, { source = 'admin' })     // upsert, writes route_history
// Also exported (already implemented): JOBS, TEXT_JOBS, MEDIA_JOBS, TIERS, modelToParams,
// validateModel(m) -> string[]  (ids, gateway, jobs, and validateParams(m.params)),
// validateParams(params) -> string[]  (catalog-only keys: openrouter_provider via providerPreferences,
//                                      max_chars positive integer, prompt_field name, reasoning shape),
// upsertModel(db, m), setRoute(db, route, {source, reason}),
// getModel(db, id) -> Model|null, listModels(db, {enabledOnly}) -> Model[], getRoutes(db) -> Route[]
// setRoute and importCatalog throw AppError(400, 'bad_request') for bad input.
```
Model ids are `"<gateway>:<slug>"`. Every job needs quality/balanced/budget picks plus a `private`
pick. The private pick for text jobs is a self-hosted open-weight model
(`selfhosted:<slug>`, `self_hosted: true, zdr: true, region: 'self'`); for media jobs it is the
best ZDR-flagged media model, or the budget pick if none is ZDR. Include alternates (not routed by
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
and `opts` = `{ fetch, logger, presidioRetryMs, presidioTimeoutMs }` (test seams).

```js
redactor.analyze(text) -> Promise<Entity[]>
  // Entity: { type, start, end, score, value }; type is a SHORT label (see below).
  // Built-in recognizers always run; Presidio results are merged in when config.privacy.presidioUrl
  // is set. Presidio failure -> log once, continue with built-ins (never send unredacted because
  // Presidio is down: built-ins still apply).

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
                                             // and a missing bracket pair: "PERSON_1")
redactor.createStreamRestorer(map) -> { push(chunk) -> string, flush() -> string }
  // Streaming-safe restore: never emits a partial placeholder; holds back the shortest possible tail.
redactor.filterResponse(text, map) -> { text, masked: { [type]: n } }
  // Masks HIGH-RISK entities (CARD, IBAN, SSN, BANK_ACCOUNT, PASSPORT, SECRET) that appear in model
  // output but are NOT one of the user's own values in `map`. Replaced with "[redacted CARD]".
redactor.isSensitive(counts) -> boolean     // true if counts include any HIGH-RISK type, used as a
                                             // privacy signal by the router
redactor.presidioEnabled -> boolean          // a Presidio URL is configured (not whether it is up)
redactor.presidioHealth() -> Promise<boolean> // live GET /health; false when none is configured
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
  isAvailable(model) -> boolean     // gateway configured (key/base URL) or mock mode; model.enabled
}
```
Provider interface (each file exports `create<Name>Provider(config) -> Provider`):
```js
Provider = {
  name: 'openrouter' | 'openai' | 'selfhosted' | 'fal' | 'mock',
  configured(): boolean,

  // TEXT. Async generator. Yields:
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
  (`prompt_field`, `max_chars`, `openrouter_provider`, `reasoning`) and generic hints (`aspect`, mapped
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
  placeholder restoration is visible), plus fake usage (tokens ≈ chars/4, `costUsd: null`).
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
include API keys or full upstream bodies in messages.

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
createClassifier({ config, db, providers, redactor? })
  .classify({ text /* already redacted */, history /* last few redacted messages, optional */,
              redactionCounts, signal, zdrOnly /* strict privacy: ZDR/self-hosted classifier only */ })
  -> Promise<{ job, difficulty, private: bool, output: { length, format, duration_s?, aspect? },
               title /* <= 6 words */, classifierModel /* models.id | 'heuristic' */,
               usage: { inputTokens, outputTokens, costMicros } }>
heuristicClassify(text, redactionCounts) -> same shape (no usage cost)
CLASSIFIER_SYSTEM_PROMPT   // exported; the mock provider detects it
```
The LLM classifier uses `providers.get(model.gateway).completeJSON`, model = the first enabled +
available of `[config.router.classifierModelId, ...CLASSIFIER_MODEL_CANDIDATES]` (falls back to heuristic if unavailable,
on timeout (4 s), or on invalid JSON). Output is validated and clamped. `private` is true if the
LLM says so OR `redactor.isSensitive(redactionCounts)` OR heuristic keywords (password, diagnosis,
salary, bank statement, tax return, lawsuit, medical, …). Cost of the call is computed from the
model's prices when the provider does not report it.

pick.js:
```js
createPicker({ db, config, providers })
  .pick({ job, difficulty, private, user /* {plan, strict_privacy, eu_only} */,
          pins /* conversation pins */, overrideModelId /* user switch or manual pick */ })
  -> { model /* Model */, tier, effort, pinned: bool, zdrRequired: bool, reason: string,
       pinsUpdate /* new pins object to store, or null */,
       private: bool /* effective privacy: classified OR sticky (an earlier private turn) */ }
  // throws AppError(409,'private_blocked') or AppError(503,'no_model')
  .candidates({ job, user, private, pins }) -> Model[]  // eligible + available models for the switch
                                                         // menu, sorted quality-first; includes alternates
```
Rules, in order:
1. `action` jobs route as `chat` (phase 1).
2. Eligibility filters: model enabled, `providers.isAvailable(model)`, job in model.jobs;
   `strict_privacy` or `private` → model.zdr or model.self_hosted (exception: a `private`, non-strict
   MEDIA request may use that job's `private` route cell, see "Private media"); `eu_only` and TEXT
   job → region 'eu' or 'self'.
3. `overrideModelId` (must be eligible, else 400 bad_request) → use it, pin it `{source:'user'}`.
4. `private` → the `private` tier route if eligible. If not (self-hosted not configured):
   `config.router.privateFallback === 'block'` → throw private_blocked; else use the normal tier's
   route if it is ZDR, otherwise the best ZDR candidate (walk quality→balanced→budget routes, then
   any ZDR candidate). zdrRequired = (private or strict_privacy) and the model is ZDR/self-hosted,
   so the 🔒 badge and the gateway's ZDR filter are never claimed for a model that can't honour them.
5. Pinned model for this job (`pins[job]`) is reused when still eligible, unless the pin is
   `source:'auto'` and the newly chosen tier ranks higher (upgrade only, never downgrade).
   User pins never auto-change.
6. Otherwise tier = `chooseTier`; model = routes[job][tier] if eligible; else walk other tiers
   (nearest first), then the cheapest eligible candidate; none → no_model.
7. effort = route.effort_override ?? difficultyToEffort(difficulty); `'none'` if the model lacks
   reasoning support or the job is media.
8. pinsUpdate: set `pins[job] = { model_id, tier, source }` when it changed.

Private media: no media model is zero-retention (fal keeps queue payloads and serves public result
URLs; OpenAI images need approval for ZDR). A `private` media request (classified private, or a
conversation that was private before) uses the job's `private` route cell (the budget pick in the
seed); the pipeline sends it only the latest text, generically redacted ("a person", "an email
address"), and the result is NOT zero-retention (`zdrRequired: false`, no 🔒). `strict_privacy` has
no such exception: a strict-privacy media request ends in `409 private_blocked` ("Strict privacy is on
and no model that meets it is available for image.").

learn.js:
```js
computeStats(db, { sinceMs }) -> [{ job, model_id, n, up, down, regenerated, overridden,
                                    avg_cost_micros, avg_latency_ms, score }]
  // score = (up + 1) / (up + down + regenerated + overridden + 2)   (Laplace-smoothed satisfaction)
proposeRoutes(db, { minSamples, sinceMs }) -> [{ job, tier, current_model_id, proposed_model_id,
                                                 reason, current_score, proposed_score }]
  // quality: best score (ties -> cheaper); budget: cheapest with score >= current budget score - 0.02;
  // balanced: maximise score - 0.15 * normalised cost. Only models with n >= minSamples on both sides
  // (or the current pick has no data). Never touches the private tier.
applyProposals(db, proposals, { source = 'learn' }) -> number   // writes routes + route_history
gateMetrics(db, { sinceMs }) -> { users, auto_pick_on_pct, override_rate, requests, api_cost_usd,
                                  charged_usd, gross_margin_pct, thumbs_up_rate }
```

## Billing — src/billing/

credits.js — `createCredits(db, config)`:
```js
balance(userId) -> micros
priceFor(apiCostMicros) -> chargedMicros          // ceil(api * (1 + margin)), 0 -> 0
estimateApiCostMicros({ model, inputTokens, maxOutputTokens, units }) -> micros
reserve(userId, estimateChargedMicros) -> { holdId, amount }
  // balance <= 0 -> AppError(402,'insufficient_credits'). hold = min(estimate, balance).
  // Inserts holds row + ledger 'hold' (-amount); users.balance_micros -= amount. Atomic.
settle(holdId, chargedMicros, ref) -> { balance }
  // ledger 'release' (+hold), ledger 'charge' (-charged), delete hold. Balance may go slightly
  // negative if actual > hold; the next reserve then fails until topped up.
release(holdId) -> void                            // full refund of the hold (errors/aborts)
grant(userId, micros, kind, ref) -> { balance, duplicate: bool }
  // kind: signup_bonus | purchase | dev_topup | admin_adjust. purchase is idempotent per ref.
ledger(userId, { limit = 50 }) -> rows
releaseStaleHolds(maxAgeMs = 15 * 60 * 1000) -> n  // crash safety, called at boot
```
Invariant: `users.balance_micros == SUM(ledger.delta_micros WHERE user_id = ?)`.

stripe.js — `createStripe(config, credits, db)`:
```js
enabled: boolean
createCheckout({ user, packUsd }) -> Promise<{ url, id }>
  // POST {stripeApiBase}/v1/checkout/sessions, form-encoded, mode=payment, inline price_data,
  // client_reference_id=user.id, metadata[user_id], metadata[credit_micros], success/cancel URLs
  // under config.publicUrl. packUsd must be one of config.billing.packsUsd.
  // Credits granted = packUsd (the margin is applied when spending, not when buying).
verifyWebhook(rawBody /* Buffer */, signatureHeader) -> event   // HMAC-SHA256, 300 s tolerance,
                                                                // timing-safe; throws 400 on failure
handleEvent(event) -> { handled: bool, duplicate: bool }
  // checkout.session.completed with payment_status 'paid', and
  // checkout.session.async_payment_succeeded -> credits.grant(purchase, ref = session.id).
  // Idempotent via stripe_events + the ledger unique index.
```

## Auth — src/auth.js

```js
createAuth({ db, config, keyring, credits })
  .signup({ email, password }) -> user      // email normalised lower-case; password >= 8 chars;
                                            // new wrapped DEK; first user or ADMIN_EMAILS -> admin;
                                            // grants signup bonus (credits.grant 'signup_bonus')
  .login({ email, password }) -> user       // AppError(401) on mismatch (same message either way)
  .createSession(userId) -> token           // stores sha256(token)
  .destroySession(token)
  .userFromToken(token) -> user | null
  .middleware()     // express: reads cookie 'gode_session', sets req.user (or null)
  .requireUser      // express middleware: 401 JSON if no req.user
  .requireAdmin     // express middleware: 403 unless req.user.is_admin
  .setCookie(res, token) / .clearCookie(res)
  .deleteEverything(userId)  // deletes the user (cascades sessions/conversations/messages/
                             // requests/holds) and nulls ledger.user_id, forgets the DEK. Atomic.
publicUser(row) -> { id, email, plan, strict_privacy, eu_only, auto_pick, share_prompts, is_admin,
                     balance_usd, created_at }
securityHeaders(config)  // express middleware: CSP (default-src 'self'; script-src 'self' only, no
                   // 'unsafe-eval' and no 'unsafe-inline'; style-src 'self' 'unsafe-inline';
                   // img/media from self data: blob: https:; form-action self + Stripe Checkout),
                   // X-Frame-Options DENY, nosniff, Referrer-Policy, HSTS in production
rateLimit({ windowMs, max, key }) // small in-memory limiter middleware (429 rate_limited)
requireSameOrigin  // for state-changing /api requests: if Origin header present it must match host
```
Cookie: `gode_session`, HttpOnly, SameSite=Lax, Path=/, Secure when `config.cookieSecure`,
Max-Age = sessionDays.

## Chat pipeline — src/chat/pipeline.js

```js
createPipeline({ db, config, keyring, redactor, classifier, picker, providers, credits, logger? })
  .run({ user /* users row or id; re-read from the DB */, conversationId /* null -> new chat */, text,
         mode /* 'auto'|'manual'|'regenerate'|'switch' */, modelId /* manual or switch target */,
         targetMessageId /* regenerate/switch: assistant msg */, emit /* (event, data) => void */, signal })
  -> Promise<void>   // never rejects for request-level failures (they end in an `error` event);
                     // throws TypeError only when emit is not a function
// Also exported: formatChip, formatCost, chipFor, sessionIdFor, buildSystemPrompt, historyContent,
// estimateMediaUnits, expectedOutputTokens, providerCostMicros, PLACEHOLDER_NOTE, MODES.
```
Steps (auto/manual):
1. Load the user row and, for an existing chat, the conversation (owned by the user, else 404): pins
   (plain JSON), the decrypted placeholder map and the last `config.router.historyMessages`
   non-superseded messages. A NEW conversation is not written yet (see step 6).
2. Early credit check: balance <= 0 → `insufficient_credits` before any redaction or classifier call
   (no requests row). Then redact (unless `config.privacy.redaction` is off): history + new text with
   the conversation map.
3. Classify the redacted latest text (+ 4 most recent redacted messages as context), with
   `zdrOnly: Boolean(user.strict_privacy)`.
4. Pick. `manual` mode passes `modelId` as `overrideModelId`; if that model can't do the classified
   job, the job falls back to `chat` (or the model's own job): "draw a cat" sent to a text model is
   answered as chat. Eligibility (enabled, available, privacy, EU) is still enforced by the picker.
5. For self-hosted models with `redactSelfHosted` off, send the unredacted messages (decided by
   `model.self_hosted`). Then route/requests `redactions` are `{}` (nothing was hidden from that
   model), the placeholder note is left out and stream restoration is a passthrough.
6. Estimate the hold: `credits.priceFor(estimateApiCostMicros({ model, inputTokens,
   maxOutputTokens: MAX_OUTPUT_TOKENS }) + classifierCost)` (media: units from catalog params). A
   voice model with `params.max_chars` refuses longer text here (400), before any hold. In ONE
   transaction: `credits.reserve`, the conversation row if new, the user message (encrypted), the
   map, and the title when the chat has none (`sanitizeTitle` → `redactor.restore` → encrypted;
   `WHERE title_enc IS NULL`, so a rename wins). Emit `route`.
7. TEXT: stream via provider (pass `sessionId` = first 32 hex chars of
   sha256(`gode-session:` + conversation id) — opaque, never identifies the user); feed deltas through
   `createStreamRestorer(map)`; emit `delta` per safe chunk. At the end, `filterResponse` (unless
   `RESPONSE_FILTER=off`); if anything was masked emit `replace { text }`. A stream that ends without
   a usage event is billed from estimated tokens, never as zero.
   MEDIA: build the media prompt with `redactMessages(..., { mode: 'generic' })` on the latest
   text only; `generateMedia` with `params { aspect }` (from the classifier) and onProgress → emit
   `progress`; then emit `media` per item.
8. Cost: provider-reported costUsd, else computed from model prices (tokens × price_in/price_out,
   outputTokens already include reasoning; or units × price_per_unit) + classifier cost. Unknown prices
   count as 0 (one warning per model id). charged = `credits.priceFor(api)`.
9. In ONE transaction: `credits.settle`, the assistant message (encrypted `{ text, media }`), the
   `requests` row (metadata only, redaction counts), merged pins, map, supersede (regenerate/switch),
   conversation updated_at. A failed write rolls the charge back and the error path releases the hold.
   If the hold vanished (stale-hold sweep) the answer is stored uncharged with a warning; if the
   account was deleted mid-answer nothing is stored (`not_found`). Emit `done`.
10. On any error: `credits.release`, log the request with status 'error' + error_code (once
    classification ran), emit one `error { error, code }`. Abort (client disconnect, `signal`)
    counts as error 'aborted' but charges for tokens already produced when the provider reported
    them (else release). AppError messages pass through; anything else becomes
    `{ error: 'Something went wrong.', code: 'internal' }`, logged as
    `[pipeline] <request id> failed: internal (<ErrorName>)`. Expected codes are not logged
    (aborted, bad_request, not_found, insufficient_credits, private_blocked); other codes log
    `[pipeline] <request id> failed: <code>`. emit() is wrapped so a throwing writer can't break billing.

regenerate: the target must be the user's own non-superseded assistant message (404 not owned, 400
a user message, 409 already superseded) → its parent user message; reuse the original request's job,
difficulty, private; pick with the conversation's real pins (keeps the pinned model); mark the old
request `regenerated = 1` right after validation (a feedback signal even if the new call fails);
history = the non-superseded messages before the parent question. The old message is marked
`superseded = 1` only in the success transaction, and the new answer keeps the old answer's
`created_at` so it stays in place. New request kind 'regenerate'. No new user message, no re-classify.
switch: same, but with `modelId` as override (pins `{source:'user'}`), old request `overridden = 1`,
kind 'switch'.

Decisions (as implemented in `src/chat/pipeline.js`; the code is the reference):
- **Redaction counts cover the new text only.** History + new text are redacted together with the
  conversation map (stable placeholders across turns), then the latest message alone is redacted
  again with the resulting map. Its counts feed the classifier's `redactionCounts`, the route event's
  `redactions`, the "N personal details hidden" note and `requests.redactions`; old messages are not
  counted again every turn. Media prompts report the counts of their generic redaction. Redaction
  always runs on REAL text (decrypted history), never on already-redacted text.
- **System prompt placeholder note.** Text jobs get a short system message (date; the `action`
  note for action jobs). Only when redacted text is sent and the map holds entries, it adds
  `PLACEHOLDER_NOTE`: treat `[PERSON_1]`-style placeholders as the real values, keep them verbatim,
  never ask what they stand for. Nothing in the system prompt identifies the user.
- **Classifier and strict privacy.** `classify` gets `zdrOnly: Boolean(user.strict_privacy)`, so a
  strict-privacy prompt never reaches a non-ZDR classifier model (falls back to the heuristic when
  none is available). The classifier sees redacted text plus the 4 previous redacted messages.
- **No ghost conversations.** A new conversation row is written in the same transaction as its
  first user message and the credit hold, after redaction, classification and picking succeeded. A
  failure before that leaves nothing behind, and its `error` event carries no `conversation_id`.
- **Retry dedupe.** When the latest stored message is a user message with no live answer and the
  same text (a retry after Stop or an error), it is reused instead of stored twice.
- **Supersede only on success.** For regenerate/switch, the old answer is marked `superseded` in
  the same transaction that settles credits and stores the new answer. A failed or stopped
  regenerate leaves the old answer visible; a target already superseded gives `409 conflict`.
- **Abort semantics** (client disconnect → `signal`): error code `aborted`, message "Stopped.". If
  the client left before the credit hold, nothing is reserved or stored. After it, a partial text
  answer is not stored; the hold is released, unless the provider already reported usage, which is
  then charged. A media result that already finished is kept (it was paid for upstream). A
  `requests` row with status `error` is written once classification ran.
- Text answers stream through `createStreamRestorer(map)`; `filterResponse` runs on the restored
  text and `replace` is emitted only when something was masked. `zdr: pick.zdrRequired` and the
  opaque `sessionId` go to `streamChat`. Self-hosted models get the real text unless
  `REDACT_SELF_HOSTED` is on.

SSE events (`emit(event, data)`), all `data` JSON:
```
route    { request_id, conversation_id, user_message_id, message_id, job, difficulty, private, tier,
           model: { id, label, vendor, region }, effort, pinned, zdr, redactions: {TYPE:n},
           est_cost_usd, title? /* first exchange only */, replaces_message_id? /* regenerate/switch */ }
delta    { text }
replace  { text }                                  // full replacement (response filter fired)
progress { status, position? }                     // media queue
media    { type, url, mime? }
done     { message_id, request_id, conversation_id, cost_usd, api_cost_usd, input_tokens,
           output_tokens, media_units, balance_usd, chip: "Claude Opus 5.5 · high effort · $0.04" }
           // input/output_tokens are null for media jobs, media_units is null for text jobs
error    { error, code, conversation_id? /* the chat exists in the DB */, request_id? /* a requests
                                           row was written */ }
```
`est_cost_usd` is a TYPICAL estimate for the live chip (expected output for the classifier's length
short/medium/long plus a reasoning allowance by effort, capped at MAX_OUTPUT_TOKENS), not the hold;
the hold always covers the full MAX_OUTPUT_TOKENS.

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
                                       redaction, presidio, selfhosted, private_fallback}}
PATCH  /api/me                     {plan?, strict_privacy?, eu_only?, auto_pick?, share_prompts?} -> {user}
DELETE /api/me                     {password} -> {ok}                    (delete everything)

GET    /api/conversations          -> {conversations:[{id,title,updated_at}]}
POST   /api/conversations          -> {conversation:{id,title,updated_at}}
GET    /api/conversations/:id      -> {conversation:{id,title,pins}, messages:[Message]}
PATCH  /api/conversations/:id      {title} -> {ok}
DELETE /api/conversations/:id      -> {ok}
  Message = { id, role, text, media:[...], created_at, parent_id,
              request?: { id, job, tier, model_id, model_label, effort, cost_usd, chip, private,
                          zdr, redactions, feedback, pinned, status } }

POST   /api/chat                   {conversation_id?, text, model_id?}  -> SSE (text/event-stream)
                                   model_id honoured only when user.auto_pick is off (mode 'manual')
POST   /api/messages/:id/regenerate                 -> SSE
POST   /api/messages/:id/switch    {model_id}       -> SSE
POST   /api/messages/:id/feedback  {value: 1|-1|0}  -> {ok}
GET    /api/models?job=chat[&conversation_id=]       -> {models:[{id,label,vendor,region,zdr,self_hosted,
                                                       price_in,price_out,price_unit,price_per_unit,
                                                       supports_reasoning}]}  (eligible candidates)
GET    /api/transparency?limit=50  -> {requests:[{id,created_at,job,tier,model_label,gateway,
                                       upstream_provider,zdr,private,redactions,cost_usd,status}]}
GET    /api/public/providers       -> {models:[{label,vendor,region,gateway,jobs,zdr,self_hosted,
                                       retention_note}], redaction:{presidio:bool}}  (no auth)

GET    /api/billing/ledger         -> {balance_usd, entries:[{kind,delta_usd,created_at}]}
POST   /api/billing/checkout       {pack_usd} -> {url}
POST   /api/billing/webhook        (raw body, Stripe-Signature) -> {received:true}
POST   /api/billing/dev-topup      {usd} -> {balance_usd}   (only when config.billing.allowDevTopup)

GET    /api/admin/routing          -> {models:[Model], routes:[Route], classifier_model_id}
PUT    /api/admin/routes/:job/:tier {model_id, effort_override?} -> {ok}
POST   /api/admin/models           Model -> {ok}           (create)
PUT    /api/admin/models/:id       partial Model -> {ok}   (id with ':' and '/' is URL-encoded)
GET    /api/admin/stats?days=28    -> {gate: gateMetrics, models: computeStats}
POST   /api/admin/learn            {apply?: bool} -> {proposals, applied}
GET    /api/admin/catalog/export   -> {models, routes}
POST   /api/admin/catalog/import   {models, routes} -> {ok}
```
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
  `auth.requireSameOrigin` the configured instance. Limits: signup+login 20 per 15 min per IP and 10 per
  15 min per email; chat/regenerate/switch 30 per minute per user; DELETE /api/me 10 per 15 min per user.
- Unknown body fields are a 400 on every route. Chat text is trimmed, 1..32,000 characters.
- Status 201 for signup, POST /api/conversations and POST /api/admin/models; everything else 200.
- Extra response fields: transparency rows also carry `kind, model_id, effort, error_code`; the
  ledger takes `?limit=1..500` (default 50) and `?all=1` (include hold/release rows), and entries carry
  `id`; conversation objects carry `updated_at`; public providers adds `redaction.enabled`; admin
  stats adds `days`; learn also accepts `{ days, min_samples }`; catalog import returns
  `{ ok, models, routes }` and is validated in full (models, params, routes) before anything is written.
- PUT /api/admin/routes: an omitted `effort_override` keeps the cell's value, null clears it; the value
  must be none/low/medium/high (EFFORT_RANK also lists minimal/xhigh/max, which a cell can't hold).
  A private-tier cell for a text job must be zdr or self-hosted.
- DELETE /api/conversations/:id removes the messages and the conversation; `requests` rows stay (metadata,
  the billing and transparency record).
- `app.locals.shutdown({ timeoutMs })` sends each running stream `error { code: 'interrupted' }`,
  aborts its pipeline (holds are released while the DB is still open) and waits for it;
  `server.js` close(): server.close → closeIdleConnections → shutdown → wait ≤ 10 s → db.close().

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
message list (markdown-lite rendering with code blocks; images/video/audio), composer (Enter sends,
Shift+Enter newline; when auto-pick is off, a model select). Each assistant message has the chip
(`Claude Opus 5.5 · high effort · $0.04`) with a switch dropdown (candidates from /api/models for that
job), 👍 / 👎, ↻ regenerate, a 🔒 badge when private/ZDR, and "N personal details hidden from the
model" when redactions > 0. Streaming via `fetch` + ReadableStream SSE parsing.

Settings: plan (Saver / Balanced / Best), auto-pick, strict privacy, EU-only, share prompts
(opt-in), transparency log, delete everything (password confirm). Billing: balance, packs →
Stripe Checkout redirect, dev top-up (when enabled), ledger. Admin: routing grid (jobs × tiers,
model select + effort override), model catalog editor (price, zdr, enabled), gate metrics + per-model
stats, learn proposals with Apply, export/import JSON.

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
`openrouter/auto` (same redacted prompt); records model, cost, latency, tokens; a judge model compares
the two answers pairwise in randomised order → A/B/tie (`bench/judge.js`). Media prompts are classified
and then skipped (counted). Writes `results-<timestamp>.json` and `summary-<timestamp>.md`; the numbers
come from `bench/stats.js` (pure, unit-tested functions: win/tie/loss, total + paired per-prompt cost,
latency p50/p95 and TTFT, per-job breakdown, classifier agreement, redaction counts). Exit code 2 = a
configuration problem; per-prompt failures are recorded in the report and never fail the run. Live
runs need `OPENROUTER_API_KEY` (the baseline) plus keys for the judge's and the routed gateways.
`bench/prompts.jsonl` ships 200 realistic seed prompts (`{id, prompt, job_hint}`);
`scripts/export-bench-prompts.js` exports real prompts only from users with `share_prompts = 1`,
redacted.

## Learning — scripts/learn.js

`node scripts/learn.js [--days 28] [--apply]` prints gate metrics + proposals; `--apply` writes them.
Run weekly from cron (documented in README).

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
config, client() }`. `test/integration.test.js` runs whole flows through the HTTP API in mock mode and
with the real adapters against mock-upstream. `npm run e2e` (`e2e/smoke.js`) drives the real
`node server.js` in Chromium through every screen at 1280×820 and 375×812 and fails on console errors
or unexpected server log lines; Playwright is installed separately (not an npm dependency).

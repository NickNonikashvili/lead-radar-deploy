// Stripe Checkout for prepaid credit packs, without the Stripe SDK.
//
// Flow: createCheckout -> the user pays on Stripe's hosted page -> Stripe POSTs a signed webhook ->
// verifyWebhook checks the signature on the RAW body -> handleEvent grants the credits once.
// Credits are bought 1:1 (a $5 pack buys $5 of credit); the margin is applied when credits are spent.
const crypto = require("crypto");
const { now, AppError, safeJsonParse } = require("../util");

// Pinned so request/response shapes don't change under us when the account default moves.
// Confirmed current in Stripe's versioning docs (Nov 2026 research); the webhook endpoint's own API
// version should be pinned to the same value in the Stripe Dashboard.
const STRIPE_API_VERSION = "2026-09-30.endive";
const SIGNATURE_TOLERANCE_SEC = 300; // Stripe's libraries default to 5 minutes.
const REQUEST_TIMEOUT_MS = 15_000;
// Stripe amounts are in the currency's minor unit. Credits are micro-USD, and with a two-decimal
// currency one minor unit (a cent) is exactly 10,000 micros.
const MICROS_PER_MINOR_UNIT = 10_000;
const FULFILMENT_EVENTS = new Set(["checkout.session.completed", "checkout.session.async_payment_succeeded"]);
// Marks our own Checkout Sessions. Informational for now: sessions created before it existed live
// up to 24 h, so the webhook relies on metadata.user_id + metadata.credit_micros (which a Payment
// Link URL cannot set) matching the amount paid. Not on the amount being one of the CURRENT packs:
// a pack removed while its Checkout Session was open (up to 24 h) must still be credited.
const SESSION_MARKER = "credit_pack";
// Stripe's zero- and three-decimal currencies. A pack price in these would be off by 100x or 10x.
const NOT_TWO_DECIMAL = new Set(
  "bif clp djf gnf jpy kmf krw mga pyg rwf ugx vnd vuv xaf xof xpf bhd jod kwd omr tnd".split(" ")
);

function badRequest(message) {
  return new AppError(400, "bad_request", message);
}

function upstreamError(message) {
  return new AppError(502, "upstream_error", `stripe: ${message}`);
}

/** "$5" for whole dollars, "$2.50" otherwise. */
function formatPack(usd) {
  return Number.isInteger(usd) ? String(usd) : usd.toFixed(2);
}

/** Parse "t=...,v1=...,v1=...,v0=..." keeping only t and every v1 (the rest is unsigned metadata). */
function parseSignatureHeader(header) {
  if (typeof header !== "string" || header === "") throw badRequest("Missing Stripe-Signature header");
  let timestamp = null;
  const signatures = [];
  for (const item of header.split(",")) {
    const eq = item.indexOf("=");
    if (eq < 0) continue;
    const key = item.slice(0, eq).trim();
    const value = item.slice(eq + 1).trim();
    if (key === "t" && timestamp === null && /^\d{1,12}$/.test(value)) timestamp = Number(value);
    else if (key === "v1" && value) signatures.push(value);
  }
  if (timestamp === null) throw badRequest("Stripe-Signature has no valid timestamp");
  if (signatures.length === 0) throw badRequest("Stripe-Signature has no v1 signature");
  return { timestamp, signatures };
}

/**
 * @param {object} config  full app config (uses config.billing and config.publicUrl)
 * @param {ReturnType<import('./credits').createCredits>} credits
 * @param {ReturnType<import('../db').openDb>} db
 * @param {{ log?: { warn: Function } }} [options]  log: where anomalies go (default console)
 */
function createStripe(config, credits, db, { log = console } = {}) {
  const billing = config.billing;
  const secretKey = billing.stripeSecretKey || "";
  const webhookSecret = billing.stripeWebhookSecret || "";
  const currency = String(billing.currency || "usd").toLowerCase();
  // Both keys are needed: without the webhook secret we could take a payment but never verify the
  // event that grants the credits.
  const enabled = Boolean(secretKey && webhookSecret);
  if (secretKey && !webhookSecret) {
    log.warn("stripe: STRIPE_SECRET_KEY is set but STRIPE_WEBHOOK_SECRET is not; payments stay disabled");
  }

  const stmt = {
    insertEvent: db.prepare("INSERT OR IGNORE INTO stripe_events (id, type, created_at) VALUES (?, ?, ?)"),
    userExists: db.prepare("SELECT 1 AS found FROM users WHERE id = ?"),
  };

  function warn(message, event, session) {
    // Stripe ids only: never user ids, emails or amounts tied to a person.
    log.warn(`stripe: ${message} (event ${event.id}${session?.id ? `, session ${session.id}` : ""})`);
  }

  /** Error text safe to show and log: never the secret key, whatever Stripe echoes back. */
  function describeError(status, body) {
    if (status === 401) return "authentication failed (check STRIPE_SECRET_KEY)";
    if (status === 403) return "permission denied (the key cannot create Checkout Sessions)";
    if (status === 429) return "rate limited, try again shortly";
    const raw = typeof body?.error?.message === "string" ? body.error.message : `HTTP ${status}`;
    let msg = raw.replace(/\b(?:sk|rk|pk)_(?:test|live)_[A-Za-z0-9*]+/g, "[key]").replace(/\bwhsec_[A-Za-z0-9*]+/g, "[key]");
    if (secretKey) msg = msg.split(secretKey).join("[key]");
    return msg.length > 200 ? `${msg.slice(0, 200)}...` : msg;
  }

  async function postForm(path, form) {
    let res;
    let text;
    try {
      res = await fetch(`${billing.stripeApiBase}${path}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${secretKey}`,
          "Content-Type": "application/x-www-form-urlencoded",
          "Stripe-Version": STRIPE_API_VERSION,
        },
        body: form.toString(),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      text = await res.text();
    } catch (err) {
      throw upstreamError(err?.name === "TimeoutError" ? "request timed out" : "unreachable");
    }
    const body = safeJsonParse(text, null);
    if (!res.ok) throw upstreamError(describeError(res.status, body));
    if (!body || typeof body !== "object") throw upstreamError("invalid response");
    return body;
  }

  function findPack(packUsd) {
    const n = typeof packUsd === "string" && packUsd.trim() !== "" ? Number(packUsd) : packUsd;
    const pack = billing.packsUsd.find((p) => p === n);
    if (pack === undefined) throw badRequest(`Unknown credit pack. Choose one of: ${billing.packsUsd.join(", ")} USD`);
    return pack;
  }

  async function createCheckout({ user, packUsd } = {}) {
    if (!enabled) throw new AppError(503, "gateway_not_configured", "Payments are not configured");
    if (!user || typeof user.id !== "string" || user.id === "") {
      throw new AppError(401, "unauthorized", "Sign in to buy credits");
    }
    if (NOT_TWO_DECIMAL.has(currency)) {
      throw new AppError(503, "gateway_not_configured", "CURRENCY must be a two-decimal currency such as usd or eur");
    }
    const pack = findPack(packUsd);
    const amountMinor = Math.round(pack * 100);
    const form = new URLSearchParams([
      ["mode", "payment"],
      ["line_items[0][price_data][currency]", currency],
      ["line_items[0][price_data][product_data][name]", `Gode credits ($${formatPack(pack)})`],
      ["line_items[0][price_data][unit_amount]", String(amountMinor)],
      ["line_items[0][quantity]", "1"],
      ["success_url", `${config.publicUrl}/#/billing?paid=1`],
      ["cancel_url", `${config.publicUrl}/#/billing`],
      ["client_reference_id", user.id],
      ["metadata[user_id]", user.id],
      ["metadata[credit_micros]", String(amountMinor * MICROS_PER_MINOR_UNIT)],
      ["metadata[gode]", SESSION_MARKER],
    ]);
    const session = await postForm("/v1/checkout/sessions", form);
    if (typeof session.id !== "string" || typeof session.url !== "string") {
      throw upstreamError("response has no checkout URL");
    }
    return { url: session.url, id: session.id };
  }

  /**
   * Verify a webhook delivery and return the parsed event. rawBody must be the exact bytes Stripe
   * sent (express.raw, before any JSON parser), or the signature can't match.
   */
  function verifyWebhook(rawBody, signatureHeader) {
    if (!webhookSecret) throw new AppError(503, "gateway_not_configured", "Stripe webhook secret is not configured");
    let body;
    if (Buffer.isBuffer(rawBody)) body = rawBody;
    else if (typeof rawBody === "string") body = Buffer.from(rawBody, "utf8");
    else throw badRequest("Webhook needs the raw request body");

    const { timestamp, signatures } = parseSignatureHeader(signatureHeader);
    const expected = Buffer.from(
      crypto.createHmac("sha256", webhookSecret).update(`${timestamp}.`, "utf8").update(body).digest("hex"),
      "utf8"
    );
    // Any matching v1 is enough: during a secret roll Stripe signs with every active secret.
    const valid = signatures.some((sig) => {
      const candidate = Buffer.from(sig, "utf8");
      return candidate.length === expected.length && crypto.timingSafeEqual(candidate, expected);
    });
    if (!valid) throw badRequest("Invalid Stripe signature");
    // Replay protection. Like Stripe's libraries, only old timestamps are rejected (clock skew).
    if (Math.floor(now() / 1000) - timestamp > SIGNATURE_TOLERANCE_SEC) {
      throw badRequest("Stripe signature timestamp is outside the tolerance");
    }
    const event = safeJsonParse(body.toString("utf8"), null);
    if (!event || typeof event !== "object" || typeof event.id !== "string" || typeof event.type !== "string") {
      throw badRequest("Invalid Stripe event payload");
    }
    return event;
  }

  /**
   * Credit to grant for a paid session, or null. The amount comes from what was actually paid, and
   * must match the credit our checkout recorded in metadata: anything else is not one of our credit
   * packs (another product on the same Stripe account). It need not be one of today's CREDIT_PACKS:
   * the metadata already proves Gode created the session, and a customer who paid for a pack that
   * was removed while their Checkout Session was open is owed the credit (the event is marked as
   * seen, so a skipped payment could never be credited by a retry later).
   */
  function creditFromSession(event, session) {
    let minor = session.amount_total;
    const paidCurrency = session.currency ? String(session.currency).toLowerCase() : currency;
    if (paidCurrency !== currency) {
      // Older Adaptive Pricing sessions report the customer's currency and keep ours here.
      const conv = session.currency_conversion;
      if (!conv || String(conv.source_currency || "").toLowerCase() !== currency) {
        warn(`paid in ${paidCurrency}, expected ${currency}; no credit granted, adjust manually`, event, session);
        return null;
      }
      minor = conv.amount_total;
    }
    if (!Number.isSafeInteger(minor) || minor <= 0) {
      warn("paid session has no positive amount_total; no credit granted", event, session);
      return null;
    }
    const credit = minor * MICROS_PER_MINOR_UNIT;
    const claimed = session.metadata?.credit_micros;
    if (claimed === undefined || claimed === null || Number(claimed) !== credit) {
      warn("amount paid does not match the session's credit pack; no credit granted, check in Stripe", event, session);
      return null;
    }
    return credit;
  }

  /** Who to credit and how much, or null (already logged when it is an anomaly). */
  function planGrant(event, session) {
    if (session.mode && session.mode !== "payment") return null; // not one of our credit packs
    // A completed session paid by a delayed method (bank debit) is still 'unpaid': its money arrives
    // later as async_payment_succeeded, which is when the credits are granted.
    if (event.type === "checkout.session.completed" && session.payment_status !== "paid") return null;
    if (event.type === "checkout.session.async_payment_succeeded" && session.payment_status === "unpaid") {
      warn("async_payment_succeeded for an unpaid session; no credit granted", event, session);
      return null;
    }
    // metadata.user_id is required: our checkout always sets it, and unlike client_reference_id
    // (which a Payment Link takes from a URL parameter) a customer cannot set it.
    const metaUser = session.metadata?.user_id || null;
    const refUser = session.client_reference_id || null;
    const userId = metaUser;
    if (!userId || typeof userId !== "string") {
      warn("paid session has no metadata.user_id (not a Gode credit pack); no credit granted", event, session);
      return null;
    }
    if (refUser && metaUser !== refUser) {
      warn("metadata user_id and client_reference_id differ; no credit granted", event, session);
      return null;
    }
    if (!stmt.userExists.get(userId)) {
      warn("paid session for a deleted account; no credit granted, refund in Stripe if needed", event, session);
      return null;
    }
    const creditMicros = creditFromSession(event, session);
    return creditMicros === null ? null : { userId, creditMicros };
  }

  /** Apply a verified event once. Synchronous: the whole decision runs in one transaction. */
  function handleEvent(event) {
    if (!event || typeof event.id !== "string" || typeof event.type !== "string") {
      throw badRequest("Invalid Stripe event");
    }
    if (!FULFILMENT_EVENTS.has(event.type)) return { handled: false, duplicate: false };
    const session = event.data?.object;
    if (!session || typeof session !== "object" || typeof session.id !== "string") {
      throw badRequest("Stripe event has no checkout session");
    }
    // Recording the event and granting commit together: if the grant fails, the event is not
    // marked as seen, so Stripe's retry can apply it.
    return db.tx(() => {
      const recorded = stmt.insertEvent.run(event.id, event.type, now());
      if (recorded.changes === 0) return { handled: false, duplicate: true };
      const plan = planGrant(event, session);
      if (!plan) return { handled: false, duplicate: false };
      // ref = session id: completed + async_payment_succeeded for one session grant only once.
      const { duplicate } = credits.grant(plan.userId, plan.creditMicros, "purchase", session.id);
      return { handled: !duplicate, duplicate };
    });
  }

  return { enabled, createCheckout, verifyWebhook, handleEvent };
}

module.exports = { createStripe, parseSignatureHeader, STRIPE_API_VERSION, SIGNATURE_TOLERANCE_SEC };

// Billing: the credit ledger, Stripe Checkout, the Stripe webhook and the development top-up.
//
// The webhook is not on the router: it needs the raw request body for the signature check, so
// src/app.js mounts createWebhookHandler() with express.raw BEFORE express.json and the origin
// check (Stripe sends no Origin and no session cookie).
const express = require("express");
const { AppError, ah, microsToUsd, usdToMicros } = require("../util");
const { rateLimit } = require("../auth");
const { bodyObject, onlyKeys, numberField, intQuery, flagQuery, badRequest } = require("./validate");

// What a statement shows by default. Every request also writes a hold/release pair around its
// charge; those cancel out (an open hold is already reflected in the balance), so they are noise.
const STATEMENT_KINDS = ["purchase", "signup_bonus", "dev_topup", "admin_adjust", "charge"];
const LEDGER_DEFAULT = 50;
const LEDGER_MAX = 500;
const DEV_TOPUP_MAX_USD = 100;
// Each checkout is a real Stripe API write: per user, so one account cannot exhaust the operator's
// Stripe rate limit and block everyone else's purchases.
const CHECKOUT_LIMIT = Object.freeze({ windowMs: 15 * 60 * 1000, max: 10 });

/**
 * @param {object} ctx  app context (see src/app.js)
 */
function createBillingRoutes({ config, auth, credits, stripe, limiters = {}, rateLimits = {} }) {
  const router = express.Router();
  // src/app.js may provide this limiter (stopped on shutdown); otherwise the router owns one.
  const checkoutLimiter =
    limiters.checkout ||
    rateLimit({ ...CHECKOUT_LIMIT, ...(rateLimits.checkout || {}), key: (req) => (req.user ? `user:${req.user.id}` : null) });

  router.get("/billing/ledger", auth.requireUser, (req, res) => {
    const limit = intQuery(req.query.limit, "limit", { min: 1, max: LEDGER_MAX, dflt: LEDGER_DEFAULT });
    const all = flagQuery(req.query.all, "all");
    const rows = credits.ledger(req.user.id, { limit, kinds: all ? undefined : STATEMENT_KINDS });
    res.json({
      balance_usd: microsToUsd(credits.balance(req.user.id)),
      // Credit on hold for answers still running (already taken out of balance_usd).
      held_usd: microsToUsd(typeof credits.held === "function" ? credits.held(req.user.id) : 0),
      entries: rows.map((r) => ({ id: r.id, kind: r.kind, delta_usd: microsToUsd(r.delta_micros), created_at: r.created_at })),
    });
  });

  router.post(
    "/billing/checkout",
    auth.requireUser,
    checkoutLimiter,
    ah(async (req, res) => {
      const body = bodyObject(req);
      onlyKeys(body, ["pack_usd"]);
      const packs = config.billing.packsUsd;
      if (typeof body.pack_usd !== "number" || !packs.includes(body.pack_usd)) {
        throw badRequest(`pack_usd must be one of: ${packs.join(", ")}.`);
      }
      // 503 gateway_not_configured when payments are off (stripe.enabled needs both Stripe keys).
      const session = await stripe.createCheckout({ user: req.user, packUsd: body.pack_usd });
      res.json({ url: session.url });
    })
  );

  // Free test credit for local development. config.billing.allowDevTopup is never true in production.
  router.post("/billing/dev-topup", auth.requireUser, (req, res) => {
    if (!config.billing.allowDevTopup) throw new AppError(403, "forbidden", "Test credit is turned off on this server.");
    const body = bodyObject(req);
    onlyKeys(body, ["usd"]);
    const usd = numberField(body.usd, "usd", { min: 0, max: DEV_TOPUP_MAX_USD });
    const micros = usdToMicros(usd);
    if (usd <= 0 || micros < 1) throw badRequest(`usd must be more than 0 and at most ${DEV_TOPUP_MAX_USD}.`);
    const { balance } = credits.grant(req.user.id, micros, "dev_topup");
    res.json({ balance_usd: microsToUsd(balance) });
  });

  return router;
}

/**
 * POST /api/billing/webhook. Mounted by src/app.js behind express.raw, so req.body is a Buffer.
 * 200 {received:true} for every event we have dealt with: granted, ignored (other event types) or
 * already seen. A bad signature (400) or a failed grant (500, rolled back) is non-2xx so Stripe
 * retries the delivery.
 */
function createWebhookHandler({ stripe }) {
  return function stripeWebhook(req, res) {
    res.setHeader("Cache-Control", "no-store");
    const event = stripe.verifyWebhook(req.body, req.get("stripe-signature"));
    stripe.handleEvent(event);
    res.json({ received: true });
  };
}

module.exports = { createBillingRoutes, createWebhookHandler, STATEMENT_KINDS, DEV_TOPUP_MAX_USD, CHECKOUT_LIMIT };

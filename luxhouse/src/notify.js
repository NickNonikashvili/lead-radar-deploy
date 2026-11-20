"use strict";

/**
 * Optional notifications for new enquiries.
 *  - Email, when SMTP_HOST / MAIL_TO are configured.
 *  - A JSON webhook (Slack/Telegram bridge, Zapier, Make, a CRM…), when LEAD_WEBHOOK_URL is set.
 * A failed notification never loses the enquiry: it is already saved on disk.
 */

const config = require("./config");

let transport = null;

function mailer() {
  if (!config.smtp.host || !config.smtp.to) return null;
  if (!transport) {
    const nodemailer = require("nodemailer");
    transport = nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.secure,
      auth: config.smtp.user ? { user: config.smtp.user, pass: config.smtp.pass } : undefined,
    });
  }
  return transport;
}

const TYPE_LABEL = { viewing: "Viewing request", contact: "Contact message", valuation: "Valuation request" };

function lines(lead) {
  const out = [
    ["Type", TYPE_LABEL[lead.type] || lead.type],
    ["Name", lead.name],
    ["Phone", lead.phone],
    ["Email", lead.email],
    ["Language", lead.lang],
  ];
  if (lead.listing) out.push(["Residence", `${lead.listing.title} (${lead.listing.ref})`]);
  if (lead.date) out.push(["Preferred date", lead.date]);
  if (lead.subject) out.push(["Subject", lead.subject]);
  if (lead.property) {
    const p = lead.property;
    if (p.location) out.push(["Property location", p.location]);
    if (p.type) out.push(["Property type", p.type]);
    if (p.area) out.push(["Approx. area (m²)", p.area]);
    if (p.expectedPrice) out.push(["Expected price ($)", p.expectedPrice]);
  }
  if (lead.message) out.push(["Message", lead.message]);
  out.push(["Received", lead.createdAt]);
  return out.filter(([, v]) => v !== undefined && v !== null && v !== "");
}

async function sendEmail(lead) {
  const tx = mailer();
  if (!tx) return "skipped";
  const rows = lines(lead);
  const subject = `[${config.brand}] ${TYPE_LABEL[lead.type] || "Enquiry"} — ${lead.name}` + (lead.listing ? ` — ${lead.listing.ref}` : "");
  await tx.sendMail({
    from: config.smtp.from || config.smtp.user || config.smtp.to,
    to: config.smtp.to,
    replyTo: lead.email || undefined,
    subject,
    text: rows.map(([k, v]) => `${k}: ${v}`).join("\n"),
  });
  return "sent";
}

async function sendWebhook(lead) {
  if (!config.webhookUrl) return "skipped";
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(config.webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        brand: config.brand,
        text: lines(lead).map(([k, v]) => `${k}: ${v}`).join("\n"),
        lead,
      }),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`webhook responded ${res.status}`);
    return "sent";
  } finally {
    clearTimeout(timer);
  }
}

/** Fire all configured notifications; resolves with a per-channel result and never rejects. */
async function notify(lead) {
  const [email, webhook] = await Promise.allSettled([sendEmail(lead), sendWebhook(lead)]);
  const result = {
    email: email.status === "fulfilled" ? email.value : "failed",
    webhook: webhook.status === "fulfilled" ? webhook.value : "failed",
  };
  if (email.status === "rejected") console.error("[notify] email failed:", email.reason && email.reason.message);
  if (webhook.status === "rejected") console.error("[notify] webhook failed:", webhook.reason && webhook.reason.message);
  return result;
}

module.exports = { notify, lines };

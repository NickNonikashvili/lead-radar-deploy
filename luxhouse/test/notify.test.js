"use strict";

/**
 * Notification channels: a new enquiry is emailed over SMTP and posted to a webhook.
 * Both are exercised against local servers started by the test.
 */

const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const { SMTPServer } = require("smtp-server");

const mails = [];
const hooks = [];
let smtp;
let hookServer;
let notify;

before(async () => {
  smtp = new SMTPServer({
    authOptional: true,
    disabledCommands: ["STARTTLS"],
    onData(stream, session, callback) {
      let raw = "";
      stream.on("data", (c) => (raw += c));
      stream.on("end", () => {
        mails.push({ raw, from: session.envelope.mailFrom.address, to: session.envelope.rcptTo.map((r) => r.address) });
        callback();
      });
    },
  });
  await new Promise((resolve) => smtp.listen(0, "127.0.0.1", resolve));

  hookServer = http.createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      hooks.push({ type: req.headers["content-type"], body: JSON.parse(body) });
      res.end("ok");
    });
  });
  await new Promise((resolve) => hookServer.listen(0, "127.0.0.1", resolve));

  process.env.SMTP_HOST = "127.0.0.1";
  process.env.SMTP_PORT = String(smtp.server.address().port);
  process.env.SMTP_SECURE = "false";
  process.env.MAIL_FROM = "site@luxhouse.test";
  process.env.MAIL_TO = "sales@luxhouse.test";
  process.env.LEAD_WEBHOOK_URL = `http://127.0.0.1:${hookServer.address().port}/hook`;
  delete process.env.SMTP_USER;
  ({ notify } = require("../src/notify"));
});

after(async () => {
  await new Promise((resolve) => smtp.close(resolve));
  await new Promise((resolve) => hookServer.close(resolve));
});

test("a new enquiry is emailed and posted to the webhook", async () => {
  const lead = {
    id: "1",
    createdAt: "2026-11-20T10:00:00.000Z",
    type: "viewing",
    lang: "ka",
    name: "ნინო ბერიძე",
    phone: "+995 555 12 34 56",
    email: "nino@example.com",
    message: "გამარჯობა",
    date: "2026-12-01",
    listing: { slug: "dighomi-stone-villa", ref: "LH-1003", title: "Stone Villa with Pool & Gardens" },
  };
  const result = await notify(lead);
  assert.deepEqual(result, { email: "sent", webhook: "sent" });

  assert.equal(mails.length, 1);
  assert.equal(mails[0].from, "site@luxhouse.test");
  assert.deepEqual(mails[0].to, ["sales@luxhouse.test"]);
  assert.match(mails[0].raw, /Reply-To: nino@example\.com/i);
  assert.match(mails[0].raw, /LH-1003/);

  assert.equal(hooks.length, 1);
  assert.match(hooks[0].type, /application\/json/);
  assert.equal(hooks[0].body.lead.name, "ნინო ბერიძე");
  assert.ok(hooks[0].body.text.includes("Preferred date: 2026-12-01"));
  assert.ok(hooks[0].body.text.includes("Stone Villa with Pool & Gardens (LH-1003)"));
});

test("a failing channel is reported but never throws", async () => {
  await new Promise((resolve) => hookServer.close(resolve));
  const result = await notify({ id: "2", createdAt: "2026-11-20T10:05:00.000Z", type: "contact", lang: "en", name: "Test", email: "t@example.com" });
  assert.equal(result.email, "sent");
  assert.equal(result.webhook, "failed");
  hookServer = http.createServer((req, res) => res.end("ok"));
  await new Promise((resolve) => hookServer.listen(0, "127.0.0.1", resolve));
});

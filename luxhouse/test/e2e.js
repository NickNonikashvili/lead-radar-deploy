"use strict";

/**
 * Browser end-to-end check. Drives the real pages in Chromium.
 *
 *   npm run test:e2e
 *
 * Needs Playwright (`npm i -D playwright && npx playwright install chromium`)
 * unless it is already available on the machine.
 */

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const http = require("node:http");
const assert = require("node:assert/strict");

const DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "luxhouse-e2e-"));
process.env.DATA_DIR = DATA_DIR;
process.env.ADMIN_PASSWORD = "e2e-password";
delete process.env.SMTP_HOST;
delete process.env.LEAD_WEBHOOK_URL;

let chromium;
try {
  ({ chromium } = require("playwright"));
} catch (e) {
  console.error("Playwright is not installed. Run: npm i -D playwright && npx playwright install chromium");
  process.exit(2);
}

const app = require("../server");
const config = require("../src/config");
const listings = require("../src/listings");

const results = [];
async function step(name, fn) {
  try {
    await fn();
    results.push({ name, ok: true });
    console.log("  ok   " + name);
  } catch (err) {
    results.push({ name, ok: false, err });
    console.log("  FAIL " + name + "\n       " + String(err && err.message).split("\n").join("\n       "));
  }
}

(async () => {
  const server = http.createServer(app);
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch();

  // Console errors and failed requests are test failures (map tiles may be blocked offline and are ignored).
  const problems = [];
  const watch = (page) => {
    page.on("pageerror", (e) => problems.push(`${page.url()} pageerror: ${e.message}`));
    page.on("console", (m) => {
      if (m.type() === "error" && !/tile\.openstreetmap\.org|net::ERR_/.test(m.text())) problems.push(`${page.url()} console: ${m.text()}`);
    });
    page.on("response", (r) => {
      if (r.status() >= 400 && r.url().startsWith(base) && !r.url().includes("/api/inquiries")) problems.push(`${page.url()} HTTP ${r.status()} ${r.url()}`);
    });
  };

  const desktop = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await desktop.newPage();
  watch(page);

  await step("home: hero, three cards, no tour links while no tour exists", async () => {
    await page.goto(`${base}/en/`, { waitUntil: "networkidle" });
    assert.equal(await page.locator("h1").count(), 1);
    assert.equal(await page.locator(".card").count(), 3);
    const anyTour = listings.all().some((l) => l.hasTour);
    assert.equal(await page.locator('a[href$="/tour"]').count() > 0, anyTour);
    const img = page.locator(".hero__img");
    assert.ok(await img.evaluate((el) => el.complete && el.naturalWidth > 0), "hero image loaded");
  });

  await step("currency toggle converts prices and persists", async () => {
    const price = page.locator(".card__price [data-money]").first();
    const usd = await price.textContent();
    assert.match(usd, /^\$[\d,]+$/);
    await page.locator(".header-tools [data-currency-toggle]").click();
    const gel = await price.textContent();
    assert.match(gel, /^≈ ₾[\d,]+$/);
    const usdValue = Number(usd.replace(/\D/g, ""));
    const gelValue = Number(gel.replace(/\D/g, ""));
    assert.ok(Math.abs(gelValue - usdValue * config.currency.usdToGel) <= 1, "conversion uses the configured rate");
    await page.reload({ waitUntil: "networkidle" });
    assert.match(await page.locator(".card__price [data-money]").first().textContent(), /^≈ ₾/);
    await page.locator(".header-tools [data-currency-toggle]").click();
    assert.match(await page.locator(".card__price [data-money]").first().textContent(), /^\$/);
  });

  await step("language switch keeps the current page", async () => {
    await page.goto(`${base}/en/residences/dighomi-stone-villa`, { waitUntil: "networkidle" });
    await page.locator('.header-tools [data-lang-link="ka"]').click();
    await page.waitForURL(`${base}/ka/residences/dighomi-stone-villa`);
    assert.equal(await page.locator("html").getAttribute("lang"), "ka");
    assert.ok((await page.locator("h1").textContent()).includes("ქვის ვილა"));
  });

  await step("home search leads to filtered results", async () => {
    await page.goto(`${base}/en/`, { waitUntil: "networkidle" });
    await page.selectOption("#hs-price", "1000000");
    await page.locator(".search-strip button[type=submit]").click();
    await page.waitForURL(/maxPrice=1000000/);
    assert.equal(await page.locator(".card").count(), 2);
    assert.equal((await page.locator(".results-count").textContent()).trim(), "2 residences");
  });

  await step("residences: filters auto-apply, empty state, reset", async () => {
    await page.goto(`${base}/en/residences`, { waitUntil: "networkidle" });
    assert.equal(await page.locator(".card").count(), 3);
    await Promise.all([page.waitForURL(/location=tabakhmela/), page.selectOption("#f-location", "tabakhmela")]);
    assert.equal(await page.locator(".card").count(), 1);
    assert.ok(!page.url().includes("maxPrice="), "empty parameters are left out of the URL");
    await Promise.all([page.waitForURL(/minArea=600/), page.selectOption("#f-area", "600")]);
    assert.equal(await page.locator(".card").count(), 0);
    assert.ok(await page.locator(".empty").isVisible());
    await page.locator(".empty a").click();
    await page.waitForURL(`${base}/en/residences`);
    assert.equal(await page.locator(".card").count(), 3);
    await Promise.all([page.waitForURL(/sort=price-asc/), page.selectOption("#f-sort", "price-asc")]);
    const prices = await page.locator(".card__price [data-money]").evaluateAll((els) => els.map((e) => Number(e.getAttribute("data-money"))));
    assert.deepEqual(prices, [...prices].sort((a, b) => a - b));
  });

  await step("residences: map view shows one marker per residence", async () => {
    await page.goto(`${base}/en/residences`, { waitUntil: "networkidle" });
    await page.locator('[data-view-btn="map"]').click();
    await page.waitForSelector(".leaflet-container .map-pin");
    assert.equal(await page.locator(".map-pin").count(), 3);
    assert.ok(await page.locator('[data-view-panel="grid"]').isHidden());
    await page.locator(".map-pin").first().click();
    await page.waitForSelector(".map-popup");
    assert.match(await page.locator(".map-popup").getAttribute("href"), /^\/en\/residences\//);
    await page.locator('[data-view-btn="grid"]').click();
    assert.ok(await page.locator('[data-view-panel="grid"]').isVisible());
  });

  await step("residence: gallery lightbox (open, next, keyboard, close)", async () => {
    await page.goto(`${base}/en/residences/dighomi-garden-house`, { waitUntil: "networkidle" });
    const total = listings.bySlug("dighomi-garden-house").photos.length;
    await page.locator(".res-mosaic__item").nth(1).click();
    const lb = page.locator(".lightbox");
    await lb.waitFor({ state: "visible" });
    assert.equal((await lb.locator("[data-lb-counter]").textContent()).trim(), `Photo 2 of ${total}`);
    await lb.locator("[data-lb-next]").click();
    assert.equal((await lb.locator("[data-lb-counter]").textContent()).trim(), `Photo 3 of ${total}`);
    await page.keyboard.press("ArrowLeft");
    await page.keyboard.press("ArrowLeft");
    await page.keyboard.press("ArrowLeft");
    assert.equal((await lb.locator("[data-lb-counter]").textContent()).trim(), `Photo ${total} of ${total}`, "wraps around");
    await page.waitForFunction(() => {
      const img = document.querySelector("[data-lb-img]");
      return img && img.complete && img.naturalWidth > 0;
    });
    await page.keyboard.press("Escape");
    await lb.waitFor({ state: "hidden" });
    await page.locator(".thumb-grid__item").nth(4).click();
    assert.equal((await lb.locator("[data-lb-counter]").textContent()).trim(), `Photo 5 of ${total}`);
    await lb.locator("[data-lb-close]").click();
    await lb.waitFor({ state: "hidden" });
  });

  await step("residence: every photo of every residence loads", async () => {
    for (const l of listings.all()) {
      await page.goto(`${base}/en/residences/${l.slug}`, { waitUntil: "networkidle" });
      await page.evaluate(async () => {
        document.querySelectorAll("img[loading=lazy]").forEach((img) => { img.loading = "eager"; });
        await Promise.all([...document.images].map((img) => (img.complete ? null : new Promise((r) => { img.onload = img.onerror = r; }))));
      });
      const broken = await page.evaluate(() => [...document.images].filter((img) => !img.naturalWidth).map((img) => img.currentSrc || img.src));
      assert.deepEqual(broken, [], `${l.slug}: broken images`);
      assert.equal(await page.locator(".thumb-grid__item").count(), l.photos.length);
    }
  });

  await step("residence: area map and financing calculator", async () => {
    await page.goto(`${base}/en/residences/tabakhmela-residence`, { waitUntil: "networkidle" });
    await page.locator("#location").scrollIntoViewIfNeeded();
    await page.waitForSelector("#location .leaflet-container path.leaflet-interactive, #location .leaflet-container svg path");
    const monthly = page.locator("[data-calc-monthly]");
    // 850,000 at 30% down, 9.5%, 15 years -> 595,000 loan.
    assert.equal((await page.locator("[data-calc-loan]").textContent()).trim(), "$595,000");
    assert.equal((await monthly.textContent()).trim(), "$6,213");
    await page.locator("[data-calc-rate]").fill("0");
    assert.equal((await monthly.textContent()).trim(), "$3,306", "zero interest divides evenly");
    await page.locator("[data-calc-down]").fill("50");
    assert.equal((await page.locator("[data-calc-loan]").textContent()).trim(), "$425,000");
  });

  await step("residence: save, saved page, remove", async () => {
    await page.goto(`${base}/en/residences/dighomi-stone-villa`, { waitUntil: "networkidle" });
    const save = page.locator(".res-actions [data-save]");
    assert.equal(await save.getAttribute("aria-pressed"), "false");
    await save.click();
    assert.equal(await save.getAttribute("aria-pressed"), "true");
    assert.equal((await page.locator(".header-tools [data-saved-count]").textContent()).trim(), "1");
    await page.goto(`${base}/ka/saved`, { waitUntil: "networkidle" });
    await page.waitForSelector("[data-saved-grid] .card");
    assert.equal(await page.locator("[data-saved-grid] .card").count(), 1);
    assert.ok((await page.locator("[data-saved-grid] .card__title").textContent()).includes("ქვის ვილა"));
    await page.locator("[data-saved-grid] .save-btn").click();
    await page.waitForSelector("[data-saved-empty]:not([hidden])");
    assert.equal(await page.locator("[data-saved-grid] .card").count(), 0);
  });

  await step("residence: share menu copies the link", async () => {
    await desktop.grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.goto(`${base}/en/residences/dighomi-stone-villa`, { waitUntil: "networkidle" });
    await page.locator("[data-share-toggle]").click();
    await page.locator("#share-menu").waitFor({ state: "visible" });
    await page.locator("[data-copy-link]").click();
    await page.waitForSelector("[data-toast]:not([hidden])");
    assert.match(await page.evaluate(() => navigator.clipboard.readText()), /\/en\/residences\/dighomi-stone-villa$/);
  });

  await step("viewing request: client validation, then stored with the right residence", async () => {
    await page.goto(`${base}/ru/residences/dighomi-garden-house`, { waitUntil: "networkidle" });
    const form = page.locator("#inquiry form");
    await form.locator("[data-submit]").click();
    assert.ok(await form.locator('[data-field="name"] [data-error]').isVisible());
    assert.ok(await form.locator('[data-error-for="contact"]').isVisible());
    assert.ok(await form.locator('[data-field="consent"] [data-error]').isVisible());
    await form.locator('[name="name"]').fill("Тест Покупатель");
    await form.locator('[name="email"]').fill("bad-email");
    await form.locator(".check").click({ position: { x: 8, y: 8 } });
    await form.locator("[data-submit]").click();
    assert.ok(await form.locator('[data-field="email"] [data-error]').isVisible());
    await form.locator('[name="email"]').fill("buyer@example.com");
    await form.locator('[name="phone"]').fill("+995 555 12 34 56");
    await form.locator("[data-submit]").click();
    await form.locator(".form__status--ok").waitFor({ state: "visible" });
    const stored = JSON.parse(fs.readFileSync(path.join(DATA_DIR, "inquiries.json"), "utf8"));
    assert.equal(stored.length, 1);
    assert.equal(stored[0].type, "viewing");
    assert.equal(stored[0].lang, "ru");
    assert.equal(stored[0].listing.ref, "LH-1002");
    assert.equal(stored[0].name, "Тест Покупатель");
    assert.ok(stored[0].message.includes("LH-1002"));
    assert.equal(await form.locator('[name="name"]').inputValue(), "", "form is cleared after sending");
  });

  await step("valuation and contact forms are stored", async () => {
    await page.goto(`${base}/en/sell`, { waitUntil: "networkidle" });
    let form = page.locator("#valuation form");
    await form.locator('[name="name"]').fill("Owner Test");
    await form.locator('[name="phone"]').fill("+995 599 000 111");
    await form.locator('[name="propertyLocation"]').fill("Tskneti");
    await form.locator('[name="propertyType"]').selectOption("villa");
    await form.locator('[name="propertyArea"]').fill("480");
    await form.locator(".check").click({ position: { x: 8, y: 8 } });
    await form.locator("[data-submit]").click();
    await form.locator(".form__status--ok").waitFor({ state: "visible" });

    await page.goto(`${base}/ka/contact`, { waitUntil: "networkidle" });
    form = page.locator("main form");
    await form.locator('[name="name"]').fill("ნინო ტესტი");
    await form.locator('[name="email"]').fill("nino@example.com");
    await form.locator('[name="subject"]').selectOption("buying");
    await form.locator('[name="message"]').fill("გამარჯობა");
    await form.locator(".check").click({ position: { x: 8, y: 8 } });
    await form.locator("[data-submit]").click();
    await form.locator(".form__status--ok").waitFor({ state: "visible" });

    const stored = JSON.parse(fs.readFileSync(path.join(DATA_DIR, "inquiries.json"), "utf8"));
    assert.deepEqual(stored.map((x) => x.type).sort(), ["contact", "valuation", "viewing"]);
    assert.equal(stored.find((x) => x.type === "valuation").property.location, "Tskneti");
    assert.equal(stored.find((x) => x.type === "contact").subject, "buying");
    assert.equal(stored.find((x) => x.type === "contact").message, "გამარჯობა");
  });

  await step("admin inbox: lists enquiries, updates status", async () => {
    const adminCtx = await browser.newContext({ httpCredentials: { username: "admin", password: "e2e-password" }, viewport: { width: 1280, height: 900 } });
    const admin = await adminCtx.newPage();
    watch(admin);
    await admin.goto(`${base}/admin`, { waitUntil: "networkidle" });
    assert.equal(await admin.locator(".adm-card").count(), 3);
    const card = admin.locator(".adm-card").first();
    await card.locator("[data-status-select]").selectOption("contacted");
    await admin.waitForFunction(() => document.querySelector(".adm-card [data-state]").textContent === "Saved");
    await admin.goto(`${base}/admin?status=contacted`, { waitUntil: "networkidle" });
    assert.equal(await admin.locator(".adm-card").count(), 1);
    await adminCtx.close();
  });

  // ---------------------------------------------------------------- mobile
  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  const m = await mobile.newPage();
  watch(m);

  await step("mobile: menu opens, navigates and closes", async () => {
    await m.goto(`${base}/en/`, { waitUntil: "networkidle" });
    assert.ok(await m.locator(".site-nav").isHidden());
    await m.locator("[data-menu-open]").tap();
    await m.locator("#mobile-menu").waitFor({ state: "visible" });
    await m.locator("#mobile-menu [data-menu-close]").tap();
    await m.locator("#mobile-menu").waitFor({ state: "hidden" });
    await m.locator("[data-menu-open]").tap();
    await m.locator('#mobile-menu nav a[href="/en/residences"]').tap();
    await m.waitForURL(`${base}/en/residences`);
  });

  await step("mobile: sticky viewing button hides once the form is on screen", async () => {
    await m.goto(`${base}/en/residences/dighomi-stone-villa`, { waitUntil: "networkidle" });
    const cta = m.locator("[data-mobile-cta]");
    assert.ok(await cta.isVisible());
    await cta.locator("a").tap();
    await m.waitForFunction(() => document.querySelector("[data-mobile-cta]").classList.contains("is-hidden"));
  });

  await step("no page scrolls sideways from 320 px to 1920 px in any language", async () => {
    const pages = ["/", "/residences", "/services", "/sell", "/about", "/contact", "/saved", "/privacy", "/terms", "/nope"];
    for (const l of listings.all()) pages.push(`/residences/${l.slug}`);
    const failures = [];
    for (const width of [320, 360, 390, 768, 1024, 1181, 1280, 1440, 1920]) {
      const ctx = await browser.newContext({ viewport: { width, height: 900 } });
      const p = await ctx.newPage();
      for (const lang of config.languages) {
        for (const route of pages) {
          const url = `${base}/${lang}${route === "/" ? "/" : route}`;
          await p.goto(url, { waitUntil: "domcontentloaded" });
          const overflow = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
          if (overflow > 0) failures.push(`${width}px ${lang}${route}: +${overflow}px`);
        }
      }
      await ctx.close();
    }
    assert.deepEqual(failures, []);
  });

  await step("no console errors or failed requests anywhere", async () => {
    assert.deepEqual(problems, []);
  });

  await browser.close();
  await new Promise((r) => server.close(r));
  fs.rmSync(DATA_DIR, { recursive: true, force: true });

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} browser checks passed`);
  process.exit(failed.length ? 1 : 0);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});

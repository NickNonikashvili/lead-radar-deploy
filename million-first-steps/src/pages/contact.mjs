import { layout } from "../lib/layout.mjs";
import { icon } from "../lib/icons.mjs";
import { join } from "../lib/html.mjs";
import { pageHero } from "../lib/components.mjs";
import { TIERS } from "../data/tiers.mjs";
import { TOURS } from "../data/tours.mjs";
import config from "../config.mjs";

export default function contactPage() {
  const body = `
${pageHero({
  sceneName: "hero",
  ka: "კონტაქტი",
  kicker: "Plan my journey",
  title: "Let's take the<br><em>first step together.</em>",
  lead: "Tell us a little about your trip. We'll reply personally — usually within a day — with ideas, a route and an exact quote. No obligation, no payment until you're sure.",
  crumbs: [{ label: "Contact" }],
})}

<section class="section contact" aria-label="Request form">
  <div class="container contact__grid">
    ${config.email ? `<p class="contact__quick"><span>Prefer to talk?</span> <a href="mailto:${config.email}" translate="no">${icon("mail")}${config.email}</a></p>` : ""}
    <form class="form" data-enquiry novalidate ${config.formEndpoint ? `action="${config.formEndpoint}" method="POST"` : ""}>
      <fieldset>
        <legend class="form__legend"><span>01</span> Your journey</legend>
        <div class="form__row">
          <label class="field"><span>Journey</span>
            <select name="tour" data-tour-select>
              <option value="">Not sure yet — help me choose</option>
              ${join(TOURS, (t) => `<option value="${t.id}">${t.name} (${t.days} days)</option>`)}
              <option value="tailor-made">Tailor-made / something else</option>
            </select>
          </label>
        </div>
        <div class="form__row">
          <span class="field__label" id="tier-label">Travel style</span>
          <div class="radio-cards" role="radiogroup" aria-labelledby="tier-label">
            ${join(
              TIERS,
              (t) => `<label class="radio-card"><input type="radio" name="tier" value="${t.name}" ${t.id === "explorer" ? "checked" : ""} data-tier-radio="${t.id}"><span><strong>${t.name}</strong><small>${t.tagline}</small></span></label>`
            )}
          </div>
        </div>
        <div class="form__row form__row--3">
          <label class="field"><span>Arrival (approx.)</span><input type="month" name="arrival"></label>
          <label class="field"><span>Adults</span><input type="number" name="adults" min="1" max="30" value="2" inputmode="numeric" data-party-input></label>
          <label class="field"><span>Children</span><input type="number" name="children" min="0" max="20" value="0" inputmode="numeric"></label>
        </div>
      </fieldset>
      <fieldset>
        <legend class="form__legend"><span>02</span> About you</legend>
        <div class="form__row form__row--2">
          <label class="field"><span>Name *</span><input type="text" name="name" autocomplete="name" required></label>
          <label class="field"><span>Email *</span><input type="email" name="email" autocomplete="email" required></label>
        </div>
        <div class="form__row form__row--2">
          <label class="field"><span>Phone / WhatsApp</span><input type="tel" name="phone" autocomplete="tel"></label>
          <label class="field"><span>Country</span><input type="text" name="country" autocomplete="country-name"></label>
        </div>
        <label class="field"><span>Anything we should know?</span><textarea name="message" rows="5" placeholder="Celebrations, interests, dietary needs, mobility, the pace you like…"></textarea></label>
        <label class="hp" aria-hidden="true">Leave this empty<input type="text" name="company" tabindex="-1" autocomplete="off"></label>
        <label class="check"><input type="checkbox" name="consent" required><span>I agree that ${config.brand} may use these details to reply to my request, as described in the <a href="privacy.html">privacy policy</a>. *</span></label>
      </fieldset>
      <div class="form__foot">
        <button class="btn btn--gold btn--lg" type="submit"><span class="btn__label">Send my request</span><span class="btn__icon">${icon("arrow")}</span></button>
        <p class="form__status" role="status" aria-live="polite" data-form-status></p>
      </div>
    </form>

    <aside class="contact__aside">
      <div class="contact__card" data-reveal>
        <h2 class="h4">Prefer to talk?</h2>
        <ul class="contact__list">
          ${config.email ? `<li><a href="mailto:${config.email}">${icon("mail")}<span><small>Email</small>${config.email}</span></a></li>` : ""}
          ${config.whatsapp ? `<li><a href="https://wa.me/${config.whatsapp}">${icon("chat")}<span><small>WhatsApp</small>Message us</span></a></li>` : ""}
          ${config.phone ? `<li><a href="tel:${config.phone.replace(/\s/g, "")}">${icon("phone")}<span><small>Phone</small>${config.phone}</span></a></li>` : ""}
          <li>${icon("pin")}<span><small>Based in</small>${config.address}</span></li>
          <li>${icon("clock")}<span><small>Reply time</small>Usually within one day</span></li>
        </ul>
      </div>
      <div class="contact__card contact__card--steps" data-reveal>
        <h2 class="h4">What happens next</h2>
        <ol class="next-steps">
          <li><strong>We reply</strong> with questions, ideas and a first route.</li>
          <li><strong>We refine it</strong> together until it's exactly right.</li>
          <li><strong>You confirm</strong> with a deposit — then we take care of everything.</li>
        </ol>
      </div>
    </aside>
  </div>
</section>`;

  return layout({
    title: "Plan my journey",
    description: "Request a private, tailor-made journey through Georgia. We reply personally within a day.",
    path: "contact.html",
    body,
    bodyClass: "page-contact",
    headerTheme: "ink",
    cta: false,
  });
}

# Where to get content without legal trouble

Research notes for **Million First Steps**, October 2026. This is practical guidance, not legal advice — for anything with money attached (contracts, booking terms, insurance), spend an hour with a Georgian lawyer.

---

## The short version

| ✅ Safe | ⚠️ Safe with care | ❌ Never |
|---|---|---|
| Your own photos & video | Wikimedia Commons (licence per file) | Google Images, Instagram, Pinterest |
| Photos you commission or buy a licence for | Unsplash / Pexels / Pixabay | Other tour operators' or hotels' websites |
| Text you write yourselves | Photos of people (need their permission) | TripAdvisor / Booking.com photos and reviews |
| Facts (dates, heights, history) | Modern buildings & sculptures | Made-up reviews or testimonials |
| Public-domain map data | Logos and brand names | AI "photos" of real places passed off as real |

**What this site already does:** all illustrations, icons, the logo and the text were made for it; the maps use public-domain Natural Earth data; fonts are open-licence and self-hosted; the animation libraries are free for commercial use; there are no trackers and no invented reviews. The only thing missing is real photography — see below.

---

## 1. Photos and video

### Best: your own
You live in Georgia — this is your biggest advantage. Original photos of your actual trips, cars, guesthouses and food are more convincing than any stock image, and there's no licence to worry about.
- **People:** if someone is recognisable (a guest, a winemaker, a grandmother at a supra), get their written OK to use the photo for marketing. A one-line message saying "yes, you may use this photo on your website and social media" is far better than nothing; a simple model-release form is best. Georgia's Law on Personal Data Protection treats images of identifiable people as personal data.
- **Guests' photos:** ask before you repost — and credit them.
- **Drones:** check the current rules of Georgia's Civil Aviation Agency before flying, and never over crowds, airports, or borders.

### Free photo libraries

| Source | Commercial use | Credit needed? | Watch out for |
|---|---|---|---|
| **[Wikimedia Commons](https://commons.wikimedia.org)** | Depends on the file's licence | Yes for CC BY / CC BY-SA (author + licence + link); recommended for public domain | Only use **CC0, Public domain, CC BY, CC BY-SA**. Skip anything **NC** (NonCommercial) or **ND** (NoDerivatives). Wikimedia says to verify each file yourself — it gives no warranty. |
| **[Unsplash](https://unsplash.com/license)** | Yes | Not required (appreciated) | No model or property releases: be careful with recognisable people, logos, private property. You can't compile Unsplash photos into a competing service. |
| **[Pexels](https://www.pexels.com/license/)** | Yes | Not required | Same caveats as Unsplash. Don't imply that people pictured endorse you. |
| **[Pixabay](https://pixabay.com/service/license-summary/)** | Yes | Not required | Same caveats; no selling unaltered copies. |
| **Flickr (Creative Commons)** | Per photo | Per licence | Most are NC — not allowed for a business. Check every single one. |

**The Wikimedia Commons route is automated for you:** `npm run photos:commons` searches Commons for every photo slot on the site (Gergeti, Ushguli, Vardzia, Kakheti vineyards, the Dmanisi skull…), keeps only images with an acceptable licence and no extra restrictions, prefers ones rated "Quality images", optimises them and writes the author, licence and link into `src/data/photo-credits.json`. The Credits page and a small caption on each photo are generated from that file — which is exactly the attribution CC BY and CC BY-SA require. **Look at every photo it picks before you publish.**

### Ask for official photos
The **Georgian National Tourism Administration** (GNTA, [georgia.travel](https://georgia.travel)) keeps a tourism photo bank for its marketing. We couldn't find public terms for reusing it, so email them, explain you're a registered Georgian tour operator, and ask for written permission. Regional tourism offices, national parks (Agency of Protected Areas), wineries and hotels you partner with will often give you photos for free in exchange for a credit — **get it in writing (an email is fine)**.

### Pay a local photographer
For the few images that matter most (home page, tour heroes), commissioning a Georgian photographer for a day is the best value you can buy. Make sure your agreement says you may use the photos on your website, social media and ads, for as long as you like.

### Modern buildings and sculptures
Photos of medieval monuments are fine. Photos where a *modern* artwork or building is the main subject (for example a recent sculpture or a contemporary bridge) can carry the artist's or architect's copyright, depending on "freedom of panorama" rules — prefer photos where such works aren't the focus.

### AI images
Don't use AI-generated images that look like photos of real Georgian places. If a traveller arrives and the castle in your hero image doesn't exist, that's misleading advertising. AI is fine for clearly illustrative or decorative artwork.

---

## 2. Text

- **Facts aren't copyrighted.** Dates, heights, distances, what happened at Didgori in 1121 — anyone can state them.
- **Wording is.** Don't copy sentences from Wikipedia (its text is CC BY-SA, which would oblige you to credit it and license your text the same way), guidebooks, or other operators' itineraries. All the text on this site is original.
- **Check facts against good sources** — the history on this site is based on:
  - UNESCO World Heritage and Intangible Heritage listings: <https://whc.unesco.org/en/statesparties/ge>, <https://ich.unesco.org/en/state/georgia-GE>
  - Dmanisi: Lordkipanidze et al., *Science* (2013) on Skull 5; Ferring et al., *PNAS* (2011) on dating
  - Earliest wine: McGovern et al., *PNAS* (2017), "Early Neolithic wine of Georgia in the South Caucasus"
  - Georgian National Museum: <https://museum.ge>
- **Visa rules change** — the Plan page tells visitors to check the Ministry of Foreign Affairs ([geoconsul.gov.ge](https://www.geoconsul.gov.ge)) before travelling. Keep it that way.

---

## 3. Reviews and testimonials

- **Never write, buy or invent reviews**, and don't post reviews from friends or family without saying who they are. In the US the FTC's 2024 rule bans fake and AI-generated reviews, with civil penalties of over $50,000 per violation; EU consumer law also bans fake reviews.
- When you have real guests: ask them to review you on Google and TripAdvisor, and quote them on the site only with their permission (first name + country is enough).
- The site's About page turns being new into a strength ("we won't invent reviews") — keep that until you have real ones.

---

## 4. Logos, names and trademarks

- You can *mention* UNESCO, hotels, wineries, airlines and car brands by name.
- Don't use their **logos** (including the UNESCO emblem and the "Georgia" national tourism brand) without written permission, and don't imply a partnership that doesn't exist.
- Name specific hotels on tour pages only once you actually work with them (the site currently describes hotel *categories*, not named hotels).

---

## 5. Fonts, code and maps used on this site

| What | Licence | Notes |
|---|---|---|
| Cinzel, Cormorant Garamond, Manrope, Noto Serif Georgian | SIL Open Font License 1.1 | Self-hosted. Loading Google Fonts from Google's servers was ruled a GDPR violation by a Munich court in 2022 (LG München I, 3 O 17493/20); self-hosting avoids that. |
| GSAP, ScrollTrigger, SplitText | GSAP Standard "No Charge" License | Free for commercial use since 2025 (Webflow). The exception is products that charge end users for access — a tour website is fine. |
| Lenis | MIT | |
| Map data | Natural Earth — public domain | Georgia shown within its internationally recognised borders. If you add interactive map tiles later (OpenStreetMap), credit "© OpenStreetMap contributors". |
| Illustrations, logo, icons | Owned by you | Generated for this site. |

---

## 6. The business side (worth knowing now)

- **Register as a tourism business.** Georgia's Law on Tourism now requires tour operators, travel agencies and guides to register with the Georgian National Tourism Administration. GNTA's guidance gives a registration deadline of the end of 2026, with fines from 1 January 2027 — sources disagreed on dates, so confirm with GNTA directly. Registration is reported to be free. <https://matsne.gov.ge/en/document/view/6012850>
- **Selling packages to EU travellers.** The EU Package Travel Directive (2015/2302, Art. 17) requires organisers that sell or market packages to EU consumers — including organisers based outside the EU — to provide insolvency protection under the rules of that member state. How this applies to a Georgian company selling direct online is a question for a lawyer before you take your first EU deposit.
- **Privacy.** The site collects nothing until someone sends a request. If you add analytics, a chat widget or a Facebook pixel later, you'll need a cookie-consent banner for EU visitors and an updated privacy policy.
- **Booking terms.** `terms.html` is a plain-language starting point and says it's being finalised. Have a lawyer set your deposit, balance and cancellation scale before you take money.
- **Insurance.** Professional liability insurance for you, and required travel insurance for guests (the site already says so).

---

## Sources

- Commons reuse guidance: <https://commons.wikimedia.org/wiki/Commons:Reusing_content_outside_Wikimedia>
- Unsplash licence, releases and trademarks: <https://unsplash.com/license>, <https://help.unsplash.com/en/articles/2612329-releases-and-trademarks>
- GSAP licence: <https://gsap.com/community/standard-license/>, <https://webflow.com/blog/gsap-becomes-free>
- Google Fonts ruling: <https://wptavern.com/german-court-fines-website-owner-for-violating-the-gdpr-by-using-google-hosted-fonts>
- FTC fake-reviews rule: <https://www.ftc.gov/news-events/news/press-releases/2024/08/federal-trade-commission-announces-final-rule-banning-fake-reviews-testimonials>
- Georgian tourism registration: <https://georgiatoday.ge/parliament-to-tighten-tourism-rules-introduces-new-registration-system/>, <https://certified-guides.org/en/instruction-for-guides/>
- Package Travel Directive commentary: <https://publications.eshte.pt/dir/ccnptd/1167/>
- Early wine study coverage: <https://www.ift.org/news-and-publications/scientific-journals/news/2017/november/21/earliest-evidence-of-winemaking-dates-to-about-6000-bc>
- Qvevri on UNESCO's list: <https://ich.unesco.org/en/RL/ancient-traditional-georgian-winemaking-method-using-the-qvevri-00870>
- Dmanisi Skull 5: <https://en.wikipedia.org/wiki/Dmanisi_skull_5>
- Natural Earth terms: <https://www.naturalearthdata.com/about/terms-of-use/>

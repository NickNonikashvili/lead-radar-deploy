# Mathub Create: the subscription, on the website and in the apps

Mathub Create is one monthly subscription (about $5) for making classes: from a syllabus (Create a class), from a
class file a classmate sends, or from a class someone shares by link. Everything else stays free:

- **The example class** ("Try an example class") is free, so anyone (and App Review) can try the whole flow.
- **Classes made before subscriptions existed** stay free. The first time the new version starts, every class
  already on the device is marked free.
- **When the subscription ends**, the classes made with it are kept, locked ("CHMY 121 is locked", Subscribe and
  Restore purchases / I already subscribed). They open again, progress and all, the moment it is back.
- **Offline**, the apps remember until when the subscription is paid for, so classes stay open on a plane.

One subscription works everywhere the student signs in with the same Mathub account:

| Where | How it is sold | How Mathub knows it is on |
|---|---|---|
| iPhone, iPad | App Store In-App Purchase | RevenueCat SDK in the app (`@revenuecat/purchases-capacitor`) |
| Android | Google Play Billing | the same SDK |
| Website | RevenueCat **Web Purchase Link** (checkout by Stripe) | `api/myclasses.php` asks RevenueCat's REST API (`create_status`) |

All three use the same RevenueCat customer: **`mh_<account id>`**. The apps call `Purchases.logIn('mh_<id>')`
when the student signs in (a purchase made before signing in moves to the account), and the website's checkout
link ends in that ID. Apple and Google require their own billing inside the apps, so the apps never mention or
link to the web checkout (App Store 3.1.1 / 3.1.3(b), Play Payments policy); a subscription bought on the web
simply works in the app after signing in.

| | Value |
|---|---|
| App Store product | `mathub_create_monthly` (auto-renewable, 1 month, group "Mathub Create") |
| Google Play product | subscription `mathub_create`, base plan `monthly` (auto-renewing, 1 month) |
| Web product | a RevenueCat Web Billing product, 1 month, $4.99, in the same `default` offering |
| RevenueCat entitlement | `create` |
| RevenueCat offering | `default` (current), package Monthly (`$rc_monthly`) |
| App keys | `BILLING` at the top of the Mathub Create section in `assets/create.js` |
| Server keys | `revenuecat_secret`, `create_web_link`, `create_web_price` in `api/config.local.php` |

Code: `assets/create.js` (classes students make, sync with the account, `App.subscription` for the store and for
the web, the paywall `App.paywall`, the lock `App.courseGate`, sharing and `#/c/CODE`), `assets/create.css`,
`api/myclasses.php` (classes saved with the account, share codes, `create_status`), `assets/app-boot.js` (the
`Purchases` plugin). Tests: `tests/app.test.js` (a stand-in store), `tests/create-web.test.js` and
`tests/myclasses-api.test.js` (a stand-in RevenueCat in `tests/pyodide/router.php`).

## 1. The money side (once)

**Google Play Console**
1. Settings → Payments profile: create the merchant (payments) profile and add your bank account.
2. Upload a build that contains Mathub Create to a testing track first (Play only lets you create subscriptions
   once a bundle with the billing permission is uploaded).
3. Monetize with Play → Products → Subscriptions → Create subscription. Product ID `mathub_create`, name
   "Mathub Create". Add a base plan: ID `monthly`, auto-renewing, billing period 1 month, price US$4.99 (or 5.00);
   let Play set the other countries. Activate it.

**App Store Connect**
1. Business: sign the **Paid Apps Agreement**, add bank and tax information. Enroll in the **App Store Small
   Business Program** (15% commission instead of 30%).
2. Your app → Monetization → Subscriptions: create the group "Mathub Create", then a subscription: reference name
   "Mathub Create Monthly", product ID `mathub_create_monthly`, duration 1 month, price $4.99 (or $5.00).
   Add a display name ("Mathub Create") and description ("Make your own classes from any syllabus"), and a
   screenshot of the paywall for review.
3. The first subscription has to be submitted **together with an app version**: on the version page, under
   In-App Purchases and Subscriptions, add it before you submit.
4. Add the Terms of Use link to the App Store description (Apple asks for it in the metadata of apps with
   subscriptions): `Terms of Use: https://mathub.space/#/policy/create`.

**Stripe (for the website)**
1. Create a Stripe account (stripe.com) and finish its activation (business details, bank account).
2. In RevenueCat (below) connect it under Project settings → Web → Stripe. RevenueCat Web Billing uses it to take
   the card payment; Stripe's fee applies, no store commission.

## 2. RevenueCat (free account at revenuecat.com)

1. Create a project "Mathub".
2. Add the **App Store** app: bundle ID `space.mathub.app`; upload an **In-App Purchase Key** (App Store Connect →
   Users and Access → Integrations → In-App Purchase) as RevenueCat asks.
3. Add the **Play Store** app: package `space.mathub.app`; upload a Google Cloud **service account** JSON that has
   access to your Play Console (RevenueCat's setup screen walks through the permissions it needs).
4. Add a **Web Billing** app (Stripe connected), with a product "Mathub Create", 1 month, $4.99.
5. Products: add `mathub_create_monthly` (App Store), `mathub_create:monthly` (Play Store) and the web product.
6. Entitlements: create `create` and attach all three products.
7. Offerings: make `default` the current offering, with a **Monthly** package containing all three products.
8. Web → **Web Purchase Links**: create one for the `default` offering. Set its success redirect to
   `https://mathub.space/#/create?paid=1` (the page checks the subscription again when the buyer comes back).
   Copy the link: it looks like `https://pay.rev.cat/<token>/` and Mathub adds the customer ID to its end.
9. Project settings → API keys: copy the two **public** app-specific keys, `appl_…` and `goog_…`, and create a
   **secret** key (`sk_…`, read access is enough) for the server.

## 3. Put the keys in

In `calc1/assets/create.js` (public SDK keys, meant to ship inside apps):

```
const BILLING = { ios: 'appl_xxxxxxxx', android: 'goog_xxxxxxxx', entitlement: 'create' };
```

Then `cd calc1/app && npm run sync` and make new app builds.

On the server, in `api/config.local.php` (never in the repository or the zip):

```
'revenuecat_secret' => 'sk_xxxxxxxx',
'create_web_link'   => 'https://pay.rev.cat/xxxxxxxx/',
'create_web_price'  => '$4.99',
```

Without app keys the apps cannot sell the subscription (the paywall says so; the example class still works).
Without the server keys the website's paywall says subscribing on the website is not available yet, and
subscriptions bought in the apps are not recognised on the website.

## 4. Test before you release

- **Android:** Play Console → Settings → License testing: add your Google account. Install from the internal or
  closed test track. Purchases are test purchases (no charge) and a monthly subscription renews every 5 minutes.
- **iPhone:** App Store Connect → Users and Access → Sandbox → add a tester. On the phone: Settings → App Store →
  Sandbox Account. Sandbox monthly subscriptions renew every 5 minutes, up to 12 times.
- **Website:** use a RevenueCat **sandbox** Web Purchase Link and Stripe's test card `4242 4242 4242 4242` (any
  future date and CVC). Settings → Mathub Create shows "On" after the checkout tab closes.
- Check: Create a class → paste an answer → Add → the paywall shows the price → Subscribe → the class is added.
  Settings shows "Mathub Create: On. Renews …". Sign in on the website with the same account: the class is there
  and opens. Cancel; after it lapses the class shows as locked; subscribing again opens it.

## 5. What changes in the store forms

- **Google Play Data safety:** Financial info → **Purchase history**: collected, not shared (RevenueCat is a
  service provider), optional, purpose App functionality. App activity → Other user-generated content now also
  covers classes the student makes (saved with the account when signed in).
- **App Store App Privacy:** Purchases → **Purchase History**: App Functionality, **linked** to the user (the
  RevenueCat customer is the account ID), not used for tracking. User Content → Other User Content covers classes
  saved with the account.
- **Permissions (Android):** `com.android.vending.BILLING` and `ACCESS_NETWORK_STATE` come with Play Billing and
  RevenueCat; the CI check allows exactly these.
- **Review notes:** "Making your own class needs the Mathub Create subscription. To try the flow without buying:
  Start page → class button → Create a class from a syllabus → Try an example class → Add SKIL 101 (free). The
  subscription itself can be tested with a sandbox account."

## Sharing a class

A class saved with the account can be shared (`myclass_share`): an 8-character code from
`ABCDEFGHJKMNPQRSTUVWXYZ23456789` and the link `https://mathub.space/#/c/CODE` with its QR code
(`assets/vendor/qrcode.js`, MIT, loaded only when a share sheet opens). Anyone can open the link (`shared_class`,
120 an hour per address) and see the class without the owner's name; adding a copy needs Mathub Create. A shared
class page has **Report**, which files a problem report; moderators see it in Admin → Problems with a **Stop
sharing this class** button (`admin_unshare`). The owner can stop sharing at any time; copies already added stay.

## What the paywall shows (store rules)

Apple (guideline 3.1.2) and Google ask that a subscription screen states what you get, the price and period, that
it renews automatically and how to cancel, with links to the Terms of Use and the Privacy Policy, and that people
can restore a purchase. The paywall shows: the price ("$4.99 a month"), three lines on what it unlocks,
Subscribe, **Restore purchases** (in the apps) or **I already subscribed** (on the website), "Renews every month at
$4.99 until you cancel. Cancel any time in your Apple ID (or Google Play) subscriptions, at least 24 hours before
it renews" (on the website: "in Settings › Mathub Create › Manage subscription, or with the link in your receipt
email. Payment is handled by Stripe."), and links to the Terms (section 1.12, `#/policy/create`) and the Privacy
Policy. On the website Subscribe opens the checkout in a new tab and the card waits, checking every 10 seconds
and whenever the tab comes back into view.

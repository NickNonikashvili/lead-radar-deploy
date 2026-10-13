# Mathub Create: the subscription in the app

Mathub Create is one monthly subscription (about $5) in the iPhone, iPad and Android apps. It unlocks making
classes: from a syllabus (Create a class) and from a class file a classmate sends. Everything else stays free:

- **The example class** ("Try an example class") is free, so anyone (and App Review) can try the whole flow.
- **Classes made before this version** stay free. The first time the new version starts, every class already on
  the device is marked free.
- **When the subscription ends**, the classes made with it stay on the device, locked ("CHMY 121 is locked",
  Subscribe and Restore purchases). They open again, progress and all, the moment it is back.
- **Offline**, the app remembers until when the subscription is paid for, so classes stay open on a plane.

Apple and Google require their own billing for this (App Store In-App Purchase, Google Play Billing). The app uses
**RevenueCat** (`@revenuecat/purchases-capacitor`) to talk to both stores, check receipts and know whether the
subscription is active. There is no server code on mathub.space for it.

| | Value |
|---|---|
| App Store product | `mathub_create_monthly` (auto-renewable, 1 month, group "Mathub Create") |
| Google Play product | subscription `mathub_create`, base plan `monthly` (auto-renewing, 1 month) |
| RevenueCat entitlement | `create` |
| RevenueCat offering | `default` (current), package Monthly (`$rc_monthly`) with both products |
| Keys in the app | `BILLING` at the top of the Mathub Create section in `assets/app-native.js` |

Code: `assets/app-native.js` (Mathub Create section: `App.subscription`, the paywall `App.paywall`, the lock
`App.courseGate`), `assets/app.css` (paywall and lock styles), `assets/app-boot.js` (the `Purchases` plugin),
`assets/app.js` (the `App.courseGate` hook, unused on the website). Tests: `tests/app.test.js` (a stand-in store).

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

## 2. RevenueCat (free account at revenuecat.com)

1. Create a project "Mathub".
2. Add the **App Store** app: bundle ID `space.mathub.app`; upload an **In-App Purchase Key** (App Store Connect →
   Users and Access → Integrations → In-App Purchase) as RevenueCat asks.
3. Add the **Play Store** app: package `space.mathub.app`; upload a Google Cloud **service account** JSON that has
   access to your Play Console (RevenueCat's setup screen walks through the permissions it needs).
4. Products: add `mathub_create_monthly` (App Store) and `mathub_create:monthly` (Play Store).
5. Entitlements: create `create` and attach both products.
6. Offerings: make `default` the current offering, with a **Monthly** package containing both products.
7. Project settings → API keys: copy the two **public** app-specific keys, `appl_…` and `goog_…`.

## 3. Put the keys in the app

In `calc1/assets/app-native.js`:

```
const BILLING = { ios: 'appl_xxxxxxxx', android: 'goog_xxxxxxxx', entitlement: 'create' };
```

These are public SDK keys, meant to ship inside apps. Then `cd calc1/app && npm run sync` and make new builds.
Without keys, the app cannot sell the subscription: the paywall says subscribing is not available, classes from a
syllabus cannot be added, and the example class still works.

## 4. Test before you release

- **Android:** Play Console → Settings → License testing: add your Google account. Install from the internal or
  closed test track. Purchases are test purchases (no charge) and a monthly subscription renews every 5 minutes.
- **iPhone:** App Store Connect → Users and Access → Sandbox → add a tester. On the phone: Settings → App Store →
  Sandbox Account. Sandbox monthly subscriptions renew every 5 minutes, up to 12 times.
- Check: Create a class → paste an answer → Add → the paywall shows the store price → Subscribe → the class is
  added. Settings → On this phone shows "Mathub Create: On. Renews …". Cancel in the store's subscription
  settings; after it lapses the class shows as locked; Restore purchases (or subscribing again) opens it.

## 5. What changes in the store forms

- **Google Play Data safety:** add Financial info → **Purchase history**: collected, not shared (RevenueCat is a
  service provider), optional, purpose App functionality.
- **App Store App Privacy:** add Purchases → **Purchase History**: App Functionality, not linked to the user
  (RevenueCat uses a random ID the app makes, not the account), not used for tracking.
- **Permissions (Android):** `com.android.vending.BILLING` and `ACCESS_NETWORK_STATE` come with Play Billing and
  RevenueCat; the CI check allows exactly these.
- **Review notes:** "Making your own class needs the Mathub Create subscription. To try the flow without buying:
  Start page → class button → Create a class from a syllabus → Try an example class → Add SKIL 101 (free). The
  subscription itself can be tested with a sandbox account."

## What the paywall shows (store rules)

Apple (guideline 3.1.2) and Google ask that a subscription screen states what you get, the price and period, that
it renews automatically and how to cancel, with links to the Terms of Use and the Privacy Policy, and that people
can restore a purchase. The paywall shows: the store's own price ("$4.99 a month"), three lines on what it unlocks,
Subscribe, **Restore purchases**, "Renews every month at $4.99 until you cancel. Cancel any time in your Apple ID
(or Google Play) subscriptions, at least 24 hours before it renews", and links to the Terms (section 1.12,
`#/policy/create`) and the Privacy Policy. Settings has Manage subscription (opens the store's page) and Restore.

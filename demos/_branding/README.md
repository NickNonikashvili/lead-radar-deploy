# EvoSoft copyright notice (shared by the demo kits)

© 2026 EvoSoft Solutions

A small card that every public demo shows: **"© 2026 EvoSoft Solutions. All rights reserved."**, then
**"{Product} demo · fictional data · evosoft.solutions"** (link to https://evosoft.solutions) and a close button that
hides it for the browser session (it comes back on the next visit). Orange accent `#FF6700`, light and dark styles
(system setting, or the app's own `html.dark` / `data-theme`), hidden while the app shows a modal dialog and when
printing.

| File | What it is |
|---|---|
| `evosoft-notice.js` | Builds the card with `createElement` / `textContent` only (no `innerHTML`, no inline styles, no `eval`), so it runs under strict CSPs and Trusted Types. Reads the product name from its own tag (`data-product`), and `data-surface` for apps with several screens. Puts the card back if the app replaces the whole `<body>` (Evo's store apps do on phones). |
| `evosoft-notice.css` | All rules scoped to `#evosoft-notice` and reset first. The end of the file places the card per product and screen (chosen from screenshots of each app, so it doesn't sit on the app's own controls) and sets its stacking order under each app's menus, dialogs and toasts. |
| `add-notice.js` | Node 18+ helper used by the Evo and Mailtabs kits: inserts the two tags into an HTML page before `</head>`, idempotently, between `<!-- evosoft-notice -->` markers, with `?v=<hash of the two files>`; refuses if anything else in the page (inline scripts included) would change. `--check FILE` tells whether a page has it. |

The tag each page gets (one line):

```html
<!-- evosoft-notice --><link rel="stylesheet" href="/__evosoft/evosoft-notice.css?v=…"><script src="/__evosoft/evosoft-notice.js?v=…" data-product="Evo" data-surface="web" defer></script><!-- /evosoft-notice -->
```

Both files are served from the demo's own origin at `/__evosoft/`, so every app's CSP (`script-src 'self'`) allows them
without a change. How each kit gets them onto its pages: Evo `evo/brand-evo.sh` + `evo/Caddyfile`, Mailtabs
`mailtabs/docker/brand-mailtabs.sh` (run in the image build), StudyCat `php api/demo-seed.php --brand` (also part of
every nightly reset). After changing either file, run that kit's step again (Evo: `brand-evo.sh`, Mailtabs:
`reset-demo.sh` rebuilds the image, StudyCat: `--brand`); the `?v=` changes, so browsers fetch the new version.

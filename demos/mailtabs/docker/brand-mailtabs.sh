#!/bin/sh
# © 2026 EvoSoft Solutions
#
# brand-mailtabs.sh APP_DIR ASSETS_DIR: add the EvoSoft copyright notice to a Mailtabs build.
# Run by docker/mailtabs.Dockerfile on the copy of the source inside the image (the source folder on the
# server is never changed); the same command works on any Mailtabs folder for a local test.
#
#   ASSETS_DIR/evosoft-notice.css, evosoft-notice.js  -> APP_DIR/public/__evosoft/
#   APP_DIR/public/index.html gets one line before </head> that loads them (add-notice.js; running it
#   again changes nothing). Both files are same-origin, so Mailtabs' CSP (script-src 'self') allows them.
set -eu
APP="${1:?usage: brand-mailtabs.sh APP_DIR ASSETS_DIR}"
ASSETS="${2:?usage: brand-mailtabs.sh APP_DIR ASSETS_DIR}"
PUB="$APP/public"

[ -f "$APP/server.js" ] && [ -f "$PUB/index.html" ] || { echo "brand-mailtabs: $APP is not a Mailtabs folder" >&2; exit 1; }
for f in evosoft-notice.css evosoft-notice.js add-notice.js; do
  [ -f "$ASSETS/$f" ] || { echo "brand-mailtabs: $ASSETS/$f is missing" >&2; exit 1; }
done

mkdir -p "$PUB/__evosoft"
cp "$ASSETS/evosoft-notice.css" "$ASSETS/evosoft-notice.js" "$PUB/__evosoft/"
chmod 0644 "$PUB/__evosoft/evosoft-notice.css" "$PUB/__evosoft/evosoft-notice.js"
node "$ASSETS/add-notice.js" --product Mailtabs "$PUB/index.html"
node "$ASSETS/add-notice.js" --check "$PUB/index.html"

#!/usr/bin/env bash
# © 2026 EvoSoft Solutions
#
# brand-evo.sh: (re)build the folder Caddy uses to show the EvoSoft copyright notice on the Evo demo.
#
# Evo checks its own files against its signed release manifest (and Security → Checklist reports any change),
# so the release is never touched. This script READS the release's four HTML entry pages and writes copies
# that also load the notice to EVO_BRAND_DIR, which the Caddyfile in this folder serves in their place:
#
#   EVO_BRAND_DIR/client/dist/index.html    the web app (login and every app route)
#   EVO_BRAND_DIR/pos/register/index.html   the register
#   EVO_BRAND_DIR/pos/stock/index.html      the stock handheld
#   EVO_BRAND_DIR/pos/display/index.html    the customer display
#   EVO_BRAND_DIR/__evosoft/evosoft-notice.css, evosoft-notice.js
#   EVO_BRAND_DIR/SOURCES.sha256            the release pages the copies were made from (for --check)
#
# The copies differ from Evo's pages by one line before </head> (a <link> and a <script src>, both same-origin);
# inline scripts are unchanged, so Evo's CSP hashes still match. Running it again gives the same result.
# Run it (as root) after installing or updating the release. evo-demo.service runs it before every start
# and reset-demo.sh after every reset, so a release update can't leave copies of an older release behind.
#
#   brand-evo.sh            build / refresh the copies
#   brand-evo.sh --check    exit 0 if the copies exist and were made from the installed release, else 1
#   brand-evo.sh --remove   delete the copies (Caddy then sends Evo's pages unchanged, without the notice)
#
#   EVO_DIR           the Evo release folder                     default /opt/evo-demo/current
#   EVO_BRAND_DIR     where the copies go (outside the release)  default /opt/evo-demo/brand
#   EVO_BRAND_ASSETS  folder with evosoft-notice.css/.js and add-notice.js
#                     default: _branding next to this script, else ../_branding (the kit layout)
#   NODE_BIN          node binary                                default node
set -Eeuo pipefail

EVO_DIR="${EVO_DIR:-/opt/evo-demo/current}"
EVO_BRAND_DIR="${EVO_BRAND_DIR:-/opt/evo-demo/brand}"
NODE_BIN="${NODE_BIN:-node}"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [[ -z "${EVO_BRAND_ASSETS:-}" ]]; then
  if [[ -f "$HERE/_branding/evosoft-notice.js" ]]; then EVO_BRAND_ASSETS="$HERE/_branding"; else EVO_BRAND_ASSETS="$HERE/../_branding"; fi
fi
PRODUCT="Evo"
# release page -> data-surface (the notice's placement for that screen)
PAGES=(client/dist/index.html pos/register/index.html pos/stock/index.html pos/display/index.html)
declare -A SURFACE=([client/dist/index.html]=web [pos/register/index.html]=register [pos/stock/index.html]=stock [pos/display/index.html]=display)

log() { printf '%s brand-evo: %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*"; }
die() { log "ERROR: $*"; exit 1; }

copies_current() {  # the copies exist, carry the notice, and were made from the installed release
  [[ -f "$EVO_BRAND_DIR/SOURCES.sha256" ]] || return 1
  (cd "$EVO_DIR" && sha256sum --check --status "$EVO_BRAND_DIR/SOURCES.sha256") || return 1
  local p
  for p in "${PAGES[@]}"; do
    "$NODE_BIN" "$EVO_BRAND_ASSETS/add-notice.js" --check "$EVO_BRAND_DIR/$p" >/dev/null 2>&1 || return 1
  done
  [[ -f "$EVO_BRAND_DIR/__evosoft/evosoft-notice.css" && -f "$EVO_BRAND_DIR/__evosoft/evosoft-notice.js" ]]
}
remove_copies() {
  local p
  for p in "${PAGES[@]}"; do rm -f "$EVO_BRAND_DIR/$p"; done
  rm -f "$EVO_BRAND_DIR/SOURCES.sha256"
}

case "${1:-}" in
  --check)
    if copies_current; then log "copies are current for $(readlink -f "$EVO_DIR")"; exit 0; fi
    log "copies are missing or were made from another release: run brand-evo.sh"; exit 1 ;;
  --remove)
    remove_copies; rm -rf "$EVO_BRAND_DIR/__evosoft"
    log "removed; Caddy now sends Evo's pages unchanged"; exit 0 ;;
  "") ;;
  *) echo "usage: brand-evo.sh [--check|--remove]" >&2; exit 2 ;;
esac

[[ -f "$EVO_DIR/app.js" && -f "$EVO_DIR/release-manifest.json" ]] || die "EVO_DIR=$EVO_DIR is not an Evo release folder"
for f in evosoft-notice.css evosoft-notice.js add-notice.js; do
  [[ -f "$EVO_BRAND_ASSETS/$f" ]] || die "$EVO_BRAND_ASSETS/$f is missing (set EVO_BRAND_ASSETS)"
done
for p in "${PAGES[@]}"; do [[ -f "$EVO_DIR/$p" ]] || die "$EVO_DIR/$p is missing"; done
case "$(realpath -m "$EVO_BRAND_DIR")/" in
  "$(realpath -m "$EVO_DIR")"/*) die "EVO_BRAND_DIR must be outside the release (Evo would report the extra files)" ;;
esac

install -d -m 0755 "$EVO_BRAND_DIR"
BUILD="$(mktemp -d "$EVO_BRAND_DIR/.build.XXXXXX")"
on_exit() {
  local rc=$?
  rm -rf "$BUILD"
  # A failed refresh must not leave copies of an older release in use: the web app would load build files
  # that no longer exist. Without copies, Caddy sends Evo's own pages (no notice, nothing broken).
  if [[ $rc -ne 0 ]] && ! copies_current; then remove_copies; log "no current copies: Caddy sends Evo's pages without the notice"; fi
}
trap on_exit EXIT

for p in "${PAGES[@]}"; do
  mkdir -p "$BUILD/$(dirname "$p")"
  "$NODE_BIN" "$EVO_BRAND_ASSETS/add-notice.js" --product "$PRODUCT" --surface "${SURFACE[$p]}" "$EVO_DIR/$p" "$BUILD/$p" >/dev/null
done
mkdir -p "$BUILD/__evosoft"
cp "$EVO_BRAND_ASSETS/evosoft-notice.css" "$EVO_BRAND_ASSETS/evosoft-notice.js" "$BUILD/__evosoft/"
(cd "$EVO_DIR" && sha256sum "${PAGES[@]}") > "$BUILD/SOURCES.sha256"
find "$BUILD" -type d -exec chmod 0755 {} + && find "$BUILD" -type f -exec chmod 0644 {} +

# Into place file by file (rename: Caddy never sees a half-written page).
for f in "${PAGES[@]}" __evosoft/evosoft-notice.css __evosoft/evosoft-notice.js SOURCES.sha256; do
  install -d -m 0755 "$EVO_BRAND_DIR/$(dirname "$f")"
  mv -f "$BUILD/$f" "$EVO_BRAND_DIR/$f"
done
copies_current || die "the copies did not check out"
log "notice copies ready in $EVO_BRAND_DIR (from $(readlink -f "$EVO_DIR"))"

#!/usr/bin/env bash
# Wipe the public Mailtabs demo and reseed it: fresh mailboxes, fresh Mailtabs database,
# the shared demo login, three connected accounts, tabs and signatures.
#
# Use it for the first start AND for every reset. Run it from cron, e.g. hourly:
#   7 * * * * cd /opt/mailtabs-demo && ./reset-demo.sh >> reset.log 2>&1
#
# While it runs (about 30-60 s), Caddy answers "being reset, back in a minute" (HTTP 503), so no
# visitor can reach the empty Mailtabs and sign up as its first user before the seeder does.
set -euo pipefail
cd "$(dirname "$0")"

PROJECT=mailtabs-demo                     # must match `name:` in docker-compose.yml
DC=(docker compose --env-file .env)

[ -f .env ] || { echo "Missing .env (cp .env.example .env and fill it in)." >&2; exit 1; }
[ -f mailtabs-src/package.json ] || { echo "Missing mailtabs-src/ (copy the Mailtabs source there)." >&2; exit 1; }

echo "== $(date -u +%FT%TZ) resetting the Mailtabs demo"
mkdir -p state/maintenance
touch state/maintenance/on
trap 'rm -f state/maintenance/on' EXIT

"${DC[@]}" build --quiet
"${DC[@]}" up -d caddy                    # keep serving the maintenance page (and TLS)

# 1. Stop everything behind the proxy and throw away its data.
"${DC[@]}" rm --force --stop mailtabs smtp-sink dovecot
docker volume rm --force "${PROJECT}_mailtabs_data" "${PROJECT}_maildirs" >/dev/null

# 2. Fresh mail server + sample mail (dates relative to now).
"${DC[@]}" up -d dovecot smtp-sink
"${DC[@]}" run --rm seed node seed-mail.js

# 3. Fresh Mailtabs + the shared demo login, accounts, tabs, signatures (through its HTTP API).
"${DC[@]}" up -d mailtabs
"${DC[@]}" run --rm seed node seed-demo.js

echo "== $(date -u +%FT%TZ) demo is live again"
# The trap removes the maintenance flag.

#!/usr/bin/env bash
# EvoSoft demo server: installs the Evo and Mailtabs live demos on one fresh Ubuntu 24.04 server.
# © 2026 EvoSoft Solutions. All rights reserved.
#
# Run as root from the folder you unpacked (the one with demos/ and apps/):
#   bash demos/one-server/setup-server.sh --email you@evosoft.solutions
#
# Options:
#   --email ADDRESS        contact for the free HTTPS certificates (Let's Encrypt). Required.
#   --evo-host NAME        default evo-demo.evosoft.solutions
#   --mail-host NAME       default mail-demo.evosoft.solutions
#   --evo-zip FILE         default apps/*evo*.zip
#   --mailtabs-zip FILE    default apps/*mailtabs*.zip
#   --no-firewall          leave the firewall (ufw) alone
#
# Safe to run again (for example after uploading a newer app zip): it reinstalls the program files and
# keeps the demo settings, the Mailtabs secret key and the HTTPS certificates.

set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEMOS="$(cd "$HERE/.." && pwd)"
ROOT="$(cd "$DEMOS/.." && pwd)"

EMAIL=""
EVO_HOST="evo-demo.evosoft.solutions"
MAIL_HOST="mail-demo.evosoft.solutions"
EVO_ZIP=""
MT_ZIP=""
FIREWALL=1

log()  { printf '\n\033[1;33m== %s\033[0m\n' "$*"; }
ok()   { printf '   \033[32mok\033[0m %s\n' "$*"; }
warn() { printf '   \033[33mwarning:\033[0m %s\n' "$*"; }
die()  { printf '\n\033[31mERROR:\033[0m %s\n' "$*" >&2; exit 1; }

while [ $# -gt 0 ]; do
  case "$1" in
    --email) EMAIL="${2:-}"; shift 2 ;;
    --evo-host) EVO_HOST="${2:-}"; shift 2 ;;
    --mail-host) MAIL_HOST="${2:-}"; shift 2 ;;
    --evo-zip) EVO_ZIP="${2:-}"; shift 2 ;;
    --mailtabs-zip) MT_ZIP="${2:-}"; shift 2 ;;
    --no-firewall) FIREWALL=0; shift ;;
    -h|--help) sed -n '2,19p' "$0"; exit 0 ;;
    *) die "Unknown option: $1 (see --help)" ;;
  esac
done

[ "$(id -u)" = 0 ] || die "Run this as root: sudo bash $0 --email you@example.com"
[[ "$EMAIL" == *@*.* ]] || die "Add --email you@yourdomain (used for the free HTTPS certificates)."
for h in "$EVO_HOST" "$MAIL_HOST"; do [[ "$h" =~ ^[a-z0-9.-]+$ ]] || die "Not a valid host name: $h"; done
EVO_ZIP="${EVO_ZIP:-$(ls "$ROOT"/apps/*evo*.zip 2>/dev/null | head -n1 || true)}"
MT_ZIP="${MT_ZIP:-$(ls "$ROOT"/apps/*mailtabs*.zip 2>/dev/null | head -n1 || true)}"
[ -f "$EVO_ZIP" ] || die "Evo release zip not found (expected apps/evo-2.1.0.zip, or pass --evo-zip)."
[ -f "$MT_ZIP" ] || die "Mailtabs zip not found (expected apps/mailtabs.zip, or pass --mailtabs-zip)."
for f in evo/Caddyfile evo/demo.env evo/brand-evo.sh mailtabs/docker-compose.yml _branding/evosoft-notice.js one-server/mail-demo.caddy; do
  [ -f "$DEMOS/$f" ] || die "Missing $DEMOS/$f. Unpack the whole bundle and run the script from inside it."
done
. /etc/os-release
[ "${ID:-}" = ubuntu ] || warn "Written for Ubuntu 24.04; this is ${PRETTY_NAME:-unknown}. Continuing."

exec > >(tee -a /root/evosoft-setup.log) 2>&1
echo "Setup started $(date -u +%FT%TZ). Log: /root/evosoft-setup.log"

# ---------------------------------------------------------------------------------------------
log "0/7 Checking DNS"
SERVER_IP="$(ip -4 route get 1.1.1.1 2>/dev/null | awk '{for (i = 1; i <= NF; i++) if ($i == "src") { print $(i + 1); exit }}')"
echo "   This server's IPv4 address: ${SERVER_IP:-unknown}"
for h in "$EVO_HOST" "$MAIL_HOST"; do
  r="$(getent ahostsv4 "$h" 2>/dev/null | awk 'NR == 1 { print $1 }')"
  if [ -z "$r" ]; then warn "$h has no DNS record yet. Add an A record pointing to ${SERVER_IP:-this server}; HTTPS starts working once it resolves."
  elif [ -n "$SERVER_IP" ] && [ "$r" != "$SERVER_IP" ]; then warn "$h points to $r, not to this server (${SERVER_IP}). Fix the A record; HTTPS starts working once it's right."
  else ok "$h -> $r"; fi
done

# ---------------------------------------------------------------------------------------------
log "1/7 System packages"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y ca-certificates curl gnupg unzip openssl cron ufw debian-keyring debian-archive-keyring apt-transport-https
MEM_MB="$(awk '/MemTotal/ { print int($2 / 1024) }' /proc/meminfo)"
if [ "$MEM_MB" -lt 3000 ] && ! swapon --show | grep -q .; then
  echo "   ${MEM_MB} MB of memory and no swap: adding a 2 GB swap file so builds don't run out of memory."
  fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile >/dev/null && swapon /swapfile
  grep -q '^/swapfile ' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi
ok "packages"

log "2/7 Node.js 24 (runs Evo)"
if ! node -v 2>/dev/null | grep -q '^v24\.'; then
  curl -fsSL https://deb.nodesource.com/setup_24.x | bash -
  apt-get install -y nodejs
fi
ok "node $(node -v)"

log "3/7 Caddy (web server with automatic HTTPS)"
if ! caddy version 2>/dev/null | grep -qE '^v2\.([89]|[1-9][0-9])\.'; then
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor --yes -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' > /etc/apt/sources.list.d/caddy-stable.list
  chmod o+r /usr/share/keyrings/caddy-stable-archive-keyring.gpg /etc/apt/sources.list.d/caddy-stable.list
  apt-get update -y
  apt-get install -y caddy
fi
ok "caddy $(caddy version | awk '{ print $1 }')"

log "4/7 Docker (runs the Mailtabs demo)"
if ! docker compose version >/dev/null 2>&1 || ! docker buildx version >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com | sh
fi
systemctl enable --now docker >/dev/null 2>&1 || true
ok "$(docker --version), compose $(docker compose version --short)"

# ---------------------------------------------------------------------------------------------
log "5/7 Evo demo ($EVO_HOST)"
id evo-demo >/dev/null 2>&1 || useradd --system --home /var/lib/evo-demo --shell /usr/sbin/nologin evo-demo
install -d -o evo-demo -g evo-demo -m 0700 /var/lib/evo-demo
TMP="$(mktemp -d)"
unzip -q "$EVO_ZIP" -d "$TMP"
EVO_SRC="$(find "$TMP" -maxdepth 3 -name app.js -path '*' -printf '%h\n' | while read -r d; do [ -f "$d/package.json" ] && grep -q '"name": "evo"' "$d/package.json" && echo "$d"; done | head -n1)"
[ -n "$EVO_SRC" ] || die "$EVO_ZIP doesn't look like an Evo release (no app.js + package.json named evo)."
EVO_VERSION="$(node -p "require('$EVO_SRC/package.json').version")"
if [ ! -f "/opt/evo-demo/releases/$EVO_VERSION/app.js" ]; then
  mkdir -p /opt/evo-demo/releases
  rm -rf "/opt/evo-demo/releases/$EVO_VERSION"
  mv "$EVO_SRC" "/opt/evo-demo/releases/$EVO_VERSION"
  (cd "/opt/evo-demo/releases/$EVO_VERSION" && npm ci --omit=dev --no-audit --no-fund)
fi
rm -rf "$TMP"
chown -R root:root /opt/evo-demo/releases && chmod -R go-w /opt/evo-demo/releases
ln -sfn "releases/$EVO_VERSION" /opt/evo-demo/current
install -d -m 0755 /etc/evo
if [ -f /etc/evo/evo-demo.env ]; then echo "   Keeping the existing /etc/evo/evo-demo.env"; else install -m 0640 -o root -g evo-demo "$DEMOS/evo/demo.env" /etc/evo/evo-demo.env; fi
install -m 0644 "$DEMOS/evo/systemd/evo-demo.service" "$DEMOS/evo/systemd/evo-demo-reset.service" "$DEMOS/evo/systemd/evo-demo-reset.timer" /etc/systemd/system/
install -m 0755 "$DEMOS/evo/reset-demo.sh" "$DEMOS/evo/brand-evo.sh" /opt/evo-demo/
install -d -m 0755 /opt/evo-demo/_branding
install -m 0644 "$DEMOS/_branding/evosoft-notice.css" "$DEMOS/_branding/evosoft-notice.js" "$DEMOS/_branding/add-notice.js" /opt/evo-demo/_branding/
/opt/evo-demo/brand-evo.sh
systemctl daemon-reload
systemctl enable evo-demo evo-demo-reset.timer >/dev/null 2>&1
systemctl restart evo-demo
systemctl start evo-demo-reset.timer
for _ in $(seq 1 60); do curl -fsS -o /dev/null http://127.0.0.1:3101/api/health/ready && break; sleep 2; done
curl -fsS -o /dev/null http://127.0.0.1:3101/api/health/ready && ok "Evo $EVO_VERSION is running" || die "Evo didn't start. See: journalctl -u evo-demo -n 60"

# ---------------------------------------------------------------------------------------------
log "6/7 Mailtabs demo ($MAIL_HOST) - the first build takes a few minutes"
MT=/opt/mailtabs-demo
mkdir -p "$MT"
cp -a "$DEMOS/mailtabs/." "$MT/"
install -d -m 0755 /opt/_branding
install -m 0644 "$DEMOS/_branding/"*.js "$DEMOS/_branding/"*.css /opt/_branding/
TMP="$(mktemp -d)"
unzip -q "$MT_ZIP" -d "$TMP"
MT_SRC="$(find "$TMP" -maxdepth 3 -name server.js -printf '%h\n' | while read -r d; do [ -f "$d/package.json" ] && grep -q '"name": "mailtabs"' "$d/package.json" && echo "$d"; done | head -n1)"
[ -n "$MT_SRC" ] || die "$MT_ZIP doesn't look like the Mailtabs source (no server.js + package.json named mailtabs)."
rm -rf "$MT/mailtabs-src"
mv "$MT_SRC" "$MT/mailtabs-src"
rm -rf "$TMP"
if [ -f "$MT/.env" ]; then
  echo "   Keeping the existing $MT/.env"
else
  umask 077
  cat > "$MT/.env" <<EOF
# Written by setup-server.sh. One-server setup: the host's Caddy owns ports 80/443.
DEMO_HOSTNAME=$MAIL_HOST
ACME_EMAIL=$EMAIL
SECRET_KEY=$(openssl rand -hex 32)
DEMO_LOGIN_EMAIL=demo@mailtabs.demo.test
DEMO_LOGIN_PASSWORD=mailtabs-demo
CADDY_HTTP_PORT=127.0.0.1:8081
CADDY_HTTPS_PORT=127.0.0.1:8444
SITE_SCHEME=http://
TRUSTED_PROXIES=private_ranges
MAILTABS_TRUST_PROXY=2
EOF
  umask 022
fi
chmod 600 "$MT/.env"
chmod +x "$MT/reset-demo.sh"
(cd "$MT" && ./reset-demo.sh)
cat > /etc/cron.d/mailtabs-demo <<'EOF'
# Reset the Mailtabs demo every hour (fresh sample mail, visitors' changes wiped). © 2026 EvoSoft Solutions.
7 * * * * root cd /opt/mailtabs-demo && ./reset-demo.sh >> /var/log/mailtabs-demo-reset.log 2>&1
EOF
chmod 644 /etc/cron.d/mailtabs-demo
code="$(curl -s -o /dev/null -w '%{http_code}' -H "Host: $MAIL_HOST" http://127.0.0.1:8081/)"
[ "$code" = 200 ] && ok "Mailtabs is running" || warn "Mailtabs answered HTTP $code on 127.0.0.1:8081 (see: cd $MT && docker compose logs --tail 50)"

# ---------------------------------------------------------------------------------------------
log "7/7 HTTPS for both demos, and the firewall"
install -d -m 0755 /etc/caddy/sites
[ -f /etc/caddy/Caddyfile.orig ] || cp /etc/caddy/Caddyfile /etc/caddy/Caddyfile.orig 2>/dev/null || true
install -m 0644 "$DEMOS/evo/Caddyfile" /etc/caddy/sites/evo-demo.caddy
install -m 0644 "$DEMOS/one-server/mail-demo.caddy" /etc/caddy/sites/mail-demo.caddy
cat > /etc/caddy/Caddyfile <<EOF
# EvoSoft demo server (written by setup-server.sh). © 2026 EvoSoft Solutions. All rights reserved.
{
	email $EMAIL
}

import /etc/caddy/sites/*.caddy
EOF
install -d -m 0755 /etc/systemd/system/caddy.service.d
cat > /etc/systemd/system/caddy.service.d/evosoft.conf <<EOF
[Service]
Environment=EVO_DEMO_HOST=$EVO_HOST MAIL_DEMO_HOST=$MAIL_HOST
EOF
EVO_DEMO_HOST="$EVO_HOST" MAIL_DEMO_HOST="$MAIL_HOST" caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile >/dev/null 2>&1 \
  || { EVO_DEMO_HOST="$EVO_HOST" MAIL_DEMO_HOST="$MAIL_HOST" caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile; die "The Caddy configuration didn't validate."; }
systemctl daemon-reload
systemctl enable caddy >/dev/null 2>&1
systemctl restart caddy
ok "Caddy is serving $EVO_HOST and $MAIL_HOST"

if [ "$FIREWALL" = 1 ]; then
  SSH_PORT="${SSH_CONNECTION##* }"
  [[ "$SSH_PORT" =~ ^[0-9]+$ ]] || SSH_PORT="$(sshd -T 2>/dev/null | awk '/^port / { print $2; exit }')"
  SSH_PORT="${SSH_PORT:-22}"
  ufw allow "$SSH_PORT/tcp" >/dev/null
  ufw allow 80/tcp >/dev/null
  ufw allow 443/tcp >/dev/null
  ufw allow 443/udp >/dev/null
  # The Mailtabs containers may not reach this server itself (README, "Hardening on the VPS").
  ufw insert 1 deny from 172.31.250.0/24 >/dev/null 2>&1 || ufw deny from 172.31.250.0/24 >/dev/null
  ufw --force enable >/dev/null
  ok "firewall: SSH ($SSH_PORT), 80 and 443 open; everything else closed"
fi

# ---------------------------------------------------------------------------------------------
log "Done"
check() {
  local code
  code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 "https://$1$2" || true)"
  if [ "$code" = 200 ]; then ok "https://$1 is live"; else warn "https://$1 isn't reachable yet (HTTP $code). If DNS was just added, give it a few minutes; Caddy keeps retrying the certificate (journalctl -u caddy -n 50)."; fi
}
check "$EVO_HOST" /api/health/ready
check "$MAIL_HOST" /
cat <<EOF

   Evo demo:       https://$EVO_HOST/login        hr@evo.test / demo1234   (resets every 3 hours)
   Mailtabs demo:  https://$MAIL_HOST              demo@mailtabs.demo.test / mailtabs-demo   (resets every hour)

   Logs:   journalctl -u evo-demo -n 50      cd $MT && docker compose logs --tail 50      journalctl -u caddy -n 50
   Setup log saved in /root/evosoft-setup.log
EOF

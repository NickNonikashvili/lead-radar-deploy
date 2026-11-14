#!/usr/bin/env bash
# EvoSoft demo server: installs the Evo, Mailtabs and StudyCat live demos on one fresh Ubuntu 24.04 server.
# © 2026 EvoSoft Solutions. All rights reserved.
#
# Run as root from the folder you unpacked (the one with demos/ and apps/):
#   bash demos/one-server/setup-server.sh --email you@evosoft.solutions
#
# Options:
#   --email ADDRESS        contact for the free HTTPS certificates (Let's Encrypt). Required.
#   --evo-host NAME        default evo-demo.evosoft.solutions
#   --mail-host NAME       default mail-demo.evosoft.solutions
#   --studycat-host NAME   default studycat-demo.evosoft.solutions
#   --evo-zip FILE         default apps/*evo*.zip
#   --mailtabs-zip FILE    default apps/*mailtabs*.zip
#   --studycat-zip FILE    default the newest apps/calc1-deploy-*.zip (StudyCat's deploy zip). With no StudyCat zip,
#                          StudyCat is skipped, or kept as it is if an earlier run installed it.
#   --no-firewall          leave the firewall (ufw) alone
#
# Safe to run again (for example after uploading a newer app zip): it reinstalls the program files and
# keeps the demo settings, the Mailtabs secret key, the StudyCat demo database and the HTTPS certificates.

set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEMOS="$(cd "$HERE/.." && pwd)"
ROOT="$(cd "$DEMOS/.." && pwd)"

EMAIL=""
EVO_HOST="evo-demo.evosoft.solutions"
MAIL_HOST="mail-demo.evosoft.solutions"
SC_HOST="studycat-demo.evosoft.solutions"
EVO_ZIP=""
MT_ZIP=""
SC_ZIP=""
FIREWALL=1

# The StudyCat demo (PHP + SQLite): its site, and its database and files outside the site (kept on every re-run).
SC_WEB=/var/www/studycat-demo
SC_DATA=/var/lib/studycat-demo
SC_LOG=/var/log/studycat-demo
SC_USER=studycat-demo
SC_SOCK=/run/php/studycat-demo.sock

log()  { printf '\n\033[1;33m== %s\033[0m\n' "$*"; }
ok()   { printf '   \033[32mok\033[0m %s\n' "$*"; }
warn() { printf '   \033[33mwarning:\033[0m %s\n' "$*"; }
die()  { printf '\n\033[31mERROR:\033[0m %s\n' "$*" >&2; exit 1; }

while [ $# -gt 0 ]; do
  case "$1" in
    --email) EMAIL="${2:-}"; shift 2 ;;
    --evo-host) EVO_HOST="${2:-}"; shift 2 ;;
    --mail-host) MAIL_HOST="${2:-}"; shift 2 ;;
    --studycat-host) SC_HOST="${2:-}"; shift 2 ;;
    --evo-zip) EVO_ZIP="${2:-}"; shift 2 ;;
    --mailtabs-zip) MT_ZIP="${2:-}"; shift 2 ;;
    --studycat-zip) SC_ZIP="${2:-}"; shift 2 ;;
    --no-firewall) FIREWALL=0; shift ;;
    -h|--help) sed -n '2,21p' "$0"; exit 0 ;;
    *) die "Unknown option: $1 (see --help)" ;;
  esac
done

[ "$(id -u)" = 0 ] || die "Run this as root: sudo bash $0 --email you@example.com"
[[ "$EMAIL" == *@*.* ]] || die "Add --email you@yourdomain (used for the free HTTPS certificates)."
for h in "$EVO_HOST" "$MAIL_HOST" "$SC_HOST"; do [[ "$h" =~ ^[a-z0-9.-]+$ ]] || die "Not a valid host name: $h"; done
EVO_ZIP="${EVO_ZIP:-$(ls "$ROOT"/apps/*evo*.zip 2>/dev/null | head -n1 || true)}"
MT_ZIP="${MT_ZIP:-$(ls "$ROOT"/apps/*mailtabs*.zip 2>/dev/null | head -n1 || true)}"
[ -f "$EVO_ZIP" ] || die "Evo release zip not found (expected apps/evo-2.1.0.zip, or pass --evo-zip)."
[ -f "$MT_ZIP" ] || die "Mailtabs zip not found (expected apps/mailtabs.zip, or pass --mailtabs-zip)."
for f in evo/Caddyfile evo/demo.env evo/brand-evo.sh mailtabs/docker-compose.yml _branding/evosoft-notice.js one-server/mail-demo.caddy; do
  [ -f "$DEMOS/$f" ] || die "Missing $DEMOS/$f. Unpack the whole bundle and run the script from inside it."
done
# StudyCat is optional: its deploy zip (the same calc1-deploy-<build>.zip as studycat.org; the newest one if there are
# several), or the Hostinger upload bundle that holds it. SC_ON: install it now, or keep the copy an earlier run installed.
SC_ZIP="${SC_ZIP:-$(ls "$ROOT"/apps/calc1-deploy-*.zip 2>/dev/null | sort -V | tail -n1 || true)}"
SC_ZIP="${SC_ZIP:-$(ls "$ROOT"/apps/*studycat*.zip 2>/dev/null | sort -V | tail -n1 || true)}"
[ -z "$SC_ZIP" ] || [ -f "$SC_ZIP" ] || die "StudyCat zip not found: $SC_ZIP"
if [ -n "$SC_ZIP" ] || [ -f "$SC_WEB/api/index.php" ]; then SC_ON=1; else SC_ON=0; fi
if [ "$SC_ON" = 1 ]; then
  for f in studycat/config.local.php studycat/demo-seed.php studycat/robots.txt _branding/evosoft-notice.css one-server/studycat-demo.caddy; do
    [ -f "$DEMOS/$f" ] || die "Missing $DEMOS/$f. Unpack the whole bundle and run the script from inside it."
  done
fi
. /etc/os-release
[ "${ID:-}" = ubuntu ] || warn "Written for Ubuntu 24.04; this is ${PRETTY_NAME:-unknown}. Continuing."

exec > >(tee -a /root/evosoft-setup.log) 2>&1
echo "Setup started $(date -u +%FT%TZ). Log: /root/evosoft-setup.log"

# ---------------------------------------------------------------------------------------------
log "0/8 Checking DNS"
SERVER_IP="$(ip -4 route get 1.1.1.1 2>/dev/null | awk '{for (i = 1; i <= NF; i++) if ($i == "src") { print $(i + 1); exit }}')"
echo "   This server's IPv4 address: ${SERVER_IP:-unknown}"
HOSTS=("$EVO_HOST" "$MAIL_HOST")
if [ "$SC_ON" = 1 ]; then HOSTS+=("$SC_HOST"); fi
for h in "${HOSTS[@]}"; do
  r="$(getent ahostsv4 "$h" 2>/dev/null | awk 'NR == 1 { print $1 }')"
  if [ -z "$r" ]; then warn "$h has no DNS record yet. Add an A record pointing to ${SERVER_IP:-this server}; HTTPS starts working once it resolves."
  elif [ -n "$SERVER_IP" ] && [ "$r" != "$SERVER_IP" ]; then warn "$h points to $r, not to this server (${SERVER_IP}). Fix the A record; HTTPS starts working once it's right."
  else ok "$h -> $r"; fi
done

# ---------------------------------------------------------------------------------------------
log "1/8 System packages"
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

log "2/8 Node.js 24 (runs Evo)"
if ! node -v 2>/dev/null | grep -q '^v24\.'; then
  curl -fsSL https://deb.nodesource.com/setup_24.x | bash -
  apt-get install -y nodejs
fi
ok "node $(node -v)"

log "3/8 Caddy (web server with automatic HTTPS)"
if ! caddy version 2>/dev/null | grep -qE '^v2\.([89]|[1-9][0-9])\.'; then
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor --yes -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' > /etc/apt/sources.list.d/caddy-stable.list
  chmod o+r /usr/share/keyrings/caddy-stable-archive-keyring.gpg /etc/apt/sources.list.d/caddy-stable.list
  apt-get update -y
  apt-get install -y caddy
fi
ok "caddy $(caddy version | awk '{ print $1 }')"

log "4/8 Docker (runs the Mailtabs demo)"
if ! docker compose version >/dev/null 2>&1 || ! docker buildx version >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com | sh
fi
systemctl enable --now docker >/dev/null 2>&1 || true
ok "$(docker --version), compose $(docker compose version --short)"

# ---------------------------------------------------------------------------------------------
log "5/8 Evo demo ($EVO_HOST)"
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
log "6/8 Mailtabs demo ($MAIL_HOST) - the first build takes a few minutes"
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
log "7/8 StudyCat demo ($SC_HOST)"
if [ "$SC_ON" = 0 ]; then
  echo "   No StudyCat deploy zip in apps/ (calc1-deploy-<build>.zip): skipping the StudyCat demo."
  echo "   To add it later: put the zip in apps/, add the DNS record for $SC_HOST and run this setup again."
else
  # PHP 8.3 with what StudyCat uses: SQLite, mbstring, curl, gd (pictures), zip (Word files), xml; opcache for speed.
  apt-get install -y php8.3-fpm php8.3-cli php8.3-sqlite3 php8.3-mbstring php8.3-curl php8.3-gd php8.3-zip php8.3-xml php8.3-opcache
  id caddy >/dev/null 2>&1 || die "There is no 'caddy' user (Caddy wasn't installed from its package in step 3)."
  id "$SC_USER" >/dev/null 2>&1 || useradd --system --home "$SC_DATA" --shell /usr/sbin/nologin "$SC_USER"
  install -d -o "$SC_USER" -g "$SC_USER" -m 0750 "$SC_DATA" "$SC_DATA/api-data" "$SC_LOG"

  if [ -n "$SC_ZIP" ]; then
    # A new copy of the site next to the live one; it goes live in one step below. Nothing in it is kept from the old
    # copy: everything StudyCat writes lives in $SC_DATA.
    install -d -m 0755 "$(dirname "$SC_WEB")"
    TMP="$(mktemp -d "$(dirname "$SC_WEB")/.studycat-demo-new.XXXXXX")"
    sc_find() {   # the folder with index.html, api/index.php and api/lib.php
      local f
      while IFS= read -r f; do
        f="$(dirname "$(dirname "$f")")"
        if [ -f "$f/index.html" ] && [ -f "$f/api/lib.php" ]; then echo "$f"; return 0; fi
      done < <(find "$1" -maxdepth 3 -path '*/api/index.php' | sort)
    }
    unzip -q "$SC_ZIP" -d "$TMP/zip"
    SC_DIR="$(sc_find "$TMP/zip")"
    if [ -z "$SC_DIR" ]; then   # the Hostinger upload bundle (studycat-demo-upload.zip) holds the deploy zip
      SC_INNER="$(find "$TMP/zip" -maxdepth 2 -name 'calc1-deploy-*.zip' | sort -V | tail -n1)"
      if [ -n "$SC_INNER" ]; then unzip -q "$SC_INNER" -d "$TMP/inner"; SC_DIR="$(sc_find "$TMP/inner")"; fi
    fi
    [ -n "$SC_DIR" ] || { rm -rf "$TMP"; die "$SC_ZIP doesn't look like StudyCat's deploy zip (no index.html with api/index.php and api/lib.php)."; }
    SC_BUILD="$(sed -n '/data-build="/{s/.*data-build="\([^"]*\)".*/\1/p;q}' "$SC_DIR/index.html")"
    echo "   StudyCat build ${SC_BUILD:-unknown} from $(basename "$SC_ZIP")"
  else
    echo "   No new StudyCat zip in apps/: keeping the installed StudyCat site, refreshing the demo settings."
    SC_DIR="$SC_WEB"
  fi

  # The demo kit (demos/studycat/README.md): demo settings, the seed/reset, the copyright notice files, robots.txt,
  # and where the database lives. api/data (StudyCat's mail.log, Bo's files) becomes a link into $SC_DATA too.
  if [ -d "$SC_WEB/api/data" ] && [ ! -L "$SC_WEB/api/data" ]; then cp -a "$SC_WEB/api/data/." "$SC_DATA/api-data/"; fi
  rm -rf "$SC_DIR/api/data"
  ln -s "$SC_DATA/api-data" "$SC_DIR/api/data"
  install -m 0644 "$DEMOS/studycat/config.local.php" "$DEMOS/studycat/demo-seed.php" \
    "$DEMOS/_branding/evosoft-notice.css" "$DEMOS/_branding/evosoft-notice.js" "$SC_DIR/api/"
  printf "<?php\n// Written by setup-server.sh: the StudyCat demo's database and files, outside the web root.\nreturn '%s';\n" "$SC_DATA" > "$SC_DIR/api/demo-data-path.php"
  install -m 0644 "$DEMOS/studycat/robots.txt" "$SC_DIR/robots.txt"
  # The copyright notice on every page (it writes only the site's pages and __evosoft/, so it runs before the site
  # is made read-only for PHP).
  php8.3 "$SC_DIR/api/demo-seed.php" --brand | sed 's/^/   /' || warn "The copyright notice could not be added to every page (see above)."
  # The site's files belong to root and are read-only for PHP; the data folder belongs to the demo's PHP user.
  chown -R root:root "$SC_DIR"
  find "$SC_DIR" -type d -exec chmod 0755 {} +
  find "$SC_DIR" -type f -exec chmod 0644 {} +
  chown -R "$SC_USER:$SC_USER" "$SC_DATA" "$SC_LOG"
  chmod 0750 "$SC_DATA" "$SC_LOG"
  if [ -n "$SC_ZIP" ]; then
    if [ -e "$SC_WEB" ]; then mv "$SC_WEB" "$TMP/old"; fi
    mv "$SC_DIR" "$SC_WEB"
    rm -rf "$TMP"
  fi

  # Its own PHP-FPM pool: PHP runs as $SC_USER, and only Caddy may use the socket.
  cat > /etc/php/8.3/fpm/pool.d/studycat-demo.conf <<EOF
; StudyCat demo (written by setup-server.sh). © 2026 EvoSoft Solutions.
[studycat-demo]
user = $SC_USER
group = $SC_USER
listen = $SC_SOCK
listen.owner = caddy
listen.group = caddy
listen.mode = 0660
pm = ondemand
pm.max_children = 8
pm.process_idle_timeout = 60s
pm.max_requests = 500
php_admin_flag[log_errors] = on
php_admin_value[error_log] = $SC_LOG/php-error.log
env[STUDYCAT_DEMO_URL] = https://$SC_HOST
EOF
  php-fpm8.3 -t >/dev/null 2>&1 || { php-fpm8.3 -t; die "The PHP-FPM settings didn't validate."; }
  systemctl enable php8.3-fpm >/dev/null 2>&1
  systemctl restart php8.3-fpm
  for _ in $(seq 1 15); do [ -S "$SC_SOCK" ] && break; sleep 1; done
  [ -S "$SC_SOCK" ] || die "PHP-FPM didn't start. See: journalctl -u php8.3-fpm -n 50"

  # The demo accounts and content (demos/studycat/README.md). A database from an earlier run is kept.
  sc_seed() { (cd / && runuser -u "$SC_USER" -- php8.3 "$SC_WEB/api/demo-seed.php" "$@"); }
  if [ -f "$SC_DATA/studycat-demo.sqlite" ]; then
    echo "   Keeping the demo database in $SC_DATA; putting the demo accounts back."
    sc_seed --repair | sed 's/^/   /' || die "Repairing the StudyCat demo accounts failed (see above)."
  else
    sc_seed | sed 's/^/   /' || die "Filling the StudyCat demo failed (see above)."
  fi
  sc_seed --check | sed 's/^/   /' || warn "The StudyCat demo check reported a problem (see above)."

  # Nightly full reset and the 10-minute account repair (demos/studycat/README.md, "Nightly reset").
  cat > /etc/cron.d/studycat-demo <<EOF
# StudyCat demo (written by setup-server.sh). © 2026 EvoSoft Solutions.
# 09:17 server time (UTC: 2:17 am in Montana): full reset, visitors' changes wiped, fresh demo content.
# Every 10 minutes: the demo accounts put back (password, roles, not banned) and their shared sign-in limits cleared.
17 9 * * * $SC_USER /usr/bin/php8.3 $SC_WEB/api/demo-seed.php --quiet >> $SC_LOG/reset.log 2>&1
*/10 * * * * $SC_USER /usr/bin/php8.3 $SC_WEB/api/demo-seed.php --repair --quiet >> $SC_LOG/reset.log 2>&1
EOF
  chmod 644 /etc/cron.d/studycat-demo
  cat > /etc/logrotate.d/studycat-demo <<EOF
$SC_LOG/*.log {
	su $SC_USER $SC_USER
	weekly
	rotate 4
	compress
	missingok
	notifempty
	copytruncate
}
EOF
  ok "StudyCat demo installed in $SC_WEB (database in $SC_DATA)"
fi

# ---------------------------------------------------------------------------------------------
log "8/8 HTTPS for the demos, and the firewall"
install -d -m 0755 /etc/caddy/sites
[ -f /etc/caddy/Caddyfile.orig ] || cp /etc/caddy/Caddyfile /etc/caddy/Caddyfile.orig 2>/dev/null || true
install -m 0644 "$DEMOS/evo/Caddyfile" /etc/caddy/sites/evo-demo.caddy
install -m 0644 "$DEMOS/one-server/mail-demo.caddy" /etc/caddy/sites/mail-demo.caddy
if [ "$SC_ON" = 1 ]; then install -m 0644 "$DEMOS/one-server/studycat-demo.caddy" /etc/caddy/sites/studycat-demo.caddy; else rm -f /etc/caddy/sites/studycat-demo.caddy; fi
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
Environment=EVO_DEMO_HOST=$EVO_HOST MAIL_DEMO_HOST=$MAIL_HOST STUDYCAT_DEMO_HOST=$SC_HOST
EOF
EVO_DEMO_HOST="$EVO_HOST" MAIL_DEMO_HOST="$MAIL_HOST" STUDYCAT_DEMO_HOST="$SC_HOST" caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile >/dev/null 2>&1 \
  || { EVO_DEMO_HOST="$EVO_HOST" MAIL_DEMO_HOST="$MAIL_HOST" STUDYCAT_DEMO_HOST="$SC_HOST" caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile; die "The Caddy configuration didn't validate."; }
systemctl daemon-reload
systemctl enable caddy >/dev/null 2>&1
systemctl restart caddy
if [ "$SC_ON" = 1 ]; then ok "Caddy is serving $EVO_HOST, $MAIL_HOST and $SC_HOST"; else ok "Caddy is serving $EVO_HOST and $MAIL_HOST"; fi

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
if [ "$SC_ON" = 1 ]; then check "$SC_HOST" "/api/index.php?r=health"; fi
cat <<EOF

   Evo demo:       https://$EVO_HOST/login        hr@evo.test / demo1234   (resets every 3 hours)
   Mailtabs demo:  https://$MAIL_HOST              demo@mailtabs.demo.test / mailtabs-demo   (resets every hour)
EOF
if [ "$SC_ON" = 1 ]; then
  echo "   StudyCat demo:  https://$SC_HOST          student@studycat.test / demo-study-2026   (resets nightly)"
fi
cat <<EOF

   Logs:   journalctl -u evo-demo -n 50      cd $MT && docker compose logs --tail 50      journalctl -u caddy -n 50
EOF
if [ "$SC_ON" = 1 ]; then echo "           StudyCat: $SC_LOG/ (resets, PHP errors)"; fi
echo "   Setup log saved in /root/evosoft-setup.log"

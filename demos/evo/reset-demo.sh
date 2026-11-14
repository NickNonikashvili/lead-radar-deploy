#!/usr/bin/env bash
# reset-demo.sh: put the public Evo demo back to a fresh "Bluefield Market Co." demo company.
#
# What it does, in order:
#   1. loads the demo settings (EVO_ENV_FILE, default /etc/evo/evo-demo.env);
#   2. stops Evo (the demo reset refuses to run while Evo uses the data folder);
#   3. runs Evo's own reset: `node server/tools/seed.js --reset` with DEMO_PASSWORD / DEMO_PIN /
#      SEED_TZ, so every sign-in in the README tables works again (it backs up both databases to
#      DATA_DIR/backups/pre-seed-*.db first and keeps the newest 5 per database);
#      if that is refused (for example a visitor renamed the company), it falls back to moving the
#      databases aside and letting Evo load a fresh demo at start (SEED_DEMO=true);
#   4. starts Evo and waits for /api/health/ready;
#   5. optionally (DEMO_GEOFENCE_MODE=flag|off) relaxes the Downtown Store geofence so visitors
#      anywhere in the world can try the employee clock-in (the punch is flagged for review
#      instead of refused). Done through Evo's own API, signed in as the demo owner.
#
# Run it as root (it stops/starts the service and runs the seed as the service user), from cron or
# the systemd timer in this folder. Every setting below can be overridden from the environment.
#
#   EVO_DIR            the Evo release folder (contains app.js)           default /opt/evo-demo/current
#   EVO_ENV_FILE       the demo settings file (systemd EnvironmentFile)   default /etc/evo/evo-demo.env
#   EVO_SERVICE        systemd unit to stop/start                          default evo-demo
#   EVO_USER           user that owns DATA_DIR and runs Evo ("" = current) default evo-demo
#   EVO_STOP_CMD       command that stops Evo   (overrides systemctl, e.g. "docker stop -t 20 evo-demo")
#   EVO_START_CMD      command that starts Evo  (overrides systemctl, e.g. "docker start evo-demo")
#   EVO_HEALTH_URL     readiness URL            default http://127.0.0.1:$PORT/api/health/ready
#   NODE_BIN           node binary              default node
#   DEMO_GEOFENCE_MODE flag | off | "" (keep the seed's "block")           default "" (set it in the env file)
#   LOCK_FILE          lock against overlapping runs                       default /run/lock/evo-demo-reset.lock
#
# Exit codes: 0 reset done; 1 refused or failed (Evo is started again in every case it was running).
set -Eeuo pipefail

EVO_DIR="${EVO_DIR:-/opt/evo-demo/current}"
EVO_ENV_FILE="${EVO_ENV_FILE:-/etc/evo/evo-demo.env}"
EVO_SERVICE="${EVO_SERVICE:-evo-demo}"
EVO_USER="${EVO_USER-evo-demo}"
NODE_BIN="${NODE_BIN:-node}"
LOCK_FILE="${LOCK_FILE:-/run/lock/evo-demo-reset.lock}"

log() { printf '%s reset-demo: %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*"; }
die() { log "ERROR: $*"; exit 1; }

# ---------- 0. one run at a time ----------
if ! { exec 9>"$LOCK_FILE"; } 2>/dev/null; then LOCK_FILE="${TMPDIR:-/tmp}/evo-demo-reset.lock"; exec 9>"$LOCK_FILE"; fi
command -v flock >/dev/null && { flock -n 9 || die "another reset is running ($LOCK_FILE)"; }

# ---------- 1. settings ----------
# Values set in the environment of this script win over the file (handy for testing).
if [[ -f "$EVO_ENV_FILE" ]]; then
  declare -A keep=()
  while IFS= read -r line; do
    [[ "$line" =~ ^[[:space:]]*([A-Za-z_][A-Za-z0-9_]*)= ]] || continue
    k="${BASH_REMATCH[1]}"; [[ -n "${!k+x}" ]] && keep[$k]="${!k}"
  done < "$EVO_ENV_FILE"
  set -a; # shellcheck disable=SC1090
  . "$EVO_ENV_FILE"; set +a
  for k in "${!keep[@]}"; do export "$k=${keep[$k]}"; done
else
  log "no settings file at $EVO_ENV_FILE; using the environment only"
fi

[[ -f "$EVO_DIR/app.js" && -f "$EVO_DIR/server/tools/seed.js" ]] || die "EVO_DIR=$EVO_DIR is not an Evo release folder"
[[ "${NODE_ENV:-}" != "production" ]] || die "NODE_ENV=production: Evo refuses the demo reset (and SEED_DEMO) on production. Remove it from $EVO_ENV_FILE."
[[ -n "${DATA_DIR:-}" ]] || die "DATA_DIR is not set (set it in $EVO_ENV_FILE)"
DEMO_PASSWORD="${DEMO_PASSWORD:-}"
[[ ${#DEMO_PASSWORD} -ge 8 ]] || die "DEMO_PASSWORD must be set (8+ characters), or every reset prints a new random password"
[[ "${DEMO_PIN:-}" =~ ^[0-9]{4,12}$ ]] || die "DEMO_PIN must be set (4-12 digits)"
export DATA_DIR DEMO_PASSWORD DEMO_PIN
export SEED_TZ="${SEED_TZ:-America/Chicago}"
PORT="${PORT:-3001}"
EVO_HEALTH_URL="${EVO_HEALTH_URL:-http://127.0.0.1:${PORT}/api/health/ready}"
EVO_DB="${DB_PATH:-$DATA_DIR/evo.db}"
POS_DB="${POS_DB_PATH:-$DATA_DIR/pos.db}"

as_evo() {  # run a command as the service user, keeping this environment
  if [[ -n "$EVO_USER" && "$(id -un)" != "$EVO_USER" ]]; then runuser -u "$EVO_USER" -- "$@"; else "$@"; fi
}
stop_evo()  { if [[ -n "${EVO_STOP_CMD:-}" ]];  then bash -c "$EVO_STOP_CMD";  else systemctl stop "$EVO_SERVICE"; fi; }
start_evo() { if [[ -n "${EVO_START_CMD:-}" ]]; then bash -c "$EVO_START_CMD"; else systemctl start "$EVO_SERVICE"; fi; }

running_pids() {  # Evo writes DATA_DIR/evo-running-<pid>.json while it runs (the seed tool checks the same)
  local f pid
  for f in "$DATA_DIR"/evo-running*.json; do
    [[ -e "$f" ]] || continue
    pid="$(sed -n 's/.*"pid":[[:space:]]*\([0-9][0-9]*\).*/\1/p' "$f" | head -n1)"
    [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null && echo "$pid"
  done
  return 0
}

wait_ready() {
  local i code
  for ((i = 0; i < ${1:-90}; i++)); do
    code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 3 "$EVO_HEALTH_URL" || true)"
    [[ "$code" == 200 ]] && return 0
    sleep 1
  done
  return 1
}

STARTED_AGAIN=0
on_exit() {  # never leave the demo down because a step failed
  local rc=$?
  if [[ $rc -ne 0 && $STARTED_AGAIN -eq 0 && -n "${STOPPED:-}" ]]; then log "starting Evo again after the failure"; start_evo || true; fi
}
trap on_exit EXIT

# ---------- 2. stop ----------
log "stopping Evo"
STOPPED=1
stop_evo
for ((i = 0; i < 30; i++)); do [[ -z "$(running_pids)" ]] && break; sleep 1; done
[[ -z "$(running_pids)" ]] || die "Evo is still running on $DATA_DIR (pid $(running_pids | tr '\n' ' '))"

# ---------- 3. reset ----------
# The reset asks for the company name when it finds accounts that aren't @evo.test (a visitor may
# have added one, or renamed the company). Read the current name so the run never stalls on it.
COMPANY="$(as_evo "$NODE_BIN" --no-warnings -e '
  const { DatabaseSync } = require("node:sqlite");
  try { const db = new DatabaseSync(process.argv[1], { readOnly: true });
        const r = db.prepare("SELECT value FROM settings WHERE key = ?").get("company_name");
        process.stdout.write(r ? String(JSON.parse(r.value)) : ""); } catch { }' "$EVO_DB" 2>/dev/null || true)"

log "resetting the demo data (SEED_TZ=$SEED_TZ)"
cd "$EVO_DIR"
seed_args=(server/tools/seed.js --reset)
[[ -n "$COMPANY" ]] && seed_args+=(--confirm "$COMPANY")
if as_evo "$NODE_BIN" --no-warnings "${seed_args[@]}"; then
  log "demo data reset"
else
  log "the reset tool refused or failed; falling back to a fresh demo database"
  [[ "${SEED_DEMO:-}" == "true" ]] || die "SEED_DEMO=true is needed in $EVO_ENV_FILE for the fallback; data left as it was"
  aside="$DATA_DIR/reset-fallback-$(date -u +%Y%m%dT%H%M%SZ)"
  as_evo mkdir -p "$aside"
  for f in "$EVO_DB" "$EVO_DB"-wal "$EVO_DB"-shm "$POS_DB" "$POS_DB"-wal "$POS_DB"-shm; do
    [[ -e "$f" ]] && as_evo mv "$f" "$aside/"
  done
  # keep the newest two fallback copies
  ls -1dt "$DATA_DIR"/reset-fallback-* 2>/dev/null | tail -n +3 | xargs -r rm -rf
  log "old databases moved to $aside; Evo will load a fresh demo at start"
fi

# ---------- 4. start ----------
log "starting Evo"
start_evo
STARTED_AGAIN=1
wait_ready 120 || die "Evo did not become ready at $EVO_HEALTH_URL (check its log)"
log "Evo is ready"

# ---------- 5. optional: geofence that works for visitors anywhere ----------
case "${DEMO_GEOFENCE_MODE:-}" in
  "") ;;
  flag|off)
    log "setting the Downtown Store geofence to '$DEMO_GEOFENCE_MODE'"
    BASE_URL="${EVO_HEALTH_URL%/api/health/ready}" "$NODE_BIN" --no-warnings --input-type=module - <<'JS' || log "WARNING: could not change the geofence (the demo works, but far-away visitors can't clock in)"
const base = process.env.BASE_URL, mode = process.env.DEMO_GEOFENCE_MODE;
let cookie = '', csrf = '';
async function call(path, method = 'GET', body) {
  const r = await fetch(base + path, { method, headers: { 'content-type': 'application/json', cookie, ...(csrf ? { 'x-csrf-token': csrf } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const set = r.headers.getSetCookie?.() || [];
  if (set.length) cookie = set.map((c) => c.split(';')[0]).join('; ');
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`${method} ${path}: ${r.status} ${j.error || ''}`);
  return j;
}
const login = await call('/api/auth/login', 'POST', { email: 'hr@evo.test', password: process.env.DEMO_PASSWORD });
csrf = login.csrf_token || '';
const locs = await call('/api/locations');
const l = locs.find((x) => x.name === 'Downtown Store');
if (!l) throw new Error('Downtown Store not found');
await call(`/api/locations/${l.id}`, 'PUT', { name: l.name, address: l.address, latitude: l.latitude, longitude: l.longitude, radius_m: l.radius_m, geofence_mode: mode, active: l.active });
await call('/api/auth/logout', 'POST', {});
console.log(`Downtown Store geofence: ${mode}`);
JS
    ;;
  *) log "WARNING: DEMO_GEOFENCE_MODE must be flag, off or empty (got '$DEMO_GEOFENCE_MODE'); left as seeded" ;;
esac

log "done: sign in as hr@evo.test / ${DEMO_PASSWORD} (register PINs ${DEMO_PIN})"

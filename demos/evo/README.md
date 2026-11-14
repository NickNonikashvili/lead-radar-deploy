# Evo public demo kit

How to run a public, self-resetting demo of **Evo 2.1.0** (workforce + campus-store POS) at
`https://evo-demo.evosoft.solutions`, from the release zip, on an ordinary Linux VPS.

The demo is Evo's own built-in demo company, **Bluefield Market Co.** (17 people, 3 sites, 8 weeks of
time-clock history) and its store **Bluefield Campus Store** (items, customers, charge accounts, promotions,
about five weeks of sales). Every sign-in is fixed (`demo1234`, register PIN `1234`), and the whole thing is
put back to fresh demo data every 3 hours.

| File | What it is |
|---|---|
| `demo.env` | The demo's settings (`/etc/evo/evo-demo.env`), with the ones you must **not** set |
| `reset-demo.sh` | Stops Evo, runs Evo's demo reset, starts Evo again, checks it's up (about 5 s of downtime) |
| `systemd/evo-demo.service` | The Evo service |
| `systemd/evo-demo-reset.service`, `systemd/evo-demo-reset.timer` | Runs the reset every 3 hours |
| `evo-demo-reset.cron` | The same schedule as a cron file, if you prefer cron (use one or the other) |
| `Caddyfile` | HTTPS in front of Evo, plus a "being reset" message during the reset |

Everything here uses supported settings and Evo's own tools. No Evo file is changed, so Evo's code check still
reports "All 343 release files match the signed manifest".

---

## 1. What visitors can sign in as

Web app: `https://evo-demo.evosoft.solutions/login`. Every account's password is **`demo1234`**.

| Account | Email | Who they are | Store role |
|---|---|---|---|
| Owner (HR) | `hr@evo.test` | Hannah Reyes: owner, HR manager | Administrator (register ID 1000) |
| HR | `grace.liu@evo.test` | Grace Liu: HR, not the owner | none (no Store section) |
| Employee | `employee@evo.test` | Alex Morgan: sales associate | Cashier (1001) |
| Store manager | `omar.haddad@evo.test` | Omar Haddad | Store Manager (5001) |
| Payroll | `payroll@evo.test` | Paul Okafor | none (no Store section) |
| Shift supervisor | `jordan.lee@evo.test` | Jordan Lee | Supervisor / Lead (2001) |
| Warehouse lead | `marcus.johnson@evo.test` | Marcus Johnson | Receiving and counts (3001) |

At the register and on the stock handheld, people sign on with a **register ID and PIN `1234`**:
1000 Hannah (admin), 1001 Alex (cashier), 1002 Priya, 1004 Aisha, 1005 Noah, 1006 Diego, 1007 Emma (cashiers),
2001 Jordan (supervisor, approves overrides), 3001 Marcus and 3002 Sofia (receiving and counts),
3003 Chloe (buyer), 5001 Omar (store manager). **1003 (Ethan Brooks) is refused on purpose**: he is
deactivated in the demo.

### Trying the register (each visitor's browser must be enrolled)

1. On a **desktop or laptop** browser (Store is blocked on phones and tablets), sign in as `hr@evo.test`
   (or `omar.haddad@evo.test`).
2. Open `https://evo-demo.evosoft.solutions/pos/register/` in the same browser.
3. Under "Use this computer as", choose a register (1 to 4) and confirm. The register's sign-on screen appears.
4. Sign on as `1001`, PIN `1234` (Alex, cashier). Press **Open till**, then **OK** (the starting bank is $150).
5. Ring items: type `840001000028` (University Hoodie, the "Hoodie Special" promotion takes $10 off) and press
   Enter, or open **Quick items**. **F4** attaches a customer (try "Avery").
6. Try an override: tap a line twice → **Override price** → new price → it asks a supervisor: `2001` / `1234`.
7. **Pay** → Cash / Exact. For the customer display, open `/pos/display/` in another tab of the same browser.

The same enrolled browser also opens the stock handheld app at `/pos/stock/` (sign on `3001` / `1234`).
Enrolling a **phone** as a handheld needs a one-time code: Store → Store setup → Devices → Add device →
*A stock handheld* (as Omar or Hannah on a desktop), then type the 8-digit code on the phone's blocked screen.

---

## 2. Host it on a VPS

Any small VPS should do (Evo is one Node process with two SQLite files; 1 vCPU / 1 GB is a reasonable start). The commands are for Ubuntu / Debian.

```bash
# DNS first: an A (and AAAA) record evo-demo.evosoft.solutions -> this server.

# Node.js 24 LTS (22.13+ also works), unzip, curl; Caddy for HTTPS (https://caddyserver.com/docs/install)
curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
sudo apt-get install -y nodejs unzip curl caddy

# A service user and its data folder
sudo useradd --system --home /var/lib/evo-demo --shell /usr/sbin/nologin evo-demo
sudo install -d -o evo-demo -g evo-demo -m 0700 /var/lib/evo-demo

# The release (verify it first: DEPLOY.md "Verify a release")
sudo mkdir -p /opt/evo-demo/releases && sudo unzip evo-2.1.0.zip -d /tmp/evo-2.1.0
sudo mv /tmp/evo-2.1.0/evo /opt/evo-demo/releases/2.1.0
cd /opt/evo-demo/releases/2.1.0 && sudo npm ci --omit=dev
sudo chown -R root:root /opt/evo-demo && sudo chmod -R go-w /opt/evo-demo
sudo ln -sfn releases/2.1.0 /opt/evo-demo/current

# Settings, service, HTTPS, reset (files from this folder)
sudo install -d -m 0755 /etc/evo
sudo install -m 0640 -o root -g evo-demo demo.env /etc/evo/evo-demo.env
sudo install -m 0644 systemd/evo-demo.service systemd/evo-demo-reset.service systemd/evo-demo-reset.timer /etc/systemd/system/
sudo install -m 0755 reset-demo.sh /opt/evo-demo/reset-demo.sh
sudo cp Caddyfile /etc/caddy/Caddyfile && sudo systemctl reload caddy
sudo systemctl daemon-reload
sudo systemctl enable --now evo-demo            # the first start loads the demo company (SEED_DEMO=true)
sudo systemctl enable --now evo-demo-reset.timer
```

Check it:

```bash
journalctl -u evo-demo -n 40     # "Evo 2.1.0", "Code check: All 343 release files match", "Evo listening on http://localhost:3101"
curl -s https://evo-demo.evosoft.solutions/api/health/ready      # {"ok":true,...}
sudo systemctl start evo-demo-reset.service && journalctl -u evo-demo-reset -n 20   # one reset by hand
systemctl list-timers evo-demo-reset.timer
```

Then sign in at `https://evo-demo.evosoft.solutions/login` as `hr@evo.test` / `demo1234`.

### HTTPS and the proxy (from DEPLOY.md)

- HTTPS is required: plain HTTP to a real host name gets a 308 to `https://`, the session cookie is
  `__Host-evo_session` (Secure, SameSite=Strict), and phones only share their location (for clock-in) over HTTPS.
- Caddy (or nginx) **on the same machine**: leave `TRUST_PROXY` unset (the default, `loopback`, is right).
  Docker behind a host proxy: the bridge address (`TRUST_PROXY=172.17.0.1`). Render / Railway / Fly.io:
  `TRUST_PROXY=1`. Never `TRUST_PROXY=true` (Evo refuses to start) or a range wider than your proxies.
- If the log shows `untrusted_proxy`, set `TRUST_PROXY` to your proxy; if writes fail with
  `csrf_origin_mismatch` ("came from another website"), set `ALLOWED_ORIGINS=https://evo-demo.evosoft.solutions`.
- Evo serves `X-Frame-Options: DENY` and `frame-ancestors 'none'`: **link to the demo, don't embed it in an
  iframe** on the portfolio site.

### Settings that must NOT be set on the demo

| Setting | Why not |
|---|---|
| `NODE_ENV=production` | Evo then ignores `SEED_DEMO` (no demo company: you get the setup screen) and refuses the demo reset. `reset-demo.sh` stops with an error. **The bundled `Dockerfile` sets it**: override it (`-e NODE_ENV=demo`) if you use Docker. |
| `STORE_ALLOWED_NETWORKS` | DEPLOY.md recommends it for internet-facing stores, but it limits register / handheld PIN sign-on, override PINs and device enrollment to those networks: visitors couldn't try the register. |
| `SMTP_URL`, `ALERT_WEBHOOK_URL` | Every visitor's owner sign-in from a new address, every self-approval and the daily store digest would be mailed / posted to you, and with SMTP the demo's fake charge-account contacts get daily emails. In-app notifications are enough. |
| `HTTPS_REDIRECT=off`, `COOKIE_SECURE=false`, `RATE_LIMIT=off` | Not needed behind HTTPS; they weaken a public server. |
| `DEMO_PASSWORD` under 8 characters, or no `DEMO_PIN` | Evo picks random ones at every reset and the published sign-ins stop working. |

`SETUP_TOKEN`, backup keys and off-site backup settings are pointless for the demo; `demo.env` turns the hourly
backups off (`BACKUP_SCHEDULE=off`) because the data is thrown away every 3 hours anyway.

---

## 3. The reset

`reset-demo.sh` (run as root by the timer or cron):

1. reads `/etc/evo/evo-demo.env` and refuses to run with `NODE_ENV=production`, without `DATA_DIR`, or without a
   fixed `DEMO_PASSWORD` / `DEMO_PIN`;
2. stops `evo-demo.service` and waits until Evo has let go of the data folder (Evo's own reset refuses to run
   while Evo is up: it checks Evo's `evo-running-<pid>.json` marker and the databases' migration locks);
3. runs Evo's reset as the service user: `node server/tools/seed.js --reset` with `DEMO_PASSWORD`, `DEMO_PIN`,
   `SEED_TZ`. Both databases are backed up to `DATA_DIR/backups/pre-seed-*.db` first (Evo keeps the newest 5 per
   database). If a visitor added a non-demo account, Evo asks for the company name: the script reads the current
   one from the database and passes `--confirm`, so a renamed company can't stall it;
4. if the reset tool refuses or fails anyway, moves `evo.db*` and `pos.db*` to `DATA_DIR/reset-fallback-<time>/`
   (newest 2 kept) and lets Evo load a fresh demo at start (`SEED_DEMO=true`);
5. starts Evo, waits for `/api/health/ready`, and starts it again on any failure, so the demo is never left down;
6. with `DEMO_GEOFENCE_MODE=flag` (the default in `demo.env`), sets the *Downtown Store* geofence to
   "flag" through Evo's own API (signed in as the demo owner). The seed sets it to "block", which means only
   someone standing in downtown Chicago could clock in as the employee; with "flag", visitors anywhere can clock
   in and the punch shows up as "outside geofence" for HR and Payroll to review.

Overrides for other layouts: `EVO_DIR`, `EVO_ENV_FILE`, `EVO_SERVICE`, `EVO_USER`, `EVO_STOP_CMD`,
`EVO_START_CMD`, `EVO_HEALTH_URL`, `NODE_BIN`, `LOCK_FILE` (see the header of the script). Runs never overlap
(`flock`).

The demo data is relative to "now": the seed builds 8 weeks of history up to the moment it runs, gives the
employee a shift starting within 15 minutes, and the store gets sales up to the current hour. Resetting every few
hours keeps "today" looking alive. Use `SEED_TZ=America/Chicago` (the demo's addresses are in Chicago); the
store's "today" and the shift times follow that zone.

### Tested

Against a local copy of the 2.1.0 release (Node 22.23, `PORT=3101`, its own `DATA_DIR`):

- normal reset: stop → seed → start → ready → geofence set, **about 5 seconds**, exit 0;
- after simulated visitor changes (an extra account `vic.visitor@example.com`, the company renamed to
  "Vandalised Inc.", an authenticator app enrolled on `hr@evo.test`, a register enrolled and a till opened):
  all gone after the reset, the company name back, `hr@evo.test` signs in with the password alone again, no
  enrolled devices left;
- the fallback (reset tool forced to fail): databases moved aside, fresh demo loaded at start, exit 0.

### Docker / PaaS instead of a VPS

Build the image from the release (`docker build -t evo:2.1.0 .`) but override its `NODE_ENV=production`, and
keep `/app/data` on a volume:

```bash
docker run -d --name evo-demo --restart unless-stopped -p 127.0.0.1:3101:3101 \
  --env-file /etc/evo/evo-demo.env -e NODE_ENV=demo -e PORT=3101 -e DATA_DIR=/app/data -e TRUST_PROXY=172.17.0.1 \
  -v evo-demo-data:/app/data --stop-timeout 20 evo:2.1.0
```

`reset-demo.sh` expects Evo's code on the host. For a container, the simplest reliable reset is to let Evo
re-create the demo on start (from cron, every 3 hours):

```bash
docker stop -t 20 evo-demo
docker run --rm -v evo-demo-data:/app/data --entrypoint sh evo:2.1.0 -c 'rm -f /app/data/evo.db* /app/data/pos.db*'
docker start evo-demo      # SEED_DEMO=true loads a fresh demo company (a few seconds)
```

(Keys in `/app/data/secrets` stay; they're fine to keep. This Docker variant was not tested here: the test
environment had no Docker.) On Render / Railway / Fly.io: one instance only, a
persistent disk at `/app/data`, `TRUST_PROXY=1`, `NODE_ENV=demo`, and a scheduled job doing the same three steps
through the platform's CLI. The geofence tweak (step 6 above) is optional; without it the employee clock-in is
refused for visitors outside Chicago unless they first move the site (HR → Locations → Downtown Store →
**Use my current location**).

---

## 4. Risks of a shared public demo, and what the reset covers

Everyone signs in to the **same** company with the **same** accounts, and the owner account can change
anything an owner can. Between resets, one visitor's changes are visible to (or can block) the next.

| A visitor could… | Effect until the next reset | Covered by the reset? |
|---|---|---|
| Enroll an authenticator app or passkey on `hr@evo.test` (or Grace / Paul / Omar) | Everyone else is asked for a code they don't have (and other sessions are signed out) | Yes: two-step enrollments are wiped |
| Change a demo password (15+ characters) or reset someone else's | That account is locked out for others | Yes: users are re-created |
| Owner → Security: pause sign-ins, end all sessions, rotate session keys, set the two-step grace to 0 days | Everyone but the owner is locked out / signed out; privileged accounts must enroll two-step at once | Yes: settings and sessions are wiped; restarting Evo also clears the in-memory limits |
| Deactivate people, delete locations, change pay rates, approve / deny every request, lock and pay periods | The demo story (pending approvals, open period) is gone | Yes |
| Rename the company, edit announcements, submit the public contact form | Odd text on screens; inquiries pile up | Yes (the script handles a renamed company) |
| Enroll a browser as Register *N* | The browser previously enrolled as Register *N* is revoked (only 4 registers exist) | Yes: all enrollments are cleared, so everyone re-enrolls after a reset |
| Type 5+ wrong PINs for an ID / 30 from outside addresses | That register ID is locked for 5 min (25 wrong: for the day); 30 wrong PINs from unknown addresses pause PIN sign-on from every visitor's address for 15 min | Yes: PIN limits live in `pos.db` and memory; both are reset |
| Type wrong passwords for `hr@evo.test` | Sign-in delay for that account (30 s, doubling to 15 min) for visitors without its known-device cookie | Yes |
| Leave tills open, ring sales, refund, close days | Store numbers change, "registers open" grows | Yes |

What the reset does **not** cover: anything outside Evo (abuse of the contact form as spam, load). Evo's own
rate limits stay on (`RATE_LIMIT_IP_PER_MIN=1200` by default). There is no read-only demo mode in Evo, so a
shorter reset interval (e.g. every hour: `OnCalendar=hourly`) is the only lever if the demo gets vandalised.

---

## 5. Caveats worth saying on the portfolio page

- **The demo resets every 3 hours.** Visitors are signed out and their changes disappear; register enrollments
  have to be done again.
- **The register, handheld and Store pages need a desktop browser.** Phones and tablets get a "Not available on
  this device" screen (Workforce, including the clock-in, works on phones).
- **Each browser must be enrolled as a register** (sign in as `hr@evo.test`, open `/pos/register/`, "Use this
  computer as Register N"). If two visitors pick the same register number, the first one's register is
  replaced: suggest picking any of Register 1 to 4.
- **Privileged accounts** (`hr@`, `grace.liu@`, `payroll@`, `omar.haddad@`) show a yellow "Set up two-step
  sign-in" reminder (a 14-day grace that restarts with every reset; it never blocks the demo) and sign out after
  30 minutes idle. Ask visitors **not** to set up two-step sign-in or change passwords on the demo.
- **"Confirm it's you"** prompts (exports, pay changes, store roles) take the account password, `demo1234`.
- **Clock-in uses the device's location**; with `DEMO_GEOFENCE_MODE=flag` it works from anywhere and the punch is
  flagged "outside geofence" (that's the demo of the review flow, not a bug). The browser asks for location
  permission.
- **Maps and address search** load OpenStreetMap tiles in the visitor's browser (allowed by Evo's CSP).
- **Link, don't iframe**: Evo forbids being framed.
- All names, companies and numbers are fictitious demo data generated by Evo.

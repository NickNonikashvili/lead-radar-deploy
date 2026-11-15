# Putting EvoSoft online: website, demos and server

A step-by-step guide for **evosoft.solutions** and its three live demos. © 2026 EvoSoft Solutions.

| What | Where it runs | Address |
|---|---|---|
| The website | Hostinger web hosting | `evosoft.solutions` |
| Evo demo | Your Ubuntu server | `evo-demo.evosoft.solutions` |
| Mailtabs demo | Your Ubuntu server (Docker) | `mail-demo.evosoft.solutions` |
| StudyCat demo (a PHP site) | Your Ubuntu server (recommended), or Hostinger web hosting as a subdomain | `studycat-demo.evosoft.solutions` |

Files you'll use (sent to you in the chat, or built with `node site-builder/package.mjs` and the bundles below):

- `evosoft-site-YYYYMMDD.zip`: the website
- `evosoft-demo-server.tar.gz`: everything the Ubuntu server needs (setup script, demo kits, the Evo and Mailtabs apps)
- `calc1-deploy-….zip`: StudyCat's deploy zip (the same one as studycat.org). It goes into the server bundle's `apps/`
  folder next to the Evo and Mailtabs zips.
- `studycat-demo-upload.zip`: only for the Hostinger alternative in Part 3

Allow about an hour in total. Most of it is waiting for installs.

---

## Part 1: The website (Hostinger web hosting)

1. hPanel → **Websites** → evosoft.solutions → **File Manager** → open `public_html`.
2. **Back up first.** Select everything, choose **Compress** (zip) and download the zip. That's your way back.
3. Delete the old site's files from `public_html`, but keep `.well-known` and `api/data` if they're there.
   `api/data` holds quote requests the old site saved; the new one moves them to `evosoft-data` by itself.
4. Upload `evosoft-site-YYYYMMDD.zip`. Right-click it, choose **Extract** into the current folder, then delete the zip.
   Turn on "Show hidden files" and check that `.htaccess` and `api/.htaccess` are there.
5. **Advanced → PHP Configuration**: choose PHP **8.2 or newer** (8.3 is a good choice).
6. Open https://evosoft.solutions. Then open https://evosoft.solutions/api/chat.php?health=1: `"ok":true` means the
   chat's server side works.
7. **Let the quote form send email.** In File Manager, go up one folder from `public_html` (to the folder that holds
   it), create a new file named `evosoft-config.php` and paste this in:

   ```php
   <?php
   return [
       'smtp_user' => 'contact@evosoft.solutions',
       'smtp_pass' => 'PUT THE MAILBOX PASSWORD HERE',
       'anthropic_api_key' => '',   // optional, see step 9
   ];
   ```

   Replace `PUT THE MAILBOX PASSWORD HERE` with the password of the contact@evosoft.solutions mailbox, the one you use
   for webmail, and save. If the password has a `'` or a `\` in it, put a `\` in front of each one. Forgot it?
   hPanel → **Emails** → **Email accounts** lets you set a new one (then use the new one in your phone's mail app too).
8. Send yourself a test through the quote form. It should arrive in webmail within a minute. Then open
   https://evosoft.solutions/api/quote.php?health=1: `"mail":"smtp","last_send":"ok"` means it works.
   `"last_send":"failed"` usually means a wrong password; `evosoft-data/mail-status.json` (next to `public_html`) says
   why. Either way no request is lost: they're all saved in `evosoft-data/quotes.jsonl`.
9. *(Optional)* To make the chat use AI, put your Anthropic API key in `anthropic_api_key` in the same file.
   `site-builder/README.md`, "Settings", has the details.

## Part 2: The Ubuntu server (Evo, Mailtabs and StudyCat demos)

### 2.1 Point the demo addresses at the server

In hPanel → **VPS** → your server → **Overview**, note the server's **IP address** and the **root password** (or SSH key).

Then hPanel → **Domains** → evosoft.solutions → **DNS / Nameservers** → **DNS records**, and add three records:

| Type | Name | Points to | TTL |
|---|---|---|---|
| A | `evo-demo` | your server's IP | default |
| A | `mail-demo` | your server's IP | default |
| A | `studycat-demo` | your server's IP | default |

(If you'd rather run StudyCat on Hostinger, skip the third record and follow Part 3, Option B.)

Do this first: the free HTTPS certificates are issued only once these names point at the server. It usually takes a few
minutes, occasionally longer. (If evosoft.solutions' DNS is managed somewhere other than Hostinger, add the records there.)

If your VPS has Hostinger's firewall turned on (VPS → **Security → Firewall**), allow ports **22, 80 and 443**.

### 2.2 Copy the bundle to the server

On your laptop, open **Terminal** (Mac) or **PowerShell** (Windows), go to the folder with the downloaded files and run
(replace `SERVER_IP`):

```bash
scp evosoft-demo-server.tar.gz root@SERVER_IP:/root/
```

Answer `yes` to the fingerprint question the first time, and enter the root password.

If the bundle's `apps/` folder doesn't already have StudyCat's `calc1-deploy-….zip`, copy it there after unpacking (next
step): `scp calc1-deploy-2026.11.05.1.zip root@SERVER_IP:/root/evosoft-demo-server/apps/`. Without it the setup
installs Evo and Mailtabs only and says it skipped StudyCat.

### 2.3 Run the setup

Still on your laptop:

```bash
ssh root@SERVER_IP
```

Now you're on the server. Run:

```bash
tar xzf evosoft-demo-server.tar.gz
cd evosoft-demo-server
bash demos/one-server/setup-server.sh --email contact@evosoft.solutions
```

The email is only used by Let's Encrypt for certificate notices. The script takes about 10 minutes and prints each step:

1. It checks that the DNS names point to this server (a warning if not yet).
2. It installs system packages, adding swap space if the server has little memory.
3. It installs Node.js 24, which runs Evo.
4. It installs Caddy, the web server that handles HTTPS for all the demos.
5. It installs Docker, which runs the Mailtabs demo and its private demo mail server.
6. It installs **Evo** as a service with the demo company, a reset every 3 hours, and the copyright notice.
7. It installs **Mailtabs**, with sample mailboxes, a reset every hour, and no access to the real internet.
8. It installs **StudyCat** (when its zip is in `apps/`): PHP 8.3, the site in `/var/www/studycat-demo`, its database
   outside the site in `/var/lib/studycat-demo`, the demo accounts and content, the copyright notice, a nightly reset
   and a 10-minute account repair. Email is off, and AI and payments can't be switched on.
9. It turns on HTTPS for every address and the firewall (SSH, 80 and 443 open; everything else closed).

It ends with a summary. Green lines, `https://evo-demo… is live`, `https://mail-demo… is live` and
`https://studycat-demo… is live`, mean you're done.

The script is safe to run again: the same command repairs a half-finished setup or installs newer app versions. It
keeps the demos' data (StudyCat's database too), settings and certificates.

### Adding StudyCat to a server that already runs Evo and Mailtabs

1. Add the third DNS record from 2.1 (`studycat-demo` → your server's IP).
2. Copy the new `evosoft-demo-server.tar.gz` to the server as in 2.2, then unpack it over the old folder:
   `cd /root && tar xzf evosoft-demo-server.tar.gz` (it replaces the setup files; the demos' data isn't in that folder).
3. Check that `calc1-deploy-….zip` is in `/root/evosoft-demo-server/apps/` (the new bundle already includes it).
4. Run the same command again: `cd /root/evosoft-demo-server && bash demos/one-server/setup-server.sh --email contact@evosoft.solutions`.
   It also reinstalls Evo and Mailtabs as they are, which resets both demos once; that is harmless.

### 2.4 Check the demos

- https://evo-demo.evosoft.solutions/login: sign in as `hr@evo.test` / `demo1234`
- https://mail-demo.evosoft.solutions: sign in as `demo@mailtabs.demo.test` / `mailtabs-demo`
- https://studycat-demo.evosoft.solutions: sign in as `student@studycat.test` / `demo-study-2026`.
  https://studycat-demo.evosoft.solutions/api/index.php?r=health must say `"mail":"log"`.

On evosoft.solutions/demos.html they now show **Live**. Each demo shows a small "© 2026 EvoSoft Solutions" notice.

## Part 3: StudyCat demo

StudyCat has two options. Use one, not both.

### Option A (recommended): on your Ubuntu server

Nothing to do beyond Part 2: with the `studycat-demo` DNS record and StudyCat's `calc1-deploy-….zip` in `apps/`, the
setup script installs it, keeps it updated and resets it. What it sets up, so you know where things are:

| What | Where |
|---|---|
| The site (replaced by each install; read-only for PHP) | `/var/www/studycat-demo` |
| Its database and files (kept) | `/var/lib/studycat-demo` |
| PHP | PHP 8.3, its own PHP-FPM pool running as the `studycat-demo` user |
| Web server rules | `/etc/caddy/sites/studycat-demo.caddy`: everything StudyCat's `.htaccess` files do on Apache (only `api/index.php` runs; settings, database, logs, hidden and build files are refused), plus "noindex" |
| Resets | `/etc/cron.d/studycat-demo`: full reset at 09:17 server time (UTC on a new VPS: 2:17 am in Montana), account repair every 10 minutes |
| Logs | `/var/log/studycat-demo/` (resets and PHP errors) |

### Option B: on Hostinger web hosting, as a subdomain

Unzip `studycat-demo-upload.zip` on your laptop first. Inside are the StudyCat site (`calc1-deploy-….zip`), an `api`
folder with four files, and `robots.txt`.

1. **Subdomain.** hPanel → **Websites** → evosoft.solutions → **Domains → Subdomains**: create `studycat-demo`.
   Note its folder, for example `public_html/studycat-demo`.
2. **SSL.** hPanel → **Security → SSL**: make sure `studycat-demo.evosoft.solutions` has a certificate. StudyCat
   sends every visitor to HTTPS.
3. **Upload the site.** In File Manager, open the subdomain's folder, upload `calc1-deploy-….zip` and **Extract** it
   there, then delete the zip. With "Show hidden files" on, check that `.htaccess`, `api/.htaccess` and `.well-known/`
   arrived.
4. **Add the demo files.** Upload the four files from the bundle's `api` folder (`config.local.php`, `demo-seed.php`,
   `evosoft-notice.css`, `evosoft-notice.js`) into the subdomain's `api/` folder. Replace its `robots.txt` with the one
   from the bundle.
5. **Fill the demo with its sample accounts and content.**
   - **With SSH** (hPanel → Advanced → SSH Access):
     `cd ~/domains/evosoft.solutions/public_html/studycat-demo && php api/demo-seed.php`
   - **Without SSH:** create the nightly cron job from step 6, set it to run in a few minutes, wait, then set it back.
6. **Automatic resets.** hPanel → **Advanced → Cron Jobs**. Use your own account path, which File Manager shows, for
   example `/home/u123456789/…`:

   | When | Command |
   |---|---|
   | Every night (e.g. 03:17) | `/usr/bin/php /home/u123456789/domains/evosoft.solutions/public_html/studycat-demo/api/demo-seed.php --quiet` |
   | Every 10 minutes | `/usr/bin/php /home/u123456789/domains/evosoft.solutions/public_html/studycat-demo/api/demo-seed.php --repair --quiet` |

7. **Check.**
   - https://studycat-demo.evosoft.solutions/api/index.php?r=health must say `"mail":"log"`.
   - Sign in as `student@studycat.test` / `demo-study-2026`.

The demo is fully separate from studycat.org: it has its own database, email is switched off, and it can't spend money
on AI. `demos/studycat/README.md` covers it in depth.

## Part 4: Looking after it

| Task | How |
|---|---|
| See what Evo is doing | `journalctl -u evo-demo -n 50` |
| See what Mailtabs is doing | `cd /opt/mailtabs-demo && docker compose logs --tail 50` |
| See what StudyCat is doing | `ls /var/log/studycat-demo/` (resets, PHP errors) · `runuser -u studycat-demo -- php8.3 /var/www/studycat-demo/api/demo-seed.php --check` |
| HTTPS and web-server log | `journalctl -u caddy -n 50` |
| Reset Evo now | `systemctl start evo-demo-reset.service` |
| Reset Mailtabs now | `cd /opt/mailtabs-demo && ./reset-demo.sh` |
| Reset StudyCat now | `runuser -u studycat-demo -- php8.3 /var/www/studycat-demo/api/demo-seed.php` |
| Turn a demo off | `systemctl stop evo-demo` · `cd /opt/mailtabs-demo && docker compose down` · StudyCat: `rm /etc/caddy/sites/studycat-demo.caddy /etc/cron.d/studycat-demo && systemctl reload caddy` |
| Install a new Evo, Mailtabs or StudyCat version | Put the new zip in `evosoft-demo-server/apps/` (remove the old one; for StudyCat the newest `calc1-deploy-….zip` is used) and run the setup command again |
| Server security updates | Ubuntu installs them automatically; reboot now and then (`reboot`) |

**If a demo isn't reachable:**

- **Just after setup.** DNS may still be on its way. `getent hosts evo-demo.evosoft.solutions` should print your server's
  IP. Caddy keeps retrying the certificate on its own, so check again in a few minutes.
- **"Connection refused" or a timeout.** Ports 80/443 are blocked. Check Hostinger's VPS firewall (Part 2.1).
- **The setup stopped with an error.** Read the last lines it printed (also in `/root/evosoft-setup.log`), fix what it
  names, and run the same setup command again.

**Shared demos:** every visitor uses the same accounts, so the demos reset themselves (Evo every 3 hours, Mailtabs every
hour, StudyCat nightly). Never put real data or real passwords into them.

## What's been tested

Each demo kit was run locally: Evo with its demo data and reset, Mailtabs with a real Dovecot mail server, StudyCat on
PHP 8.3.

For this one-server setup, these were tested here:
- the setup script's syntax (`bash -n` and shellcheck);
- the Docker Compose settings in both modes;
- the forwarding from the server's Caddy to the Mailtabs demo, with real Caddy processes: host name, locked endpoints,
  the reset page and the "being reset" fallback;
- StudyCat on the server: the script's own StudyCat step run on Ubuntu 24.04 with the real deploy zip (first install,
  re-run with the database kept, re-run without a zip, the Hostinger upload bundle in `apps/`, a wrong zip), then
  Caddy 2.6.2 (as the `caddy` user) with `studycat-demo.caddy` and PHP-FPM 8.3, over HTTP and over HTTPS with the real
  host name: the pages, the health check, sign-in through the real form, a class dashboard, the Faculty class page, a
  study guide, the copyright notice, no CSP errors, a Secure sign-in cookie, the http→https redirect (one hop), and 117
  addresses checked (every protected file refused, every page and asset served with the same caching and security
  headers as on Apache); the two cron jobs run as the `studycat-demo` user;
- `caddy validate` on the server's combined configuration (Evo, Mailtabs and StudyCat).

Not run here (no systemd, no Docker daemon, and only Caddy 2.6.2 available):
- the full script on a real Ubuntu 24.04 server (systemd starting PHP-FPM, cron running the resets on its own);
- Caddy 2.9 or newer, and its `trusted_proxies` option. That option keeps visitors' real IP address and the https
  scheme as they reach Mailtabs.

After the first run, the script's end-of-setup checks tell you whether the demos are live.

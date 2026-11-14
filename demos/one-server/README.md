# Putting EvoSoft online: website, demos and server

A step-by-step guide for **evosoft.solutions** and its three live demos. © 2026 EvoSoft Solutions.

| What | Where it runs | Address |
|---|---|---|
| The website | Hostinger web hosting | `evosoft.solutions` |
| StudyCat demo (a PHP site) | Hostinger web hosting, as a subdomain | `studycat-demo.evosoft.solutions` |
| Evo demo | Your Ubuntu server | `evo-demo.evosoft.solutions` |
| Mailtabs demo | Your Ubuntu server (Docker) | `mail-demo.evosoft.solutions` |

Files you'll use (sent to you in the chat, or built with `node site-builder/package.mjs` and the bundles below):

- `evosoft-site-YYYYMMDD.zip`: the website
- `evosoft-demo-server.tar.gz`: everything the Ubuntu server needs (setup script, demo kits, the Evo and Mailtabs apps)
- `studycat-demo-upload.zip`: the StudyCat demo files

Allow about an hour in total. Most of it is waiting for installs.

---

## Part 1: The website (Hostinger web hosting)

1. hPanel → **Websites** → evosoft.solutions → **File Manager** → open `public_html`.
2. **Back up first.** Select everything, choose **Compress** (zip) and download the zip. That's your way back.
3. Delete the old site's files from `public_html`, but keep `.well-known` if it's there.
4. Upload `evosoft-site-YYYYMMDD.zip`. Right-click it, choose **Extract** into the current folder, then delete the zip.
   Turn on "Show hidden files" and check that `.htaccess` and `api/.htaccess` are there.
5. **Advanced → PHP Configuration**: choose PHP **8.1 or newer**.
6. Open https://evosoft.solutions. Then open https://evosoft.solutions/api/chat.php?health=1: `"ok":true` means the
   chat's server side works.
7. *(Optional)* To make the chat use AI, put your Anthropic API key in `evosoft-config.php` one folder above `public_html`.
   `site-builder/README.md`, "Settings", has the details.

## Part 2: The Ubuntu server (Evo and Mailtabs demos)

### 2.1 Point the demo addresses at the server

In hPanel → **VPS** → your server → **Overview**, note the server's **IP address** and the **root password** (or SSH key).

Then hPanel → **Domains** → evosoft.solutions → **DNS / Nameservers** → **DNS records**, and add two records:

| Type | Name | Points to | TTL |
|---|---|---|---|
| A | `evo-demo` | your server's IP | default |
| A | `mail-demo` | your server's IP | default |

Do this first: the free HTTPS certificates are issued only once these names point at the server. It usually takes a few
minutes, occasionally longer. (If evosoft.solutions' DNS is managed somewhere other than Hostinger, add the records there.)

If your VPS has Hostinger's firewall turned on (VPS → **Security → Firewall**), allow ports **22, 80 and 443**.

### 2.2 Copy the bundle to the server

On your laptop, open **Terminal** (Mac) or **PowerShell** (Windows), go to the folder with the downloaded file and run
(replace `SERVER_IP`):

```bash
scp evosoft-demo-server.tar.gz root@SERVER_IP:/root/
```

Answer `yes` to the fingerprint question the first time, and enter the root password.

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

1. It checks that the two DNS names point to this server (a warning if not yet).
2. It installs system packages, adding swap space if the server has little memory.
3. It installs Node.js 24, which runs Evo.
4. It installs Caddy, the web server that handles HTTPS for both demos.
5. It installs Docker, which runs the Mailtabs demo and its private demo mail server.
6. It installs **Evo** as a service with the demo company, a reset every 3 hours, and the copyright notice.
7. It installs **Mailtabs**, with sample mailboxes, a reset every hour, and no access to the real internet.
8. It turns on HTTPS for both addresses and the firewall (SSH, 80 and 443 open; everything else closed).

It ends with a summary. Two green lines, `https://evo-demo… is live` and `https://mail-demo… is live`, mean you're done.

The script is safe to run again: the same command repairs a half-finished setup or installs newer app versions.

### 2.4 Check the demos

- https://evo-demo.evosoft.solutions/login: sign in as `hr@evo.test` / `demo1234`
- https://mail-demo.evosoft.solutions: sign in as `demo@mailtabs.demo.test` / `mailtabs-demo`

On evosoft.solutions/demos.html both now show **Live**. Each demo shows a small "© 2026 EvoSoft Solutions" notice.

## Part 3: StudyCat demo (Hostinger web hosting)

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
| HTTPS and web-server log | `journalctl -u caddy -n 50` |
| Reset Evo now | `systemctl start evo-demo-reset.service` |
| Reset Mailtabs now | `cd /opt/mailtabs-demo && ./reset-demo.sh` |
| Turn a demo off | `systemctl stop evo-demo` · `cd /opt/mailtabs-demo && docker compose down` |
| Install a new Evo or Mailtabs version | Put the new zip in `evosoft-demo-server/apps/` (remove the old one) and run the setup command again |
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
  the reset page and the "being reset" fallback.

Not run here (no systemd, no Docker daemon, and only Caddy 2.6.2 available):
- the full script on a real Ubuntu 24.04 server;
- Caddy 2.9 or newer, and its `trusted_proxies` option. That option keeps visitors' real IP address and the https
  scheme as they reach Mailtabs.

After the first run, the script's end-of-setup checks tell you whether both demos are live.

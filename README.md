# Lead Radar — deployment guide

A small Node/Express app: three AI agents (discover, research + score, draft outreach) for
finding web-design clients. No external CRM, no build step.

## What's in here

- `server.js` — Express server. Holds your Anthropic API key (never sent to the browser),
  proxies agent calls to Claude, and stores leads in `data/leads.json`.
- `public/index.html`, `public/app.js` — the React frontend (loaded via CDN + in-browser Babel,
  so there's no build/bundle step to manage).
- `data/leads.json` — your lead database. Back this file up occasionally.

## 1. Get an API key

Create a key at https://console.anthropic.com (Settings → API Keys). Keep it secret — treat it
like a password.

## 2. Configure

```bash
cp .env.example .env
```

Open `.env` and paste your key:

```
ANTHROPIC_API_KEY=sk-ant-...
PORT=3000
```

`PORT` is optional — most hosts set this automatically via an environment variable, in which case
you can leave the `.env` value or delete the line entirely.

## 3. Install and run locally (to test first)

```bash
npm install
npm start
```

Visit `http://localhost:3000`. Try adding a lead manually, then try Discover with a real niche +
city to confirm your API key works.

## 4. Deploy to your host

Steps are similar across most Node hosts (Render, Railway, a VPS, cPanel with Node support, etc.):

1. Upload this whole folder (or push it to a git repo your host deploys from).
2. Set the **start command** to `npm start` (or `node server.js`).
3. Set the environment variable `ANTHROPIC_API_KEY` in your host's dashboard — **do not** commit
   your real `.env` file to a public repo. A `.gitignore` is included for this reason.
4. Make sure the host persists the `data/` folder between deploys, or your leads will reset each
   time you redeploy. Most platforms have a "persistent disk" or "volume" setting — check your
   host's docs. If your host wipes the filesystem on every deploy (some serverless platforms do),
   you'll want to swap the JSON file for a hosted database instead — ask me and I can help you
   migrate to Postgres/SQLite when you get there.
5. Point your domain/subdomain at the app once it's running.

## Cost notes

- Each "Run research" or "Discover" call uses web search + Claude — a few cents at most per call.
- Each "Draft email" call is text-only and cheaper.
- Watch your Anthropic Console usage dashboard the first week to see real per-lead cost, then set
  a spend cap in the Console if you want a hard ceiling.

## Security notes

- Your API key lives only in `.env` / your host's environment variables — never in the frontend
  code, so it can't be scraped from the page.
- There's no login on this app as built. If it's reachable on the public internet, anyone with the
  URL could run agent calls on your API budget. For a single-user internal tool, consider putting
  it behind your host's basic auth, a VPN, or ask me to add a simple password gate.

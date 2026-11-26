# Presidio analyzer for Gode

Gode strips personal data from every prompt before it reaches a model provider. Two detection layers
do this:

1. **Built-in recognizers** (`src/redact/patterns.js`), always on: emails, phone numbers, card numbers
   (Luhn-checked), IBANs (mod-97), US SSNs, IP addresses, API keys/tokens/passwords, and names
   introduced by phrases such as "my name is", "Dear", "Dr." or an email sign-off.
2. **Presidio** ([Data Privacy Stack](https://presidio.dataprivacystack.org), MIT licence), optional:
   adds named-entity recognition, so names and places are caught without a trigger phrase
   ("Tell Maria Garcia I'm in Berlin").

Presidio is optional. If it is not configured, or it stops responding, Gode logs one warning (never the
text) and carries on with the built-in recognizers only. Prompts are never sent unredacted because
Presidio is down.

## Option A: Docker (recommended for servers)

```sh
docker compose -f presidio/docker-compose.yml up -d
```

This runs `ghcr.io/data-privacy-stack/presidio-analyzer` (the current image; the old
`mcr.microsoft.com/presidio-*` images are frozen and no longer updated) and publishes it on
`127.0.0.1:5002` (container port 3000). It bundles spaCy's large English model and needs about
1.5 GB of RAM.

The port is bound to loopback on purpose: prompts are personal data. If Gode runs in another container
or on another host, put both on a private network rather than publishing the port.

## Option B: Python, no Docker (laptops, small boxes)

`server.py` is a small standard-library HTTP server with the same `/analyze` and `/health` API, using
spaCy's small English model (about 200 MB of RAM). Python 3.11 to 3.13.

```sh
python3 -m venv .venv-presidio
.venv-presidio/bin/pip install -r presidio/requirements.txt
.venv-presidio/bin/python presidio/server.py          # listens on http://127.0.0.1:5002
```

Settings (environment variables): `HOST` (default `127.0.0.1`), `PORT` (default `5002`),
`SPACY_MODEL` (default `en_core_web_sm`; `en_core_web_lg` is more accurate if installed),
`PRESIDIO_LANGUAGE` (default `en`), `MAX_BODY_BYTES` (default 2 MiB).

The server never logs requests or their contents. Keep `.venv-presidio/` out of git.

## Point Gode at it

In Gode's `.env`:

```sh
PRESIDIO_ANALYZER_URL=http://localhost:5002
# optional
PRESIDIO_SCORE_THRESHOLD=0.5   # drop Presidio findings below this confidence
PRESIDIO_LANGUAGE=en
```

Leave `PRESIDIO_ANALYZER_URL` empty to use the built-in recognizers only.

Check it is up:

```sh
curl http://localhost:5002/health
# Presidio Analyzer service is up
curl -s -X POST http://localhost:5002/analyze -H 'content-type: application/json' \
  -d '{"text":"Tell Maria Garcia I moved to Berlin","language":"en","score_threshold":0.5}'
```

## What Gode does with the results

Gode sends `POST /analyze {text, language, score_threshold}` with a 1.5 s timeout and maps Presidio's
entity types to its own labels: PERSON, EMAIL_ADDRESS→EMAIL, PHONE_NUMBER→PHONE, CREDIT_CARD→CARD,
IBAN_CODE→IBAN, US_SSN/US_ITIN→SSN, IP_ADDRESS→IP, LOCATION, US_PASSPORT→PASSPORT,
US_DRIVER_LICENSE→LICENSE, US_BANK_NUMBER→BANK_ACCOUNT, CRYPTO. Other types (DATE_TIME, NRP, URL,
UUID, ...) are ignored. Overlaps with the built-in findings are resolved (same type: merged; different
types: higher score, then longer span wins). After a failure Gode skips Presidio for 30 s instead of
adding a timeout to every request, then tries again. Recent results are cached in memory by a SHA-256
of the text (offsets only, never the text), because each chat turn re-redacts the history.

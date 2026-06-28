# Handoff: Stand up StumpDad on the droplet

**From:** Forge (Workshop / design surface)
**To:** Claude Code on the droplet (`root@the-network-n8n`, 45.55.241.135)
**Owner:** Chris · **Date:** 2026-06-28
**AI provider for this deploy:** Anthropic Claude (`claude-haiku-4-5-20251001`).

Forge built and verified the app but does not touch live systems or hold keys.
This is the deploy brief. Everything needed is in `StumpDad/app/`.

---

## What this is
A self-contained React + Vite + Express trivia game. Express serves the built
frontend **and** proxies trivia generation to an LLM so the API key stays
server-side. The server is provider-agnostic: set `ANTHROPIC_API_KEY` and it uses
Claude (preferred); set `GEMINI_API_KEY` instead and it uses Gemini. For this
deploy we're using **Claude**. No database; the only external call is to the
Anthropic API.

## Pre-verified by Forge (sandbox)
- `npm install` + `npm run build` → clean (vite 5, ~60 kB gz JS).
- `node server.js` serves `dist/index.html`; `/api/health` returns `{ok,provider,model,hasKey}`; `/api/trivia` 500s cleanly when no key is set.
- Provider auto-select confirmed: with `ANTHROPIC_API_KEY` set, health reports `provider:"anthropic", model:"claude-haiku-4-5-20251001"`.
- Game logic (slot building for all 3 modes, scoring/streak/speed/final math) unit-checked.
- **Not** tested: a live LLM call (Forge holds no key). The Anthropic path uses `POST https://api.anthropic.com/v1/messages` with `x-api-key` + `anthropic-version: 2023-06-01`.

## Runtime requirements
- Node 18+ (already on the droplet for n8n — confirm `node -v`).
- An Anthropic API key (Chris provides) → https://console.anthropic.com/settings/keys
- One free TCP port (default **8088**, must not collide with n8n).

---

## STEP A — get the code onto the droplet  (via git — preferred)

StumpDad is now a git repo. Clone it on the droplet:

```bash
mkdir -p /opt && cd /opt
git clone https://github.com/drprofesq25/stumpdad.git
# → app lives at /opt/stumpdad/app
```

Future updates become a one-liner: `cd /opt/stumpdad && git pull && bash app/deploy/deploy.sh`.

> `.gitignore` already excludes `node_modules/`, `dist/`, and `.env`, so secrets
> and build artifacts are never in the repo — they're created on the droplet.

> Fallback if the repo isn't pushed yet: from the desktop,
> `ssh root@45.55.241.135 "mkdir -p /opt/stumpdad"` then
> `scp -r app root@45.55.241.135:/opt/stumpdad/`.

## STEP B — configure the key  (on the droplet)

```bash
cd /opt/stumpdad/app
cp .env.example .env
nano .env          # set ANTHROPIC_API_KEY=sk-ant-...   (leave GEMINI_API_KEY blank)
```

## STEP C — build + run as a service  (on the droplet, as root)

```bash
bash /opt/stumpdad/app/deploy/deploy.sh
```

Installs deps, builds the frontend, writes & starts a `stumpdad` systemd service
(auto-restart, enabled on boot), and prints a health check.

## STEP D — expose it  (pick one)

- **Quick (family-only, no TLS):** `ufw allow 8088` → `http://45.55.241.135:8088`
- **Proper (TLS + subdomain):** point a DNS A record at the droplet, use
  `deploy/nginx-stumpdad.conf` (set `server_name`), `nginx -t && systemctl reload nginx`,
  then `certbot --nginx -d stumpdad.<domain>`. (Needed before any app-store wrapper.)

## STEP E — verify
```bash
systemctl status stumpdad
curl -s http://127.0.0.1:8088/api/health      # expect {"ok":true,"provider":"anthropic","hasKey":true,...}
journalctl -u stumpdad -f                       # watch a real game generate questions
```
Then load the URL on a phone and play one round end-to-end (try Free-for-All with 3 players, Kids difficulty, to confirm the kid-safe path).

## Decisions / knobs
- **Port** (default 8088) — change in `.env` if it clashes.
- **Model** — defaults to `claude-haiku-4-5-20251001`; override `ANTHROPIC_MODEL` in `.env`.
- **IP vs subdomain+TLS** — IP fine for family now; TLS before app-store wrapping.

## Rollback
```bash
systemctl disable --now stumpdad
rm /etc/systemd/system/stumpdad.service && systemctl daemon-reload
rm -rf /opt/stumpdad
```
Nothing else on the droplet is touched. n8n is never modified.

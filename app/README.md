# StumpDad 🧠

AI-powered family trivia. Pick your topics, battle for the crown. Built as a
React + Vite frontend with a small Express backend that keeps your AI API key
**server-side** (never shipped to the browser). Works with **Anthropic Claude**
(default, recommended) or **Google Gemini** — set whichever key you have.

---

## What's new vs. the original

The original was a single-file React component with the Gemini key in the
client and two modes. This version is a deployable app with:

**Modes**
- **Stump the Expert** — one know-it-all vs. the whole room (the original Stump mode, generalized to any number of challengers).
- **Free-for-All** — 2–8 players, each with their own topics and questions.
- **Teams** — split the family into Team Indigo vs. Team Amber.

**Gameplay depth**
- Per-question **timer** with a countdown ring (off / 20 / 30 / 45s).
- **Speed bonus** — answer faster, score more.
- **Streak multipliers** — consecutive correct answers build a combo up to 3×.
- **Lifelines** — limited Hints and Skips.
- **Steals** — a missed question is up for grabs by the other players/team.
- **Final round** — last questions worth double.
- **Kids difficulty tier** + a kid-safe content guardrail baked into the AI prompt.

**Family**
- Custom names, tap-to-cycle emoji avatars and colors, up to 8 players.
- **Hall of Fame** (persistent) — running win counts, best scores, recent matches.
- Roster is remembered between game nights.

**Polish**
- Dark, glassy, mobile-first UI; confetti on victory; pop/shake/float animations.
- Full Web Audio sound design (ding, buzzer, combo riff, steal whoosh, victory fanfare, countdown ticks) — no audio files needed.
- Optional subtle **background music** loop (toggle in the top bar).

**Security**
- The Gemini key lives only in `.env` on the server. The browser calls `/api/trivia`; the server calls Google. Retry/backoff is server-side.

---

## Run locally (your computer)

Requires Node 18+.

```bash
cd app
cp .env.example .env          # then edit .env and paste your ANTHROPIC_API_KEY
npm install
npm run build                 # builds the frontend into dist/
npm start                     # serves the app on http://localhost:8088
```

Get a Claude key at <https://console.anthropic.com/settings/keys> (or a Gemini
key at <https://aistudio.google.com/apikey> and set `GEMINI_API_KEY` instead).

For live frontend development with hot reload, run the backend and Vite together:

```bash
npm start          # terminal 1 — backend on :8088
npm run dev        # terminal 2 — Vite dev server on :5173 (proxies /api to :8088)
```

Get a Gemini key at <https://aistudio.google.com/apikey>.

---

## Deploy to the droplet

This is the part to hand to **Claude Code on the droplet** — see
`../HANDOFF_TO_CODE.md` for the exact brief. In short:

1. Get the `app/` folder onto the droplet (e.g. `/opt/stumpdad/app`).
2. Create `.env` with your `GEMINI_API_KEY`.
3. Run the deploy script (builds + installs a systemd service):

   ```bash
   bash app/deploy/deploy.sh
   ```

4. Reach it either way:
   - **Simplest:** `ufw allow 8088` and open `http://YOUR_DROPLET_IP:8088`.
   - **Nicer (TLS + subdomain):** use `app/deploy/nginx-stumpdad.conf`, then `certbot`.

The service auto-restarts on failure and on reboot. Logs: `journalctl -u stumpdad -f`.

---

## Getting it onto an app store — the realistic path

StumpDad is a web app, so you don't rewrite it — you **wrap** it. The standard
route is **[Capacitor](https://capacitorjs.com/solution/react)**, which packages
your existing React build into native iOS and Android projects without changing
your code.

**The steps**

1. **Make it installable as a PWA first** (web manifest + icons + a service
   worker). This is low effort and gives you an "Add to Home Screen" app on every
   phone in the family *today* — no store, no fees. For a family game this may be
   all you ever need.
2. **Add Capacitor** to the project: `npm i @capacitor/core @capacitor/cli`,
   `npx cap init`, then `npx cap add ios` and `npx cap add android`. Point its
   `webDir` at `dist/` and set an app id like `com.everson.stumpdad`.
3. **Build the native shells** in Xcode (iOS) and Android Studio (Android).
   Your `/api/trivia` calls keep working as long as the app points at your
   droplet's URL (use the TLS/subdomain setup, not a raw IP).
4. **Enroll + submit:**
   - **Google Play** — one-time **$25** developer registration. Review is fast
     (usually days). The easiest first store.
   - **Apple App Store** — **$99/year** Apple Developer Program. Stricter review:
     Apple rejects apps that are just a thin web wrapper with "minimal
     functionality." StumpDad's multiple modes, local Hall of Fame, sound, and
     offline-capable shell help, but budget time for review back-and-forth.

**Honest take:** for playing with your family, a **PWA (step 1) installed to home
screens is the fastest, free, zero-maintenance win.** Pursue the stores only if
you want to distribute StumpDad publicly — Google Play first (cheap, easy), Apple
later (pricier, stricter). Note that store fees and review rules change; verify
current terms when you start.

Sources: [Apple Developer Program – Membership](https://developer.apple.com/programs/whats-included/) · [Capacitor for React](https://capacitorjs.com/solution/react)

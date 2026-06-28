# StumpDad 🧠

AI-powered family trivia — pick your topics, battle for the crown.

- **The app** lives in [`app/`](app/) (React + Vite frontend, Express backend that keeps the AI key server-side).
- **App docs & app-store path:** [`app/README.md`](app/README.md)
- **Droplet deploy brief (for Claude Code):** [`HANDOFF_TO_CODE.md`](HANDOFF_TO_CODE.md)

Provider-agnostic: uses **Anthropic Claude** by default (recommended), or Google
Gemini — set whichever key you have in `app/.env`.

## Quick start (local)
```bash
cd app
cp .env.example .env      # add ANTHROPIC_API_KEY
npm install && npm run build && npm start
# → http://localhost:8088
```

`stumpdad.tsx` is the original single-file prototype, kept for reference.

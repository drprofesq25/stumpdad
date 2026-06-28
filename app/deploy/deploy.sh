#!/usr/bin/env bash
# StumpDad one-shot deploy for the droplet.
# Run as root from anywhere: bash app/deploy/deploy.sh
# It builds the frontend and (re)installs a systemd service that keeps the
# Express server running on PORT (default 8088).
set -euo pipefail

# Resolve the app/ directory (parent of this deploy/ folder).
APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
NODE_BIN="$(command -v node || true)"
SERVICE=/etc/systemd/system/stumpdad.service

echo "==> StumpDad app dir: $APP_DIR"
[ -n "$NODE_BIN" ] || { echo "ERROR: node not found on PATH. Install Node 18+ first."; exit 1; }
echo "==> node: $NODE_BIN ($("$NODE_BIN" -v))"

cd "$APP_DIR"

# 1) Environment / API key
if [ ! -f .env ]; then
  cp .env.example .env
  echo ""
  echo "  Created $APP_DIR/.env"
  echo "  Edit it and set GEMINI_API_KEY=... then re-run this script."
  exit 1
fi
if ! grep -Eq '^(ANTHROPIC_API_KEY|GEMINI_API_KEY)=.+' .env; then
  echo "ERROR: No AI key set in $APP_DIR/.env — set ANTHROPIC_API_KEY (Claude) or GEMINI_API_KEY, then re-run."
  exit 1
fi

# 2) Build
echo "==> Installing dependencies..."
npm install --no-audit --no-fund
echo "==> Building frontend..."
npm run build

# 3) systemd service (templated with the real paths)
PORT_VAL="$(grep -E '^PORT=' .env | cut -d= -f2 | tr -d ' ' || true)"
PORT_VAL="${PORT_VAL:-8088}"
echo "==> Writing $SERVICE (port $PORT_VAL)"
cat > "$SERVICE" <<UNIT
[Unit]
Description=StumpDad family trivia
After=network.target

[Service]
Type=simple
WorkingDirectory=$APP_DIR
ExecStart=$NODE_BIN $APP_DIR/server.js
Restart=on-failure
RestartSec=3
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
UNIT

systemctl daemon-reload
systemctl enable stumpdad >/dev/null 2>&1 || true
systemctl restart stumpdad
sleep 1.5

echo ""
echo "==> Status:"
systemctl --no-pager --lines=0 status stumpdad || true
echo ""
echo "==> Health check:"
curl -s "http://127.0.0.1:${PORT_VAL}/api/health" || echo "(no response yet — check: journalctl -u stumpdad -n 50)"
echo ""
echo ""
echo "Done. StumpDad is serving on port ${PORT_VAL}."
echo "  - Direct (no TLS):   http://YOUR_DROPLET_IP:${PORT_VAL}   (run: ufw allow ${PORT_VAL})"
echo "  - Behind nginx/TLS:  see app/deploy/nginx-stumpdad.conf"
echo "  - Logs:              journalctl -u stumpdad -f"

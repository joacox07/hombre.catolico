#!/usr/bin/env bash
# Host temporal para usar el cerebro desde el panel móvil sin entrar a GitHub.
# Mantiene el gateway sólo en localhost y publica un relay SSH efímero. Cuando el
# relay cambia de URL, actualiza únicamente la variable no secreta de Actions.
set -euo pipefail

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONFIG_FILE="${CONFIG_FILE:?Indicá CONFIG_FILE con la ruta absoluta al .env.local del cerebro.}"
REPO_GITHUB="${REPO_GITHUB:-joacox07/hombre.catolico}"
PUERTO="${PORT:-8793}"

set -a
. "$CONFIG_FILE"
set +a

if ! command -v codex >/dev/null || ! command -v gh >/dev/null || ! command -v ssh >/dev/null; then
  echo "Faltan codex, gh o ssh en esta PC." >&2
  exit 1
fi

node "$RAIZ/cerebro/server.mjs" &
PID_CEREBRO=$!
limpiar() {
  kill "$PID_CEREBRO" 2>/dev/null || true
}
trap limpiar EXIT INT TERM

while kill -0 "$PID_CEREBRO" 2>/dev/null; do
  while IFS= read -r linea; do
    printf '%s\n' "$linea"
    if [[ "$linea" =~ https://[a-z0-9.-]+\.lhr\.life ]]; then
      URL="${BASH_REMATCH[0]}/v1"
      gh variable set CODEX_GATEWAY_URL --body "$URL" -R "$REPO_GITHUB"
      echo "✓ Relay conectado al workflow móvil."
    fi
  done < <(ssh -o StrictHostKeyChecking=no -o ServerAliveInterval=30 -o ServerAliveCountMax=3 -R "80:localhost:${PUERTO}" nokey@localhost.run 2>&1 || true)
  echo "El relay se desconectó; reintentando en 5 segundos…" >&2
  sleep 5
done

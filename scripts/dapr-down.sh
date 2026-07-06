#!/usr/bin/env bash
# Robust Dapr shutdown for this project.
#
# Why this exists:
#   `dapr run -f dapr.yaml` supervises N sidecars + N `yarn nest start`
#   children. If the parent CLI dies unexpectedly (terminal crash, hard
#   kill, `killall dapr`), two things get orphaned:
#     1. `daprd` processes (still holding ports 3500-3503)
#     2. `node dist/apps/<svc>/main` processes that `nest start` forked
#        (still holding app ports 3000-3003)
#
#   `dapr stop -f dapr.yaml` cannot help — the coordinator it looks for
#   is dead. This script tries every level of cleanup so you never have
#   to hunt PIDs by hand.
#
# Usage: yarn dapr:down

set -u

APPS=(order-service payment-service inventory-service notification-service)

echo "[1/3] Graceful multi-app stop..."
dapr stop -f dapr.yaml 2>/dev/null || true

echo "[2/3] Per-app stop (kills orphaned daprd)..."
for id in "${APPS[@]}"; do
  dapr stop --app-id "$id" 2>/dev/null || true
done

echo "[3/3] Killing orphaned nest child processes..."
for id in "${APPS[@]}"; do
  # `nest start <svc>` compiles then forks `node dist/apps/<svc>/main`.
  # That forked node is what actually holds the app port.
  pkill -f "dist/apps/${id}/main" 2>/dev/null || true
done

sleep 1

echo
echo "Port status:"
if command -v ss >/dev/null 2>&1; then
  ss -ltn 2>/dev/null | awk 'NR==1 || /:(3000|3001|3002|3003|3500|3501|3502|3503) / {print}'
elif command -v lsof >/dev/null 2>&1; then
  lsof -iTCP -sTCP:LISTEN -P 2>/dev/null | grep -E ':(3000|3001|3002|3003|3500|3501|3502|3503)\b' || echo "all Dapr/app ports free"
else
  echo "(install ss or lsof to inspect ports)"
fi

echo
echo "Done. If ports are still held, run: yarn dapr:doctor"

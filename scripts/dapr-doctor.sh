#!/usr/bin/env bash
# Diagnose Dapr / app port occupancy.
# Read-only — never kills anything.
#
# Usage: yarn dapr:doctor

set -u

PORTS=(3000 3001 3002 3003 3500 3501 3502 3503)

echo "== dapr list =="
dapr list 2>&1 || true

echo
echo "== Processes on Dapr/app ports =="
for p in "${PORTS[@]}"; do
  if command -v ss >/dev/null 2>&1; then
    line=$(ss -ltnp 2>/dev/null | awk -v p=":$p " '$4 ~ p {print}')
  else
    line=$(lsof -iTCP:"$p" -sTCP:LISTEN -Pn 2>/dev/null | tail -n +2)
  fi
  if [[ -n "$line" ]]; then
    echo "port $p:"
    echo "  $line"
  else
    echo "port $p: free"
  fi
done

echo
echo "== daprd + nest child processes =="
ps -eo pid,ppid,etime,cmd 2>/dev/null \
  | grep -E 'daprd|dist/apps/[a-z-]+-service/main' \
  | grep -v grep \
  || echo "(none)"

echo
echo "If ports are held by orphans, run: yarn dapr:down"

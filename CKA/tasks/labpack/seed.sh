#!/usr/bin/env bash
# Seed a single task's starting/broken state into the current cluster.
#   bash seed.sh CA-02
# Reads the task's `setup` script straight from tasks.json (single source of truth).
set -euo pipefail

ID="${1:-}"
HERE="$(cd "$(dirname "$0")" && pwd)"
TASKS="${HERE}/../tasks.json"

if [ -z "${ID}" ]; then
  echo "usage: seed.sh <TASK-ID>   (e.g. seed.sh CA-02)" >&2
  exit 1
fi
if [ ! -f "${TASKS}" ]; then
  echo "tasks.json not found at ${TASKS}" >&2
  exit 1
fi

extract_field() {
  local field="$1"
  if command -v jq >/dev/null 2>&1; then
    jq -r --arg id "${ID}" --arg f "${field}" '.tasks[] | select(.id==$id) | .[$f] // ""' "${TASKS}"
  elif command -v python3 >/dev/null 2>&1; then
    python3 - "${TASKS}" "${ID}" "${field}" <<'PY'
import json, sys
data = json.load(open(sys.argv[1]))
match = [t for t in data["tasks"] if t["id"] == sys.argv[2]]
print(match[0].get(sys.argv[3], "") if match else "", end="")
PY
  else
    echo "need jq or python3 to read tasks.json" >&2
    exit 2
  fi
}

SETUP="$(extract_field setup)"
if [ -z "${SETUP}" ]; then
  echo "no task with id '${ID}' (or it has no setup)" >&2
  exit 1
fi

echo "==> Seeding ${ID}"
echo "------------------------------------------------------------"
echo "${SETUP}"
echo "------------------------------------------------------------"
bash -c "${SETUP}"
echo "==> Done. Now solve ${ID} and run its verify command."

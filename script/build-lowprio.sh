#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

LOGFILE="build-output/build.log"
mkdir -p build-output

if command -v ionice >/dev/null 2>&1; then
  exec nice -n 19 ionice -c2 -n7 bun run build > "$LOGFILE" 2>&1
else
  exec nice -n 19 bun run build > "$LOGFILE" 2>&1
fi

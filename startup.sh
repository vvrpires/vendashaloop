#!/bin/sh
set -eu
cd /workspace
if [ -f /workspace/.data/database-url ]; then
  DATABASE_URL=$(cat /workspace/.data/database-url)
  export DATABASE_URL
fi
node scripts/preview.mjs stop || true
if curl -sf -o /dev/null --max-time 2 http://127.0.0.1:8080/; then
  exit 0
fi
npm run dev >>/tmp/app-startup.log 2>&1 &
#!/bin/sh
# Container start: make the data folder (often a freshly mounted volume) writable for the
# unprivileged "node" user, optionally refresh the demo accounts, then run the server as "node".
set -e
DATA_DIR="${DATA_DIR:-/app/data}"
mkdir -p "$DATA_DIR"
chown -R node:node "$DATA_DIR"
if [ "$DEMO" = "1" ]; then
  # Demo accounts (demo*@endocontrol.app) are recreated on every start so the data is fresh;
  # real accounts are not touched. A small feeder adds a new value every 5 minutes.
  su-exec node node scripts/demo.js
  su-exec node node scripts/demo-patients.js
  su-exec node node scripts/demo-feed.js &
fi
exec su-exec node node server.js

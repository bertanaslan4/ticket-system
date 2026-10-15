#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"
export PATH="/usr/local/bin:$PATH"
npm run build:server
node server/index.js

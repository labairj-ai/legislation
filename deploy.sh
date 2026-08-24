#!/bin/bash
set -e

echo "==> Building client..."
npm run build --workspace=client

echo "==> Syncing to optiplex..."
rsync -av --exclude=node_modules --exclude=.git --exclude='client/src' \
  ~/Desktop/legislation/ optiplex:~/legislation/

echo "==> Installing server deps on optiplex..."
ssh optiplex "cd ~/legislation/server && npm install --omit=dev"

echo "==> Restarting PM2 on optiplex..."
ssh optiplex "pm2 restart legislation || pm2 start ~/legislation/ecosystem.config.cjs"

echo "==> Done! https://legislation.tailb97cdb.ts.net/"

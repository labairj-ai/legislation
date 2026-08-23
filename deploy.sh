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
ssh optiplex "cd ~/legislation && pm2 restart legislation 2>/dev/null || pm2 start ecosystem.config.cjs"

echo "==> Copying .env..."
ssh optiplex "grep CONGRESS_API_KEY ~/investment/.env >> ~/legislation/.env 2>/dev/null || true"
ssh optiplex "echo 'MLX_URL=http://100.73.128.40:8080' >> ~/legislation/.env 2>/dev/null || true"

echo "==> Done! https://legislation.tailb97cdb.ts.net/"

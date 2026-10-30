#!/usr/bin/env bash
# Clone Excalidraw at the pinned tag (APP_VERSION) into app/, install deps and build.
set -euo pipefail
cd "$(dirname "$0")/.."
TAG="$(tr -d '[:space:]' < APP_VERSION)"

if [ ! -d app/.git ]; then
  git clone --depth 1 --branch "$TAG" https://github.com/excalidraw/excalidraw app
fi

cd app
CURRENT="$(git describe --tags --exact-match 2>/dev/null || true)"
if [ "$CURRENT" != "$TAG" ]; then
  echo "app/ is at '$CURRENT', expected '$TAG'" >&2
  exit 1
fi

npx -y yarn@1.22.22 install --frozen-lockfile --ignore-engines --network-timeout 600000
# Production build: no HMR or eslint overlay, closer to what users get.
(cd excalidraw-app && VITE_APP_DISABLE_SENTRY=true npx vite build)

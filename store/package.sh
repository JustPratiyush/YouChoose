#!/bin/sh
# Builds the Chrome Web Store upload (store/youchoose-<version>.zip) from the extension files only.
set -e
cd "$(dirname "$0")/.."
version=$(sed -n 's/.*"version": *"\([^"]*\)".*/\1/p' manifest.json)
out="store/youchoose-$version.zip"
rm -f "$out"
zip -r -X -q "$out" manifest.json LICENSE THIRD_PARTY_NOTICES.md background.js content options popup shared summarize \
  icons/icon16.png icons/icon32.png icons/icon48.png icons/icon128.png -x '*.DS_Store'
echo "$out"

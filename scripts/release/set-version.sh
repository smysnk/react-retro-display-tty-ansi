#!/usr/bin/env bash

set -euo pipefail

THIS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${THIS_DIR}/../.." && pwd)"

if [[ $# -ne 1 ]]; then
  echo "Usage: $0 <semver>" >&2
  echo "Example: $0 0.1.412" >&2
  exit 1
fi

NEW_VERSION="$1"
if [[ ! "$NEW_VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "Invalid version: $NEW_VERSION (expected format: X.Y.Z)" >&2
  exit 1
fi

if ! command -v node >/dev/null 2>&1; then
  echo "Missing node in PATH" >&2
  exit 1
fi

MANIFEST_PATH="${ROOT_DIR}/package.json"
if [[ ! -f "$MANIFEST_PATH" ]]; then
  echo "Missing package.json: $MANIFEST_PATH" >&2
  exit 1
fi

OLD_VERSION="$(node -p "require(process.argv[1]).version" "$MANIFEST_PATH")"

node - <<'JS' "$MANIFEST_PATH" "$NEW_VERSION"
const fs = require("node:fs");

const [manifestPath, newVersion] = process.argv.slice(2);
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
manifest.version = newVersion;
fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
JS

echo "Updated package version: $OLD_VERSION -> $NEW_VERSION"
echo "Files updated:"
echo "  - package.json"

#!/usr/bin/env bash

set -euo pipefail

THIS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${THIS_DIR}/../.." && pwd)"
SET_VERSION_SCRIPT="${THIS_DIR}/set-version.sh"
MANIFEST_PATH="${ROOT_DIR}/package.json"

if [[ ! -x "$SET_VERSION_SCRIPT" ]]; then
  echo "Missing executable: $SET_VERSION_SCRIPT" >&2
  exit 1
fi

if [[ ! -f "$MANIFEST_PATH" ]]; then
  echo "Missing package.json: $MANIFEST_PATH" >&2
  exit 1
fi

BUILD_NUMBER="${BUILD_NUMBER:-${GITHUB_RUN_NUMBER:-}}"
if [[ -z "$BUILD_NUMBER" ]]; then
  echo "Missing BUILD_NUMBER (or GITHUB_RUN_NUMBER)" >&2
  exit 1
fi
if [[ ! "$BUILD_NUMBER" =~ ^[0-9]+$ ]]; then
  echo "BUILD_NUMBER must be an integer, got: $BUILD_NUMBER" >&2
  exit 1
fi

if ! command -v node >/dev/null 2>&1; then
  echo "Missing node in PATH" >&2
  exit 1
fi

CURRENT_VERSION="$(node -p "require(process.argv[1]).version" "$MANIFEST_PATH")"
CURRENT_MAJOR="${CURRENT_VERSION%%.*}"
CURRENT_MINOR_AND_PATCH="${CURRENT_VERSION#*.}"
CURRENT_MINOR="${CURRENT_MINOR_AND_PATCH%%.*}"

VERSION_MAJOR="${VERSION_MAJOR:-$CURRENT_MAJOR}"
VERSION_MINOR="${VERSION_MINOR:-$CURRENT_MINOR}"
PATCH_MODE="${PATCH_MODE:-build}"
PATCH_FIXED="${PATCH_FIXED:-}"

if [[ ! "$VERSION_MAJOR" =~ ^[0-9]+$ ]]; then
  echo "VERSION_MAJOR must be an integer, got: $VERSION_MAJOR" >&2
  exit 1
fi
if [[ ! "$VERSION_MINOR" =~ ^[0-9]+$ ]]; then
  echo "VERSION_MINOR must be an integer, got: $VERSION_MINOR" >&2
  exit 1
fi

case "$PATCH_MODE" in
  build)
    PATCH="$BUILD_NUMBER"
    ;;
  fixed-minus-build)
    if [[ -z "$PATCH_FIXED" ]]; then
      echo "PATCH_FIXED is required when PATCH_MODE=fixed-minus-build" >&2
      exit 1
    fi
    if [[ ! "$PATCH_FIXED" =~ ^[0-9]+$ ]]; then
      echo "PATCH_FIXED must be an integer, got: $PATCH_FIXED" >&2
      exit 1
    fi
    PATCH=$((PATCH_FIXED - BUILD_NUMBER))
    if (( PATCH < 0 )); then
      echo "Computed patch is negative: PATCH_FIXED($PATCH_FIXED) - BUILD_NUMBER($BUILD_NUMBER) = $PATCH" >&2
      exit 1
    fi
    ;;
  *)
    echo "Unsupported PATCH_MODE: $PATCH_MODE (supported: build, fixed-minus-build)" >&2
    exit 1
    ;;
esac

TARGET_VERSION="${VERSION_MAJOR}.${VERSION_MINOR}.${PATCH}"
echo "Computed npm package version from build metadata:"
echo "  current=${CURRENT_VERSION}"
echo "  major=${VERSION_MAJOR}"
echo "  minor=${VERSION_MINOR}"
echo "  patch_mode=${PATCH_MODE}"
if [[ -n "$PATCH_FIXED" ]]; then
  echo "  patch_fixed=${PATCH_FIXED}"
fi
echo "  build_number=${BUILD_NUMBER}"
echo "  target=${TARGET_VERSION}"

"$SET_VERSION_SCRIPT" "$TARGET_VERSION"

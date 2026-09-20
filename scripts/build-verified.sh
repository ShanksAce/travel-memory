#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
project_root="$(cd "${script_dir}/.." && pwd)"

command -v timeout || {
  echo "build-verified.sh requires GNU timeout." >&2
  exit 69
}

vinext="${project_root}/node_modules/.bin/vinext"
if [[ ! -x "${vinext}" ]]; then
  echo "vinext is unavailable. Run npm ci before building." >&2
  exit 69
fi

echo "Running bounded vinext build..."
cd "${project_root}"
timeout \
  --signal=TERM \
  --kill-after="${BUILD_KILL_AFTER:-10s}" \
  "${BUILD_TIMEOUT:-3m}" \
  "${vinext}" build

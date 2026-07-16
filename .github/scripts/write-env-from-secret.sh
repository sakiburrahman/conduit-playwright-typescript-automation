#!/usr/bin/env bash
# Writes GitHub Actions secret ENV_FILE to src/config/environment/.env when set.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ENV_PATH="${ROOT_DIR}/src/config/environment/.env"

if [[ -z "${ENV_FILE:-}" ]]; then
  echo "ENV_FILE secret is not set; continuing with workflow env defaults only."
  exit 0
fi

mkdir -p "$(dirname "${ENV_PATH}")"
printf '%s\n' "${ENV_FILE}" >"${ENV_PATH}"
echo "Wrote ${ENV_PATH} from ENV_FILE secret ($(wc -l <"${ENV_PATH}" | tr -d ' ') lines)."

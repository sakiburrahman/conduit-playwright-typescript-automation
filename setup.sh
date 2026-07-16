#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "${ROOT_DIR}"

INSTALL_ALL_BROWSERS=false

print_help() {
  cat <<'HELP'
Usage: ./setup.sh [--browsers-all]

Installs project dependencies, Playwright browsers, local environment files,
runtime directories, Git hooks, and optional native reporter dependencies.

Options:
  --browsers-all   Install Chromium, Firefox, and WebKit.
                   By default, only Chromium is installed.
  -h, --help       Show this help message.
HELP
}

for arg in "$@"; do
  case "${arg}" in
    --browsers-all)
      INSTALL_ALL_BROWSERS=true
      ;;
    -h|--help)
      print_help
      exit 0
      ;;
    *)
      echo "Unknown option: ${arg}" >&2
      print_help >&2
      exit 1
      ;;
  esac
done

command_exists() {
  command -v "$1" >/dev/null 2>&1
}

npm_script_exists() {
  node -e "
    const scripts = require('./package.json').scripts || {};
    process.exit(Object.prototype.hasOwnProperty.call(scripts, process.argv[1]) ? 0 : 1);
  " "$1"
}

echo "==> Checking prerequisites..."

if ! command_exists node; then
  echo "Node.js 18 or later is required." >&2
  exit 1
fi

if ! command_exists npm; then
  echo "npm 9 or later is required." >&2
  exit 1
fi

NODE_MAJOR="$(node -p "Number(process.versions.node.split('.')[0])")"
NPM_MAJOR="$(npm -v | cut -d. -f1)"

if (( NODE_MAJOR < 18 )); then
  echo "Node.js $(node -v) detected. Upgrade to Node.js 18 or later." >&2
  exit 1
fi

if (( NPM_MAJOR < 9 )); then
  echo "npm $(npm -v) detected. Upgrade to npm 9 or later." >&2
  exit 1
fi

echo "    Node.js: $(node -v)"
echo "    npm:     $(npm -v)"

echo "==> Installing npm dependencies..."
if [[ -f package-lock.json ]]; then
  npm ci
else
  npm install
fi

echo "==> Installing Playwright browsers..."

PLAYWRIGHT_BROWSERS=(chromium)
if [[ "${INSTALL_ALL_BROWSERS}" == "true" ]]; then
  PLAYWRIGHT_BROWSERS=(chromium firefox webkit)
fi

if [[ "$(uname -s)" == "Linux" ]]; then
  npx playwright install --with-deps "${PLAYWRIGHT_BROWSERS[@]}"
else
  npx playwright install "${PLAYWRIGHT_BROWSERS[@]}"
fi

ENV_EXAMPLE="src/config/environment/.env.example"
ENV_FILE="src/config/environment/.env"

if [[ -f "${ENV_EXAMPLE}" && ! -f "${ENV_FILE}" ]]; then
  echo "==> Creating ${ENV_FILE}..."
  cp "${ENV_EXAMPLE}" "${ENV_FILE}"
elif [[ -f "${ENV_FILE}" ]]; then
  echo "==> Keeping existing ${ENV_FILE}."
else
  echo "==> Skipping environment file creation; ${ENV_EXAMPLE} was not found."
fi

CREATE_USER_EXAMPLE="test-data/create-user.json.example"
CREATE_USER_FILE="test-data/create-user.json"

if [[ -f "${CREATE_USER_EXAMPLE}" && ! -f "${CREATE_USER_FILE}" ]]; then
  echo "==> Creating ${CREATE_USER_FILE} from the example file..."
  cp "${CREATE_USER_EXAMPLE}" "${CREATE_USER_FILE}"
fi

echo "==> Creating runtime directories..."
mkdir -p \
  playwright/.auth \
  logs \
  test-results/history

touch playwright/.auth/.gitkeep

echo "==> Enabling executable permissions..."
chmod +x setup.sh
if [[ -f all-test-run.sh ]]; then
  chmod +x all-test-run.sh
fi

if npm_script_exists prepare; then
  echo "==> Installing Git hooks..."
  npm run prepare
fi

if npm_script_exists rebuild:sqlite3; then
  echo "==> Rebuilding sqlite3 for the Ortoni reporter..."
  if ! npm run rebuild:sqlite3; then
    echo "Warning: sqlite3 rebuild failed. Ortoni may be unavailable." >&2
  fi
elif npm ls sqlite3 --depth=0 >/dev/null 2>&1; then
  echo "==> Rebuilding sqlite3 for the Ortoni reporter..."
  if ! npm rebuild sqlite3; then
    echo "Warning: sqlite3 rebuild failed. Ortoni may be unavailable." >&2
  fi
fi

echo
echo "Setup complete."
echo "npm run lint && npm run format  # before commit"
echo
echo "Run the complete local suite (API + all E2E) with:"
echo "  ./all-test-run.sh"
echo

#!/usr/bin/env bash
set -uo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "${ROOT_DIR}"

if [[ "${ALL_TEST_RUN_DIRECT:-}" != "1" ]]; then
  if [[ -z "${ENVIRONMENT+x}" && -z "${DYNAMIC_USER+x}" && -z "${BROWSER+x}" && -z "${HEADLESS+x}" && -z "${PARALLEL+x}" && -z "${WORKERS+x}" && -z "${CI+x}" ]]; then
    exec npm run test:all:headed:parallel
  fi
  export ALL_TEST_RUN_DIRECT=1
fi

ENVIRONMENT="${ENVIRONMENT:-DEV}"
BROWSER="${BROWSER:-DesktopChrome}"
DYNAMIC_USER="${DYNAMIC_USER:-true}"
HEADLESS="${HEADLESS:-false}"
PARALLEL="${PARALLEL:-true}"
CI="${CI:-false}"

if [[ ! "${PARALLEL}" =~ ^(true|false)$ ]]; then
  echo "PARALLEL must be true or false. Received: ${PARALLEL}" >&2
  exit 1
fi

if [[ "${PARALLEL}" == "true" ]]; then
  WORKERS="${WORKERS:-8}"
else
  WORKERS="${WORKERS:-1}"
fi

if [[ ! "${WORKERS}" =~ ^[1-9][0-9]*$ ]]; then
  echo "WORKERS must be a positive integer. Received: ${WORKERS}" >&2
  exit 1
fi

if (( WORKERS > 8 )); then
  echo "WORKERS=${WORKERS} exceeds maximum 8; capping to 8." >&2
  WORKERS=8
fi

TEST_RESULTS_DIR="test-results"
HISTORY_DIR="${TEST_RESULTS_DIR}/history"
LOG_DIR="logs"
RUN_ID="$(date '+%Y-%m-%d_%H-%M-%S')"
export RUN_ID

mkdir -p "${LOG_DIR}" "${HISTORY_DIR}"

npm_script_exists() {
  node -e "
    const scripts = require('./package.json').scripts || {};
    process.exit(
      Object.prototype.hasOwnProperty.call(scripts, process.argv[1]) ? 0 : 1
    );
  " "$1"
}

run_command() {
  local name="$1"
  shift

  echo
  echo "==> ${name}"
  echo "    $*"

  "$@"
  local exit_code=$?

  if (( exit_code == 0 )); then
    echo "==> ${name}: passed"
  else
    echo "==> ${name}: failed with exit code ${exit_code}" >&2
  fi

  return "${exit_code}"
}

record_result() {
  local suite_name="$1"
  local exit_code="$2"

  SUITE_NAMES+=("${suite_name}")
  SUITE_RESULTS+=("${exit_code}")

  if (( exit_code != 0 )); then
    overall_status=1
  fi
}

record_report_result() {
  local name="$1"
  local exit_code="$2"

  REPORT_NAMES+=("${name}")
  REPORT_RESULTS+=("${exit_code}")

  if (( exit_code != 0 )); then
    report_status=1
  fi
}

start_report() {
  local report_name="$1"
  local npm_script="$2"
  local log_key="$3"
  local log_file="${LOG_DIR}/${log_key}-report.log"
  local pid_file="${LOG_DIR}/${log_key}-launcher.pid"

  if ! npm_script_exists "${npm_script}"; then
    echo "Warning: npm script '${npm_script}' does not exist; ${report_name} was not opened." >&2
    return 0
  fi

  if [[ -f "${pid_file}" ]]; then
    local old_pid
    old_pid="$(tr -d '[:space:]' <"${pid_file}" || true)"
    if [[ "${old_pid}" =~ ^[0-9]+$ ]] && kill -0 "${old_pid}" 2>/dev/null; then
      echo "==> Stopping previous ${report_name} launcher (PID ${old_pid})..."
      kill "${old_pid}" 2>/dev/null || true
      sleep 0.5
    fi
    rm -f "${pid_file}"
  fi

  echo "==> Opening ${report_name} report..."
  nohup npm run "${npm_script}" >"${log_file}" 2>&1 &
  local report_pid=$!
  echo "${report_pid}" >"${pid_file}"
  sleep 0.8

  echo "    PID: ${report_pid}"
  echo "    Log: ${log_file}"
}

if ! command -v node >/dev/null 2>&1 || ! command -v npm >/dev/null 2>&1; then
  echo "Node.js and npm are required. Run ./setup.sh first." >&2
  exit 1
fi

if [[ ! -f package.json ]]; then
  echo "package.json was not found in ${ROOT_DIR}." >&2
  exit 1
fi

echo "Conduit Playwright full suite (API + all E2E)"
echo "Environment:   ${ENVIRONMENT}"
echo "Browser:       ${BROWSER}"
echo "UI mode:       $([ "${HEADLESS}" = "true" ] && echo Headless || echo Headed)"
echo "Architecture:  two-phase E2E (settings mutate shared run user)"
echo "  Context:     fresh BrowserContext + Page per test (storageState reused)"
if [[ "${PARALLEL}" == "true" ]]; then
  echo "Parallel:      Enabled (max ${WORKERS} workers)"
  echo "  Phase 1 API:           3 tests · no browser · up to ${WORKERS} workers"
  echo "  Phase 2 articles/tags: 12 tests · fullyParallel · up to ${WORKERS} workers"
  echo "  Phase 3 settings:      5 tests · 1 worker · serial (shared user)"
else
  echo "Parallel:      Disabled (serial; ${WORKERS} worker(s) for API + article/tag E2E)"
  echo "Settings:      1 worker (shared user; always last)"
fi
echo "Dynamic user:  ${DYNAMIC_USER}"
echo "Run ID:        ${RUN_ID}"
echo "CI:            ${CI}"


echo
echo "==> Preparing report directories once (preserving history)..."
if npm_script_exists reports:prepare; then
  run_command "Prepare multi-phase report dirs" npm run reports:prepare
else
  npx tsx src/utils/reports-helper.ts prepare-multi
fi

overall_status=0
report_status=0
declare -a SUITE_NAMES=()
declare -a SUITE_RESULTS=()
declare -a REPORT_NAMES=()
declare -a REPORT_RESULTS=()

PHASE_ENV=(
  "ENVIRONMENT=${ENVIRONMENT}"
  "DYNAMIC_USER=${DYNAMIC_USER}"
  "OPEN_REPORTS=false"
  "MULTI_PHASE_RUN=true"
  "KEEP_REPORT_RESULTS=true"
  "RUN_ID=${RUN_ID}"
)

run_command \
  "Phase 1/3: API tests (${PARALLEL}, ${WORKERS} worker(s))" \
  npx cross-env \
    "${PHASE_ENV[@]}" \
    "TEST_TYPE=api" \
    "REPORT_PHASE=api" \
    "PARALLEL=${PARALLEL}" \
    "WORKERS=${WORKERS}" \
    npx playwright test --project=api
record_result "API tests" "$?"

run_command \
  "Phase 2/3: article + tag E2E (${BROWSER}, ${PARALLEL}, ${WORKERS} worker(s))" \
  npx cross-env \
    "${PHASE_ENV[@]}" \
    "TEST_TYPE=e2e" \
    "REPORT_PHASE=e2e-articles" \
    "BROWSER=${BROWSER}" \
    "HEADLESS=${HEADLESS}" \
    "PARALLEL=${PARALLEL}" \
    "WORKERS=${WORKERS}" \
    npx playwright test --project=e2e --grep-invert=@E2ESettings
record_result "E2E article + tag tests" "$?"

echo
echo "==> Phase 3/3: settings E2E (1 worker; shared run-level user)."

run_command \
  "Phase 3/3: settings E2E (${BROWSER}, 1 worker)" \
  npx cross-env \
    "${PHASE_ENV[@]}" \
    "TEST_TYPE=e2e" \
    "REPORT_PHASE=e2e-settings" \
    "BROWSER=${BROWSER}" \
    "HEADLESS=${HEADLESS}" \
    "PARALLEL=false" \
    "WORKERS=1" \
    npx playwright test \
      tests/e2e-tests/settings/test-e2e-update-user-settings.spec.ts \
      --project=e2e \
      --workers=1
record_result "E2E settings tests" "$?"

echo
echo "==> Merging phase reports into final Playwright / Allure / Ortoni outputs..."
if npm_script_exists reports:merge; then
  run_command "Merge all reports" npm run reports:merge
  record_report_result "Report merge" "$?"
else
  run_command "Merge all reports" npx tsx src/utils/reports-helper.ts merge-all
  record_report_result "Report merge" "$?"
fi

echo
echo "==> Archiving final reports under history/${RUN_ID}/..."
if npm_script_exists reports:archive; then
  run_command "Archive reports" env RUN_ID="${RUN_ID}" npm run reports:archive -- "${RUN_ID}"
  record_report_result "Report archive" "$?"
else
  run_command "Archive reports" npx tsx src/utils/reports-helper.ts archive "${RUN_ID}"
  record_report_result "Report archive" "$?"
fi

if [[ "${SEND_EMAIL_TO_USER:-false}" == "true" ]]; then
  echo
  echo "==> Emailing combined reports (SEND_EMAIL_TO_USER=true)..."
  if npm_script_exists reports:email; then
    run_command "Email reports" env RUN_ID="${RUN_ID}" EMAIL_REPORT_STATUS="local-suite" npm run reports:email
    record_report_result "Report email" "$?"
  else
    run_command "Email reports" env RUN_ID="${RUN_ID}" npx tsx src/utils/email-report-helper.ts
    record_report_result "Report email" "$?"
  fi
fi

echo
echo "Test execution summary (full suite)"

for index in "${!SUITE_NAMES[@]}"; do
  if (( SUITE_RESULTS[index] == 0 )); then
    printf "PASS  %s\n" "${SUITE_NAMES[index]}"
  else
    printf "FAIL  %s\n" "${SUITE_NAMES[index]}"
  fi
done

echo
echo "Report generation summary"

for index in "${!REPORT_NAMES[@]}"; do
  if (( REPORT_RESULTS[index] == 0 )); then
    printf "PASS  %s\n" "${REPORT_NAMES[index]}"
  else
    printf "FAIL  %s\n" "${REPORT_NAMES[index]}"
  fi
done

echo
echo "Report locations"
echo "  Latest Allure:          test-results/allure-report/"
echo "  Latest Ortoni:          test-results/ortoni-report/"
echo "  Latest Playwright HTML: test-results/playwright-report/"
echo "  History:                test-results/history/${RUN_ID}/"

if [[ "${CI}" == "true" ]]; then
  echo
  echo "CI environment detected. Reports were generated and archived but will not be opened."
else
  echo
  echo "==> Opening Allure, Playwright, and Ortoni reports once..."

  if npm_script_exists open:playwright-report; then
    echo "==> Opening Playwright report..."
    if npm run open:playwright-report; then
      echo "==> Playwright report: opened"
    else
      echo "Warning: Playwright report failed to open." >&2
    fi
  fi

  start_report "Allure" "open:allure-report" "allure"
  start_report "Ortoni" "open:ortoni-report" "ortoni"
fi

echo
final_exit="${overall_status}"
if (( report_status != 0 )); then
  final_exit=1
fi

if (( final_exit == 0 )); then
  if [[ "${CI}" == "true" ]]; then
    echo "All test suites completed successfully."
    echo "All available reports were merged, archived, and prepared for artifact upload."
  else
    echo "All test suites completed successfully."
    echo "All available reports were merged, archived, and opened."
  fi
else
  if [[ "${CI}" == "true" ]]; then
    echo "One or more test suites failed. Remaining suites still ran, and all available reports were merged, archived, and prepared for artifact upload." >&2
  else
    echo "One or more test suites failed. Remaining suites still ran, and all available reports were merged, archived, and opened." >&2
  fi
fi

echo "Script execution is complete. Report viewers will continue running in the background (local only)."
exit "${final_exit}"

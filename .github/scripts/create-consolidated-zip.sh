#!/usr/bin/env bash
# Creates test-results/consolidated-reports.zip from whichever of the three
# merged report directories exist.  Meant to be called from the working
# directory that contains test-results/.
#
# Usage:
#   bash .github/scripts/create-consolidated-zip.sh
#
# Exit code is always 0; the upload step uses if-no-files-found: ignore.
set -euo pipefail

RESULTS_DIR="${RESULTS_DIR:-test-results}"
ZIP_PATH="${RESULTS_DIR}/consolidated-reports.zip"

cd "${RESULTS_DIR}"

DIRS=()
if [ -d playwright-report ]; then DIRS+=(playwright-report); fi
if [ -d allure-report ];     then DIRS+=(allure-report);     fi
if [ -d ortoni-report ];     then DIRS+=(ortoni-report);     fi

if [ "${#DIRS[@]}" -gt 0 ]; then
  zip -r -q consolidated-reports.zip "${DIRS[@]}"
  echo "Created ${ZIP_PATH} (${#DIRS[@]} report dir(s))"
  ls -lh consolidated-reports.zip
else
  echo "No merged report directories found; consolidated ZIP was not created"
fi

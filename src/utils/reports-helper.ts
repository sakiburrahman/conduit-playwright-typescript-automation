import { execSync, spawn } from "child_process";
import * as fs from "fs";
import * as net from "net";
import * as os from "node:os";
import * as path from "path";

import { Logger } from "./logger";

import type { ReporterDescription } from "@playwright/test";

export const REPORT_PHASES = ["api", "e2e-articles", "e2e-settings"] as const;
export type ReportPhase = (typeof REPORT_PHASES)[number];

export function isReportPhase(value: string | undefined): value is ReportPhase {
  return (
    value === "api" || value === "e2e-articles" || value === "e2e-settings"
  );
}

export function isMultiPhaseRun(): boolean {
  return (
    process.env.MULTI_PHASE_RUN === "true" ||
    process.env.KEEP_REPORT_RESULTS === "true"
  );
}

export function getReportPhase(): ReportPhase | undefined {
  const raw = process.env.REPORT_PHASE;
  return isReportPhase(raw) ? raw : undefined;
}

export const TEST_RESULTS_DIR = path.join(process.cwd(), "test-results");
export const HISTORY_DIR = path.join(TEST_RESULTS_DIR, "history");
export const ARTIFACTS_DIR = path.join(TEST_RESULTS_DIR, "artifacts");

export const RAW_DIR = path.join(TEST_RESULTS_DIR, "raw");
export const RAW_BLOB_DIR = path.join(RAW_DIR, "playwright-blob");
export const RAW_ALLURE_DIR = path.join(RAW_DIR, "allure");
export const RAW_ORTONI_DIR = path.join(RAW_DIR, "ortoni");

export const PLAYWRIGHT_REPORT_DIR = path.join(
  TEST_RESULTS_DIR,
  "playwright-report",
);
export const ALLURE_RESULTS_DIR = path.join(TEST_RESULTS_DIR, "allure-result");
export const ALLURE_REPORT_DIR = path.join(TEST_RESULTS_DIR, "allure-report");
export const ORTONI_REPORT_DIR = path.join(TEST_RESULTS_DIR, "ortoni-report");

export const BLOB_MERGE_INPUT_DIR = path.join(
  TEST_RESULTS_DIR,
  "blob-report-merge",
);

export function rawBlobPhaseDir(phase: ReportPhase): string {
  return path.join(RAW_BLOB_DIR, phase);
}

export function rawAllurePhaseDir(phase: ReportPhase): string {
  return path.join(RAW_ALLURE_DIR, phase);
}

export function rawOrtoniPhaseDir(phase: ReportPhase): string {
  return path.join(RAW_ORTONI_DIR, phase);
}

export function blobZipName(phase: ReportPhase): string {
  return `${phase}.zip`;
}

export function historyRunDir(runId: string): string {
  return path.join(HISTORY_DIR, runId);
}

const REL = {
  playwrightReport: PLAYWRIGHT_REPORT_DIR,
  allureResult: ALLURE_RESULTS_DIR,
  ortoniReport: path.join("test-results", "ortoni-report"),
  blobPhase: (phase: ReportPhase): string => rawBlobPhaseDir(phase),
  allurePhase: (phase: ReportPhase): string => rawAllurePhaseDir(phase),
  ortoniPhase: (phase: ReportPhase): string =>
    path.join("test-results", "raw", "ortoni", phase),
  blobZip: (phase: ReportPhase): string => `${phase}.zip`,
};

export function canLoadOrtoniReport(): boolean {
  try {
    require.resolve("ortoni-report");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require("sqlite3");
    return true;
  } catch {
    console.warn(
      "Skipping ortoni-report: sqlite3 native bindings are unavailable. Run `npm rebuild sqlite3` to restore it.",
    );
    return false;
  }
}

export function buildHtmlReporter(): ReporterDescription {
  return ["html", { outputFolder: REL.playwrightReport, open: "never" }];
}

export function buildBlobReporter(phase: ReportPhase): ReporterDescription {
  return [
    "blob",
    {
      outputDir: REL.blobPhase(phase),
      fileName: REL.blobZip(phase),
    },
  ];
}

export function buildAllureReporter(
  testType = process.env.TEST_TYPE ?? "E2E",
  resultsDir: string = REL.allureResult,
  reportPhase = process.env.REPORT_PHASE ?? "standalone",
): ReporterDescription {
  return [
    "allure-playwright",
    {
      resultsDir,
      environmentInfo: {
        os_platform: os.platform(),
        os_release: os.release(),
        os_version: os.version(),
        node_version: process.version,
        test_type: testType,
        test_env: process.env.TEST_ENV ?? process.env.ENVIRONMENT ?? "DEV",
        report_phase: reportPhase,
      },
    },
  ];
}

export function buildMergedAllureEnvironmentProperties(): string {
  const testEnv = process.env.TEST_ENV ?? process.env.ENVIRONMENT ?? "DEV";
  return [
    `os_platform=${os.platform()}`,
    `os_release=${os.release()}`,
    `os_version=${os.version()}`,
    `node_version=${process.version}`,
    `test_type=API & E2E`,
    `test_env=${testEnv}`,
    `report_phase=all-tests`,
    "",
  ].join("\n");
}

export function buildOrtoniReporter(
  folderPath: string = REL.ortoniReport,
  testTypeLabel?: string,
): ReporterDescription | null {
  if (!canLoadOrtoniReport()) {
    return null;
  }

  const envLabel = process.env.TEST_ENV ?? process.env.ENVIRONMENT ?? "DEV";
  const phase = process.env.REPORT_PHASE;
  const isMergedSuite = testTypeLabel === "API & E2E";
  const typeLabel =
    testTypeLabel ??
    (phase ? `${phase.toUpperCase()} - ${envLabel}` : `ALL - ${envLabel}`);
  const reportPhaseLabel = isMergedSuite
    ? "all-tests"
    : (phase ?? "standalone");
  const parallel = process.env.PARALLEL ?? "true";
  const workers =
    process.env.WORKERS ?? (parallel === "false" ? "1" : String(8));
  const authorName = "Md Sakibur Rahman";
  const projectName = "Playwright Typescript Automation";

  return [
    "ortoni-report",
    {
      base64Image: true,
      title: "Playwright Test Automation Report",
      showProject: true,
      filename: "ortoni-report",
      folderPath,
      authorName,
      preferredTheme: "light",
      projectName,
      testType: typeLabel,
      open: "never",
      saveHistory: false,
      meta: {
        Project: projectName,
        Environment: envLabel,
        Browser: process.env.BROWSER ?? "DesktopChrome",
        Parallel: parallel,
        Workers: workers,
        "Dynamic User": process.env.DYNAMIC_USER ?? "true",
        "Report Phase": reportPhaseLabel,
        Author: authorName,
      },
    },
  ];
}

export function buildPhaseReporters(): ReporterDescription[] {
  const phase = getReportPhase();
  if (!phase) {
    throw new Error(
      "MULTI_PHASE_RUN is set but REPORT_PHASE is missing or invalid (api | e2e-articles | e2e-settings)",
    );
  }

  return [
    ["./src/utils/my-reporter.ts"],
    ["line"],
    buildBlobReporter(phase),
    buildAllureReporter(phase.toUpperCase(), REL.allurePhase(phase)),
  ];
}

export function buildStandaloneReporters(
  testType = process.env.TEST_TYPE ?? "E2E",
): ReporterDescription[] {
  const reporters: ReporterDescription[] = [
    ["./src/utils/my-reporter.ts"],
    ["line"],
    buildHtmlReporter(),
    buildAllureReporter(testType),
  ];

  const ortoni = buildOrtoniReporter();
  if (ortoni) {
    reporters.push(ortoni);
  }

  return reporters;
}

export function buildMergedSuiteReporters(): ReporterDescription[] {
  const reporters: ReporterDescription[] = [buildHtmlReporter()];
  const ortoni = buildOrtoniReporter(REL.ortoniReport, "API & E2E");
  if (ortoni) {
    reporters.push(ortoni);
  }
  return reporters;
}

export function buildReportersForConfig(): ReporterDescription[] {
  if (isMultiPhaseRun()) {
    return buildPhaseReporters();
  }
  return buildStandaloneReporters();
}

const DEFAULT_PLAYWRIGHT_REPORT_PORT = 9323;
const PLAYWRIGHT_REPORT_PORT_ENV = "PLAYWRIGHT_REPORT_PORT";
const HISTORY_RETENTION = 10;

const ORTONI_DB_PATH = path.join(
  ORTONI_REPORT_DIR,
  "ortoni-data-history.sqlite",
);
const ORTONI_REPORT_PATH = path.join(ORTONI_REPORT_DIR, "ortoni-report.html");

const LATEST_ALLURE_LINK = path.join(TEST_RESULTS_DIR, "allure-report-latest");
const LATEST_ORTONI_LINK = path.join(TEST_RESULTS_DIR, "ortoni-report-latest");

const LEGACY_HISTORY_PREFIXES = [
  "allure_",
  "allure-report_",
  "ortoni_",
  "ortoni-report_",
  "playwright_",
  "playwright-report_",
];

export interface MergeReportsResult {
  playwright: boolean;
  allure: boolean;
  ortoni: boolean;
}

export function isCiEnvironment(): boolean {
  return (
    process.env.CI === "true" ||
    process.env.GITHUB_ACTIONS === "true" ||
    process.env.GITLAB_CI === "true"
  );
}

function serveAllureReportInBrowser(reportDir: string): boolean {
  const generatedReportPath = path.join(reportDir, "index.html");
  if (!fs.existsSync(generatedReportPath)) {
    return false;
  }

  const allureBin = path.join(
    process.cwd(),
    "node_modules",
    ".bin",
    process.platform === "win32" ? "allure.cmd" : "allure",
  );
  const command = fs.existsSync(allureBin) ? allureBin : "npx";
  const args = fs.existsSync(allureBin)
    ? ["open", reportDir]
    : ["allure", "open", reportDir];

  const child = spawn(command, args, {
    detached: true,
    stdio: "ignore",
    shell: process.platform === "win32",
    cwd: process.cwd(),
    env: process.env,
  });
  child.unref();
  return true;
}

function isPortFree(port: number, host = "127.0.0.1"): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.unref();
    server.once("error", () => resolve(false));
    server.once("listening", () => {
      server.close(() => resolve(true));
    });
    server.listen(port, host);
  });
}

const PLAYWRIGHT_SERVER_PID_FILE = path.join(
  process.cwd(),
  "logs",
  "playwright-report-server.pid",
);

function stopProcessTree(pid: number): void {
  if (!Number.isInteger(pid) || pid <= 0 || pid === process.pid) {
    return;
  }

  try {
    process.kill(pid, 0);
  } catch {
    return;
  }

  try {
    if (process.platform === "win32") {
      execSync(`taskkill /PID ${pid} /T /F`, { stdio: "ignore" });
    } else {
      try {
        process.kill(-pid, "SIGTERM");
      } catch {
        process.kill(pid, "SIGTERM");
      }
    }
  } catch {
    /* ignore */
  }
}

function stopStalePlaywrightReportServer(): void {
  if (fs.existsSync(PLAYWRIGHT_SERVER_PID_FILE)) {
    const raw = fs.readFileSync(PLAYWRIGHT_SERVER_PID_FILE, "utf-8").trim();
    const pid = Number(raw);
    if (Number.isInteger(pid) && pid > 0 && pid !== process.pid) {
      Logger.logInfo(`Stopping previous Playwright report server (PID ${pid})`);
      stopProcessTree(pid);
    }
    try {
      fs.unlinkSync(PLAYWRIGHT_SERVER_PID_FILE);
    } catch {
      /* ignore */
    }
  }

  const legacyLauncherPid = path.join(
    process.cwd(),
    "logs",
    "playwright-report.pid",
  );
  if (fs.existsSync(legacyLauncherPid)) {
    try {
      fs.unlinkSync(legacyLauncherPid);
    } catch {
      /* ignore */
    }
  }

  if (process.platform === "win32") {
    return;
  }

  try {
    const output = execSync(
      `lsof -ti :${DEFAULT_PLAYWRIGHT_REPORT_PORT} 2>/dev/null || true`,
      { encoding: "utf-8" },
    ).trim();
    if (!output) {
      return;
    }
    for (const line of output.split(/\s+/)) {
      const pid = Number(line.trim());
      if (Number.isInteger(pid) && pid > 0 && pid !== process.pid) {
        Logger.logInfo(
          `Freeing port ${DEFAULT_PLAYWRIGHT_REPORT_PORT} (PID ${pid})`,
        );
        stopProcessTree(pid);
      }
    }
  } catch {
    /* ignore */
  }
}

async function waitForPortOpen(
  port: number,
  host = "127.0.0.1",
  maxWaitMs = 8_000,
): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    const free = await isPortFree(port, host);
    if (!free) {
      return true;
    }
    await delay(200);
  }
  return false;
}

async function resolvePlaywrightReportPort(): Promise<number> {
  const configured = process.env[PLAYWRIGHT_REPORT_PORT_ENV];
  if (configured) {
    const parsed = Number(configured);
    if (Number.isInteger(parsed) && parsed > 0) {
      return parsed;
    }
  }

  stopStalePlaywrightReportServer();
  await delay(400);

  if (await isPortFree(DEFAULT_PLAYWRIGHT_REPORT_PORT)) {
    return DEFAULT_PLAYWRIGHT_REPORT_PORT;
  }

  for (
    let port = DEFAULT_PLAYWRIGHT_REPORT_PORT + 1;
    port < DEFAULT_PLAYWRIGHT_REPORT_PORT + 20;
    port++
  ) {
    if (await isPortFree(port)) {
      Logger.logWarning(
        `Port ${DEFAULT_PLAYWRIGHT_REPORT_PORT} is busy; using ${port} for Playwright HTML report`,
      );
      return port;
    }
  }

  return DEFAULT_PLAYWRIGHT_REPORT_PORT;
}

async function servePlaywrightReportInBrowser(): Promise<boolean> {
  if (!fs.existsSync(path.join(PLAYWRIGHT_REPORT_DIR, "index.html"))) {
    return false;
  }

  const port = await resolvePlaywrightReportPort();
  const playwrightBin = path.join(
    process.cwd(),
    "node_modules",
    ".bin",
    process.platform === "win32" ? "playwright.cmd" : "playwright",
  );
  const command = fs.existsSync(playwrightBin) ? playwrightBin : "npx";
  const args = fs.existsSync(playwrightBin)
    ? [
        "show-report",
        PLAYWRIGHT_REPORT_DIR,
        "--host",
        "127.0.0.1",
        "--port",
        String(port),
      ]
    : [
        "playwright",
        "show-report",
        PLAYWRIGHT_REPORT_DIR,
        "--host",
        "127.0.0.1",
        "--port",
        String(port),
      ];

  const logDir = path.join(process.cwd(), "logs");
  fs.mkdirSync(logDir, { recursive: true });
  const logFile = path.join(logDir, "playwright-report.log");
  const logFd = fs.openSync(logFile, "a");

  const child = spawn(command, args, {
    detached: true,
    stdio: ["ignore", logFd, logFd],
    shell: process.platform === "win32",
    cwd: process.cwd(),
    env: process.env,
  });
  fs.closeSync(logFd);

  if (!child.pid) {
    Logger.logWarning("Failed to start Playwright HTML report server");
    return false;
  }

  fs.writeFileSync(PLAYWRIGHT_SERVER_PID_FILE, String(child.pid), "utf-8");
  child.unref();

  const ready = await waitForPortOpen(port);
  if (!ready) {
    Logger.logWarning(
      `Playwright report server did not become ready on port ${port}`,
    );
  }

  const reportUrl = `http://127.0.0.1:${port}`;
  Logger.logInfo(`Playwright HTML report: ${reportUrl}`);
  Logger.logSuccess(
    `Playwright show-report started (PID ${child.pid}) → ${reportUrl}`,
  );
  return true;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function removePathIfExists(targetPath: string, label: string): void {
  if (!fs.existsSync(targetPath)) {
    return;
  }

  fs.rmSync(targetPath, { recursive: true, force: true });
  Logger.logInfo(`Removed ${label}: ${targetPath}`);
}

function directoryHasContent(dirPath: string): boolean {
  if (!fs.existsSync(dirPath)) {
    return false;
  }

  try {
    return fs.readdirSync(dirPath).length > 0;
  } catch {
    return false;
  }
}

export function buildReportTimestamp(date = new Date()): string {
  const pad = (value: number): string => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}_${pad(date.getHours())}-${pad(date.getMinutes())}-${pad(date.getSeconds())}`;
}

function ensureHistoryDir(): void {
  fs.mkdirSync(HISTORY_DIR, { recursive: true });
}

function ensurePhaseRawDirs(): void {
  for (const phase of REPORT_PHASES) {
    fs.mkdirSync(rawBlobPhaseDir(phase), { recursive: true });
    fs.mkdirSync(rawAllurePhaseDir(phase), { recursive: true });
    fs.mkdirSync(rawOrtoniPhaseDir(phase), { recursive: true });
  }
}

function refreshLatestPointer(pointerPath: string, targetDir: string): void {
  removePathIfExists(pointerPath, "latest report pointer");

  try {
    fs.symlinkSync(targetDir, pointerPath, "junction");
  } catch {
    fs.cpSync(targetDir, pointerPath, { recursive: true });
  }
}

export function normalizeLegacyHistoryFolders(): void {
  if (!fs.existsSync(HISTORY_DIR)) {
    return;
  }

  for (const entry of fs.readdirSync(HISTORY_DIR, { withFileTypes: true })) {
    if (!entry.isDirectory()) {
      continue;
    }
    const isLegacy = LEGACY_HISTORY_PREFIXES.some((prefix) =>
      entry.name.startsWith(prefix),
    );
    if (isLegacy) {
      removePathIfExists(
        path.join(HISTORY_DIR, entry.name),
        `legacy history folder ${entry.name}`,
      );
    }
  }
}

export function pruneReportHistory(keep = HISTORY_RETENTION): void {
  if (!fs.existsSync(HISTORY_DIR)) {
    return;
  }

  const runIdPattern = /^\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}$/;
  const runs = fs
    .readdirSync(HISTORY_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && runIdPattern.test(entry.name))
    .map((entry) => {
      const full = path.join(HISTORY_DIR, entry.name);
      return { name: entry.name, mtime: fs.statSync(full).mtimeMs, full };
    })
    .sort((a, b) => b.mtime - a.mtime);

  for (const stale of runs.slice(keep)) {
    removePathIfExists(stale.full, `stale history run ${stale.name}`);
  }
}

export function prepareMultiPhaseRun(): void {
  Logger.logInfo(
    "Preparing multi-phase report directories (clean once before first phase)...",
  );

  normalizeLegacyHistoryFolders();

  removePathIfExists(RAW_DIR, "raw multi-phase results");
  removePathIfExists(BLOB_MERGE_INPUT_DIR, "blob merge staging");
  removePathIfExists(ALLURE_RESULTS_DIR, "Allure consolidated results");
  removePathIfExists(ALLURE_REPORT_DIR, "Allure report");
  removePathIfExists(ORTONI_REPORT_DIR, "Ortoni report");
  removePathIfExists(PLAYWRIGHT_REPORT_DIR, "Playwright HTML report");
  removePathIfExists(ARTIFACTS_DIR, "Playwright artifacts");
  removePathIfExists(LATEST_ALLURE_LINK, "Allure latest pointer");
  removePathIfExists(LATEST_ORTONI_LINK, "Ortoni latest pointer");
  removePathIfExists(
    path.join(TEST_RESULTS_DIR, "blob-report"),
    "legacy blob-report",
  );

  ensurePhaseRawDirs();
  fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });
  ensureHistoryDir();

  Logger.logSuccess("Multi-phase report directories ready");
}

export function prepareReportsForNewRun(): void {
  if (isMultiPhaseRun()) {
    Logger.logInfo(
      "Multi-phase run: preserving raw/phase outputs (cleanup owned by all-test-run.sh)",
    );
    ensurePhaseRawDirs();
    fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });
    ensureHistoryDir();
    return;
  }

  Logger.logInfo(
    "Preparing report directories for a new standalone test run...",
  );

  removePathIfExists(ALLURE_RESULTS_DIR, "Allure results directory");
  removePathIfExists(ALLURE_REPORT_DIR, "Allure report directory");
  removePathIfExists(ORTONI_REPORT_DIR, "Ortoni report directory");
  removePathIfExists(PLAYWRIGHT_REPORT_DIR, "Playwright HTML report");
  removePathIfExists(BLOB_MERGE_INPUT_DIR, "blob merge staging");
  removePathIfExists(ARTIFACTS_DIR, "Playwright artifacts directory");
  removePathIfExists(LATEST_ALLURE_LINK, "Allure latest pointer");
  removePathIfExists(LATEST_ORTONI_LINK, "Ortoni latest pointer");
  removePathIfExists(
    path.join(TEST_RESULTS_DIR, "blob-report"),
    "legacy blob-report",
  );

  fs.mkdirSync(ALLURE_RESULTS_DIR, { recursive: true });
  fs.mkdirSync(ALLURE_REPORT_DIR, { recursive: true });
  fs.mkdirSync(ORTONI_REPORT_DIR, { recursive: true });
  fs.mkdirSync(PLAYWRIGHT_REPORT_DIR, { recursive: true });
  fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });
  ensureHistoryDir();

  Logger.logSuccess("Report directories ready for the new run");
}

export function cleanOrtoniResults(): void {
  try {
    Logger.logInfo("Cleaning Ortoni report results...");
    removePathIfExists(ORTONI_REPORT_DIR, "Ortoni report directory");
    removePathIfExists(LATEST_ORTONI_LINK, "Ortoni latest pointer");
    fs.mkdirSync(ORTONI_REPORT_DIR, { recursive: true });
    Logger.logSuccess("Ortoni results cleaned successfully");
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    Logger.logWarning(`Failed to clean Ortoni results: ${errorMessage}`);
  }
}

export function cleanAllureResults(): void {
  try {
    Logger.logInfo("Cleaning Allure results...");
    removePathIfExists(ALLURE_RESULTS_DIR, "Allure results directory");
    removePathIfExists(ALLURE_REPORT_DIR, "Allure report directory");
    removePathIfExists(LATEST_ALLURE_LINK, "Allure latest pointer");
    Logger.logSuccess("Allure results cleaned successfully");
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    Logger.logWarning(`Failed to clean Allure results: ${errorMessage}`);
  }
}

export function cleanPlaywrightReportResults(): void {
  try {
    Logger.logInfo("Cleaning Playwright HTML report and artifacts...");
    removePathIfExists(PLAYWRIGHT_REPORT_DIR, "Playwright HTML report");
    removePathIfExists(ARTIFACTS_DIR, "Playwright artifacts directory");
    Logger.logSuccess("Playwright report artifacts cleaned successfully");
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    Logger.logWarning(
      `Failed to clean Playwright report artifacts: ${errorMessage}`,
    );
  }
}

export function cleanReportHistory(): void {
  try {
    Logger.logInfo("Cleaning archived report history...");
    removePathIfExists(HISTORY_DIR, "Report history directory");
    Logger.logSuccess("Report history cleaned successfully");
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    Logger.logWarning(`Failed to clean report history: ${errorMessage}`);
  }
}

export function cleanAllReports(): void {
  Logger.logInfo("Cleaning latest test reports and artifacts...");
  cleanAllureResults();
  cleanOrtoniResults();
  cleanPlaywrightReportResults();
  removePathIfExists(RAW_DIR, "raw multi-phase results");
  removePathIfExists(BLOB_MERGE_INPUT_DIR, "blob merge staging");
  removePathIfExists(
    path.join(TEST_RESULTS_DIR, "blob-report"),
    "legacy blob-report",
  );
  Logger.logSuccess("Latest reports and artifacts cleaned");
}

export function archiveRunReports(runId?: string): string | null {
  const id = runId ?? process.env.RUN_ID ?? buildReportTimestamp();
  ensureHistoryDir();

  const destRoot = historyRunDir(id);
  const copies: [string, string][] = [
    [PLAYWRIGHT_REPORT_DIR, "playwright-report"],
    [ALLURE_REPORT_DIR, "allure-report"],
    [ORTONI_REPORT_DIR, "ortoni-report"],
  ];

  let archivedAny = false;
  fs.mkdirSync(destRoot, { recursive: true });

  for (const [source, name] of copies) {
    if (!directoryHasContent(source)) {
      Logger.logWarning(`Skip archive: ${source} is empty or missing`);
      continue;
    }
    const dest = path.join(destRoot, name);
    if (fs.existsSync(dest)) {
      fs.rmSync(dest, { recursive: true, force: true });
    }
    fs.cpSync(source, dest, { recursive: true });
    Logger.logInfo(`Archived ${name} → ${dest}`);
    archivedAny = true;
  }

  if (!archivedAny) {
    removePathIfExists(destRoot, "empty history run folder");
    return null;
  }

  if (directoryHasContent(ALLURE_REPORT_DIR)) {
    refreshLatestPointer(LATEST_ALLURE_LINK, ALLURE_REPORT_DIR);
  }
  if (directoryHasContent(ORTONI_REPORT_DIR)) {
    refreshLatestPointer(LATEST_ORTONI_LINK, ORTONI_REPORT_DIR);
  }

  pruneReportHistory();
  return destRoot;
}

export function archiveLatestReportsToHistory(): void {
  archiveRunReports();
}

export async function generateAllureReport(): Promise<boolean> {
  try {
    Logger.logInfo("Generating Allure report...");

    if (!fs.existsSync(ALLURE_RESULTS_DIR)) {
      Logger.logWarning(
        "Allure results directory does not exist. Skipping Allure report generation.",
      );
      return false;
    }

    let files = fs.readdirSync(ALLURE_RESULTS_DIR);
    if (files.length === 0) {
      Logger.logWarning(
        "Allure results directory is empty. Skipping Allure report generation.",
      );
      return false;
    }

    Logger.logInfo("Waiting for all test results to be written...");
    await delay(500);

    files = fs.readdirSync(ALLURE_RESULTS_DIR);
    if (files.length === 0) {
      Logger.logWarning(
        "Allure results directory is empty after wait. Skipping Allure report generation.",
      );
      return false;
    }

    try {
      execSync(
        `npx allure generate "${ALLURE_RESULTS_DIR}" --clean -o "${ALLURE_REPORT_DIR}"`,
        {
          stdio: "inherit",
        },
      );
      Logger.logSuccess(
        `Allure report generated successfully at: ${ALLURE_REPORT_DIR}`,
      );
      return true;
    } catch (_error) {
      Logger.logWarning(
        "Failed to generate Allure report. Make sure allure-commandline is installed.",
      );
      return false;
    }
  } catch (error) {
    Logger.handleError(error, "Error generating Allure report");
    return false;
  }
}

export function openAllureReport(): void {
  try {
    const generatedReportPath = path.join(ALLURE_REPORT_DIR, "index.html");

    if (!fs.existsSync(generatedReportPath)) {
      Logger.logInfo("Generated report not found, generating it first...");
      try {
        execSync(
          `npx allure generate "${ALLURE_RESULTS_DIR}" --clean -o "${ALLURE_REPORT_DIR}"`,
          { stdio: "inherit" },
        );
      } catch (_error) {
        Logger.logWarning("Failed to generate Allure report before opening.");
        return;
      }
    }

    Logger.logInfo("Opening Allure report over HTTP (allure open)...");
    if (serveAllureReportInBrowser(ALLURE_REPORT_DIR)) {
      Logger.logSuccess("Allure report server started!");
    } else {
      Logger.logWarning("Failed to start Allure report server.");
    }
  } catch (error) {
    Logger.handleError(error, "Error opening Allure report");
  }
}

async function waitForFile(
  filePath: string,
  maxWaitMs: number,
  intervalMs = 500,
): Promise<boolean> {
  let elapsed = 0;
  while (elapsed < maxWaitMs) {
    if (fs.existsSync(filePath)) {
      return true;
    }
    await delay(intervalMs);
    elapsed += intervalMs;
  }
  return fs.existsSync(filePath);
}

const DEFAULT_ORTONI_REPORT_PORT = 2004;
const ORTONI_SERVER_PID_FILE = path.join(
  process.cwd(),
  "logs",
  "ortoni-report-server.pid",
);

function stopStaleOrtoniReportServer(): void {
  if (fs.existsSync(ORTONI_SERVER_PID_FILE)) {
    const raw = fs.readFileSync(ORTONI_SERVER_PID_FILE, "utf-8").trim();
    const pid = Number(raw);
    if (Number.isInteger(pid) && pid > 0 && pid !== process.pid) {
      Logger.logInfo(`Stopping previous Ortoni report server (PID ${pid})`);
      stopProcessTree(pid);
    }
    try {
      fs.unlinkSync(ORTONI_SERVER_PID_FILE);
    } catch {
      /* ignore */
    }
  }

  try {
    const output = execSync(`lsof -ti :${DEFAULT_ORTONI_REPORT_PORT}`, {
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    if (!output) {
      return;
    }
    for (const line of output.split(/\s+/)) {
      const pid = Number(line.trim());
      if (Number.isInteger(pid) && pid > 0 && pid !== process.pid) {
        Logger.logInfo(
          `Freeing Ortoni port ${DEFAULT_ORTONI_REPORT_PORT} (PID ${pid})`,
        );
        stopProcessTree(pid);
      }
    }
  } catch {
    /* ignore */
  }
}

export async function openOrtoniReport(): Promise<void> {
  if (isCiEnvironment()) {
    Logger.logInfo("CI/CD detected; skipping Ortoni report open");
    return;
  }

  const found = await waitForFile(ORTONI_REPORT_PATH, 15_000);
  if (!found) {
    Logger.logWarning(
      `Ortoni report not found at: ${ORTONI_REPORT_PATH} after waiting`,
    );
    return;
  }

  try {
    if (fs.existsSync(ORTONI_DB_PATH)) {
      const stats = fs.statSync(ORTONI_DB_PATH);
      fs.utimesSync(ORTONI_DB_PATH, stats.atime, new Date());
    }
  } catch {
    /* ignore */
  }

  stopStaleOrtoniReportServer();
  await delay(300);

  const logDir = path.join(process.cwd(), "logs");
  fs.mkdirSync(logDir, { recursive: true });
  const logFile = path.join(logDir, "ortoni-report-server.log");
  const logFd = fs.openSync(logFile, "a");

  Logger.logInfo(
    `Opening Ortoni report once (with meta) via HTTP on port ${DEFAULT_ORTONI_REPORT_PORT}...`,
  );

  const child = spawn(
    "npx",
    [
      "ortoni-report",
      "show-report",
      "-d",
      ORTONI_REPORT_DIR,
      "-f",
      "ortoni-report.html",
      "-p",
      String(DEFAULT_ORTONI_REPORT_PORT),
    ],
    {
      detached: true,
      stdio: ["ignore", logFd, logFd],
      cwd: process.cwd(),
      env: process.env,
      shell: process.platform === "win32",
    },
  );
  fs.closeSync(logFd);

  if (child.pid) {
    fs.writeFileSync(ORTONI_SERVER_PID_FILE, String(child.pid), "utf-8");
  }
  child.unref();

  Logger.logSuccess(
    `Ortoni report server started (meta: API & E2E / all-tests): http://127.0.0.1:${DEFAULT_ORTONI_REPORT_PORT}`,
  );
}

export async function openLocalReportsAfterRun(): Promise<void> {
  if (isCiEnvironment()) {
    Logger.logInfo("CI/CD detected; skipping browser open for reports");
    return;
  }

  if (process.env.OPEN_REPORTS === "false") {
    Logger.logInfo("OPEN_REPORTS=false; skipping browser open for reports");
    return;
  }

  Logger.logInfo(
    "Opening latest Allure, Ortoni, and Playwright HTML reports...",
  );

  if (serveAllureReportInBrowser(ALLURE_REPORT_DIR)) {
    Logger.logSuccess(
      `Serving Allure report via HTTP from ${ALLURE_REPORT_DIR}`,
    );
  } else {
    Logger.logWarning("Allure report HTML not found; skipping Allure open");
  }

  const ortoniReady = await waitForFile(ORTONI_REPORT_PATH, 10_000);
  if (ortoniReady) {
    await openOrtoniReport();
  } else {
    Logger.logWarning("Ortoni report HTML not found; skipping Ortoni open");
  }

  const playwrightIndex = path.join(PLAYWRIGHT_REPORT_DIR, "index.html");
  const playwrightReady = await waitForFile(playwrightIndex, 10_000);
  if (playwrightReady) {
    const served = await servePlaywrightReportInBrowser();
    if (served) {
      Logger.logSuccess(
        `Serving Playwright HTML report from ${PLAYWRIGHT_REPORT_DIR}`,
      );
    }
  } else {
    Logger.logWarning(
      "Playwright HTML report not found; skipping Playwright open",
    );
  }
}

function collectBlobZipsIntoMergeInput(): number {
  removePathIfExists(BLOB_MERGE_INPUT_DIR, "blob merge staging");
  fs.mkdirSync(BLOB_MERGE_INPUT_DIR, { recursive: true });

  let count = 0;
  for (const phase of REPORT_PHASES) {
    const phaseDir = rawBlobPhaseDir(phase);
    if (!fs.existsSync(phaseDir)) {
      continue;
    }
    for (const entry of fs.readdirSync(phaseDir)) {
      if (!entry.endsWith(".zip")) {
        continue;
      }
      const source = path.join(phaseDir, entry);
      const destName = `${phase}-${entry}`;
      fs.copyFileSync(source, path.join(BLOB_MERGE_INPUT_DIR, destName));
      count += 1;
      Logger.logInfo(`Staged blob ${destName} for merge`);
    }
  }

  if (fs.existsSync(RAW_BLOB_DIR)) {
    for (const entry of fs.readdirSync(RAW_BLOB_DIR, { withFileTypes: true })) {
      if (entry.isFile() && entry.name.endsWith(".zip")) {
        fs.copyFileSync(
          path.join(RAW_BLOB_DIR, entry.name),
          path.join(BLOB_MERGE_INPUT_DIR, entry.name),
        );
        count += 1;
      }
    }
  }

  return count;
}

export function consolidateAllureResults(
  phases: readonly ReportPhase[] = REPORT_PHASES,
): boolean {
  removePathIfExists(ALLURE_RESULTS_DIR, "Allure consolidated results");
  fs.mkdirSync(ALLURE_RESULTS_DIR, { recursive: true });

  let copied = 0;
  const seen = new Set<string>();

  const copyUnique = (sourcePath: string, destName: string): void => {
    let finalName = destName;
    if (
      seen.has(finalName) ||
      fs.existsSync(path.join(ALLURE_RESULTS_DIR, finalName))
    ) {
      const ext = path.extname(destName);
      const base = destName.slice(0, destName.length - ext.length);
      let n = 1;
      do {
        finalName = `${base}__dup${n}${ext}`;
        n += 1;
      } while (
        seen.has(finalName) ||
        fs.existsSync(path.join(ALLURE_RESULTS_DIR, finalName))
      );
      Logger.logWarning(
        `Allure file name collision for ${destName}; wrote as ${finalName}`,
      );
    }
    seen.add(finalName);
    const destPath = path.join(ALLURE_RESULTS_DIR, finalName);
    fs.mkdirSync(path.dirname(destPath), { recursive: true });
    fs.copyFileSync(sourcePath, destPath);
    copied += 1;
  };

  const singletonFiles = new Set(["categories.json", "executor.json"]);
  const singletonKept = new Set<string>();

  for (const phase of phases) {
    const phaseDir = rawAllurePhaseDir(phase);
    if (!fs.existsSync(phaseDir)) {
      Logger.logWarning(`No Allure raw results for phase ${phase}`);
      continue;
    }

    const walk = (dir: string, relative = ""): void => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        const rel = relative ? path.join(relative, entry.name) : entry.name;
        if (entry.isDirectory()) {
          const destSub = path.join(ALLURE_RESULTS_DIR, rel);
          fs.mkdirSync(destSub, { recursive: true });
          walk(full, rel);
          continue;
        }

        if (entry.name === "environment.properties") {
          continue;
        }

        if (singletonFiles.has(entry.name)) {
          if (singletonKept.has(entry.name)) {
            Logger.logInfo(
              `Keeping first ${entry.name}; skipping duplicate from ${phase}`,
            );
            continue;
          }
          singletonKept.add(entry.name);
          copyUnique(full, rel);
          continue;
        }

        copyUnique(full, rel);
      }
    };

    walk(phaseDir);
    Logger.logInfo(`Consolidated Allure results from phase ${phase}`);
  }

  if (fs.existsSync(RAW_ALLURE_DIR)) {
    for (const entry of fs.readdirSync(RAW_ALLURE_DIR, {
      withFileTypes: true,
    })) {
      if (!entry.isDirectory()) {
        continue;
      }
      if ((REPORT_PHASES as readonly string[]).includes(entry.name)) {
        continue;
      }
    }
  }

  if (copied === 0) {
    Logger.logWarning("No Allure result files found to consolidate");
    return false;
  }

  const environmentPath = path.join(
    ALLURE_RESULTS_DIR,
    "environment.properties",
  );
  fs.writeFileSync(
    environmentPath,
    buildMergedAllureEnvironmentProperties(),
    "utf-8",
  );
  Logger.logInfo(
    "Wrote merged Allure environment (test_type=API & E2E, report_phase=all-tests)",
  );

  Logger.logSuccess(
    `Consolidated ${copied} Allure file(s) into ${ALLURE_RESULTS_DIR}`,
  );
  return true;
}

export function mergeOrtoniFromShardsIfPresent(): boolean {
  const staging = path.join(TEST_RESULTS_DIR, "ortoni-shard-merge");
  removePathIfExists(staging, "Ortoni shard staging");
  fs.mkdirSync(staging, { recursive: true });

  let shardCount = 0;
  for (const phase of REPORT_PHASES) {
    const phaseDir = rawOrtoniPhaseDir(phase);
    if (!fs.existsSync(phaseDir)) {
      continue;
    }
    for (const entry of fs.readdirSync(phaseDir)) {
      if (!entry.startsWith("ortoni-shard-") || !entry.endsWith(".json")) {
        continue;
      }
      fs.copyFileSync(path.join(phaseDir, entry), path.join(staging, entry));
      shardCount += 1;
    }
  }

  if (shardCount === 0) {
    removePathIfExists(staging, "Ortoni shard staging");
    Logger.logInfo(
      "No Ortioni shard JSON files found; Ortoni will come from Playwright blob merge",
    );
    return false;
  }

  try {
    Logger.logInfo(
      `Merging ${shardCount} Ortoni shard file(s) via ortoni-report merge-report...`,
    );
    fs.mkdirSync(ORTONI_REPORT_DIR, { recursive: true });
    execSync(
      `npx ortoni-report merge-report -d "${staging}" -f ortoni-report.html`,
      {
        stdio: "inherit",
        cwd: process.cwd(),
      },
    );
    const generated = path.join(staging, "ortoni-report.html");
    if (fs.existsSync(generated)) {
      fs.copyFileSync(
        generated,
        path.join(ORTONI_REPORT_DIR, "ortoni-report.html"),
      );
    }
    Logger.logSuccess("Ortoni shard merge completed");
    return true;
  } catch (error) {
    Logger.handleError(error, "Ortoni merge-report failed");
    return false;
  }
}

export function mergePlaywrightAndOrtoniFromBlobs(): boolean {
  const blobCount = collectBlobZipsIntoMergeInput();
  if (blobCount === 0) {
    Logger.logWarning("No Playwright blob ZIP files found; skip blob merge");
    return false;
  }

  try {
    Logger.logInfo(
      `Merging ${blobCount} blob report(s) into Playwright HTML + Ortoni...`,
    );
    removePathIfExists(PLAYWRIGHT_REPORT_DIR, "Playwright HTML report");
    removePathIfExists(ORTONI_REPORT_DIR, "Ortoni report directory");
    fs.mkdirSync(PLAYWRIGHT_REPORT_DIR, { recursive: true });
    fs.mkdirSync(ORTONI_REPORT_DIR, { recursive: true });

    execSync(
      `npx playwright merge-reports --config src/config/defaultConfig/merge-reports.config.ts "${BLOB_MERGE_INPUT_DIR}"`,
      {
        stdio: "inherit",
        cwd: process.cwd(),
        env: process.env,
      },
    );
    Logger.logSuccess("Playwright blob merge completed (HTML + Ortoni)");
    return true;
  } catch (error) {
    Logger.handleError(error, "Failed to merge Playwright blob reports");
    return false;
  }
}

export async function mergeAllReports(): Promise<MergeReportsResult> {
  const result: MergeReportsResult = {
    playwright: false,
    allure: false,
    ortoni: false,
  };

  result.playwright = mergePlaywrightAndOrtoniFromBlobs();
  result.ortoni =
    fs.existsSync(ORTONI_REPORT_PATH) || directoryHasContent(ORTONI_REPORT_DIR);
  if (!result.ortoni) {
    result.ortoni = mergeOrtoniFromShardsIfPresent();
  }

  const consolidated = consolidateAllureResults();
  if (consolidated) {
    result.allure = await generateAllureReport();
  }

  return result;
}

export function mergeBlobReports(): boolean {
  return mergePlaywrightAndOrtoniFromBlobs();
}

export async function openPlaywrightHtmlReport(): Promise<void> {
  const served = await servePlaywrightReportInBrowser();
  if (!served) {
    Logger.logWarning(
      `Playwright HTML report not found at ${PLAYWRIGHT_REPORT_DIR}`,
    );
  }
}

if (require.main === module) {
  const action = process.argv[2];

  void (async () => {
    if (action === "ortoni") {
      cleanOrtoniResults();
    } else if (action === "allure") {
      cleanAllureResults();
    } else if (action === "playwright") {
      cleanPlaywrightReportResults();
    } else if (action === "history") {
      cleanReportHistory();
    } else if (action === "prepare") {
      prepareReportsForNewRun();
    } else if (action === "prepare-multi") {
      prepareMultiPhaseRun();
    } else if (action === "merge" || action === "merge-all") {
      const status = await mergeAllReports();
      const ok = status.playwright && status.allure;
      if (!ok) {
        Logger.logWarning(
          `Merge incomplete (playwright=${status.playwright}, allure=${status.allure}, ortoni=${status.ortoni})`,
        );
      } else if (!status.ortoni) {
        Logger.logWarning(
          "Playwright + Allure merged; Ortoni report was not produced",
        );
      }
      process.exitCode = ok ? 0 : 1;
    } else if (action === "merge-playwright") {
      process.exitCode = mergePlaywrightAndOrtoniFromBlobs() ? 0 : 1;
    } else if (action === "merge-allure") {
      const consolidated = consolidateAllureResults();
      process.exitCode = consolidated && (await generateAllureReport()) ? 0 : 1;
    } else if (action === "merge-ortoni") {
      const shardOk = mergeOrtoniFromShardsIfPresent();
      if (shardOk) {
        process.exitCode = 0;
        return;
      }
      process.exitCode = mergePlaywrightAndOrtoniFromBlobs() ? 0 : 1;
    } else if (action === "archive") {
      const runId = process.argv[3] ?? process.env.RUN_ID;
      const dest = archiveRunReports(runId);
      process.exitCode = dest ? 0 : 1;
    } else if (action === "open") {
      await openOrtoniReport();
    } else if (action === "open-playwright") {
      await openPlaywrightHtmlReport();
    } else if (action === "open-all") {
      await openLocalReportsAfterRun();
    } else {
      cleanAllReports();
    }
  })();
}

import { execFileSync } from "child_process";
import * as fs from "fs";
import * as path from "path";

import dotenv from "dotenv";
import nodemailer from "nodemailer";

import { parseBoolean } from "@/config/environment/envConfig";
import { Logger } from "@/utils/logger";
import {
  ALLURE_REPORT_DIR,
  ORTONI_REPORT_DIR,
  PLAYWRIGHT_REPORT_DIR,
  TEST_RESULTS_DIR,
} from "@/utils/reports-helper";

const MAX_ATTACHMENT_BYTES = 20 * 1024 * 1024;
const ENV_PATH = path.resolve(process.cwd(), "src/config/environment/.env");

/** Prefer committed-secret .env over empty CI placeholder env vars. */
function loadEmailEnvFromDotenv(): void {
  if (!fs.existsSync(ENV_PATH)) {
    return;
  }
  dotenv.config({ path: ENV_PATH, override: true });
}

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(
      `Missing required env var for email reports: ${name}. Set it in src/config/environment/.env (or GitHub secret ENV_FILE).`,
    );
  }
  return value;
}

function directoryHasFiles(dir: string): boolean {
  if (!fs.existsSync(dir)) {
    return false;
  }
  return fs.readdirSync(dir).length > 0;
}

function createReportsZip(): string | null {
  const zipPath = path.join(TEST_RESULTS_DIR, "conduit-reports.zip");
  if (fs.existsSync(zipPath)) {
    fs.unlinkSync(zipPath);
  }

  const entries: string[] = [];
  if (directoryHasFiles(PLAYWRIGHT_REPORT_DIR)) {
    entries.push("playwright-report");
  }
  if (directoryHasFiles(ALLURE_REPORT_DIR)) {
    entries.push("allure-report");
  }
  if (directoryHasFiles(ORTONI_REPORT_DIR)) {
    entries.push("ortoni-report");
  }

  if (entries.length === 0) {
    Logger.logWarning("No report directories found to zip for email");
    return null;
  }

  fs.mkdirSync(TEST_RESULTS_DIR, { recursive: true });
  execFileSync("zip", ["-r", "-q", zipPath, ...entries], {
    cwd: TEST_RESULTS_DIR,
    stdio: "inherit",
  });

  const size = fs.statSync(zipPath).size;
  if (size > MAX_ATTACHMENT_BYTES) {
    Logger.logWarning(
      `Report zip is ${(size / (1024 * 1024)).toFixed(1)}MB (limit ${MAX_ATTACHMENT_BYTES / (1024 * 1024)}MB); sending summary email without attachment`,
    );
    fs.unlinkSync(zipPath);
    return null;
  }

  return zipPath;
}

function buildWorkflowUrl(): string | undefined {
  const server = process.env.GITHUB_SERVER_URL;
  const repo = process.env.GITHUB_REPOSITORY;
  const runId = process.env.GITHUB_RUN_ID;
  if (server && repo && runId) {
    return `${server}/${repo}/actions/runs/${runId}`;
  }
  return undefined;
}

function buildHtmlBody(options: {
  to: string;
  zipAttached: boolean;
  workflowUrl?: string;
}): string {
  const runId =
    process.env.RUN_ID ?? process.env.GITHUB_RUN_ID ?? new Date().toISOString();
  const branch =
    process.env.GITHUB_REF_NAME ?? process.env.GITHUB_HEAD_REF ?? "local";
  const sha = process.env.GITHUB_SHA?.slice(0, 7) ?? "n/a";
  const status =
    process.env.EMAIL_REPORT_STATUS?.trim() ??
    (process.env.CI === "true" ? "see CI job results" : "local run");

  const workflowLine = options.workflowUrl
    ? `<p><strong>CI run:</strong> <a href="${options.workflowUrl}">${options.workflowUrl}</a></p>`
    : "";

  const attachmentLine = options.zipAttached
    ? "<p>Attached: <code>conduit-reports.zip</code> (Playwright HTML / Allure / Ortoni).</p>"
    : "<p>Report zip was omitted (missing or too large). Download artifacts from the CI run page or open local <code>test-results/</code>.</p>";

  return `<!DOCTYPE html>
<html>
  <body style="font-family: -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; line-height: 1.5;">
    <h2>Conduit Playwright report</h2>
    <p>Automated test reports for <strong>${branch}</strong> (<code>${sha}</code>).</p>
    <ul>
      <li><strong>Run ID:</strong> ${runId}</li>
      <li><strong>Status:</strong> ${status}</li>
      <li><strong>Recipient:</strong> ${options.to}</li>
    </ul>
    ${workflowLine}
    ${attachmentLine}
    <p style="color:#666;font-size:12px;">Sent because <code>SEND_EMAIL_TO_USER=true</code>.</p>
  </body>
</html>`;
}

export async function sendReportsEmailIfEnabled(): Promise<boolean> {
  loadEmailEnvFromDotenv();

  const enabled = parseBoolean(process.env.SEND_EMAIL_TO_USER, false);
  if (!enabled) {
    Logger.logInfo("SEND_EMAIL_TO_USER is not true; skipping report email");
    return false;
  }

  const to = requiredEnv("SEND_EMAIL_TO_USER_EMAIL");
  const host = requiredEnv("SMTP_HOST");
  const port = Number(requiredEnv("SMTP_PORT"));
  const user = requiredEnv("SMTP_USER");
  const pass = requiredEnv("SMTP_PASS");
  const from = process.env.SMTP_FROM?.trim() ?? user;

  if (!Number.isFinite(port) || port <= 0) {
    throw new Error(`Invalid SMTP_PORT: ${process.env.SMTP_PORT}`);
  }

  const zipPath = createReportsZip();
  const workflowUrl = buildWorkflowUrl();
  const subject = `[Conduit Playwright] Reports — ${
    process.env.GITHUB_REF_NAME ?? process.env.RUN_ID ?? "local"
  }`;

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });

  await transporter.sendMail({
    from,
    to,
    subject,
    text: [
      "Conduit Playwright report",
      `To: ${to}`,
      workflowUrl ? `CI: ${workflowUrl}` : undefined,
      zipPath ? "Attached: conduit-reports.zip" : "No zip attachment",
    ]
      .filter(Boolean)
      .join("\n"),
    html: buildHtmlBody({
      to,
      zipAttached: Boolean(zipPath),
      workflowUrl,
    }),
    attachments: zipPath
      ? [
          {
            filename: "conduit-reports.zip",
            path: zipPath,
          },
        ]
      : undefined,
  });

  Logger.logSuccess(`Report email sent to ${to}`);
  if (zipPath && fs.existsSync(zipPath)) {
    fs.unlinkSync(zipPath);
  }
  return true;
}

void (async () => {
  if (process.argv[1]?.includes("email-report-helper")) {
    try {
      await sendReportsEmailIfEnabled();
    } catch (error) {
      Logger.handleError(error, "Failed to send report email");
      process.exitCode = 1;
    }
  }
})();

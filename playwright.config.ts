import { defineConfig } from "@playwright/test";
import * as fs from "fs";
import browserConfig from "./src/config/browser/browserConfig";
import { timeConfig } from "./src/config/defaultConfig/testConfig";
import getEnvConfig, {
  executionConfig,
  isHeadlessEnabled,
} from "./src/config/environment/envConfig";
import { buildReportersForConfig } from "./src/utils/reports-helper";
import { StorageStateHelper } from "./src/utils/storage-state-helper";

const envConfig = getEnvConfig();
const testType = process.env.TEST_TYPE;
const isApiTest = testType === "api";

console.warn(
  `Execution mode: PARALLEL=${executionConfig.isParallel}, WORKERS=${executionConfig.workers ?? "playwright-default"}, HEADLESS=${isHeadlessEnabled}`,
);

const authFilePath = StorageStateHelper.getAuthFilePath();
const authFileExists = fs.existsSync(authFilePath);

if (authFileExists && !isApiTest) {
  console.log(`Using authentication state from: ${authFilePath}`);
} else if (!authFileExists && !isApiTest) {
  console.log(
    `Authentication state not found. Setup will create: ${authFilePath}`,
  );
}

export default defineConfig({
  testDir: "./",
  fullyParallel: executionConfig.isParallel,
  forbidOnly: !!process.env.CI,
  maxFailures: 0,
  retries: process.env.CI ? 2 : 0,
  workers: executionConfig.workers,

  timeout: timeConfig.testTimeout,

  expect: {
    timeout: timeConfig.expectTimeout,
  },

  use: {
    trace: "retain-on-failure",
    video: {
      mode: "retain-on-failure",
      size: { width: 1496, height: 1080 },
    },
    screenshot: "only-on-failure",
    navigationTimeout: timeConfig.navigationTimeout,
    baseURL: envConfig.baseURL,
  },

  outputDir: "./test-results/artifacts",

  projects: [
    {
      name: "user-setup",
      testDir: "./src/common",
      testMatch: "global-setup.ts",
      use: isApiTest
        ? {
            baseURL: envConfig.apiBaseURL,
            video: "off",
            trace: "off",
            screenshot: "off",
          }
        : {
            ...browserConfig.use,
            headless: isHeadlessEnabled,
            viewport: null,
            deviceScaleFactor: undefined,
            launchOptions: {
              args: ["--start-maximized"],
            },
            baseURL: envConfig.baseURL,
            video: "off",
            trace: "off",
            screenshot: "off",
          },
    },
    {
      name: "api",
      testDir: "./tests/api-tests",
      testMatch: "**/*.spec.ts",
      dependencies: ["user-setup"],
      use: {
        baseURL: envConfig.apiBaseURL,
        trace: "off",
        video: "off",
        screenshot: "off",
      },
    },
    {
      ...browserConfig,
      name: "e2e",
      testDir: "./tests/e2e-tests",
      testMatch: "**/*.spec.ts",
      dependencies: ["user-setup"],
      use: {
        ...browserConfig.use,
        baseURL: envConfig.baseURL,
        storageState: authFilePath,
      },
    },
  ],

  reporter: buildReportersForConfig(),

  globalTeardown: require.resolve("./src/common/global-teardown.ts"),
});

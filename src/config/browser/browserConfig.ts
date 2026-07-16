import { devices, type PlaywrightTestOptions } from "@playwright/test";

import { isHeadlessEnabled } from "@/config/environment/envConfig";

export type BrowserName =
  | "DesktopChrome"
  | "DesktopFirefox"
  | "DesktopSafari"
  | "MobileChrome"
  | "MobileSafari";

const browserName: BrowserName =
  (process.env.BROWSER as BrowserName | undefined) ?? "DesktopChrome";

const deviceMap = {
  DesktopChrome: devices["Desktop Chrome"],
  DesktopFirefox: devices["Desktop Firefox"],
  DesktopSafari: devices["Desktop Safari"],
  MobileChrome: devices["Pixel 5"],
  MobileSafari: devices["iPhone 12"],
} as const;

const testType = process.env.TEST_TYPE;
const isApiTest = testType === "api";

const baseDevice = deviceMap[browserName];

const { deviceScaleFactor: _deviceScaleFactor, ...deviceWithoutScaleFactor } =
  baseDevice;

type BrowserUseOptions = Partial<PlaywrightTestOptions> & {
  channel?: "chrome" | "msedge" | "chrome-beta" | "msedge-beta" | "msedge-dev";
  headless?: boolean;
  launchOptions?: { args?: string[] };
};

const browserConfig: {
  name: BrowserName;
  use: BrowserUseOptions;
} = {
  name: browserName,
  use: {
    ...deviceWithoutScaleFactor,
    ...(browserName === "DesktopChrome" && !isHeadlessEnabled
      ? { channel: "chrome" as const }
      : {}),
    headless: isApiTest ? true : isHeadlessEnabled,
    viewport: null,
    launchOptions: isApiTest
      ? {}
      : {
          args: ["--start-maximized"],
        },
  },
};

export default browserConfig;

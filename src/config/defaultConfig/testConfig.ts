export const timeConfig = {
  navigationTimeout: 60 * 1000,
  expectTimeout: 60 * 1000,
  elementStateTimeout: 60 * 1000,
  defaultWaitTimeout: 60 * 1000,
  testTimeout: 180 * 60 * 1000,
};

export const testUrl = "/";

export const runtimeDefaults = {
  dynamicUser: true,
  headless: false,
  parallel: true,
  parallelWorkers: 8,
} as const;

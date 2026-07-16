import path from "path";

import dotenv from "dotenv";

import { runtimeDefaults } from "@/config/defaultConfig/testConfig";

dotenv.config({ path: path.resolve(__dirname, "./.env") });

export interface EnvConfig {
  baseURL: string;
  apiBaseURL: string;
  email: string;
  username: string;
  password: string;
}

export interface ExecutionConfig {
  isParallel: boolean;
  workers?: number;
}

export function parseBoolean(
  value: string | undefined,
  defaultValue: boolean,
): boolean {
  if (value === undefined || value.trim() === "") {
    return defaultValue;
  }

  const normalizedValue = value.trim().toLowerCase();

  if (normalizedValue === "true") {
    return true;
  }

  if (normalizedValue === "false") {
    return false;
  }

  throw new Error(
    `Invalid Boolean value "${value}". Expected "true" or "false".`,
  );
}

export function parseWorkers(value: string | undefined): number | undefined {
  if (value === undefined || value.trim() === "") {
    return undefined;
  }

  const workers = Number(value);

  if (!Number.isInteger(workers) || workers < 1) {
    throw new Error(
      `Invalid WORKERS value "${value}". Expected a positive integer.`,
    );
  }

  return workers;
}

export function resolveExecutionConfig(
  env: NodeJS.ProcessEnv = process.env,
): ExecutionConfig {
  const isParallel = parseBoolean(env.PARALLEL, runtimeDefaults.parallel);
  const configuredWorkers = parseWorkers(env.WORKERS);
  const maxWorkers = runtimeDefaults.parallelWorkers;
  const uncapped = !isParallel
    ? 1
    : (configuredWorkers ?? (env.CI ? 2 : maxWorkers));
  const workers = Math.min(uncapped, maxWorkers);

  return {
    isParallel,
    workers,
  };
}

export const executionConfig: ExecutionConfig = resolveExecutionConfig();

export const isDynamicUserEnabled: boolean = parseBoolean(
  process.env.DYNAMIC_USER,
  runtimeDefaults.dynamicUser,
);

export const isHeadlessEnabled: boolean = parseBoolean(
  process.env.HEADLESS,
  runtimeDefaults.headless,
);

const getEnvConfig = (env = process.env.ENVIRONMENT ?? "DEV"): EnvConfig => {
  const environments: Record<string, EnvConfig> = {
    DEV: {
      baseURL: process.env.DEV_BASEURL ?? "",
      apiBaseURL: process.env.DEV_API_BASE_URL ?? "",
      email: process.env.DEV_EMAIL ?? "",
      username: process.env.DEV_USERNAME ?? "",
      password: process.env.DEV_PASSWORD ?? "",
    },
    QA: {
      baseURL: process.env.QA_BASEURL ?? "",
      apiBaseURL: process.env.QA_API_BASE_URL ?? "",
      email: process.env.QA_EMAIL ?? "",
      username: process.env.QA_USERNAME ?? "",
      password: process.env.QA_PASSWORD ?? "",
    },
    UAT: {
      baseURL: process.env.UAT_BASEURL ?? "",
      apiBaseURL: process.env.UAT_API_BASE_URL ?? "",
      email: process.env.UAT_EMAIL ?? "",
      username: process.env.UAT_USERNAME ?? "",
      password: process.env.UAT_PASSWORD ?? "",
    },
  };

  const key = env.toUpperCase();
  const config = environments[key];

  if (!config) {
    throw new Error(
      `Invalid environment value: ${env}. Expected one of ${Object.keys(environments).join(", ")}.`,
    );
  }

  if (!config.baseURL || !config.apiBaseURL) {
    throw new Error(
      `Missing required base URL variables for ${key} environment`,
    );
  }

  if (
    !isDynamicUserEnabled &&
    (!config.email || !config.username || !config.password)
  ) {
    throw new Error(
      `Missing fixed-user credentials for ${key}. Set DYNAMIC_USER=true or provide EMAIL/USERNAME/PASSWORD.`,
    );
  }

  console.warn(
    `Using environment: ${key} (DYNAMIC_USER=${isDynamicUserEnabled})`,
  );
  return config;
};

export default getEnvConfig;

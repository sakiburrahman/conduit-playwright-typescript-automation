import * as fs from "fs/promises";
import * as path from "path";

import { faker } from "@faker-js/faker";

import { Logger } from "@/utils/logger";

import type {
  ArticleData,
  ArticleInput,
  ArticleOverrides,
} from "@/utils/article-helper";
import type {
  CreateUserPayload,
  GenerateUserOverrides,
  GeneratedUser,
} from "@/utils/user-helper";

const CREATE_USER_JSON_PATH = path.join(
  process.cwd(),
  "test-data",
  "create-user.json",
);

const CREATED_ARTICLE_JSON_PATH = path.join(
  process.cwd(),
  "test-data",
  "created-article.json",
);

interface ArticleCreateDataFile {
  article: ArticleInput;
}

function createTimestamp(): string {
  return Date.now().toString();
}

function sanitizeUsername(value: string): string {
  return value
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, "")
    .slice(0, 20);
}

function toEmailLocalPart(fullName: string, timestamp: string): string {
  return `${fullName}${timestamp}`.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
}

export function maskEmail(email: string): string {
  const [localPart, domain] = email.split("@");
  if (!localPart || !domain) {
    return "***";
  }

  const prefix = localPart.slice(0, Math.min(2, localPart.length));
  const suffix = localPart.slice(-Math.min(2, localPart.length));
  return `${prefix}***${suffix}@${domain}`;
}

export function toCreateUserPayload(user: GeneratedUser): CreateUserPayload {
  return {
    user: {
      email: user.email,
      password: user.password,
      username: user.username,
    },
  };
}

export function buildRandomUser(
  environment: string,
  overrides: GenerateUserOverrides = {},
): GeneratedUser {
  const timestamp = createTimestamp();
  const fullName = faker.person.fullName();

  const username =
    overrides.username ?? sanitizeUsername(`${fullName}${timestamp}`);

  const email =
    overrides.email ?? `${toEmailLocalPart(fullName, timestamp)}@gmail.com`;

  const password =
    overrides.password ?? faker.internet.password({ length: 10 });

  return {
    username,
    email,
    password,
    runId: timestamp,
    environment,
    createdAt: new Date().toISOString(),
  };
}

export async function generateRandomUser(
  environment: string,
  overrides: GenerateUserOverrides = {},
): Promise<GeneratedUser> {
  const generatedUser = buildRandomUser(environment, overrides);
  await writeCreateUserFile(generatedUser);
  return generatedUser;
}

export async function writeCreateUserFile(
  user: GeneratedUser,
): Promise<CreateUserPayload> {
  const payload = toCreateUserPayload(user);
  await fs.mkdir(path.dirname(CREATE_USER_JSON_PATH), { recursive: true });
  const tempPath = `${CREATE_USER_JSON_PATH}.${process.pid}.tmp`;
  await fs.writeFile(
    tempPath,
    `${JSON.stringify(payload, null, 2)}\n`,
    "utf-8",
  );
  await fs.rename(tempPath, CREATE_USER_JSON_PATH);
  Logger.logInfo(`Wrote create-user.json for username: ${user.username}`);
  return payload;
}

export async function readCreateUserFile(): Promise<CreateUserPayload> {
  const raw = await fs.readFile(CREATE_USER_JSON_PATH, "utf-8");
  const parsed: unknown = JSON.parse(raw);

  if (
    !parsed ||
    typeof parsed !== "object" ||
    !("user" in parsed) ||
    typeof (parsed as CreateUserPayload).user !== "object"
  ) {
    throw new Error("create-user.json must contain a user object");
  }

  const { user } = parsed as CreateUserPayload;
  if (
    typeof user.email !== "string" ||
    typeof user.password !== "string" ||
    typeof user.username !== "string"
  ) {
    throw new Error(
      "create-user.json user must include email, password, and username",
    );
  }

  return { user };
}

export class GeneratedUserHelper {
  private static readonly AUTH_DIR = path.join(
    process.cwd(),
    "playwright",
    ".auth",
  );
  private static readonly USER_FILE = "generated-user.json";

  static getUserFilePath(): string {
    return path.join(this.AUTH_DIR, this.USER_FILE);
  }

  static async ensureDirectoryExists(): Promise<void> {
    await fs.mkdir(this.AUTH_DIR, { recursive: true });
  }

  static async saveUser(
    user: GeneratedUser,
    options: { persistCreateUserJson?: boolean } = {},
  ): Promise<void> {
    await this.ensureDirectoryExists();
    const filePath = this.getUserFilePath();
    const tempPath = `${filePath}.${process.pid}.tmp`;
    const payload = `${JSON.stringify(user, null, 2)}\n`;

    await fs.writeFile(tempPath, payload, "utf-8");
    await fs.rename(tempPath, filePath);

    if (options.persistCreateUserJson) {
      await writeCreateUserFile(user);
    }

    Logger.logInfo(`Generated test user loaded: ${user.username}`);
    Logger.logInfo(`Generated test user environment: ${user.environment}`);
  }

  static async readUser(): Promise<GeneratedUser> {
    const filePath = this.getUserFilePath();

    try {
      const raw = await fs.readFile(filePath, "utf-8");
      const parsed: unknown = JSON.parse(raw);
      return this.validateUser(parsed);
    } catch (error) {
      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        error.code === "ENOENT"
      ) {
        throw new Error(
          `Generated user file not found at ${filePath}. Run the user-setup project first.`,
        );
      }
      throw error instanceof Error
        ? error
        : new Error("Failed to read generated user file");
    }
  }

  static async deleteUserFile(): Promise<void> {
    try {
      await fs.unlink(this.getUserFilePath());
      Logger.logInfo("Deleted generated-user.json");
    } catch (error) {
      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        error.code === "ENOENT"
      ) {
        return;
      }
      throw error instanceof Error
        ? error
        : new Error("Failed to delete generated user file");
    }
  }

  private static validateUser(value: unknown): GeneratedUser {
    if (!value || typeof value !== "object") {
      throw new Error("generated-user.json is not a valid object");
    }

    const record = value as Record<string, unknown>;
    const requiredKeys: (keyof GeneratedUser)[] = [
      "username",
      "email",
      "password",
      "runId",
      "environment",
      "createdAt",
    ];

    for (const key of requiredKeys) {
      if (typeof record[key] !== "string" || record[key].trim() === "") {
        throw new Error(
          `generated-user.json is missing required property: ${key}`,
        );
      }
    }

    return {
      username: record.username as string,
      email: record.email as string,
      password: record.password as string,
      runId: record.runId as string,
      environment: record.environment as string,
      createdAt: record.createdAt as string,
    };
  }
}

export function generateRandomArticle(
  overrides: ArticleOverrides = {},
): ArticleData {
  const uniqueId = `${Date.now().toString(36)}-${faker.string.alphanumeric({
    length: 6,
    casing: "lower",
  })}`;

  const topicTemplates = [
    {
      topic: "Artificial Intelligence",
      description:
        "A practical overview of how AI assists everyday software testing work.",
      body: [
        "Artificial intelligence is changing how teams design, run, and maintain automated tests.",
        "Modern assistants help write assertions, review flaky failures, and suggest coverage gaps.",
        "When used carefully, AI speeds up delivery without replacing engineering judgment.",
        "This article shares simple habits for adopting AI tools in a quality-focused workflow.",
      ].join("\n"),
    },
    {
      topic: "Playwright Automation",
      description:
        "Reliable end-to-end checks with Playwright for modern web applications.",
      body: [
        "Playwright gives teams a fast, stable way to exercise real browser journeys.",
        "Strong locators, explicit waits, and isolated auth setups keep suites maintainable.",
        "Pair UI flows with API setup helpers so tests stay short and focused.",
        "Use traces and artifacts to diagnose failures quickly when a run goes red.",
      ].join("\n"),
    },
    {
      topic: "Quality Engineering",
      description:
        "Building confidence through risk-based testing and measurable quality signals.",
      body: [
        "Quality engineering looks beyond finding bugs late in the release cycle.",
        "Teams map risk early, automate high-value paths, and watch production signals.",
        "Clear ownership and feedback loops help catch regressions before customers do.",
        "The goal is sustainable confidence, not endless case volume.",
      ].join("\n"),
    },
    {
      topic: "API Testing",
      description:
        "Validating contracts, status codes, and data integrity at the service layer.",
      body: [
        "API tests catch broken contracts before the user interface ever loads.",
        "Assert status codes, response shapes, and authorization boundaries with precision.",
        "Reuse the same fixtures across UI and API paths to keep data consistent.",
        "Negative checks for missing fields and bad tokens protect critical endpoints.",
      ].join("\n"),
    },
    {
      topic: "Software Development",
      description:
        "Practical notes on shipping maintainable software with automated verification.",
      body: [
        "Good software development balances feature speed with long-term clarity.",
        "Small pull requests, shared conventions, and automated checks reduce surprise.",
        "Tests document expected behavior and guard against accidental regressions.",
        "Investing in readable code and fixtures pays off every sprint that follows.",
      ].join("\n"),
    },
  ] as const;

  const selected = faker.helpers.arrayElement([...topicTemplates]);

  const defaultArticle: ArticleInput = {
    title: `${selected.topic} ${uniqueId}`,
    description: selected.description,
    body: selected.body,
    tagList: [
      selected.topic.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      `automation-${uniqueId}`,
    ],
  };

  return {
    article: {
      ...defaultArticle,
      ...overrides,
    },
  };
}

export class CreatedArticleHelper {
  static getCreatePayloadPath(): string {
    return CREATED_ARTICLE_JSON_PATH;
  }

  static async saveCreatePayload(payload: ArticleData): Promise<void> {
    await fs.mkdir(path.dirname(this.getCreatePayloadPath()), {
      recursive: true,
    });
    const filePayload: ArticleCreateDataFile = { article: payload.article };
    await fs.writeFile(
      this.getCreatePayloadPath(),
      `${JSON.stringify(filePayload, null, 2)}\n`,
      "utf-8",
    );
  }
}

export function generateUniqueTag(prefix = "tag"): string {
  const safePrefix = prefix.replace(/[^a-zA-Z0-9]/g, "").slice(0, 12) || "tag";
  return `${safePrefix}${Date.now()}${faker.string.alphanumeric(4)}`.toLowerCase();
}

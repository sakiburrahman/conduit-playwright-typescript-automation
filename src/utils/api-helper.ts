import {
  expect,
  type APIRequestContext,
  type APIResponse,
  type Page,
} from "@playwright/test";

import apiEndpoints from "@/config/apiConfig/apiEndpointConfig.json";
import { timeConfig } from "@/config/defaultConfig/testConfig";
import getEnvConfig from "@/config/environment/envConfig";
import {
  maskEmail,
  readCreateUserFile,
  toCreateUserPayload,
  generateRandomArticle,
  GeneratedUserHelper,
} from "@/utils/data-generator";
import { Logger } from "@/utils/logger";

import type {
  Article,
  ArticleInput,
  ArticleResponse,
  CreatedArticleFixture,
} from "@/utils/article-helper";
import type {
  AuthResponse,
  ConduitUser,
  CurrentUserResponse,
  GeneratedUser,
  RegisteredUser,
  UserAuthResponse,
} from "@/utils/user-helper";

interface RequestOptions {
  formData?: Record<string, unknown>;
  data?: unknown;
  form?: Record<string, string | number>;
  headers?: Record<string, string>;
  timeout?: number;
}

interface ValidationOptions {
  responseTime?: number;
  schema?: Record<string, string>;
  fields?: Record<string, unknown>;
}

interface ApiCallResult<T = unknown> {
  status: number;
  data?: T;
  response: APIResponse;
}

export const CONDUIT_JWT_STORAGE_KEY = "jwtToken";

export async function createAuthenticatedBrowserState(options: {
  page: Page;
  token: string;
  baseUrl: string;
}): Promise<void> {
  const { page, token, baseUrl } = options;

  async function injectTokenAndReload(): Promise<void> {
    await page.goto(baseUrl, {
      waitUntil: "domcontentloaded",
      timeout: timeConfig.navigationTimeout,
    });

    await page.evaluate(
      ({ key, value }: { key: string; value: string }) => {
        localStorage.setItem(key, value);
      },
      { key: CONDUIT_JWT_STORAGE_KEY, value: token },
    );

    await page.reload({
      waitUntil: "domcontentloaded",
      timeout: timeConfig.navigationTimeout,
    });
  }

  await injectTokenAndReload();

  const homeLink = page.getByRole("link", { name: "Home", exact: true });
  try {
    await expect(homeLink).toBeVisible({ timeout: 15_000 });
  } catch {
    Logger.logWarning("Authenticated nav missing after JWT inject; retrying");
    await injectTokenAndReload();
    await expect(homeLink).toBeVisible({
      timeout: timeConfig.expectTimeout,
    });
  }

  Logger.logInfo("Injected authentication into browser localStorage");
}

export class RegistrationCollisionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RegistrationCollisionError";
  }
}

export class AuthApiHelper {
  private readonly envConfig = getEnvConfig(process.env.ENVIRONMENT ?? "DEV");
  private readonly apiHelper: ApiHelper;

  constructor(private readonly request: APIRequestContext) {
    this.apiHelper = new ApiHelper(request);
  }

  async registerUser(user: GeneratedUser): Promise<RegisteredUser> {
    Logger.logInfo(`Creating generated ${user.environment} test user`);
    Logger.logInfo(`Generated username: ${user.username}`);
    Logger.logInfo(`Generated email: ${maskEmail(user.email)}`);

    let registrationPayload = toCreateUserPayload(user);
    try {
      registrationPayload = await readCreateUserFile();
    } catch {
      Logger.logWarning(
        "create-user.json unavailable; using in-memory generated user payload",
      );
    }

    return this.registerWithPayload(registrationPayload, user);
  }

  private async registerWithPayload(
    registrationPayload: ReturnType<typeof toCreateUserPayload>,
    user: GeneratedUser,
  ): Promise<RegisteredUser> {
    const endpoint = `${this.envConfig.apiBaseURL}${apiEndpoints.auth.register}`;

    const response = await this.request.post(endpoint, {
      data: registrationPayload,
      headers: {
        "content-type": "application/json",
        accept: "application/json",
      },
      timeout: timeConfig.defaultWaitTimeout,
    });

    const status = response.status();
    const bodyText = await response.text();
    const sanitizedBody = this.sanitizeResponseBody(bodyText);

    if (status === 422 && this.isCollisionResponse(bodyText)) {
      throw new RegistrationCollisionError(
        `Registration collision for username/email (${sanitizedBody})`,
      );
    }

    if (status !== 200 && status !== 201) {
      throw new Error(
        `Registration failed with status ${status}. Details: ${sanitizedBody}`,
      );
    }

    const parsed = this.parseJson<UserAuthResponse>(bodyText);
    const registered = parsed.user;

    if (!registered?.token) {
      throw new Error("Registration response did not include an auth token");
    }

    expect(registered.username).toBe(user.username);
    expect(registered.email.toLowerCase()).toBe(user.email.toLowerCase());

    Logger.logSuccess("Registration successful");

    return {
      ...user,
      token: registered.token,
      bio: registered.bio,
      image: registered.image,
    };
  }

  async login(email: string, password: string): Promise<AuthResponse> {
    const endpoint = `${this.envConfig.apiBaseURL}${apiEndpoints.auth.login}`;
    const result = await this.apiHelper.call<UserAuthResponse>(
      "POST",
      endpoint,
      200,
      {
        data: {
          user: {
            email,
            password,
          },
        },
        headers: {
          "content-type": "application/json",
          accept: "application/json",
        },
        timeout: timeConfig.defaultWaitTimeout,
      },
    );

    const loggedInUser = result.data?.user;
    if (!loggedInUser?.token) {
      throw new Error("Login response did not include an auth token");
    }

    return loggedInUser;
  }

  async getCurrentUser(token: string): Promise<ConduitUser> {
    const endpoint = `${this.envConfig.apiBaseURL}${apiEndpoints.user.current}`;
    const result = await this.apiHelper.call<CurrentUserResponse>(
      "GET",
      endpoint,
      200,
      {
        headers: {
          accept: "application/json",
          authorization: `Token ${token}`,
        },
        timeout: timeConfig.defaultWaitTimeout,
      },
    );

    const currentUser = result.data?.user;
    if (!currentUser) {
      throw new Error("Current-user response did not include user data");
    }

    return currentUser;
  }

  async validateCurrentUser(
    token: string,
    expectedUser: GeneratedUser,
  ): Promise<void> {
    const currentUser = await this.getCurrentUser(token);
    expect(currentUser.username).toBe(expectedUser.username);
    expect(currentUser.email.toLowerCase()).toBe(
      expectedUser.email.toLowerCase(),
    );
    Logger.logSuccess("Current-user API validation successful");
  }

  async expectUnauthorizedCurrentUser(): Promise<void> {
    const endpoint = `${this.envConfig.apiBaseURL}${apiEndpoints.user.current}`;
    const response = await this.request.get(endpoint, {
      headers: {
        accept: "application/json",
      },
      timeout: timeConfig.defaultWaitTimeout,
    });

    expect([401, 403]).toContain(response.status());
  }

  private isCollisionResponse(bodyText: string): boolean {
    const normalized = bodyText.toLowerCase();
    return (
      normalized.includes("has already been taken") ||
      normalized.includes("already been taken") ||
      normalized.includes("already exists")
    );
  }

  private sanitizeResponseBody(bodyText: string): string {
    return bodyText
      .replace(/"token"\s*:\s*"[^"]*"/gi, '"token":"[REDACTED]"')
      .replace(/"password"\s*:\s*"[^"]*"/gi, '"password":"[REDACTED]"')
      .slice(0, 500);
  }

  private parseJson<T>(bodyText: string): T {
    try {
      return JSON.parse(bodyText) as T;
    } catch {
      throw new Error(
        `Unable to parse API JSON response: ${this.sanitizeResponseBody(bodyText)}`,
      );
    }
  }
}

export class ArticleApiHelper {
  private readonly envConfig = getEnvConfig(process.env.ENVIRONMENT ?? "DEV");
  private readonly apiHelper: ApiHelper;
  private readonly authApi: AuthApiHelper;

  constructor(private readonly request: APIRequestContext) {
    this.apiHelper = new ApiHelper(request);
    this.authApi = new AuthApiHelper(request);
  }

  async loginAndGetToken(): Promise<string> {
    const generatedUser = await GeneratedUserHelper.readUser();
    const authResult = await this.authApi.login(
      generatedUser.email,
      generatedUser.password,
    );
    if (!authResult.token) {
      throw new Error("Failed to obtain auth token for article API helper");
    }
    return authResult.token;
  }

  async createArticle(
    overrides: Partial<ArticleInput> = {},
    token?: string,
  ): Promise<CreatedArticleFixture> {
    const authToken = token ?? (await this.loginAndGetToken());
    const requestBody = generateRandomArticle(overrides);
    const createEndpoint = `${this.envConfig.apiBaseURL}${apiEndpoints.articles.create}`;

    const result = await this.apiHelper.call<ArticleResponse>(
      "POST",
      createEndpoint,
      201,
      {
        data: requestBody,
        headers: {
          "content-type": "application/json",
          accept: "application/json",
          authorization: `Token ${authToken}`,
        },
        timeout: timeConfig.defaultWaitTimeout,
      },
    );

    const article = result.data?.article;
    if (!article) {
      throw new Error("Article create response did not include article data");
    }

    return {
      articleId: article.slug,
      title: article.title,
      description: article.description,
      body: article.body,
      tagList: article.tagList,
      author: article.author.username,
    };
  }

  async getArticle(articleId: string, token?: string): Promise<Article> {
    const authToken = token ?? (await this.loginAndGetToken());
    const getEndpoint = `${this.envConfig.apiBaseURL}${apiEndpoints.articles.getByArticleId.replace("{articleId}", encodeURIComponent(articleId))}`;

    const result = await this.apiHelper.call<ArticleResponse>(
      "GET",
      getEndpoint,
      200,
      {
        headers: {
          accept: "application/json",
          authorization: `Token ${authToken}`,
        },
        timeout: timeConfig.defaultWaitTimeout,
      },
    );

    const article = result.data?.article;
    if (!article) {
      throw new Error("Article get response did not include article data");
    }
    return article;
  }

  async expectArticleAbsent(articleId: string, token?: string): Promise<void> {
    const authToken = token ?? (await this.loginAndGetToken());
    const getEndpoint = `${this.envConfig.apiBaseURL}${apiEndpoints.articles.getByArticleId.replace("{articleId}", encodeURIComponent(articleId))}`;

    const response = await this.request.get(getEndpoint, {
      headers: {
        accept: "application/json",
        authorization: `Token ${authToken}`,
      },
      timeout: timeConfig.defaultWaitTimeout,
    });

    expect([404, 422]).toContain(response.status());
  }

  async deleteArticle(articleId: string, token?: string): Promise<void> {
    const authToken = token ?? (await this.loginAndGetToken());
    const deleteEndpoint = `${this.envConfig.apiBaseURL}${apiEndpoints.articles.deleteByArticleId.replace("{articleId}", encodeURIComponent(articleId))}`;

    const response = await this.request.delete(deleteEndpoint, {
      headers: {
        accept: "application/json",
        authorization: `Token ${authToken}`,
      },
      timeout: timeConfig.defaultWaitTimeout,
    });

    if (![200, 204, 404].includes(response.status())) {
      throw new Error(
        `Expected delete status 200, 204, or 404, but got ${response.status()}`,
      );
    }
  }
}

export default class ApiHelper {
  private request: APIRequestContext;

  constructor(request: APIRequestContext) {
    this.request = request;
  }

  async call<T = unknown>(
    method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
    url: string,
    expectedStatus: number,
    requestOptions: RequestOptions = {},
    validationOptions?: ValidationOptions,
  ): Promise<ApiCallResult<T>> {
    const startTime = Date.now();

    const { formData, ...restOptions } = requestOptions;
    const options: Parameters<APIRequestContext["post"]>[1] = {
      ...restOptions,
    };

    if (formData && !options.form && !options.data) {
      options.form = Object.fromEntries(
        Object.entries(formData).map(([key, value]) => {
          if (value === null || value === undefined) {
            return [key, ""];
          }
          if (typeof value === "string") {
            return [key, value];
          }
          if (typeof value === "number" || typeof value === "boolean") {
            return [key, String(value)];
          }
          return [key, JSON.stringify(value)];
        }),
      );
    }

    let response: APIResponse;

    switch (method) {
      case "GET":
        response = await this.request.get(url, options);
        break;
      case "POST":
        response = await this.request.post(url, options);
        break;
      case "PUT":
        response = await this.request.put(url, options);
        break;
      case "PATCH":
        response = await this.request.patch(url, options);
        break;
      case "DELETE":
        response = await this.request.delete(url, options);
        break;
      default:
        throw new Error(`Unsupported HTTP method: ${String(method)}`);
    }

    const responseTime = Date.now() - startTime;

    if (
      validationOptions?.responseTime &&
      responseTime > validationOptions.responseTime
    ) {
      throw new Error(
        `Response time ${responseTime}ms exceeded expected ${validationOptions.responseTime}ms`,
      );
    }

    if (response.status() !== expectedStatus) {
      const responseText = await response
        .text()
        .catch(() => "Unable to read response body");
      const sanitized = responseText
        .replace(/"token"\s*:\s*"[^"]*"/gi, '"token":"[REDACTED]"')
        .replace(/"password"\s*:\s*"[^"]*"/gi, '"password":"[REDACTED]"');
      throw new Error(
        `Expected status ${expectedStatus}, but got ${response.status()}. Response: ${sanitized}`,
      );
    }

    let data: T | undefined;
    const contentType = response.headers()["content-type"] ?? "";

    if (contentType.includes("application/json")) {
      data = (await response.json()) as T;
    } else {
      const text = await response.text();
      try {
        data = JSON.parse(text) as T;
      } catch {
        data = text as unknown as T;
      }
    }

    if (validationOptions?.schema && data) {
      this.validateSchema(data, validationOptions.schema);
    }

    if (validationOptions?.fields && data) {
      this.validateFields(data, validationOptions.fields);
    }

    return {
      status: response.status(),
      data,
      response,
    };
  }

  private validateSchema(data: unknown, schema: Record<string, string>): void {
    if (typeof data !== "object" || data === null) {
      throw new Error("Response data is not an object");
    }

    const dataObj = data as Record<string, unknown>;

    for (const [key, expectedType] of Object.entries(schema)) {
      if (!(key in dataObj)) {
        throw new Error(`Missing required field: ${key}`);
      }

      const actualType = typeof dataObj[key];
      if (actualType !== expectedType) {
        throw new Error(
          `Field ${key} has type ${actualType}, but expected ${expectedType}`,
        );
      }
    }
  }

  private validateFields(data: unknown, fields: Record<string, unknown>): void {
    if (typeof data !== "object" || data === null) {
      throw new Error("Response data is not an object");
    }

    const dataObj = data as Record<string, unknown>;

    for (const [key, expectedValue] of Object.entries(fields)) {
      if (!(key in dataObj)) {
        throw new Error(`Missing required field: ${key}`);
      }

      if (dataObj[key] !== expectedValue) {
        throw new Error(
          `Field ${key} has value ${JSON.stringify(dataObj[key])}, but expected ${JSON.stringify(expectedValue)}`,
        );
      }
    }
  }
}

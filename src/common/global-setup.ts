/* eslint-disable playwright/expect-expect -- setup validates auth via page actions / API helpers */
import { chromium, test as setup } from "@playwright/test";

import browserConfig from "@/config/browser/browserConfig";
import { timeConfig } from "@/config/defaultConfig/testConfig";
import getEnvConfig, {
  isDynamicUserEnabled,
  isHeadlessEnabled,
} from "@/config/environment/envConfig";
import { LoginActions } from "@/pageActions/login.actions";
import { NavigationBarActions } from "@/pageActions/navigation-bar.actions";
import {
  AuthApiHelper,
  RegistrationCollisionError,
  createAuthenticatedBrowserState,
} from "@/utils/api-helper";
import {
  GeneratedUserHelper,
  generateRandomUser,
  maskEmail,
} from "@/utils/data-generator";
import { HarHelper } from "@/utils/har-helper";
import { Logger } from "@/utils/logger";
import { prepareReportsForNewRun } from "@/utils/reports-helper";
import { StorageStateHelper } from "@/utils/storage-state-helper";

import type { GeneratedUser, RegisteredUser } from "@/utils/user-helper";

const environment = process.env.ENVIRONMENT ?? "DEV";
const envConfig = getEnvConfig(environment);
const MAX_COLLISION_RETRIES = 2;

async function registerDynamicUser(
  authApi: AuthApiHelper,
): Promise<{ generatedUser: GeneratedUser; registeredUser: RegisteredUser }> {
  let attempt = 0;
  let lastError: unknown;

  while (attempt <= MAX_COLLISION_RETRIES) {
    const generatedUser = await generateRandomUser(environment);
    try {
      const registeredUser = await authApi.registerUser(generatedUser);
      return { generatedUser, registeredUser };
    } catch (error) {
      lastError = error;
      if (!(error instanceof RegistrationCollisionError)) {
        throw error;
      }
      attempt += 1;
      Logger.logWarning(
        `Registration collision detected. Regenerating user (attempt ${attempt}/${MAX_COLLISION_RETRIES}).`,
      );
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Registration failed after collision retries");
}

function loadFixedEnvUser(): GeneratedUser {
  return {
    username: envConfig.username,
    email: envConfig.email,
    password: envConfig.password,
    runId: "fixed-user",
    environment,
    createdAt: new Date().toISOString(),
  };
}

async function provisionRunUser(authApi: AuthApiHelper): Promise<{
  activeUser: GeneratedUser;
  authToken: string;
}> {
  if (isDynamicUserEnabled) {
    Logger.logInfo(
      "DYNAMIC_USER=true; generating random user into test-data/create-user.json and registering",
    );

    const { generatedUser, registeredUser } =
      await registerDynamicUser(authApi);

    await GeneratedUserHelper.saveUser(generatedUser, {
      persistCreateUserJson: true,
    });

    return { activeUser: generatedUser, authToken: registeredUser.token };
  }

  Logger.logInfo(
    "DYNAMIC_USER=false; using credentials from .env (not writing create-user.json)",
  );

  const activeUser = loadFixedEnvUser();
  const loginResult = await authApi.login(
    activeUser.email,
    activeUser.password,
  );

  await GeneratedUserHelper.saveUser(activeUser, {
    persistCreateUserJson: false,
  });

  return { activeUser, authToken: loginResult.token };
}

function assertUserShape(activeUser: GeneratedUser): void {
  if (activeUser.username.trim().length === 0) {
    throw new Error("Username is empty");
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(activeUser.email)) {
    throw new Error("Email is invalid");
  }
  if (activeUser.password.length < 8) {
    throw new Error("Password does not meet minimum length");
  }
}

setup("Create and authenticate user for test run", async ({ request }) => {
  const testType = process.env.TEST_TYPE;
  const isApiTest = testType === "api";

  try {
    Logger.logInfo("Preparing authentication artifacts for test run...");
    prepareReportsForNewRun();
    HarHelper.clearHarRecordings();
    await StorageStateHelper.deleteAuthFile();
    await GeneratedUserHelper.deleteUserFile();
    await StorageStateHelper.ensureAuthDirectoryExists();

    const authApi = new AuthApiHelper(request);
    const { activeUser, authToken } = await provisionRunUser(authApi);

    await authApi.validateCurrentUser(authToken, activeUser);
    await authApi.expectUnauthorizedCurrentUser();
    assertUserShape(activeUser);

    if (isApiTest) {
      Logger.logInfo("API test run detected. Skipping UI auth setup.");
      await StorageStateHelper.updateEnvMarker(environment);
      Logger.logSuccess(
        `API run user ready: ${activeUser.username} (${maskEmail(activeUser.email)})`,
      );
      return;
    }

    const launchOptions = browserConfig.use.launchOptions;
    const browser = await chromium.launch({
      headless: isHeadlessEnabled,
      ...(browserConfig.use.channel
        ? { channel: browserConfig.use.channel }
        : {}),
      ...(launchOptions ? { args: launchOptions.args } : {}),
    });

    const page = await browser.newPage({
      baseURL: envConfig.baseURL,
      viewport: null,
    });

    try {
      const navigationBarActions = new NavigationBarActions(page);

      if (isDynamicUserEnabled) {
        await createAuthenticatedBrowserState({
          page,
          token: authToken,
          baseUrl: envConfig.baseURL,
        });
      } else {
        await page.goto(`${envConfig.baseURL}/login`, {
          waitUntil: "domcontentloaded",
          timeout: timeConfig.navigationTimeout,
        });
        const loginActions = new LoginActions(page);
        await loginActions.login(activeUser.email, activeUser.password);
      }

      await page.goto(envConfig.baseURL, {
        waitUntil: "domcontentloaded",
        timeout: timeConfig.navigationTimeout,
      });

      await navigationBarActions.confirmAuthenticatedMenu(activeUser.username);
      await navigationBarActions.verifyUsernameMatchesApiData(
        activeUser.username,
      );
      Logger.logSuccess("Username validated in navigation");

      await page.reload({
        waitUntil: "domcontentloaded",
        timeout: timeConfig.navigationTimeout,
      });
      await navigationBarActions.confirmAuthenticatedMenu(activeUser.username);

      const authFilePath = StorageStateHelper.getAuthFilePath();
      await page.context().storageState({ path: authFilePath });
      await StorageStateHelper.updateEnvMarker(environment);

      Logger.logSuccess("Authentication state saved");
      Logger.logSuccess(
        `Run user ready: ${activeUser.username} (${maskEmail(activeUser.email)})`,
      );
    } finally {
      await page.close();
      await browser.close();
    }
  } catch (error) {
    const errorMessage = "Failed during user setup";
    Logger.handleError(error, errorMessage);
    throw error instanceof Error ? error : new Error(errorMessage);
  }
});

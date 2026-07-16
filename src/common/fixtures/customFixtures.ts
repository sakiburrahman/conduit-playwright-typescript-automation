import { test as base } from "@playwright/test";

import getEnvConfig from "@/config/environment/envConfig";
import { ArticleDetailsActions } from "@/pageActions/article-details.actions";
import { ArticleEditorActions } from "@/pageActions/article-editor.actions";
import { HomeActions } from "@/pageActions/home.actions";
import { LoginActions } from "@/pageActions/login.actions";
import { NavigationBarActions } from "@/pageActions/navigation-bar.actions";
import { ProfileActions } from "@/pageActions/profile.actions";
import { RegisterActions } from "@/pageActions/register.actions";
import { SettingsActions } from "@/pageActions/settings.actions";
import {
  AuthApiHelper,
  createAuthenticatedBrowserState,
} from "@/utils/api-helper";
import { GeneratedUserHelper } from "@/utils/data-generator";
import { Logger } from "@/utils/logger";

import type { GeneratedUser } from "@/utils/user-helper";

interface CustomFixtures {
  generatedUser: GeneratedUser;
  authToken: string;
  loginActions: LoginActions;
  registerActions: RegisterActions;
  navigationBarActions: NavigationBarActions;
  homeActions: HomeActions;
  articleEditorActions: ArticleEditorActions;
  articleDetailsActions: ArticleDetailsActions;
  profileActions: ProfileActions;
  settingsActions: SettingsActions;
}

export const test = base.extend<CustomFixtures>({
  generatedUser: async ({}, use) => {
    const user = await GeneratedUserHelper.readUser();
    await use(user);
  },

  authToken: async ({ request, generatedUser }, use) => {
    const authApi = new AuthApiHelper(request);
    const authResult = await authApi.login(
      generatedUser.email,
      generatedUser.password,
    );
    await use(authResult.token);
  },

  page: async ({ page, authToken }, use, testInfo) => {
    if (testInfo.project.name === "e2e") {
      const envConfig = getEnvConfig(process.env.ENVIRONMENT ?? "DEV");
      try {
        await createAuthenticatedBrowserState({
          page,
          token: authToken,
          baseUrl: envConfig.baseURL,
        });
        Logger.logSuccess(
          `Authenticated UI session ready at ${envConfig.baseURL}`,
        );
      } catch {
        Logger.logWarning("Authenticated bootstrap failed, retrying once...");
        await createAuthenticatedBrowserState({
          page,
          token: authToken,
          baseUrl: envConfig.baseURL,
        });
      }
    }

    await use(page);
  },

  loginActions: async ({ page }, use) => {
    await use(new LoginActions(page));
  },

  registerActions: async ({ page }, use) => {
    await use(new RegisterActions(page));
  },

  navigationBarActions: async ({ page }, use) => {
    await use(new NavigationBarActions(page));
  },

  homeActions: async ({ page }, use) => {
    await use(new HomeActions(page));
  },

  articleEditorActions: async ({ page }, use) => {
    await use(new ArticleEditorActions(page));
  },

  articleDetailsActions: async ({ page }, use) => {
    await use(new ArticleDetailsActions(page));
  },

  profileActions: async ({ page }, use) => {
    await use(new ProfileActions(page));
  },

  settingsActions: async ({ page }, use) => {
    await use(new SettingsActions(page));
  },
});

export { expect } from "@playwright/test";

import { TestTags } from "@/common/enums/testTags";
import { expect, test } from "@/common/fixtures/customFixtures";
import { testUrl } from "@/config/defaultConfig/testConfig";
import { AuthApiHelper } from "@/utils/api-helper";

import type { SettingsActions } from "@/pageActions/settings.actions";
import type { GeneratedUser } from "@/utils/user-helper";

const INVALID_PROFILE_IMAGE_URL = "https://kommodo.ai/i/MavMFGskWOKTCiEP65aX";

async function fillBaselineForm(
  settingsActions: SettingsActions,
  user: GeneratedUser,
  bio: string,
  image = "",
): Promise<void> {
  await settingsActions.fillProfileSettings({
    image,
    username: user.username,
    bio,
    email: user.email,
  });
}

test.describe("Test Update User Settings Functionality", () => {
  test.describe.configure({ mode: "serial" });

  test(
    "CONDUIT-TC-0016: Verify that a user can update existing password",
    {
      tag: [
        TestTags.E2E.REGRESSION,
        TestTags.E2E.POSITIVE,
        TestTags.FEATURE.SETTINGS,
      ],
    },
    async ({
      page,
      generatedUser,
      navigationBarActions,
      settingsActions,
      loginActions,
    }) => {
      const oldPassword = generatedUser.password;
      const newPassword = `Nw${Date.now().toString(36)}!a1`;
      const baselineBio = `baseline-bio-${generatedUser.runId}`;

      await navigationBarActions.confirmAuthenticatedMenu(
        generatedUser.username,
      );
      await settingsActions.openSettings();
      await expect(
        page.getByPlaceholder("New Password", { exact: true }),
      ).toBeVisible();

      await settingsActions.updateProfileSettings({
        username: generatedUser.username,
        email: generatedUser.email,
        bio: baselineBio,
        image: "",
        password: newPassword,
      });

      await settingsActions.openSettings();
      await settingsActions.logout();
      await navigationBarActions.confirmUnauthenticatedMenu();

      await loginActions.submitInvalidCredentials(
        generatedUser.email,
        oldPassword,
      );

      await loginActions.login(generatedUser.email, newPassword);
      await loginActions.confirmAuthenticatedNavigation(generatedUser.username);
      await navigationBarActions.confirmAuthenticatedMenu(
        generatedUser.username,
      );

      await settingsActions.openSettings();
      await settingsActions.updateProfileSettings({
        username: generatedUser.username,
        email: generatedUser.email,
        bio: baselineBio,
        image: "",
        password: oldPassword,
      });
    },
  );

  test(
    "CONDUIT-TC-0017: Verify that a user can update existing username",
    {
      tag: [
        TestTags.E2E.REGRESSION,
        TestTags.E2E.POSITIVE,
        TestTags.FEATURE.SETTINGS,
      ],
    },
    async ({
      page,
      generatedUser,
      navigationBarActions,
      profileActions,
      settingsActions,
    }) => {
      const baselineBio = `baseline-bio-${generatedUser.runId}`;
      const updatedUsername = `${generatedUser.username.slice(0, 12)}upd`.slice(
        0,
        20,
      );

      await navigationBarActions.confirmAuthenticatedMenu(
        generatedUser.username,
      );
      await settingsActions.openSettings();

      await settingsActions.updateProfileSettings({
        username: updatedUsername,
        email: generatedUser.email,
        bio: baselineBio,
        image: "",
      });

      await expect(page).toHaveURL(new RegExp(`/profile/${updatedUsername}`));
      await profileActions.confirmProfileUsername(updatedUsername);

      await page.goto(testUrl);
      await navigationBarActions.confirmAuthenticatedMenu(updatedUsername);
      await navigationBarActions.confirmNavigationUsername(updatedUsername);

      await settingsActions.openSettings();
      await settingsActions.updateProfileSettings({
        username: generatedUser.username,
        email: generatedUser.email,
        bio: baselineBio,
        image: "",
      });

      await expect(page).toHaveURL(
        new RegExp(`/profile/${generatedUser.username}`),
      );
      await profileActions.confirmProfileUsername(generatedUser.username);

      await page.goto(testUrl);
      await navigationBarActions.confirmAuthenticatedMenu(
        generatedUser.username,
      );
      await navigationBarActions.confirmNavigationUsername(
        generatedUser.username,
      );
    },
  );

  test.describe("Test Update User Settings Validation Negative Scenarios", () => {
    test.beforeEach(
      async ({ generatedUser, navigationBarActions, settingsActions }) => {
        await navigationBarActions.confirmAuthenticatedMenu(
          generatedUser.username,
        );
        await settingsActions.openSettings();
        await fillBaselineForm(
          settingsActions,
          generatedUser,
          `baseline-bio-${generatedUser.runId}`,
        );
      },
    );

    test(
      "CONDUIT-TC-0018: Verify that Update Settings does not update the username when the username field contains only spaces",
      {
        tag: [
          TestTags.E2E.REGRESSION,
          TestTags.E2E.NEGATIVE,
          TestTags.FEATURE.SETTINGS,
        ],
      },
      async ({
        page,
        generatedUser,
        navigationBarActions,
        settingsActions,
      }) => {
        await settingsActions.fillProfileSettings({ username: "      " });
        await settingsActions.submitSettings();

        await settingsActions.expectStillOnSettings();
        await expect(page).not.toHaveURL(/\/profile\//i);
        await expect(
          page.getByRole("link", { name: /My (Articles|Posts)/i }),
        ).toHaveCount(0);

        await page.goto(testUrl, { waitUntil: "domcontentloaded" });
        await navigationBarActions.confirmAuthenticatedMenu(
          generatedUser.username,
        );
      },
    );

    test(
      "CONDUIT-TC-0019: Verify that invalid profile picture URL should not be accepted",
      {
        tag: [
          TestTags.E2E.REGRESSION,
          TestTags.E2E.NEGATIVE,
          TestTags.FEATURE.SETTINGS,
        ],
      },
      async ({ page, generatedUser, settingsActions }) => {
        page.once("dialog", () => {
          throw new Error("Unexpected dialog for invalid profile image URL");
        });

        await settingsActions.openSettings();
        await expect(
          page.getByRole("heading", { name: "Your Settings" }),
        ).toBeVisible();

        await settingsActions.submitInvalidProfileSettings({
          image: INVALID_PROFILE_IMAGE_URL,
        });

        await settingsActions.expectStillOnSettings();
        await expect(page).not.toHaveURL(/\/profile\//i);
        await expect(
          page.getByRole("link", { name: /My (Articles|Posts)/i }),
        ).toHaveCount(0);
        await expect(
          page.getByRole("heading", { name: "Your Settings" }),
        ).toBeVisible();

        const form = await settingsActions.readCurrentFormValues();
        expect(
          form.image,
          "The web application must not persist an invalid profile image URL",
        ).not.toBe(INVALID_PROFILE_IMAGE_URL);
        expect(form.username).toBe(generatedUser.username);
      },
    );

    // eslint-disable-next-line playwright/no-skipped-test -- CONDUIT-TC-0020 intentional skip for Skipped visibility in reports
    test.skip(
      "CONDUIT-TC-0020: Verify that an invalid email address can not be accepted and the user can not update settings",
      {
        tag: [
          TestTags.E2E.REGRESSION,
          TestTags.E2E.NEGATIVE,
          TestTags.FEATURE.SETTINGS,
        ],
        annotation: {
          type: "intentional-skip",
          description:
            "Intentionally skipped so Playwright HTML / Allure / Ortoni show skipped tests in the consolidated report. Re-enable to exercise invalid-email rejection on the web application.",
        },
      },
      async ({
        page,
        request,
        authToken,
        generatedUser,
        navigationBarActions,
        settingsActions,
      }) => {
        const invalidEmail = "invalid-email";

        await settingsActions.fillProfileSettings({ email: invalidEmail });
        await expect(page.getByRole("textbox", { name: "Email" })).toHaveValue(
          invalidEmail,
        );

        await settingsActions.submitSettings();

        await expect(page).not.toHaveURL(/\/profile\//i, { timeout: 5_000 });

        await page.goto("/settings", { waitUntil: "domcontentloaded" });
        await settingsActions.openSettings();
        const form = await settingsActions.readCurrentFormValues();

        const authApi = new AuthApiHelper(request);
        const currentUser = await authApi.getCurrentUser(authToken);
        expect(
          currentUser.email.toLowerCase(),
          "Invalid email must not be persisted for the current user",
        ).toBe(generatedUser.email.toLowerCase());
        expect(currentUser.email.toLowerCase()).not.toBe(invalidEmail);

        expect(
          form.email.toLowerCase(),
          "Settings must not keep an accepted invalid email value",
        ).not.toBe(invalidEmail);

        const formEmail = form.email.trim().toLowerCase();
        if (formEmail.length > 0) {
          expect(formEmail).toBe(generatedUser.email.toLowerCase());
        }

        await page.goto(testUrl, { waitUntil: "domcontentloaded" });
        await navigationBarActions.confirmAuthenticatedMenu(
          generatedUser.username,
        );
      },
    );
  });
});

import { expect, type Page } from "@playwright/test";

import { ElementState } from "@/common/enums/elementState";
import { timeConfig } from "@/config/defaultConfig/testConfig";
import { BaseActions } from "@/pageActions/base.actions";
import { NavigationBarPage } from "@/pageLocators/navigation-bar.page";
import { SettingsPage } from "@/pageLocators/settings.page";

export interface SettingsFormValues {
  image: string;
  username: string;
  bio: string;
  email: string;
  password: string;
}

export class SettingsActions extends BaseActions {
  private readonly locators: SettingsPage;
  private readonly navigationBarPage: NavigationBarPage;

  constructor(page: Page) {
    super(page);
    this.locators = new SettingsPage(page);
    this.navigationBarPage = new NavigationBarPage(page);
  }

  async openSettings(): Promise<void> {
    const settingsInNav = await this.checkElementState(
      this.navigationBarPage.settings_LK,
      ElementState.Visible,
      10_000,
      false,
    );

    if (settingsInNav) {
      await this.click(this.navigationBarPage.settings_LK);
    } else {
      await this.navigateTo("/settings");
    }

    await this.verifyUrl(/\/settings$/);
    await this.ensureElementState(
      this.locators.heading,
      ElementState.Visible,
      undefined,
      "settings heading",
    );
    await this.ensureElementState(
      this.locators.username_IN,
      ElementState.Visible,
      undefined,
      "username input",
    );
  }

  async readCurrentFormValues(): Promise<SettingsFormValues> {
    return {
      image: await this.locators.imageUrl_IN.inputValue(),
      username: await this.locators.username_IN.inputValue(),
      bio: await this.locators.bio_TA.inputValue(),
      email: await this.locators.email_IN.inputValue(),
      password: await this.locators.password_IN.inputValue(),
    };
  }

  async fillProfileSettings(values: {
    username?: string;
    bio?: string;
    image?: string;
    email?: string;
    password?: string;
  }): Promise<void> {
    if (values.image !== undefined) {
      await this.fill(this.locators.imageUrl_IN, values.image);
    }
    if (values.username !== undefined) {
      await this.fill(this.locators.username_IN, values.username);
    }
    if (values.bio !== undefined) {
      await this.fill(this.locators.bio_TA, values.bio);
    }
    if (values.email !== undefined) {
      await this.fill(this.locators.email_IN, values.email);
    }
    if (values.password !== undefined) {
      await this.fill(this.locators.password_IN, values.password);
    }
  }

  async clearProfileFields(
    fields: ("image" | "username" | "bio" | "email" | "password")[],
  ): Promise<void> {
    for (const field of fields) {
      switch (field) {
        case "image":
          await this.clear(this.locators.imageUrl_IN);
          break;
        case "username":
          await this.clear(this.locators.username_IN);
          break;
        case "bio":
          await this.clear(this.locators.bio_TA);
          break;
        case "email":
          await this.clear(this.locators.email_IN);
          break;
        case "password":
          await this.clear(this.locators.password_IN);
          break;
        default: {
          const _exhaustive: never = field;
          throw new Error(`Unsupported settings field: ${String(_exhaustive)}`);
        }
      }
    }
  }

  async updateProfileSettings(values: {
    username?: string;
    bio?: string;
    image?: string;
    email?: string;
    password?: string;
  }): Promise<void> {
    await this.fillProfileSettings(values);

    await Promise.all([
      this.page.waitForURL(/\/profile\//, {
        timeout: timeConfig.navigationTimeout,
      }),
      this.click(this.locators.updateSettings_BTN),
    ]);
  }

  async submitSettings(): Promise<void> {
    await this.click(this.locators.updateSettings_BTN);
  }

  async submitInvalidProfileSettings(values: {
    username?: string;
    email?: string;
    bio?: string;
    image?: string;
    password?: string;
  }): Promise<void> {
    await this.fillProfileSettings(values);
    await this.submitSettings();
  }

  async expectStillOnSettings(): Promise<void> {
    await expect(
      this.page,
      "Update Settings must not navigate to /profile (e.g. My Posts)",
    ).not.toHaveURL(/\/profile\//i, { timeout: 5_000 });

    await expect(
      this.page.getByRole("link", { name: /My (Articles|Posts)/i }),
      'Profile "My Posts" tab must not appear after a rejected settings update',
    ).toHaveCount(0);

    await this.verifyUrl(/\/settings$/);
    await this.ensureElementState(
      this.locators.heading,
      ElementState.Visible,
      undefined,
      "settings heading after invalid submit",
    );
  }

  async logout(): Promise<void> {
    await this.click(this.locators.logout_BTN);
    await this.verifyUrl(/\/$/);
  }
}

import type { Locator, Page } from "@playwright/test";

export class SettingsPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly imageUrl_IN: Locator;
  readonly username_IN: Locator;
  readonly bio_TA: Locator;
  readonly email_IN: Locator;
  readonly password_IN: Locator;
  readonly updateSettings_BTN: Locator;
  readonly logout_BTN: Locator;
  readonly errorMessages: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole("heading", { name: "Your Settings" });
    this.imageUrl_IN = page.getByRole("textbox", {
      name: "URL of profile picture",
    });
    this.username_IN = page.getByRole("textbox", { name: "Username" });
    this.bio_TA = page.getByRole("textbox", {
      name: "Short bio about you",
    });
    this.email_IN = page.getByRole("textbox", { name: "Email" });
    this.password_IN = page.getByPlaceholder("New Password", { exact: true });
    this.updateSettings_BTN = page.getByRole("button", {
      name: "Update Settings",
    });
    this.logout_BTN = page.getByRole("button", {
      name: /Or click here to logout/i,
    });
    this.errorMessages = page
      .locator("app-list-errors li, .error-messages li")
      .first();
  }
}

import type { Locator, Page } from "@playwright/test";

export class LoginPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly email_IN: Locator;
  readonly password_IN: Locator;
  readonly login_BTN: Locator;
  readonly errorMessages: Locator;
  readonly invalidCredentialsError: Locator;
  readonly needAccount_LK: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole("heading", { name: "Sign in" });
    this.email_IN = page.getByRole("textbox", { name: "Email" });
    this.password_IN = page.getByRole("textbox", { name: "Password" });
    this.login_BTN = page.getByRole("button", { name: "Sign in" });
    this.errorMessages = page
      .locator("app-list-errors ul.error-messages li, .error-messages li")
      .first();
    this.invalidCredentialsError = page
      .locator("ul.error-messages")
      .getByRole("listitem")
      .filter({ hasText: /^email or password is invalid$/ });
    this.needAccount_LK = page.getByRole("link", { name: "Need an account?" });
  }
}

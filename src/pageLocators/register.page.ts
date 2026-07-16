import type { Locator, Page } from "@playwright/test";

export class RegisterPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly username_IN: Locator;
  readonly email_IN: Locator;
  readonly password_IN: Locator;
  readonly signUp_BTN: Locator;
  readonly haveAccount_LK: Locator;
  readonly errorMessages: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole("heading", { name: /sign up/i });
    this.username_IN = page.getByPlaceholder(/username/i);
    this.email_IN = page.getByPlaceholder(/email/i);
    this.password_IN = page.getByPlaceholder(/password/i);
    this.signUp_BTN = page.getByRole("button", { name: /sign up/i });
    this.haveAccount_LK = page.getByRole("link", {
      name: /have an account/i,
    });
    this.errorMessages = page.locator(
      "app-list-errors ul.error-messages li, .error-messages li",
    );
  }
}

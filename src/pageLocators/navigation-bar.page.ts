import type { Locator, Page } from "@playwright/test";

export class NavigationBarPage {
  readonly page: Page;
  readonly home_LK: Locator;
  readonly signIn_LK: Locator;
  readonly signUp_LK: Locator;
  readonly newArticle_LK: Locator;
  readonly settings_LK: Locator;

  constructor(page: Page) {
    this.page = page;
    this.home_LK = page.getByRole("link", { name: "Home", exact: true });
    this.signIn_LK = page.getByRole("link", { name: "Sign in", exact: true });
    this.signUp_LK = page.getByRole("link", { name: "Sign up", exact: true });
    this.newArticle_LK = page.getByRole("link", {
      name: /New Article/,
      exact: false,
    });
    this.settings_LK = page.getByRole("link", {
      name: /Settings/,
      exact: false,
    });
  }

  usernameLink(username: string): Locator {
    return this.getNavigationUsername(username);
  }

  getNavigationUsername(username: string): Locator {
    return this.page.locator("ul.navbar-nav").getByRole("link", {
      name: username,
      exact: true,
    });
  }
}

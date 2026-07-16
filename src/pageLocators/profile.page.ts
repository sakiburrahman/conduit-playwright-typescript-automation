import type { Locator, Page } from "@playwright/test";

export class ProfilePage {
  readonly page: Page;
  readonly username_TXT: Locator;
  readonly bio_TXT: Locator;
  readonly image_IMG: Locator;
  readonly myArticles_TAB: Locator;
  readonly favoritedArticles_TAB: Locator;
  readonly editProfileSettings_BTN: Locator;

  constructor(page: Page) {
    this.page = page;
    this.username_TXT = page.locator(".user-info h4, .user-info h2").first();
    this.bio_TXT = page.locator(".user-info p").first();
    this.image_IMG = page.locator(".user-info img").first();
    this.myArticles_TAB = page.getByRole("link", {
      name: /My (Articles|Posts)/i,
    });
    this.favoritedArticles_TAB = page.getByRole("link", {
      name: /Favorited (Articles|Posts)/i,
    });
    this.editProfileSettings_BTN = page.getByRole("link", {
      name: /Edit Profile Settings/i,
    });
  }

  articleByTitle(title: string): Locator {
    return this.page.getByRole("heading", { name: title });
  }

  getProfileUsername(username: string): Locator {
    return this.page.locator(".profile-page .user-info").getByRole("heading", {
      level: 4,
      name: username,
      exact: true,
    });
  }
}

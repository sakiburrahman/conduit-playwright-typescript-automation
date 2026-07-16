import type { Locator, Page } from "@playwright/test";

export class ArticleEditorPage {
  readonly page: Page;
  readonly title_IN: Locator;
  readonly description_IN: Locator;
  readonly body_TA: Locator;
  readonly tags_IN: Locator;
  readonly tagPills: Locator;
  readonly publish_BTN: Locator;
  readonly errorMessages: Locator;

  constructor(page: Page) {
    this.page = page;
    this.title_IN = page.getByPlaceholder("Article Title");
    this.description_IN = page.getByPlaceholder("What's this article about?");
    this.body_TA = page.getByPlaceholder("Write your article (in markdown)");
    this.tags_IN = page.getByPlaceholder("Enter tags");
    this.tagPills = page.locator(".tag-list .tag-default");
    this.publish_BTN = page.getByRole("button", { name: /Publish Article/i });
    this.errorMessages = page
      .locator("app-list-errors li, .error-messages li")
      .first();
  }

  removeTagButton(tag: string): Locator {
    return this.tagPills
      .filter({ hasText: tag })
      .locator("i.ion-close-round, .ion-close-round");
  }
}

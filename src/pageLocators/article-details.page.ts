import type { Locator, Page } from "@playwright/test";

export class ArticleDetailsPage {
  readonly page: Page;
  readonly title_TXT: Locator;
  readonly body_TXT: Locator;
  readonly articleBodyContainer: Locator;
  readonly articleAuthor: Locator;
  readonly articleTags: Locator;
  readonly editArticle_BTN: Locator;
  readonly deleteArticle_BTN: Locator;
  readonly meta: Locator;
  readonly comment_TA: Locator;

  constructor(page: Page) {
    this.page = page;

    const articleBanner = page.locator(".article-page .banner");

    this.title_TXT = articleBanner
      .getByRole("heading", { level: 1 })
      .or(page.locator("h1").first());

    this.articleAuthor = articleBanner
      .locator("a.author")
      .or(page.locator(".article-meta a.author").first());

    this.articleBodyContainer = page.locator(
      ".article-page .article-content .col-md-12 > div, .article-content",
    );

    this.body_TXT = this.articleBodyContainer.first();

    this.articleTags = page.locator(
      ".article-page .article-content .tag-list .tag-pill, .article-page .tag-list .tag-pill, .tag-list .tag-default",
    );

    this.editArticle_BTN = page
      .getByRole("link", { name: /Edit Article/i })
      .first();
    this.deleteArticle_BTN = page
      .getByRole("button", { name: /Delete Article/i })
      .first();
    this.meta = page.locator(".article-meta").first();
    this.comment_TA = page.getByPlaceholder("Write a comment...");
  }

  authorLink(username: string): Locator {
    return this.page.getByRole("link", { name: username, exact: true }).first();
  }

  tagPill(tag: string): Locator {
    return this.articleTags.filter({ hasText: tag }).first();
  }

  articleTag(tagName: string): Locator {
    return this.articleTags.filter({ hasText: tagName });
  }
}

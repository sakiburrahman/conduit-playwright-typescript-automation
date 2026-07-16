import type { Locator, Page } from "@playwright/test";

export class HomePage {
  readonly page: Page;
  readonly globalFeed_TAB: Locator;
  readonly yourFeed_TAB: Locator;
  readonly popularTags_SECTION: Locator;
  readonly articleList: Locator;
  readonly articleCards: Locator;
  readonly articlePreview_LIST: Locator;
  readonly paginationButtons: Locator;
  readonly loading_TXT: Locator;
  readonly emptyFeed_TXT: Locator;

  constructor(page: Page) {
    this.page = page;
    this.globalFeed_TAB = page.getByText("Global Feed", { exact: true });
    this.yourFeed_TAB = page.getByText("Your Feed", { exact: true });
    this.popularTags_SECTION = page.getByText("Popular Tags");
    this.articleList = page.locator("app-article-list");
    this.articleCards = this.articleList.locator("app-article-preview");
    this.articlePreview_LIST = page.locator(
      "app-article-list app-article-preview, .article-preview",
    );
    this.paginationButtons = this.articleList.locator(".pagination .page-link");
    this.loading_TXT = page.getByText("Loading articles...");
    this.emptyFeed_TXT = page.getByText(/No articles are here/i);
  }

  tagLink(tag: string): Locator {
    return this.page.locator(".sidebar .tag-list a.tag-pill", {
      hasText: tag,
    });
  }

  feedTagTab(tag: string): Locator {
    return this.page.getByText(tag, { exact: true }).first();
  }

  articleCardByTitle(articleTitle: string): Locator {
    return this.page.locator("app-article-preview").filter({
      has: this.page.getByRole("heading", {
        name: articleTitle,
        exact: true,
      }),
    });
  }

  articleTitle(articleTitle: string): Locator {
    return this.articleCardByTitle(articleTitle).getByRole("heading", {
      name: articleTitle,
      exact: true,
    });
  }

  articleDescription(articleTitle: string): Locator {
    return this.articleCardByTitle(articleTitle).locator("a.preview-link > p");
  }

  articleAuthor(articleTitle: string): Locator {
    return this.articleCardByTitle(articleTitle).locator(
      ".article-meta a.author",
    );
  }

  articlePreviewLink(articleTitle: string): Locator {
    return this.articleCardByTitle(articleTitle).locator("a.preview-link");
  }

  articleTags(articleTitle: string): Locator {
    return this.articleCardByTitle(articleTitle).locator(
      ".tag-list .tag-pill, .tag-list .tag-default",
    );
  }

  articleTag(articleTitle: string, tagName: string): Locator {
    return this.articleTags(articleTitle).filter({ hasText: tagName });
  }

  readMoreLink(articleTitle: string): Locator {
    return this.articleCardByTitle(articleTitle).getByText("Read more...", {
      exact: true,
    });
  }

  activeFeedOrTag(name: string): Locator {
    return this.page
      .locator(
        ".nav-pills .nav-link.active, .feed-toggle .nav-link.active, .nav-pills .active",
      )
      .filter({ hasText: name })
      .first();
  }
}

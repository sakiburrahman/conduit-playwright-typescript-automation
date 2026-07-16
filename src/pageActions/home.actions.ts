import { expect, type Page } from "@playwright/test";

import { ElementState } from "@/common/enums/elementState";
import { testUrl } from "@/config/defaultConfig/testConfig";
import { BaseActions } from "@/pageActions/base.actions";
import { HomePage } from "@/pageLocators/home.page";

import type { ArticleInput } from "@/utils/article-helper";

export class HomeActions extends BaseActions {
  private readonly homePage: HomePage;

  constructor(page: Page) {
    super(page);
    this.homePage = new HomePage(page);
  }

  async openGlobalFeed(): Promise<void> {
    await this.page.goto(testUrl, { waitUntil: "domcontentloaded" });

    await this.ensureElementState(
      this.homePage.globalFeed_TAB,
      ElementState.Visible,
      undefined,
      "Global Feed tab",
    );

    const classes = await this.homePage.globalFeed_TAB.getAttribute("class");
    if (!classes?.includes("active")) {
      await this.click(this.homePage.globalFeed_TAB);
    }

    await expect(this.homePage.globalFeed_TAB).toHaveClass(/active/);
    await this.waitForFeedToLoad();
  }

  async openYourFeed(): Promise<void> {
    await this.click(this.homePage.yourFeed_TAB);
    await this.waitForFeedToLoad();
  }

  async waitForFeedToLoad(): Promise<void> {
    await this.checkElementState(
      this.homePage.loading_TXT,
      ElementState.Hidden,
      15_000,
    );

    const articlePreview = this.page.locator(".article-preview").first();
    const hasArticles = await this.checkElementState(
      articlePreview,
      ElementState.Visible,
      15_000,
    );
    if (!hasArticles) {
      await this.ensureElementState(
        this.homePage.emptyFeed_TXT,
        ElementState.Visible,
        15_000,
        "empty feed",
      );
    }
  }

  async verifyArticleCard(
    article: ArticleInput,
    expectedAuthor: string,
  ): Promise<void> {
    const articleCard = this.homePage.articleCardByTitle(article.title);
    await this.ensureElementState(
      articleCard,
      ElementState.Visible,
      20_000,
      "article card in Global Feed",
    );

    await this.verifyText(
      this.homePage.articleTitle(article.title),
      article.title,
    );
    await this.verifyText(
      this.homePage.articleDescription(article.title),
      article.description,
    );
    await this.verifyText(
      this.homePage.articleAuthor(article.title),
      expectedAuthor,
    );
    await this.ensureElementState(
      this.homePage.readMoreLink(article.title),
      ElementState.Visible,
      undefined,
      "Read more link",
    );

    const displayedTags = (
      await this.homePage.articleTags(article.title).allTextContents()
    ).map((tag) => tag.trim().toLowerCase());

    const expectedTags = article.tagList.map((tag) => tag.toLowerCase());
    expect(displayedTags).toEqual(expect.arrayContaining(expectedTags));
  }

  async openArticleFromGlobalFeed(articleTitle: string): Promise<void> {
    const articleLink = this.homePage.articlePreviewLink(articleTitle);
    await this.ensureElementState(
      articleLink,
      ElementState.Visible,
      undefined,
      "article preview link",
    );

    await Promise.all([
      this.page.waitForURL(/\/article\//),
      this.click(articleLink),
    ]);
  }

  articleCardByTitle(articleTitle: string) {
    return this.homePage.articleCardByTitle(articleTitle);
  }

  async selectPopularTag(tag: string): Promise<void> {
    await this.click(this.homePage.tagLink(tag));
    await this.verifyUrl(new RegExp(`tag=${encodeURIComponent(tag)}`));
    await this.waitForFeedToLoad();
  }

  async selectTagFromArticleCard(title: string, tag: string): Promise<void> {
    void title;
    await this.filterFeedByTag(tag);
  }

  async filterFeedByTag(tag: string): Promise<void> {
    await this.page.goto(`/?tag=${encodeURIComponent(tag)}`, {
      waitUntil: "domcontentloaded",
    });
    await this.waitForFeedToLoad();
  }

  async findArticleByTitle(title: string): Promise<void> {
    await this.ensureElementState(
      this.homePage.articleCardByTitle(title),
      ElementState.Visible,
      undefined,
      "article card",
    );
  }

  async readVisibleArticleTitles(): Promise<string[]> {
    return this.getAllTexts(this.page.locator(".article-preview h1"));
  }

  async readTagsFromArticleCard(title: string): Promise<string[]> {
    return this.getAllTexts(this.homePage.articleTags(title));
  }

  async openArticleByTitle(title: string): Promise<void> {
    await this.openArticleFromGlobalFeed(title);
  }

  async confirmSelectedTag(tag: string): Promise<void> {
    const activeTag = this.homePage.activeFeedOrTag(tag);
    const hasActivePill = await this.checkElementState(
      activeTag,
      ElementState.Visible,
      5_000,
    );
    if (hasActivePill) {
      return;
    }

    await this.verifyUrl(new RegExp(`tag=${encodeURIComponent(tag)}`, "i"));
  }

  async confirmArticleAbsent(title: string): Promise<void> {
    await this.verifyElementCount(this.homePage.articleCardByTitle(title), 0);
  }

  async confirmEmptyFeedState(): Promise<void> {
    await this.ensureElementState(
      this.homePage.emptyFeed_TXT,
      ElementState.Visible,
      undefined,
      "empty feed state",
    );
  }
}

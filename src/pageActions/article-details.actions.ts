import { expect, type Page } from "@playwright/test";

import { ElementState } from "@/common/enums/elementState";
import { BaseActions } from "@/pageActions/base.actions";
import { ArticleDetailsPage } from "@/pageLocators/article-details.page";

import type { ArticleInput } from "@/utils/article-helper";

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export class ArticleDetailsActions extends BaseActions {
  private readonly locators: ArticleDetailsPage;

  constructor(page: Page) {
    super(page);
    this.locators = new ArticleDetailsPage(page);
  }

  async waitForArticleDetails(title?: string): Promise<void> {
    await this.verifyUrl(/\/article\//);
    await this.ensureElementState(
      this.locators.title_TXT,
      ElementState.Visible,
      undefined,
      "article title",
    );
    if (title) {
      await this.verifyText(this.locators.title_TXT, title);
    }
  }

  async readTitle(): Promise<string> {
    await this.ensureElementState(
      this.locators.title_TXT,
      ElementState.Visible,
      undefined,
      "article title",
    );
    return normalizeWhitespace(await this.getText(this.locators.title_TXT));
  }

  async readBody(): Promise<string> {
    await this.ensureElementState(
      this.locators.body_TXT,
      ElementState.Visible,
      undefined,
      "article body",
    );
    return normalizeWhitespace(await this.getText(this.locators.body_TXT));
  }

  async readAuthor(): Promise<string> {
    const author = this.locators.meta.locator("a.author").first();
    await this.ensureElementState(
      author,
      ElementState.Visible,
      undefined,
      "article author",
    );
    return normalizeWhitespace(await this.getText(author));
  }

  async readDisplayedTags(): Promise<string[]> {
    return this.getAllTexts(
      this.page.locator(".tag-list .tag-pill, .tag-list .tag-default"),
    );
  }

  async navigateToEdit(): Promise<void> {
    await this.click(this.locators.editArticle_BTN);
    await this.verifyUrl(/\/editor\//);
  }

  async deleteArticle(): Promise<void> {
    this.page.once("dialog", (dialog) => {
      void dialog.accept();
    });
    await this.click(this.locators.deleteArticle_BTN);
  }

  async verifyArticleDetails(
    article: ArticleInput,
    expectedAuthor: string,
  ): Promise<void> {
    await expect(this.page).toHaveURL(/\/article\//);

    await this.verifyText(this.locators.title_TXT, article.title);
    await this.verifyText(this.locators.articleAuthor, expectedAuthor);
    await this.verifyText(
      this.locators.articleBodyContainer.first(),
      article.body.split("\n")[0] ?? article.body,
      "contains",
    );

    const displayedTags = (
      await this.locators.articleTags.allTextContents()
    ).map((tag) => tag.trim().toLowerCase());
    const expectedTags = article.tagList.map((tag) => tag.toLowerCase());
    expect(displayedTags).toEqual(expect.arrayContaining(expectedTags));
  }

  async confirmArticleDetails(
    article: ArticleInput,
    author: string,
  ): Promise<void> {
    await this.verifyArticleDetails(article, author);
    await this.ensureElementState(
      this.locators.editArticle_BTN,
      [ElementState.Visible, ElementState.Enabled],
      undefined,
      "edit article button",
    );
    await this.ensureElementState(
      this.locators.deleteArticle_BTN,
      [ElementState.Visible, ElementState.Enabled],
      undefined,
      "delete article button",
    );
  }

  async confirmAuthorActionsHidden(): Promise<void> {
    await this.verifyElementCount(this.locators.editArticle_BTN, 0);
    await this.verifyElementCount(this.locators.deleteArticle_BTN, 0);
  }

  async confirmDetailsPersistAfterReload(article: ArticleInput): Promise<void> {
    await this.reloadPage();
    await this.ensureElementState(
      this.locators.title_TXT,
      ElementState.Visible,
      undefined,
      "article title after reload",
    );
    await this.verifyText(this.locators.title_TXT, article.title);
    await this.verifyText(
      this.locators.body_TXT,
      article.body.split("\n")[0] ?? article.body,
      "contains",
    );
  }

  async openArticleById(articleId: string): Promise<void> {
    await this.navigateTo(`/article/${articleId}`);
  }

  async expectArticleNotFoundOrUnavailable(
    requestedArticleId?: string,
  ): Promise<void> {
    const notFound = this.page
      .getByText(/not found|404|No articles|error/i)
      .first();
    const found = await this.checkElementState(
      notFound,
      ElementState.Visible,
      5_000,
    );
    if (found) {
      return;
    }

    await this.verifyUrl(/\/($|\?)/);
    if (requestedArticleId) {
      const currentUrl = this.getUrl();
      if (currentUrl.includes(`/article/${requestedArticleId}`)) {
        throw new Error(
          `Expected redirect away from missing article "${requestedArticleId}", but URL was ${currentUrl}`,
        );
      }
    }
    await this.verifyElementCount(this.locators.editArticle_BTN, 0);
    await this.verifyElementCount(this.locators.deleteArticle_BTN, 0);
  }
}

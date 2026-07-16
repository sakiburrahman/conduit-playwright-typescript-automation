import { type Page } from "@playwright/test";

import { ElementState } from "@/common/enums/elementState";
import { BaseActions } from "@/pageActions/base.actions";
import { ArticleEditorPage } from "@/pageLocators/article-editor.page";

import type { ArticleInput } from "@/utils/article-helper";

export class ArticleEditorActions extends BaseActions {
  private readonly locators: ArticleEditorPage;

  constructor(page: Page) {
    super(page);
    this.locators = new ArticleEditorPage(page);
  }

  async verifyEditorDisplayed(): Promise<void> {
    await this.ensureElementState(
      this.locators.title_IN,
      [ElementState.Visible, ElementState.Editable],
      undefined,
      "article title input",
    );
    await this.ensureElementState(
      this.locators.description_IN,
      [ElementState.Visible, ElementState.Editable],
      undefined,
      "article description input",
    );
    await this.ensureElementState(
      this.locators.body_TA,
      [ElementState.Visible, ElementState.Editable],
      undefined,
      "article body input",
    );
    await this.ensureElementState(
      this.locators.publish_BTN,
      [ElementState.Visible, ElementState.Enabled],
      undefined,
      "publish button",
    );
  }

  async addTag(tag: string): Promise<void> {
    await this.fill(this.locators.tags_IN, tag);
    await this.pressKeyOn(this.locators.tags_IN, "Enter");
  }

  async removeTag(tag: string): Promise<void> {
    await this.click(this.locators.removeTagButton(tag));
  }

  async fillArticleForm(article: ArticleInput): Promise<void> {
    await this.fill(this.locators.title_IN, article.title);
    await this.fill(this.locators.description_IN, article.description);
    await this.fill(this.locators.body_TA, article.body);
    for (const tag of article.tagList) {
      await this.addTag(tag);
    }
  }

  async createArticle(article: ArticleInput): Promise<void> {
    await this.fillArticleForm(article);
    await Promise.all([
      this.page.waitForURL(/\/article\//),
      this.click(this.locators.publish_BTN),
    ]);
  }

  async updateArticle(article: ArticleInput): Promise<void> {
    await this.fill(this.locators.title_IN, article.title);
    await this.fill(this.locators.description_IN, article.description);
    await this.fill(this.locators.body_TA, article.body);

    const existingTags = await this.getAllTexts(this.locators.tagPills);
    for (const tag of existingTags) {
      const cleaned = tag.replace(/\s*×\s*$/, "").trim();
      if (cleaned) {
        await this.removeTag(cleaned).catch(() => undefined);
      }
    }

    for (const tag of article.tagList) {
      await this.addTag(tag);
    }

    await Promise.all([
      this.page.waitForURL(/\/article\//),
      this.click(this.locators.publish_BTN),
    ]);
  }

  async clearRequiredField(
    field: "title" | "description" | "body",
  ): Promise<void> {
    const locator =
      field === "title"
        ? this.locators.title_IN
        : field === "description"
          ? this.locators.description_IN
          : this.locators.body_TA;
    await this.clear(locator);
  }

  async submitInvalidArticleData(
    article: Partial<ArticleInput>,
  ): Promise<void> {
    if (article.title !== undefined) {
      await this.fill(this.locators.title_IN, article.title);
    }
    if (article.description !== undefined) {
      await this.fill(this.locators.description_IN, article.description);
    }
    if (article.body !== undefined) {
      await this.fill(this.locators.body_TA, article.body);
    }

    await this.ensureElementState(
      this.locators.publish_BTN,
      ElementState.Visible,
      undefined,
      "publish button",
    );
    const canPublish = await this.checkElementState(
      this.locators.publish_BTN,
      ElementState.Enabled,
    );
    if (canPublish) {
      await this.click(this.locators.publish_BTN);
    }
  }

  async readEditorErrors(): Promise<string> {
    await this.ensureElementState(
      this.locators.errorMessages,
      ElementState.Visible,
      15_000,
      "editor validation errors",
    );
    return this.getText(this.locators.errorMessages);
  }

  async expectStillOnEditor(): Promise<void> {
    await this.verifyUrl(/\/editor/);
    await this.ensureElementState(
      this.locators.title_IN,
      ElementState.Visible,
      undefined,
      "editor title input",
    );
  }

  async expectValidationError(message: string): Promise<void> {
    await this.ensureElementState(
      this.page.getByText(message, { exact: true }),
      ElementState.Visible,
      15_000,
      `validation error: ${message}`,
    );
  }
}

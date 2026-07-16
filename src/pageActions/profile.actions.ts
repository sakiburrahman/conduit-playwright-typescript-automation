import { type Page } from "@playwright/test";

import { ElementState } from "@/common/enums/elementState";
import { BaseActions } from "@/pageActions/base.actions";
import { ProfilePage } from "@/pageLocators/profile.page";

export class ProfileActions extends BaseActions {
  private readonly locators: ProfilePage;

  constructor(page: Page) {
    super(page);
    this.locators = new ProfilePage(page);
  }

  async openProfileByUsername(username: string): Promise<void> {
    await this.navigateTo(`/profile/${username}`);
    await this.ensureElementState(
      this.locators.username_TXT,
      ElementState.Visible,
      undefined,
      "profile username",
    );
  }

  async readDisplayedUsername(): Promise<string> {
    await this.ensureElementState(
      this.locators.username_TXT,
      ElementState.Visible,
      undefined,
      "profile username",
    );
    return this.getText(this.locators.username_TXT);
  }

  async readDisplayedBio(): Promise<string> {
    await this.ensureElementState(
      this.locators.bio_TXT,
      ElementState.Visible,
      undefined,
      "profile bio",
    );
    return this.getText(this.locators.bio_TXT);
  }

  async readImageSource(): Promise<string> {
    return this.getAttribute(this.locators.image_IMG, "src");
  }

  async confirmArticleInMyArticles(title: string): Promise<void> {
    await this.click(this.locators.myArticles_TAB);
    await this.ensureElementState(
      this.locators.articleByTitle(title),
      ElementState.Visible,
      undefined,
      "profile article",
    );
  }

  async confirmArticleAbsent(title: string): Promise<void> {
    await this.click(this.locators.myArticles_TAB);
    await this.verifyElementCount(this.locators.articleByTitle(title), 0);
  }

  async navigateToProfileSettings(): Promise<void> {
    await this.click(this.locators.editProfileSettings_BTN);
    await this.verifyUrl(/\/settings/);
  }

  async confirmProfileUsername(username: string): Promise<void> {
    await this.ensureElementState(
      this.locators.username_TXT,
      ElementState.Visible,
      undefined,
      "profile username heading",
    );
    await this.verifyText(this.locators.username_TXT, username);
  }
}

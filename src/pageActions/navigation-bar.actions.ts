import { type Page } from "@playwright/test";

import { ElementState } from "@/common/enums/elementState";
import { testUrl } from "@/config/defaultConfig/testConfig";
import { BaseActions } from "@/pageActions/base.actions";
import { NavigationBarPage } from "@/pageLocators/navigation-bar.page";

export class NavigationBarActions extends BaseActions {
  private readonly navigationBarPage: NavigationBarPage;

  constructor(page: Page) {
    super(page);
    this.navigationBarPage = new NavigationBarPage(page);
  }

  async navigateToHome(): Promise<void> {
    await this.click(this.navigationBarPage.home_LK);
    await this.verifyUrl(/\/$|\/\?/);
  }

  async navigateToNewArticle(): Promise<void> {
    await this.click(this.navigationBarPage.newArticle_LK);
    await this.verifyUrl(/\/editor$/);
  }

  async navigateToSettings(): Promise<void> {
    await this.click(this.navigationBarPage.settings_LK);
    await this.verifyUrl(/\/settings$/);
  }

  async navigateToProfile(username: string): Promise<void> {
    await this.click(this.navigationBarPage.usernameLink(username));
    await this.verifyUrl(new RegExp(`/profile/${username}`));
  }

  async confirmAuthenticatedMenu(username: string): Promise<void> {
    const homeVisible = await this.checkElementState(
      this.navigationBarPage.home_LK,
      ElementState.Visible,
      5_000,
      false,
    );
    if (!homeVisible) {
      await this.navigateTo(testUrl);
    }

    await this.ensureElementState(
      this.navigationBarPage.home_LK,
      ElementState.Visible,
      undefined,
      "home link",
    );
    await this.ensureElementState(
      this.navigationBarPage.newArticle_LK,
      ElementState.Visible,
      undefined,
      "new article link",
    );
    await this.ensureElementState(
      this.navigationBarPage.settings_LK,
      ElementState.Visible,
      undefined,
      "settings link",
    );
    await this.ensureElementState(
      this.navigationBarPage.usernameLink(username),
      ElementState.Visible,
      undefined,
      "username link",
    );
    await this.verifyElementCount(this.navigationBarPage.signIn_LK, 0);
    await this.verifyElementCount(this.navigationBarPage.signUp_LK, 0);
  }

  async confirmUnauthenticatedMenu(): Promise<void> {
    await this.ensureElementState(
      this.navigationBarPage.home_LK,
      ElementState.Visible,
      undefined,
      "home link",
    );
    await this.ensureElementState(
      this.navigationBarPage.signIn_LK,
      ElementState.Visible,
      undefined,
      "sign in link",
    );
    await this.ensureElementState(
      this.navigationBarPage.signUp_LK,
      ElementState.Visible,
      undefined,
      "sign up link",
    );
    await this.verifyElementCount(this.navigationBarPage.newArticle_LK, 0);
    await this.verifyElementCount(this.navigationBarPage.settings_LK, 0);
  }

  async verifySettingsLinkIsDisplayed(): Promise<void> {
    await this.ensureElementState(
      this.navigationBarPage.settings_LK,
      ElementState.Visible,
      undefined,
      "settings link",
    );
  }

  async verifyUsernameMatchesApiData(username: string): Promise<void> {
    const usernameLink = this.navigationBarPage.getNavigationUsername(username);
    await this.ensureElementState(
      usernameLink,
      ElementState.Visible,
      undefined,
      "username link",
    );
    await this.verifyText(usernameLink, username);
  }

  async confirmNavigationUsername(username: string): Promise<void> {
    await this.verifyUsernameMatchesApiData(username);
  }
}

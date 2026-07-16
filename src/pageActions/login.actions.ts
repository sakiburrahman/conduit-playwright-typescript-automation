import { type Page } from "@playwright/test";

import { ElementState } from "@/common/enums/elementState";
import { BaseActions } from "@/pageActions/base.actions";
import { LoginPage } from "@/pageLocators/login.page";
import { NavigationBarPage } from "@/pageLocators/navigation-bar.page";
import { Logger } from "@/utils/logger";

export class LoginActions extends BaseActions {
  private readonly loginPage: LoginPage;
  private readonly navigationBarPage: NavigationBarPage;

  constructor(page: Page) {
    super(page);
    this.loginPage = new LoginPage(page);
    this.navigationBarPage = new NavigationBarPage(page);
  }

  async navigateToLogin(): Promise<void> {
    await this.navigateTo("/login");
    await this.ensureElementState(
      this.loginPage.heading,
      ElementState.Visible,
      undefined,
      "login heading",
    );
  }

  async login(email: string, password: string): Promise<void> {
    Logger.logInfo("Performing UI login");
    await this.fill(this.loginPage.email_IN, email);
    await this.fill(this.loginPage.password_IN, password);
    await this.click(this.loginPage.login_BTN);
    Logger.logSuccess("Login form submitted");
  }

  async submitInvalidCredentials(
    email: string,
    password: string,
  ): Promise<void> {
    await this.navigateToLogin();
    await this.login(email, password);
    await this.ensureElementState(
      this.loginPage.invalidCredentialsError,
      ElementState.Visible,
      undefined,
      "invalid credentials error",
    );
  }

  async expectInvalidCredentialsError(): Promise<void> {
    await this.ensureElementState(
      this.loginPage.invalidCredentialsError,
      ElementState.Visible,
      undefined,
      "email or password is invalid",
    );
  }

  async readAuthenticationErrors(): Promise<string> {
    await this.ensureElementState(
      this.loginPage.errorMessages,
      ElementState.Visible,
      undefined,
      "login error messages",
    );
    return this.getText(this.loginPage.errorMessages);
  }

  async confirmAuthenticatedNavigation(username: string): Promise<void> {
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
  }
}

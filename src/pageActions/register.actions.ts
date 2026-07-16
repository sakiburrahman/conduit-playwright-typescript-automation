import { type Page } from "@playwright/test";

import { ElementState } from "@/common/enums/elementState";
import { BaseActions } from "@/pageActions/base.actions";
import { NavigationBarActions } from "@/pageActions/navigation-bar.actions";
import { RegisterPage } from "@/pageLocators/register.page";

import type { GeneratedUser } from "@/utils/user-helper";

export class RegisterActions extends BaseActions {
  private readonly locators: RegisterPage;
  private readonly navigationBarActions: NavigationBarActions;

  constructor(page: Page) {
    super(page);
    this.locators = new RegisterPage(page);
    this.navigationBarActions = new NavigationBarActions(page);
  }

  async navigateToRegistration(): Promise<void> {
    await this.navigateTo("/register");
    await this.ensureElementState(
      this.locators.heading,
      ElementState.Visible,
      undefined,
      "sign up heading",
    );
  }

  async registerUser(user: GeneratedUser): Promise<void> {
    await this.fill(this.locators.username_IN, user.username);
    await this.fill(this.locators.email_IN, user.email);
    await this.fill(this.locators.password_IN, user.password);
    await this.click(this.locators.signUp_BTN);
  }

  async readRegistrationErrors(): Promise<string[]> {
    await this.ensureElementState(
      this.locators.errorMessages.first(),
      ElementState.Visible,
      undefined,
      "registration errors",
    );
    return this.locators.errorMessages.allTextContents();
  }

  async confirmSuccessfulRegistration(expectedUsername: string): Promise<void> {
    await this.verifyUrl(/\/$|\/\?/);
    await this.navigationBarActions.confirmAuthenticatedMenu(expectedUsername);
    await this.navigationBarActions.verifyUsernameMatchesApiData(
      expectedUsername,
    );
  }
}

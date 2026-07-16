import { expect } from "@playwright/test";

import { ElementState } from "@/common/enums/elementState";
import { timeConfig } from "@/config/defaultConfig/testConfig";
import { Logger } from "@/utils/logger";

import type { Locator, Page } from "@playwright/test";

export class BaseActions {
  protected readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  private handleError(error: unknown, errorMessage: string): never {
    Logger.handleError(error, errorMessage);
    throw error instanceof Error ? error : new Error(errorMessage);
  }

  private async executeWithErrorHandling<T>(
    operation: () => Promise<T>,
    errorMessage: string,
  ): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      return this.handleError(error, errorMessage);
    }
  }

  private async performAction(
    action: () => Promise<void>,
    actionName: string,
  ): Promise<void> {
    try {
      Logger.logInfo(`${actionName} element`);
      await action();
      Logger.logSuccess(`${actionName} completed`);
    } catch (error) {
      this.handleError(error, `Failed to ${actionName.toLowerCase()}`);
    }
  }

  private async verifyWithExpect(
    expectFn: () => Promise<void>,
    logMessage: string,
    errorMessage: string,
  ): Promise<void> {
    try {
      await expectFn();
      Logger.logSuccess(logMessage);
    } catch (error) {
      this.handleError(error, errorMessage);
    }
  }

  async navigateTo(
    url: string,
    timeout: number = timeConfig.navigationTimeout,
  ): Promise<void> {
    await this.executeWithErrorHandling(async () => {
      await this.page.goto(url, {
        timeout,
        waitUntil: "domcontentloaded",
      });
      Logger.logSuccess(`Navigated to ${url}`);
    }, `Failed to navigate to ${url}`);
  }

  getUrl(): string {
    return this.page.url();
  }

  async verifyUrl(
    expectedUrl: string | RegExp,
    timeout: number = timeConfig.expectTimeout,
  ): Promise<void> {
    await this.verifyWithExpect(
      () => expect(this.page).toHaveURL(expectedUrl, { timeout }),
      `Verifying URL: ${expectedUrl}`,
      `URL verification failed. Expected: ${expectedUrl}`,
    );
  }

  async checkElementState(
    locator: Locator,
    states: ElementState | ElementState[] | "all" = ElementState.Visible,
    timeout: number = timeConfig.elementStateTimeout,
    throwOnFailure = false,
    actionDescription?: string,
  ): Promise<boolean> {
    const stateArray =
      states === "all"
        ? Object.values(ElementState)
        : Array.isArray(states)
          ? states
          : [states];

    const stateChecks: Record<ElementState, () => Promise<void>> = {
      [ElementState.Visible]: () => expect(locator).toBeVisible({ timeout }),
      [ElementState.Enabled]: () => expect(locator).toBeEnabled({ timeout }),
      [ElementState.Editable]: () => expect(locator).toBeEditable({ timeout }),
      [ElementState.Hidden]: () => expect(locator).toBeHidden({ timeout }),
      [ElementState.Attached]: () => expect(locator).toBeAttached({ timeout }),
      [ElementState.Detached]: () =>
        expect(locator).toHaveCount(0, { timeout }),
      [ElementState.Checked]: () => expect(locator).toBeChecked({ timeout }),
      [ElementState.Disabled]: () => expect(locator).toBeDisabled({ timeout }),
      [ElementState.BeEmpty]: () => expect(locator).toBeEmpty({ timeout }),
      [ElementState.BeFocused]: () => expect(locator).toBeFocused({ timeout }),
    };

    for (const state of stateArray) {
      const checkFn = stateChecks[state];
      if (checkFn === undefined) {
        const error = new Error(`Unsupported state: ${state}`);
        if (throwOnFailure) {
          Logger.handleError(error, "State check");
          throw error;
        }
        Logger.logWarning(`Unsupported state: ${state}`);
        return false;
      }

      try {
        await checkFn();
      } catch (error) {
        if (throwOnFailure) {
          const message = actionDescription
            ? `Element did not satisfy required state "${state}" before ${actionDescription}`
            : `Element did not satisfy required state "${state}"`;
          Logger.handleError(error, message);
          throw new Error(message);
        }
        return false;
      }
    }

    return true;
  }

  protected async ensureElementState(
    locator: Locator,
    states: ElementState | ElementState[] | "all",
    timeout: number | undefined,
    actionDescription: string,
  ): Promise<void> {
    await this.checkElementState(
      locator,
      states,
      timeout ?? timeConfig.elementStateTimeout,
      true,
      actionDescription,
    );
  }

  async click(
    locator: Locator,
    timeout: number = timeConfig.defaultWaitTimeout,
  ): Promise<void> {
    await this.ensureElementState(
      locator,
      [ElementState.Visible, ElementState.Enabled],
      timeout,
      "click",
    );
    await this.performAction(() => locator.click({ timeout }), "Clicking");
  }

  async fill(
    locator: Locator,
    text: string,
    timeout: number = timeConfig.defaultWaitTimeout,
  ): Promise<void> {
    await this.ensureElementState(
      locator,
      [ElementState.Visible, ElementState.Editable],
      timeout,
      "fill",
    );
    await this.performAction(async () => {
      await locator.fill("", { timeout });
      await locator.fill(text, { timeout });
    }, `Filling with text: "${text}"`);
  }

  async clear(
    locator: Locator,
    timeout: number = timeConfig.defaultWaitTimeout,
  ): Promise<void> {
    await this.ensureElementState(
      locator,
      [ElementState.Visible, ElementState.Editable],
      timeout,
      "clear",
    );
    await this.performAction(
      () => locator.fill("", { timeout }),
      "Clearing input",
    );
  }

  async pressKeyOn(
    locator: Locator,
    key: string,
    timeout: number = timeConfig.defaultWaitTimeout,
  ): Promise<void> {
    await this.ensureElementState(
      locator,
      ElementState.Visible,
      timeout,
      `press ${key}`,
    );
    await this.performAction(
      () => locator.press(key, { timeout }),
      `Pressing key "${key}"`,
    );
  }

  async reloadPage(
    timeout: number = timeConfig.navigationTimeout,
  ): Promise<void> {
    await this.executeWithErrorHandling(async () => {
      await this.page.reload({
        timeout,
        waitUntil: "domcontentloaded",
      });
      Logger.logSuccess("Page reloaded");
    }, "Failed to reload page");
  }

  async verifyText(
    locator: Locator,
    expectedText: string | RegExp,
    matchType: "exact" | "contains" = "exact",
    timeout: number = timeConfig.defaultWaitTimeout,
  ): Promise<void> {
    const textToLog =
      typeof expectedText === "string" ? expectedText : expectedText.source;

    try {
      switch (matchType) {
        case "exact": {
          const normalizedText =
            typeof expectedText === "string"
              ? expectedText.trim()
              : expectedText;
          await expect(locator).toHaveText(normalizedText, { timeout });
          break;
        }
        case "contains":
          await expect(locator).toContainText(expectedText, { timeout });
          break;
        default: {
          const _exhaustive: never = matchType;
          throw new Error(`Unknown match type: ${String(_exhaustive)}`);
        }
      }

      Logger.logSuccess(`Text verified (${matchType}): "${textToLog}"`);
    } catch (error) {
      this.handleError(
        error,
        `Text verification failed (${matchType}): "${textToLog}"`,
      );
    }
  }

  async getText(
    locator: Locator,
    timeout: number = timeConfig.defaultWaitTimeout,
  ): Promise<string> {
    return this.executeWithErrorHandling(async () => {
      const text = (await locator.textContent({ timeout })) ?? "";
      return text.trim();
    }, "Failed to get text from element");
  }

  async getAllTexts(locator: Locator): Promise<string[]> {
    return this.executeWithErrorHandling(async () => {
      const texts = await locator.allTextContents();
      return texts.map((text) => text.trim()).filter(Boolean);
    }, "Failed to get all texts from elements");
  }

  async getAttribute(
    locator: Locator,
    attribute: string,
    timeout: number = timeConfig.defaultWaitTimeout,
  ): Promise<string> {
    return this.executeWithErrorHandling(async () => {
      await locator.waitFor({ state: "attached", timeout });
      return (await locator.getAttribute(attribute)) ?? "";
    }, `Failed to get attribute "${attribute}"`);
  }

  async verifyElementCount(
    locator: Locator,
    expectedCount: number,
    timeout: number = timeConfig.defaultWaitTimeout,
  ): Promise<void> {
    await this.verifyWithExpect(
      () => expect(locator).toHaveCount(expectedCount, { timeout }),
      `Verifying element count: ${expectedCount}`,
      `Element count verification failed. Expected: ${expectedCount}`,
    );
  }
}

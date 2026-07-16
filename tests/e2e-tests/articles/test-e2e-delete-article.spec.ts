/* eslint-disable playwright/expect-expect -- UI assertions are performed in page-action helpers */
import { TestTags } from "@/common/enums/testTags";
import { expect, test } from "@/common/fixtures/customFixtures";
import { testUrl } from "@/config/defaultConfig/testConfig";
import { ArticleApiHelper } from "@/utils/api-helper";
import { buildRandomUser, generateRandomArticle } from "@/utils/data-generator";

import type { CreatedArticleFixture } from "@/utils/article-helper";

test.describe("Test Delete Article Functionality", () => {
  let createdArticle: CreatedArticleFixture;
  let articleApiHelper: ArticleApiHelper;
  let authToken: string;

  test.beforeEach(async ({ request }) => {
    articleApiHelper = new ArticleApiHelper(request);
    authToken = await articleApiHelper.loginAndGetToken();
    createdArticle = await articleApiHelper.createArticle(
      generateRandomArticle().article,
      authToken,
    );
    expect(createdArticle.articleId).toBeTruthy();
  });

  test.afterEach(async ({}, testInfo) => {
    if (
      !createdArticle?.articleId ||
      testInfo.title.includes("CONDUIT-TC-0012")
    ) {
      return;
    }
    await articleApiHelper
      .deleteArticle(createdArticle.articleId, authToken)
      .catch(() => undefined);
  });

  test(
    "CONDUIT-TC-0012: Verify that an authenticated user can delete an article",
    {
      tag: [
        TestTags.E2E.REGRESSION,
        TestTags.E2E.POSITIVE,
        TestTags.FEATURE.ARTICLE,
        TestTags.SCENARIO.DELETE_ARTICLE,
      ],
    },
    async ({
      generatedUser,
      navigationBarActions,
      articleDetailsActions,
      profileActions,
      homeActions,
    }) => {
      await navigationBarActions.confirmAuthenticatedMenu(
        generatedUser.username,
      );

      await articleDetailsActions.openArticleById(createdArticle.articleId);
      await articleDetailsActions.waitForArticleDetails(createdArticle.title);
      await articleDetailsActions.confirmArticleDetails(
        {
          title: createdArticle.title,
          description: createdArticle.description,
          body: createdArticle.body,
          tagList: createdArticle.tagList,
        },
        generatedUser.username,
      );

      const deletedId = createdArticle.articleId;
      await articleDetailsActions.deleteArticle();
      await homeActions.waitForFeedToLoad();

      await profileActions.openProfileByUsername(generatedUser.username);
      await profileActions.confirmArticleAbsent(createdArticle.title);

      await articleApiHelper.expectArticleAbsent(deletedId, authToken);
      createdArticle = { ...createdArticle, articleId: "" };
    },
  );

  test(
    "CONDUIT-TC-0013: Verify that Edit and Delete article buttons are hidden for non-authors",
    {
      tag: [
        TestTags.E2E.REGRESSION,
        TestTags.E2E.NEGATIVE,
        TestTags.FEATURE.ARTICLE,
        TestTags.SCENARIO.DELETE_ARTICLE,
      ],
    },
    async ({
      page,
      generatedUser,
      articleDetailsActions,
      navigationBarActions,
      settingsActions,
      registerActions,
    }) => {
      const otherUser = buildRandomUser(process.env.ENVIRONMENT ?? "DEV");

      await page.goto(testUrl);
      await navigationBarActions.confirmAuthenticatedMenu(
        generatedUser.username,
      );
      await settingsActions.openSettings();
      await settingsActions.logout();
      await navigationBarActions.confirmUnauthenticatedMenu();

      await registerActions.navigateToRegistration();
      await registerActions.registerUser(otherUser);
      await registerActions.confirmSuccessfulRegistration(otherUser.username);

      await articleDetailsActions.openArticleById(createdArticle.articleId);
      await articleDetailsActions.waitForArticleDetails(createdArticle.title);
      await articleDetailsActions.confirmAuthorActionsHidden();
    },
  );
});

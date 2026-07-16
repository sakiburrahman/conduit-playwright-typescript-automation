/* eslint-disable playwright/expect-expect -- UI assertions are performed in page-action helpers */
import { TestTags } from "@/common/enums/testTags";
import { expect, test } from "@/common/fixtures/customFixtures";
import { testUrl } from "@/config/defaultConfig/testConfig";
import { ArticleApiHelper } from "@/utils/api-helper";
import {
  articleIdFromUrl,
  verifyArticleFromGlobalFeed,
} from "@/utils/article-helper";
import { buildRandomUser, generateRandomArticle } from "@/utils/data-generator";

import type { CreatedArticleFixture } from "@/utils/article-helper";

test.describe("Test Edit Article Functionality", () => {
  let createdArticle: CreatedArticleFixture;
  let articleApiHelper: ArticleApiHelper;
  let authToken: string;
  let originalTitleForAbsenceCheck: string | undefined;

  test.beforeEach(async ({ request }) => {
    articleApiHelper = new ArticleApiHelper(request);
    authToken = await articleApiHelper.loginAndGetToken();
    createdArticle = await articleApiHelper.createArticle(
      generateRandomArticle().article,
      authToken,
    );
    expect(createdArticle.articleId).toBeTruthy();
  });

  test.afterEach(async () => {
    if (!createdArticle?.articleId) {
      return;
    }
    await articleApiHelper
      .deleteArticle(createdArticle.articleId, authToken)
      .catch(() => undefined);
  });

  test(
    "CONDUIT-TC-0009: Verify that an authenticated user can edit an article and validate the updated details in the Global Feed",
    {
      tag: [
        TestTags.E2E.REGRESSION,
        TestTags.E2E.POSITIVE,
        TestTags.FEATURE.ARTICLE,
        TestTags.SCENARIO.EDIT_ARTICLE,
      ],
    },
    async ({
      generatedUser,
      navigationBarActions,
      articleDetailsActions,
      articleEditorActions,
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

      originalTitleForAbsenceCheck = createdArticle.title;
      const updatedArticle = generateRandomArticle({
        title: `Updated ${createdArticle.title}`.slice(0, 100),
        description: "Updated article description",
        body: "This is the updated article body.",
        tagList: ["AI", "Updated"],
      }).article;

      await articleDetailsActions.navigateToEdit();
      await articleEditorActions.verifyEditorDisplayed();
      await articleEditorActions.updateArticle(updatedArticle);

      await homeActions.openGlobalFeed();
      await expect(
        homeActions.articleCardByTitle(originalTitleForAbsenceCheck),
      ).toHaveCount(0);

      await verifyArticleFromGlobalFeed(
        updatedArticle,
        generatedUser.username,
        homeActions,
        articleDetailsActions,
      );
      await articleDetailsActions.confirmDetailsPersistAfterReload(
        updatedArticle,
      );

      const updatedSlug =
        articleIdFromUrl(articleDetailsActions.getUrl()) ??
        createdArticle.articleId;
      const persisted = await articleApiHelper.getArticle(
        updatedSlug,
        authToken,
      );
      expect(persisted.title).toBe(updatedArticle.title);
      expect(persisted.description).toBe(updatedArticle.description);
      expect(persisted.body).toContain(
        updatedArticle.body.split("\n")[0] ?? updatedArticle.body,
      );

      createdArticle = {
        ...createdArticle,
        articleId: updatedSlug,
        title: updatedArticle.title,
        description: updatedArticle.description,
        body: updatedArticle.body,
        tagList: updatedArticle.tagList,
      };
    },
  );

  test(
    "CONDUIT-TC-0010: Verify that article editing is rejected when the title is blank",
    {
      tag: [
        TestTags.E2E.REGRESSION,
        TestTags.E2E.NEGATIVE,
        TestTags.FEATURE.ARTICLE,
        TestTags.SCENARIO.EDIT_ARTICLE,
      ],
    },
    async ({ articleDetailsActions, articleEditorActions }) => {
      await articleDetailsActions.openArticleById(createdArticle.articleId);
      await articleDetailsActions.waitForArticleDetails(createdArticle.title);
      await articleDetailsActions.navigateToEdit();
      await articleEditorActions.verifyEditorDisplayed();

      await articleEditorActions.clearRequiredField("title");
      await articleEditorActions.submitInvalidArticleData({
        description: createdArticle.description,
        body: createdArticle.body,
      });

      await articleEditorActions.expectStillOnEditor();
    },
  );

  test(
    "CONDUIT-TC-0011: Verify that Edit and Delete article buttons are hidden for non-authors",
    {
      tag: [
        TestTags.E2E.REGRESSION,
        TestTags.E2E.NEGATIVE,
        TestTags.FEATURE.ARTICLE,
        TestTags.SCENARIO.EDIT_ARTICLE,
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

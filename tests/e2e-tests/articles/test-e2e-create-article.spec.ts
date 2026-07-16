/* eslint-disable playwright/expect-expect -- UI assertions are performed in page-action helpers */
import { TestTags } from "@/common/enums/testTags";
import { expect, test } from "@/common/fixtures/customFixtures";
import {
  createArticleFromUi,
  verifyArticleFromGlobalFeed,
} from "@/utils/article-helper";
import { generateRandomArticle } from "@/utils/data-generator";

test.describe("Test Create Article Functionality", () => {
  test(
    "CONDUIT-TC-0004: Verify that an authenticated user can create an article and validate its details in the Global Feed and Article Details page",
    {
      tag: [
        TestTags.E2E.REGRESSION,
        TestTags.E2E.POSITIVE,
        TestTags.FEATURE.ARTICLE,
        TestTags.SCENARIO.CREATE_ARTICLE,
      ],
    },
    async ({
      generatedUser,
      navigationBarActions,
      articleEditorActions,
      homeActions,
      articleDetailsActions,
    }) => {
      const article = generateRandomArticle().article;
      let articleSlug: string | undefined;

      try {
        await navigationBarActions.confirmAuthenticatedMenu(
          generatedUser.username,
        );
        const created = await createArticleFromUi(
          article,
          generatedUser.username,
          navigationBarActions,
          articleEditorActions,
          articleDetailsActions,
        );
        articleSlug = created.articleId;
        expect(articleSlug).toBeTruthy();

        await verifyArticleFromGlobalFeed(
          article,
          generatedUser.username,
          homeActions,
          articleDetailsActions,
        );
      } finally {
        if (articleSlug) {
          try {
            await articleDetailsActions.openArticleById(articleSlug);
            await articleDetailsActions.deleteArticle();
          } catch {}
        }
      }
    },
  );

  test.describe("Test Create Article Validation Negative Scenarios", () => {
    test.beforeEach(
      async ({ generatedUser, navigationBarActions, articleEditorActions }) => {
        await navigationBarActions.confirmAuthenticatedMenu(
          generatedUser.username,
        );
        await navigationBarActions.navigateToNewArticle();
        await articleEditorActions.verifyEditorDisplayed();
      },
    );

    test(
      "CONDUIT-TC-0005: Verify that article creation is rejected when the title is blank",
      {
        tag: [
          TestTags.E2E.REGRESSION,
          TestTags.E2E.NEGATIVE,
          TestTags.FEATURE.ARTICLE,
          TestTags.SCENARIO.CREATE_ARTICLE,
        ],
      },
      async ({ articleEditorActions }) => {
        const article = generateRandomArticle().article;

        await articleEditorActions.submitInvalidArticleData({
          title: "",
          description: article.description,
          body: article.body,
        });

        await articleEditorActions.expectStillOnEditor();
        await articleEditorActions.expectValidationError(
          "title can't be blank",
        );
      },
    );

    test(
      "CONDUIT-TC-0006: Verify that article creation is rejected when the description is blank",
      {
        tag: [
          TestTags.E2E.REGRESSION,
          TestTags.E2E.NEGATIVE,
          TestTags.FEATURE.ARTICLE,
          TestTags.SCENARIO.CREATE_ARTICLE,
        ],
      },
      async ({ articleEditorActions }) => {
        const article = generateRandomArticle().article;

        await articleEditorActions.submitInvalidArticleData({
          title: article.title,
          description: "",
          body: article.body,
        });

        await articleEditorActions.expectStillOnEditor();
        await articleEditorActions.expectValidationError(
          "description can't be blank",
        );
      },
    );

    test(
      "CONDUIT-TC-0007: Verify that article creation is rejected when the body is blank",
      {
        tag: [
          TestTags.E2E.REGRESSION,
          TestTags.E2E.NEGATIVE,
          TestTags.FEATURE.ARTICLE,
          TestTags.SCENARIO.CREATE_ARTICLE,
        ],
      },
      async ({ articleEditorActions }) => {
        const article = generateRandomArticle().article;

        await articleEditorActions.submitInvalidArticleData({
          title: article.title,
          description: article.description,
          body: "",
        });

        await articleEditorActions.expectStillOnEditor();
        await articleEditorActions.expectValidationError("body can't be blank");
      },
    );

    test(
      "CONDUIT-TC-0008: Verify that article creation is rejected when the title is a duplicate",
      {
        tag: [
          TestTags.E2E.REGRESSION,
          TestTags.E2E.NEGATIVE,
          TestTags.FEATURE.ARTICLE,
          TestTags.SCENARIO.CREATE_ARTICLE,
        ],
      },
      async ({
        generatedUser,
        navigationBarActions,
        articleEditorActions,
        articleDetailsActions,
      }) => {
        const existing = generateRandomArticle().article;
        let articleSlug: string | undefined;

        try {
          const created = await createArticleFromUi(
            existing,
            generatedUser.username,
            navigationBarActions,
            articleEditorActions,
            articleDetailsActions,
          );
          articleSlug = created.articleId;

          await navigationBarActions.navigateToNewArticle();
          await articleEditorActions.verifyEditorDisplayed();
          await articleEditorActions.submitInvalidArticleData({
            title: existing.title,
            description: `Duplicate title probe ${Date.now()}`,
            body: `Duplicate title body ${Date.now()}`,
          });

          await articleEditorActions.expectStillOnEditor();
          await articleEditorActions.expectValidationError(
            "title must be unique",
          );
        } finally {
          if (articleSlug) {
            try {
              await articleDetailsActions.openArticleById(articleSlug);
              await articleDetailsActions.deleteArticle();
            } catch {}
          }
        }
      },
    );
  });
});

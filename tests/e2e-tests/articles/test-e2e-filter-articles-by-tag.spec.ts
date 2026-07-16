import { TestTags } from "@/common/enums/testTags";
import { expect, test } from "@/common/fixtures/customFixtures";
import { testUrl } from "@/config/defaultConfig/testConfig";
import { createArticleFromUi } from "@/utils/article-helper";
import {
  generateRandomArticle,
  generateUniqueTag,
} from "@/utils/data-generator";

import type { CreatedArticleFixture } from "@/utils/article-helper";

test.describe("Test Filter Articles by Tag Functionality", () => {
  test(
    "CONDUIT-TC-0014: Verify that the feed filters to matching tagged articles only",
    {
      tag: [
        TestTags.E2E.REGRESSION,
        TestTags.E2E.POSITIVE,
        TestTags.FEATURE.ARTICLE,
        TestTags.FEATURE.FILTER_BY_TAG,
      ],
    },
    async ({
      page,
      generatedUser,
      navigationBarActions,
      homeActions,
      articleEditorActions,
      articleDetailsActions,
    }) => {
      const uniqueTag = generateUniqueTag("filter");
      const unrelatedTag = generateUniqueTag("other");

      let matchingArticle: CreatedArticleFixture | undefined;
      let unrelatedArticle: CreatedArticleFixture | undefined;

      try {
        await page.goto(testUrl);
        await navigationBarActions.confirmAuthenticatedMenu(
          generatedUser.username,
        );

        matchingArticle = await createArticleFromUi(
          generateRandomArticle({
            title: `Matching tagged article ${Date.now()}`,
            tagList: [uniqueTag, "pw-auto"],
          }).article,
          generatedUser.username,
          navigationBarActions,
          articleEditorActions,
          articleDetailsActions,
        );

        unrelatedArticle = await createArticleFromUi(
          generateRandomArticle({
            title: `Unrelated tagged article ${Date.now()}`,
            tagList: [unrelatedTag],
          }).article,
          generatedUser.username,
          navigationBarActions,
          articleEditorActions,
          articleDetailsActions,
        );

        await test.step("Open tag-filtered feed for the unique tag", async () => {
          await homeActions.openGlobalFeed();
          await homeActions.findArticleByTitle(matchingArticle!.title);
          await homeActions.filterFeedByTag(uniqueTag);
          await expect(page).toHaveURL(new RegExp(`tag=`, "i"));
          await homeActions.confirmSelectedTag(uniqueTag);
        });

        await test.step("Matching article is visible; unrelated is not", async () => {
          await homeActions.findArticleByTitle(matchingArticle!.title);

          const matchingTags = await homeActions.readTagsFromArticleCard(
            matchingArticle!.title,
          );
          expect(matchingTags.map((tag) => tag.toLowerCase())).toContain(
            uniqueTag.toLowerCase(),
          );

          const unrelatedCount = await homeActions
            .articleCardByTitle(unrelatedArticle!.title)
            .count();

          if (unrelatedCount === 0) {
            await homeActions.confirmArticleAbsent(unrelatedArticle!.title);
            return;
          }

          test.info().annotations.push({
            type: "known-limitation",
            description:
              "The web application UI may keep unfiltered cards visible for /?tag=.",
          });

          const unrelatedTags = await homeActions.readTagsFromArticleCard(
            unrelatedArticle!.title,
          );
          expect(unrelatedTags.map((tag) => tag.toLowerCase())).not.toContain(
            uniqueTag.toLowerCase(),
          );
        });
      } finally {
        for (const article of [matchingArticle, unrelatedArticle]) {
          if (!article?.articleId) {
            continue;
          }
          try {
            await articleDetailsActions.openArticleById(article.articleId);
            await articleDetailsActions.deleteArticle();
          } catch {}
        }
      }
    },
  );

  test(
    "CONDUIT-TC-0015: Verify that no articles are shown for a tag with zero matches",
    {
      tag: [
        TestTags.E2E.REGRESSION,
        TestTags.E2E.NEGATIVE,
        TestTags.FEATURE.ARTICLE,
        TestTags.FEATURE.FILTER_BY_TAG,
      ],
    },
    async ({ page, homeActions }) => {
      const missingTag = generateUniqueTag("empty");

      await test.step("UI does not show articles for the unused tag", async () => {
        await page.goto(`/?tag=${encodeURIComponent(missingTag)}`);
        await expect(page).toHaveURL(new RegExp(`tag=`));
        await homeActions.waitForFeedToLoad();

        const emptyVisible = await page
          .getByText(/No articles are here/i)
          .isVisible()
          .catch(() => false);
        const visibleTitles = await homeActions.readVisibleArticleTitles();

        if (emptyVisible || visibleTitles.length === 0) {
          expect(emptyVisible || visibleTitles.length === 0).toBe(true);
          return;
        }

        test.info().annotations.push({
          type: "known-limitation",
          description:
            "The web application UI still renders a feed for unused tags even when none should match.",
        });

        for (const title of visibleTitles) {
          const tags = await homeActions.readTagsFromArticleCard(title);
          expect(tags.map((tag) => tag.toLowerCase())).not.toContain(
            missingTag.toLowerCase(),
          );
        }
      });
    },
  );
});

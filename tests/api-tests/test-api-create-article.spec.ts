import { TestTags } from "@/common/enums/testTags";
import { expect, test } from "@/common/fixtures/customFixtures";
import apiEndpoints from "@/config/apiConfig/apiEndpointConfig.json";
import { timeConfig } from "@/config/defaultConfig/testConfig";
import getEnvConfig from "@/config/environment/envConfig";
import ApiHelper from "@/utils/api-helper";
import {
  CreatedArticleHelper,
  generateRandomArticle,
} from "@/utils/data-generator";

import type { ArticleResponse } from "@/utils/article-helper";

test.describe("Test Create Article API", () => {
  const envConfig = getEnvConfig(process.env.ENVIRONMENT ?? "DEV");
  const createArticleEndpoint = `${envConfig.apiBaseURL}${apiEndpoints.articles.create}`;
  const deleteArticleEndpoint = (articleId: string) =>
    `${envConfig.apiBaseURL}${apiEndpoints.articles.deleteByArticleId.replace("{articleId}", encodeURIComponent(articleId))}`;

  test(
    "CONDUIT-TC-0001: Verify that an authenticated user can create a new article with a valid payload",
    {
      tag: [TestTags.API.POSITIVE, TestTags.SCENARIO.CREATE_ARTICLE],
    },
    async ({ request, generatedUser, authToken }) => {
      const apiHelper = new ApiHelper(request);
      const articlePayload = generateRandomArticle();
      await CreatedArticleHelper.saveCreatePayload(articlePayload);

      const result = await apiHelper.call<ArticleResponse>(
        "POST",
        createArticleEndpoint,
        201,
        {
          data: articlePayload,
          headers: {
            "content-type": "application/json",
            accept: "application/json",
            authorization: `Token ${authToken}`,
          },
          timeout: timeConfig.defaultWaitTimeout,
        },
        {
          responseTime: 5000,
          schema: {
            article: "object",
          },
        },
      );

      expect(result.status).toBe(201);
      expect(result.data?.article.slug).toBeTruthy();
      expect(result.data?.article.title).toBe(articlePayload.article.title);
      expect(result.data?.article.description).toBe(
        articlePayload.article.description,
      );
      expect(result.data?.article.body).toBe(articlePayload.article.body);
      expect(result.data?.article.author.username).toBe(generatedUser.username);

      const receivedTags = (result.data?.article.tagList ?? []).map((tag) =>
        tag.toLowerCase(),
      );
      const expectedTags = articlePayload.article.tagList.map((tag) =>
        tag.toLowerCase(),
      );
      expect(receivedTags).toEqual(expect.arrayContaining(expectedTags));

      const articleId = result.data!.article.slug;
      const deleteResponse = await request.delete(
        deleteArticleEndpoint(articleId),
        {
          headers: {
            accept: "application/json",
            authorization: `Token ${authToken}`,
          },
          timeout: timeConfig.defaultWaitTimeout,
        },
      );
      expect([200, 204]).toContain(deleteResponse.status());
    },
  );

  test(
    "CONDUIT-TC-0002: Verify that article creation is rejected when the request is unauthorized",
    {
      tag: [TestTags.API.NEGATIVE, TestTags.SCENARIO.CREATE_ARTICLE],
    },
    async ({ request }) => {
      const apiHelper = new ApiHelper(request);
      const articlePayload = generateRandomArticle();

      const result = await apiHelper.call(
        "POST",
        createArticleEndpoint,
        401,
        {
          data: articlePayload,
          headers: {
            "content-type": "application/json",
            accept: "application/json",
          },
          timeout: timeConfig.defaultWaitTimeout,
        },
        {
          responseTime: 5000,
        },
      );

      expect(result.status).toBe(401);
    },
  );

  test(
    "CONDUIT-TC-0003: Verify that article creation is rejected when the token is invalid",
    {
      tag: [TestTags.API.NEGATIVE, TestTags.SCENARIO.CREATE_ARTICLE],
    },
    async ({ request }) => {
      const apiHelper = new ApiHelper(request);
      const articlePayload = generateRandomArticle();

      const result = await apiHelper.call(
        "POST",
        createArticleEndpoint,
        401,
        {
          data: articlePayload,
          headers: {
            "content-type": "application/json",
            accept: "application/json",
            authorization: "Token invalid-token-value",
          },
          timeout: timeConfig.defaultWaitTimeout,
        },
        {
          responseTime: 5000,
        },
      );

      expect(result.status).toBe(401);
    },
  );
});

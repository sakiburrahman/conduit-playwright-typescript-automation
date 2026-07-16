export const TestTags = {
  E2E: {
    POSITIVE: "@E2EPositiveTest",
    NEGATIVE: "@E2ENegativeTest",
    REGRESSION: "@E2ERegressionTest",
  },

  API: {
    POSITIVE: "@APIPositiveTest",
    NEGATIVE: "@APINegativeTest",
  },

  FEATURE: {
    ARTICLE: "@E2EArticleTest",
    SETTINGS: "@E2ESettings",
    FILTER_BY_TAG: "@E2EFilterByTag",
  },

  SCENARIO: {
    CREATE_ARTICLE: "@CreateArticle",
    EDIT_ARTICLE: "@EditArticle",
    DELETE_ARTICLE: "@DeleteArticle",
  },
} as const;

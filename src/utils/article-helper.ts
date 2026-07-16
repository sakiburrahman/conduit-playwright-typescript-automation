import type { ArticleDetailsActions } from "@/pageActions/article-details.actions";
import type { ArticleEditorActions } from "@/pageActions/article-editor.actions";
import type { HomeActions } from "@/pageActions/home.actions";
import type { NavigationBarActions } from "@/pageActions/navigation-bar.actions";

export interface ArticleInput {
  title: string;
  description: string;
  body: string;
  tagList: string[];
}

export interface ArticleData {
  article: ArticleInput;
}

export type ArticleOverrides = Partial<ArticleInput>;

export interface ArticleAuthor {
  username: string;
  bio: string | null;
  image: string;
  following: boolean;
}

export interface Article {
  slug: string;
  title: string;
  description: string;
  body: string;
  tagList: string[];
  createdAt: string;
  updatedAt: string;
  favorited: boolean;
  favoritesCount: number;
  author: ArticleAuthor;
}

export interface ArticleResponse {
  article: Article;
}

export interface CreatedArticleFixture {
  articleId: string;
  title: string;
  description: string;
  body: string;
  tagList: string[];
  author: string;
}

export function articleIdFromUrl(url: string): string | undefined {
  return /\/article\/([^/?#]+)/.exec(url)?.[1];
}

export async function createArticleFromUi(
  article: ArticleInput,
  author: string,
  navigationBarActions: NavigationBarActions,
  articleEditorActions: ArticleEditorActions,
  articleDetailsActions: ArticleDetailsActions,
): Promise<CreatedArticleFixture> {
  await navigationBarActions.navigateToNewArticle();
  await articleEditorActions.verifyEditorDisplayed();
  await articleEditorActions.createArticle(article);
  await articleDetailsActions.waitForArticleDetails(article.title);

  const articleId = articleIdFromUrl(articleDetailsActions.getUrl());
  if (!articleId) {
    throw new Error(
      `Expected /article/:id after UI publish, got ${articleDetailsActions.getUrl()}`,
    );
  }

  return {
    articleId,
    title: article.title,
    description: article.description,
    body: article.body,
    tagList: article.tagList,
    author,
  };
}

export async function verifyArticleFromGlobalFeed(
  article: ArticleInput,
  expectedAuthor: string,
  homeActions: HomeActions,
  articleDetailsActions: ArticleDetailsActions,
): Promise<void> {
  await homeActions.openGlobalFeed();
  await homeActions.verifyArticleCard(article, expectedAuthor);
  await homeActions.openArticleFromGlobalFeed(article.title);
  await articleDetailsActions.verifyArticleDetails(article, expectedAuthor);
}

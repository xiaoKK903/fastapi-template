import type { CancelablePromise } from "@/client/core/CancelablePromise"
import { OpenAPI } from "@/client/core/OpenAPI"
import { request as __request } from "@/client/core/request"

export interface ArticleTagPublic {
  id: string
  name: string
  color?: string | null
  owner_id: string
  created_at?: string | null
  updated_at?: string | null
  article_count?: number | null
}

export interface ArticleTagsPublic {
  data: ArticleTagPublic[]
  count: number
}

export interface ArticleTagCreate {
  name: string
  color?: string | null
}

export interface Message {
  message: string
}

export class ArticleTagsService {
  public static readTags(
    data: { skip?: number; limit?: number } = {},
  ): CancelablePromise<ArticleTagsPublic> {
    return __request(OpenAPI, {
      method: "GET",
      url: "/api/v1/article-tags/",
      query: {
        skip: data.skip,
        limit: data.limit,
      },
      errors: {
        422: "Validation Error",
      },
    })
  }

  public static getPopularTags(
    data: { limit?: number } = {},
  ): CancelablePromise<ArticleTagsPublic> {
    return __request(OpenAPI, {
      method: "GET",
      url: "/api/v1/article-tags/popular/{limit}",
      path: {
        limit: data.limit || 10,
      },
      errors: {
        422: "Validation Error",
      },
    })
  }

  public static createTag(
    data: { requestBody: ArticleTagCreate },
  ): CancelablePromise<ArticleTagPublic> {
    return __request(OpenAPI, {
      method: "POST",
      url: "/api/v1/article-tags/",
      body: data.requestBody,
      mediaType: "application/json",
      errors: {
        422: "Validation Error",
      },
    })
  }

  public static readTag(
    data: { id: string },
  ): CancelablePromise<ArticleTagPublic> {
    return __request(OpenAPI, {
      method: "GET",
      url: "/api/v1/article-tags/{id}",
      path: {
        id: data.id,
      },
      errors: {
        422: "Validation Error",
      },
    })
  }

  public static deleteTag(
    data: { id: string },
  ): CancelablePromise<Message> {
    return __request(OpenAPI, {
      method: "DELETE",
      url: "/api/v1/article-tags/{id}",
      path: {
        id: data.id,
      },
      errors: {
        422: "Validation Error",
      },
    })
  }
}

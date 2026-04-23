import type { CancelablePromise } from "@/client/core/CancelablePromise"
import { OpenAPI } from "@/client/core/OpenAPI"
import { request as __request } from "@/client/core/request"

export interface ArticleCategoryPublic {
  id: string
  name: string
  description?: string | null
  color?: string | null
  icon?: string | null
  parent_id?: string | null
  owner_id: string
  created_at?: string | null
  updated_at?: string | null
  article_count?: number | null
}

export interface ArticleCategoriesPublic {
  data: ArticleCategoryPublic[]
  count: number
}

export interface ArticleCategoryCreate {
  name: string
  description?: string | null
  color?: string | null
  icon?: string | null
  parent_id?: string | null
}

export interface ArticleCategoryUpdate {
  name?: string | null
  description?: string | null
  color?: string | null
  icon?: string | null
  parent_id?: string | null
}

export interface Message {
  message: string
}

export class ArticleCategoriesService {
  public static readCategories(
    data: { skip?: number; limit?: number } = {},
  ): CancelablePromise<ArticleCategoriesPublic> {
    return __request(OpenAPI, {
      method: "GET",
      url: "/api/v1/article-categories/",
      query: {
        skip: data.skip,
        limit: data.limit,
      },
      errors: {
        422: "Validation Error",
      },
    })
  }

  public static getCategoriesTree(): CancelablePromise<ArticleCategoriesPublic> {
    return __request(OpenAPI, {
      method: "GET",
      url: "/api/v1/article-categories/tree",
      errors: {
        422: "Validation Error",
      },
    })
  }

  public static createCategory(
    data: { requestBody: ArticleCategoryCreate },
  ): CancelablePromise<ArticleCategoryPublic> {
    return __request(OpenAPI, {
      method: "POST",
      url: "/api/v1/article-categories/",
      body: data.requestBody,
      mediaType: "application/json",
      errors: {
        422: "Validation Error",
      },
    })
  }

  public static readCategory(
    data: { id: string },
  ): CancelablePromise<ArticleCategoryPublic> {
    return __request(OpenAPI, {
      method: "GET",
      url: "/api/v1/article-categories/{id}",
      path: {
        id: data.id,
      },
      errors: {
        422: "Validation Error",
      },
    })
  }

  public static updateCategory(
    data: { id: string; requestBody: ArticleCategoryUpdate },
  ): CancelablePromise<ArticleCategoryPublic> {
    return __request(OpenAPI, {
      method: "PATCH",
      url: "/api/v1/article-categories/{id}",
      path: {
        id: data.id,
      },
      body: data.requestBody,
      mediaType: "application/json",
      errors: {
        422: "Validation Error",
      },
    })
  }

  public static deleteCategory(
    data: { id: string },
  ): CancelablePromise<Message> {
    return __request(OpenAPI, {
      method: "DELETE",
      url: "/api/v1/article-categories/{id}",
      path: {
        id: data.id,
      },
      errors: {
        422: "Validation Error",
      },
    })
  }
}

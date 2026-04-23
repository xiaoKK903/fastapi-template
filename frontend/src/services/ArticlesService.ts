import type { CancelablePromise } from "@/client/core/CancelablePromise"
import { OpenAPI } from "@/client/core/OpenAPI"
import { request as __request } from "@/client/core/request"

export enum ArticleStatus {
  DRAFT = "DRAFT",
  PUBLISHED = "PUBLISHED",
  ARCHIVED = "ARCHIVED",
}

export enum SensitiveLevel {
  SAFE = "SAFE",
  WARNING = "WARNING",
  BLOCKED = "BLOCKED",
}

export interface ArticlePublic {
  id: string
  title: string
  summary?: string | null
  content?: string | null
  cover_image?: string | null
  status: ArticleStatus
  category_id?: string | null
  category_name?: string | null
  category_color?: string | null
  views: number
  word_count: number
  is_deleted: boolean
  is_private: boolean
  sensitive_level: SensitiveLevel
  sensitive_reason?: string | null
  tag_ids?: string[] | null
  tag_names?: string[] | null
  tag_colors?: string[] | null
  owner_id: string
  created_at?: string | null
  updated_at?: string | null
  published_at?: string | null
}

export interface ArticlesPublic {
  data: ArticlePublic[]
  count: number
}

export interface ArticleCreate {
  title: string
  summary?: string | null
  content?: string | null
  cover_image?: string | null
  status?: ArticleStatus
  category_id?: string | null
  is_private?: boolean
  tag_ids?: string[] | null
}

export interface ArticleUpdate {
  title?: string | null
  summary?: string | null
  content?: string | null
  cover_image?: string | null
  status?: ArticleStatus | null
  category_id?: string | null
  is_private?: boolean | null
  tag_ids?: string[] | null
}

export interface ArchiveMonth {
  year: number
  month: number
  article_count: number
}

export interface ArticleArchive {
  months: ArchiveMonth[]
}

export interface CategoryDistribution {
  id: string
  name: string
  count: number
}

export interface ArticleStatistics {
  total_articles: number
  draft_articles: number
  published_articles: number
  archived_articles: number
  deleted_articles: number
  total_views: number
  total_words: number
  category_distribution?: CategoryDistribution[] | null
}

export interface Message {
  message: string
}

export interface CoverUploadResult {
  filename: string
  original_name: string
  size: number
  url: string
}

export class ArticlesService {
  public static readArticles(
    data: {
      skip?: number
      limit?: number
      status?: ArticleStatus
      category_id?: string
      search?: string
      include_archived?: boolean
      include_deleted?: boolean
    } = {},
  ): CancelablePromise<ArticlesPublic> {
    return __request(OpenAPI, {
      method: "GET",
      url: "/api/v1/articles/",
      query: {
        skip: data.skip,
        limit: data.limit,
        status: data.status,
        category_id: data.category_id,
        search: data.search,
        include_archived: data.include_archived,
        include_deleted: data.include_deleted,
      },
      errors: {
        422: "Validation Error",
      },
    })
  }

  public static readDrafts(
    data: { skip?: number; limit?: number } = {},
  ): CancelablePromise<ArticlesPublic> {
    return __request(OpenAPI, {
      method: "GET",
      url: "/api/v1/articles/drafts",
      query: {
        skip: data.skip,
        limit: data.limit,
      },
      errors: {
        422: "Validation Error",
      },
    })
  }

  public static readArchived(
    data: { skip?: number; limit?: number } = {},
  ): CancelablePromise<ArticlesPublic> {
    return __request(OpenAPI, {
      method: "GET",
      url: "/api/v1/articles/archived",
      query: {
        skip: data.skip,
        limit: data.limit,
      },
      errors: {
        422: "Validation Error",
      },
    })
  }

  public static readTrash(
    data: { skip?: number; limit?: number } = {},
  ): CancelablePromise<ArticlesPublic> {
    return __request(OpenAPI, {
      method: "GET",
      url: "/api/v1/articles/trash",
      query: {
        skip: data.skip,
        limit: data.limit,
      },
      errors: {
        422: "Validation Error",
      },
    })
  }

  public static getArchive(): CancelablePromise<ArticleArchive> {
    return __request(OpenAPI, {
      method: "GET",
      url: "/api/v1/articles/archive",
      errors: {
        422: "Validation Error",
      },
    })
  }

  public static getStatistics(): CancelablePromise<ArticleStatistics> {
    return __request(OpenAPI, {
      method: "GET",
      url: "/api/v1/articles/statistics",
      errors: {
        422: "Validation Error",
      },
    })
  }

  public static readArticle(
    data: { id: string },
  ): CancelablePromise<ArticlePublic> {
    return __request(OpenAPI, {
      method: "GET",
      url: "/api/v1/articles/{id}",
      path: {
        id: data.id,
      },
      errors: {
        422: "Validation Error",
      },
    })
  }

  public static createArticle(
    data: { requestBody: ArticleCreate },
  ): CancelablePromise<ArticlePublic> {
    return __request(OpenAPI, {
      method: "POST",
      url: "/api/v1/articles/",
      body: data.requestBody,
      mediaType: "application/json",
      errors: {
        422: "Validation Error",
      },
    })
  }

  public static updateArticle(
    data: { id: string; requestBody: ArticleUpdate },
  ): CancelablePromise<ArticlePublic> {
    return __request(OpenAPI, {
      method: "PATCH",
      url: "/api/v1/articles/{id}",
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

  public static publishArticle(
    data: { id: string },
  ): CancelablePromise<ArticlePublic> {
    return __request(OpenAPI, {
      method: "PATCH",
      url: "/api/v1/articles/{id}/publish",
      path: {
        id: data.id,
      },
      errors: {
        422: "Validation Error",
      },
    })
  }

  public static archiveArticle(
    data: { id: string },
  ): CancelablePromise<ArticlePublic> {
    return __request(OpenAPI, {
      method: "PATCH",
      url: "/api/v1/articles/{id}/archive",
      path: {
        id: data.id,
      },
      errors: {
        422: "Validation Error",
      },
    })
  }

  public static unarchiveArticle(
    data: { id: string },
  ): CancelablePromise<ArticlePublic> {
    return __request(OpenAPI, {
      method: "PATCH",
      url: "/api/v1/articles/{id}/unarchive",
      path: {
        id: data.id,
      },
      errors: {
        422: "Validation Error",
      },
    })
  }

  public static softDeleteArticle(
    data: { id: string },
  ): CancelablePromise<Message> {
    return __request(OpenAPI, {
      method: "PATCH",
      url: "/api/v1/articles/{id}/soft-delete",
      path: {
        id: data.id,
      },
      errors: {
        422: "Validation Error",
      },
    })
  }

  public static restoreArticle(
    data: { id: string },
  ): CancelablePromise<Message> {
    return __request(OpenAPI, {
      method: "PATCH",
      url: "/api/v1/articles/{id}/restore",
      path: {
        id: data.id,
      },
      errors: {
        422: "Validation Error",
      },
    })
  }

  public static deleteArticle(
    data: { id: string },
  ): CancelablePromise<Message> {
    return __request(OpenAPI, {
      method: "DELETE",
      url: "/api/v1/articles/{id}",
      path: {
        id: data.id,
      },
      errors: {
        422: "Validation Error",
      },
    })
  }

  public static emptyTrash(): CancelablePromise<Message> {
    return __request(OpenAPI, {
      method: "DELETE",
      url: "/api/v1/articles/trash/empty",
      errors: {
        422: "Validation Error",
      },
    })
  }

  public static uploadCoverImage(
    data: { file: File },
  ): CancelablePromise<CoverUploadResult> {
    const formData = new FormData()
    formData.append("file", data.file)
    
    return __request(OpenAPI, {
      method: "POST",
      url: "/api/v1/articles/upload-cover",
      formData: formData,
      mediaType: "multipart/form-data",
      errors: {
        422: "Validation Error",
      },
    })
  }
}

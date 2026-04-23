import type { CancelablePromise } from "@/client/core/CancelablePromise"
import { OpenAPI } from "@/client/core/OpenAPI"
import { request as __request } from "@/client/core/request"

export enum MediaType {
  BOOK = "book",
  MOVIE = "movie",
  TV_SHOW = "tv_show",
}

export enum MediaStatus {
  WANT_TO_WATCH = "want_to_watch",
  WATCHING = "watching",
  COMPLETED = "completed",
  ON_HOLD = "on_hold",
  DROPPED = "dropped",
}

export const MediaTypeLabels: Record<MediaType, string> = {
  [MediaType.BOOK]: "书籍",
  [MediaType.MOVIE]: "电影",
  [MediaType.TV_SHOW]: "电视剧",
}

export const MediaStatusLabels: Record<MediaStatus, string> = {
  [MediaStatus.WANT_TO_WATCH]: "想看",
  [MediaStatus.WATCHING]: "在看",
  [MediaStatus.COMPLETED]: "已完成",
  [MediaStatus.ON_HOLD]: "搁置",
  [MediaStatus.DROPPED]: "放弃",
}

export const MediaStatusColors: Record<MediaStatus, string> = {
  [MediaStatus.WANT_TO_WATCH]: "bg-blue-500",
  [MediaStatus.WATCHING]: "bg-green-500",
  [MediaStatus.COMPLETED]: "bg-purple-500",
  [MediaStatus.ON_HOLD]: "bg-yellow-500",
  [MediaStatus.DROPPED]: "bg-red-500",
}

export interface MediaTagPublic {
  id: string
  name: string
  color?: string | null
  owner_id: string
  media_count: number
  created_at?: string | null
}

export interface MediaTagsPublic {
  data: MediaTagPublic[]
  count: number
}

export interface MediaCollectionPublic {
  id: string
  title: string
  original_title?: string | null
  media_type: MediaType
  status: MediaStatus
  rating?: number | null
  description?: string | null
  notes?: string | null
  cover_image?: string | null
  year?: number | null
  genre?: string | null
  author?: string | null
  director?: string | null
  episodes?: number | null
  is_private: boolean
  owner_id: string
  created_at?: string | null
  updated_at?: string | null
  completed_at?: string | null
  tag_names: string[]
}

export interface MediaCollectionsPublic {
  data: MediaCollectionPublic[]
  count: number
}

export interface MediaCollectionStatistics {
  total_items: number
  want_to_watch: number
  watching: number
  completed: number
  on_hold: number
  dropped: number
  books: number
  movies: number
  tv_shows: number
  average_rating?: number | null
}

export interface Message {
  message: string
}

export interface MediaCollectionCreate {
  title: string
  original_title?: string | null
  media_type?: MediaType
  status?: MediaStatus
  rating?: number | null
  description?: string | null
  notes?: string | null
  cover_image?: string | null
  year?: number | null
  genre?: string | null
  author?: string | null
  director?: string | null
  episodes?: number | null
  is_private?: boolean
  tag_ids?: string[]
}

export interface MediaCollectionUpdate {
  title?: string
  original_title?: string | null
  media_type?: MediaType | null
  status?: MediaStatus | null
  rating?: number | null
  description?: string | null
  notes?: string | null
  cover_image?: string | null
  year?: number | null
  genre?: string | null
  author?: string | null
  director?: string | null
  episodes?: number | null
  is_private?: boolean | null
  tag_ids?: string[] | null
}

export class MediaCollectionService {
  public static getCollections(
    data: {
      skip?: number
      limit?: number
      media_type?: MediaType
      status?: MediaStatus
      search?: string
      tag_id?: string
    } = {},
  ): CancelablePromise<MediaCollectionsPublic> {
    return __request(OpenAPI, {
      method: "GET",
      url: "/api/v1/media/collections",
      query: {
        skip: data.skip,
        limit: data.limit,
        media_type: data.media_type,
        status: data.status,
        search: data.search,
        tag_id: data.tag_id,
      },
      errors: {
        422: "Validation Error",
      },
    })
  }

  public static getCollectionStats(): CancelablePromise<MediaCollectionStatistics> {
    return __request(OpenAPI, {
      method: "GET",
      url: "/api/v1/media/collections/stats",
      errors: {
        422: "Validation Error",
      },
    })
  }

  public static getCollection(
    data: { collection_id: string },
  ): CancelablePromise<MediaCollectionPublic> {
    return __request(OpenAPI, {
      method: "GET",
      url: "/api/v1/media/collections/{collection_id}",
      path: {
        collection_id: data.collection_id,
      },
      errors: {
        422: "Validation Error",
      },
    })
  }

  public static createCollection(
    data: { requestBody: MediaCollectionCreate },
  ): CancelablePromise<MediaCollectionPublic> {
    return __request(OpenAPI, {
      method: "POST",
      url: "/api/v1/media/collections",
      body: data.requestBody,
      mediaType: "application/json",
      errors: {
        422: "Validation Error",
      },
    })
  }

  public static updateCollection(
    data: {
      collection_id: string
      requestBody: MediaCollectionUpdate
    },
  ): CancelablePromise<MediaCollectionPublic> {
    return __request(OpenAPI, {
      method: "PATCH",
      url: "/api/v1/media/collections/{collection_id}",
      path: {
        collection_id: data.collection_id,
      },
      body: data.requestBody,
      mediaType: "application/json",
      errors: {
        422: "Validation Error",
      },
    })
  }

  public static deleteCollection(
    data: { collection_id: string },
  ): CancelablePromise<Message> {
    return __request(OpenAPI, {
      method: "DELETE",
      url: "/api/v1/media/collections/{collection_id}",
      path: {
        collection_id: data.collection_id,
      },
      errors: {
        422: "Validation Error",
      },
    })
  }

  public static getTags(
    data: { search?: string; limit?: number } = {},
  ): CancelablePromise<MediaTagsPublic> {
    return __request(OpenAPI, {
      method: "GET",
      url: "/api/v1/media/tags",
      query: {
        search: data.search,
        limit: data.limit,
      },
      errors: {
        422: "Validation Error",
      },
    })
  }

  public static getTag(
    data: { tag_id: string },
  ): CancelablePromise<MediaTagPublic> {
    return __request(OpenAPI, {
      method: "GET",
      url: "/api/v1/media/tags/{tag_id}",
      path: {
        tag_id: data.tag_id,
      },
      errors: {
        422: "Validation Error",
      },
    })
  }

  public static createTag(
    data: { requestBody: { name: string; color?: string | null } },
  ): CancelablePromise<MediaTagPublic> {
    return __request(OpenAPI, {
      method: "POST",
      url: "/api/v1/media/tags",
      body: data.requestBody,
      mediaType: "application/json",
      errors: {
        422: "Validation Error",
      },
    })
  }

  public static deleteTag(
    data: { tag_id: string },
  ): CancelablePromise<Message> {
    return __request(OpenAPI, {
      method: "DELETE",
      url: "/api/v1/media/tags/{tag_id}",
      path: {
        tag_id: data.tag_id,
      },
      errors: {
        422: "Validation Error",
      },
    })
  }
}

import type { CancelablePromise } from "@/client/core/CancelablePromise"
import { OpenAPI } from "@/client/core/OpenAPI"
import { request as __request } from "@/client/core/request"

export interface Folder {
  id: string
  name: string
  parent_id?: string
  description?: string
  color?: string
  owner_id: string
  created_at?: string
  updated_at?: string
}

export interface FolderPublic extends Folder {}

export interface FoldersPublic {
  data: FolderPublic[]
  count: number
}

export interface FolderTreeItem extends FolderPublic {
  children: FolderTreeItem[]
  file_count: number
}

export interface FolderCreate {
  name: string
  parent_id?: string
  description?: string
  color?: string
}

export interface FolderUpdate {
  name?: string
  parent_id?: string
  description?: string
  color?: string
}

export interface FilePublic {
  id: string
  name: string
  original_name?: string
  size: number
  file_type?: string
  extension?: string
  mime_type?: string
  folder_id?: string
  access_type: string
  description?: string
  is_favorite: boolean
  owner_id: string
  created_at?: string
  updated_at?: string
  folder_name?: string
  tags: string[]
}

export interface FilesPublic {
  data: FilePublic[]
  count: number
}

export interface FileUploadResponse {
  id: string
  name: string
  original_name?: string
  size: number
  file_type?: string
  mime_type?: string
  folder_id?: string
}

export interface FileUpdate {
  name?: string
  folder_id?: string
  description?: string
  access_type?: string
  is_favorite?: boolean
}

export interface StorageQuota {
  user_id: string
  total_quota: number
  used_storage: number
  remaining_storage: number
  usage_percentage: number
  formatted_total: string
  formatted_used: string
  formatted_remaining: string
}

export interface FileSharePublic {
  id: string
  file_id: string
  file_name?: string
  file_size?: number
  permission: string
  password?: string
  expire_at?: string
  max_downloads?: number
  download_count: number
  is_active: boolean
  share_url?: string
  created_at?: string
  owner_id: string
}

export interface FileSharesPublic {
  data: FileSharePublic[]
  count: number
}

export interface FileShareCreate {
  file_id: string
  permission?: string
  password?: string
  expire_hours?: number
  max_downloads?: number
}

export interface FileShareUpdate {
  permission?: string
  password?: string
  expire_hours?: number
  max_downloads?: number
  is_active?: boolean
}

export interface FileTagPublic {
  id: string
  name: string
  color?: string
  owner_id: string
  file_count: number
}

export interface FileTagsPublic {
  data: FileTagPublic[]
  count: number
}

export interface Message {
  message: string
}

export class FilesService {
  public static readFiles(
    folder_id?: string,
    search?: string,
    file_type?: string,
    tag?: string,
    is_favorite?: boolean,
    skip: number = 0,
    limit: number = 100,
    sort_by: string = "created_at",
    sort_order: string = "desc",
  ): CancelablePromise<FilesPublic> {
    return __request(OpenAPI, {
      method: "GET",
      url: "/api/v1/files/",
      query: {
        folder_id,
        search,
        file_type,
        tag,
        is_favorite,
        skip,
        limit,
        sort_by,
        sort_order,
      },
      errors: {
        422: "Validation Error",
      },
    })
  }

  public static readFile(file_id: string): CancelablePromise<FilePublic> {
    return __request(OpenAPI, {
      method: "GET",
      url: "/api/v1/files/{file_id}",
      path: {
        file_id,
      },
      errors: {
        422: "Validation Error",
      },
    })
  }

  public static uploadFile(
    file: File,
    folder_id?: string,
    name?: string,
    description?: string,
    tags?: string[],
  ): CancelablePromise<FileUploadResponse> {
    const formData = new FormData()
    formData.append("file", file)
    if (folder_id) formData.append("folder_id", folder_id)
    if (name) formData.append("name", name)
    if (description) formData.append("description", description)
    if (tags && tags.length > 0) {
      tags.forEach((tag) => {
        formData.append("tags", tag)
      })
    }

    return __request(OpenAPI, {
      method: "POST",
      url: "/api/v1/files/upload",
      formData: formData,
      mediaType: "multipart/form-data",
      errors: {
        422: "Validation Error",
      },
    })
  }

  public static updateFile(
    file_id: string,
    data: FileUpdate,
  ): CancelablePromise<FilePublic> {
    return __request(OpenAPI, {
      method: "PUT",
      url: "/api/v1/files/{file_id}",
      path: {
        file_id,
      },
      body: data,
      errors: {
        422: "Validation Error",
      },
    })
  }

  public static deleteFile(file_id: string): CancelablePromise<Message> {
    return __request(OpenAPI, {
      method: "DELETE",
      url: "/api/v1/files/{file_id}",
      path: {
        file_id,
      },
      errors: {
        422: "Validation Error",
      },
    })
  }

  public static toggleFavorite(file_id: string): CancelablePromise<FilePublic> {
    return __request(OpenAPI, {
      method: "POST",
      url: "/api/v1/files/{file_id}/toggle-favorite",
      path: {
        file_id,
      },
      errors: {
        422: "Validation Error",
      },
    })
  }

  public static addTag(
    file_id: string,
    tag_name: string,
  ): CancelablePromise<FilePublic> {
    return __request(OpenAPI, {
      method: "POST",
      url: "/api/v1/files/{file_id}/tags/{tag_name}",
      path: {
        file_id,
        tag_name,
      },
      errors: {
        422: "Validation Error",
      },
    })
  }

  public static removeTag(
    file_id: string,
    tag_name: string,
  ): CancelablePromise<FilePublic> {
    return __request(OpenAPI, {
      method: "DELETE",
      url: "/api/v1/files/{file_id}/tags/{tag_name}",
      path: {
        file_id,
        tag_name,
      },
      errors: {
        422: "Validation Error",
      },
    })
  }

  public static getQuota(): CancelablePromise<StorageQuota> {
    return __request(OpenAPI, {
      method: "GET",
      url: "/api/v1/files/quota/info",
      errors: {
        422: "Validation Error",
      },
    })
  }
}

export class FoldersService {
  public static readFolders(
    parent_id?: string,
    skip: number = 0,
    limit: number = 100,
  ): CancelablePromise<FoldersPublic> {
    return __request(OpenAPI, {
      method: "GET",
      url: "/api/v1/folders/",
      query: {
        parent_id,
        skip,
        limit,
      },
      errors: {
        422: "Validation Error",
      },
    })
  }

  public static readFolderTree(): CancelablePromise<FolderTreeItem[]> {
    return __request(OpenAPI, {
      method: "GET",
      url: "/api/v1/folders/tree",
      errors: {
        422: "Validation Error",
      },
    })
  }

  public static readFolder(folder_id: string): CancelablePromise<any> {
    return __request(OpenAPI, {
      method: "GET",
      url: "/api/v1/folders/{folder_id}",
      path: {
        folder_id,
      },
      errors: {
        422: "Validation Error",
      },
    })
  }

  public static createFolder(
    data: FolderCreate,
  ): CancelablePromise<FolderPublic> {
    return __request(OpenAPI, {
      method: "POST",
      url: "/api/v1/folders/",
      body: data,
      errors: {
        422: "Validation Error",
      },
    })
  }

  public static updateFolder(
    folder_id: string,
    data: FolderUpdate,
  ): CancelablePromise<FolderPublic> {
    return __request(OpenAPI, {
      method: "PUT",
      url: "/api/v1/folders/{folder_id}",
      path: {
        folder_id,
      },
      body: data,
      errors: {
        422: "Validation Error",
      },
    })
  }

  public static deleteFolder(folder_id: string): CancelablePromise<Message> {
    return __request(OpenAPI, {
      method: "DELETE",
      url: "/api/v1/folders/{folder_id}",
      path: {
        folder_id,
      },
      errors: {
        422: "Validation Error",
      },
    })
  }
}

export class RecycleService {
  public static getTrashFiles(
    skip: number = 0,
    limit: number = 100,
  ): CancelablePromise<FilesPublic> {
    return __request(OpenAPI, {
      method: "GET",
      url: "/api/v1/recycle/",
      query: {
        skip,
        limit,
      },
      errors: {
        422: "Validation Error",
      },
    })
  }

  public static getTrashStats(): CancelablePromise<any> {
    return __request(OpenAPI, {
      method: "GET",
      url: "/api/v1/recycle/stats",
      errors: {
        422: "Validation Error",
      },
    })
  }

  public static restoreFile(file_id: string): CancelablePromise<Message> {
    return __request(OpenAPI, {
      method: "POST",
      url: "/api/v1/recycle/{file_id}/restore",
      path: {
        file_id,
      },
      errors: {
        422: "Validation Error",
      },
    })
  }

  public static permanentDelete(file_id: string): CancelablePromise<Message> {
    return __request(OpenAPI, {
      method: "DELETE",
      url: "/api/v1/recycle/{file_id}",
      path: {
        file_id,
      },
      errors: {
        422: "Validation Error",
      },
    })
  }

  public static emptyTrash(): CancelablePromise<Message> {
    return __request(OpenAPI, {
      method: "POST",
      url: "/api/v1/recycle/empty",
      errors: {
        422: "Validation Error",
      },
    })
  }

  public static restoreAll(): CancelablePromise<Message> {
    return __request(OpenAPI, {
      method: "POST",
      url: "/api/v1/recycle/restore-all",
      errors: {
        422: "Validation Error",
      },
    })
  }
}

export class SharesService {
  public static listShares(
    file_id?: string,
    is_active?: boolean,
    skip: number = 0,
    limit: number = 100,
  ): CancelablePromise<FileSharesPublic> {
    return __request(OpenAPI, {
      method: "GET",
      url: "/api/v1/shares/",
      query: {
        file_id,
        is_active,
        skip,
        limit,
      },
      errors: {
        422: "Validation Error",
      },
    })
  }

  public static readShare(
    share_id: string,
  ): CancelablePromise<FileSharePublic> {
    return __request(OpenAPI, {
      method: "GET",
      url: "/api/v1/shares/{share_id}",
      path: {
        share_id,
      },
      errors: {
        422: "Validation Error",
      },
    })
  }

  public static createShare(
    data: FileShareCreate,
  ): CancelablePromise<FileSharePublic> {
    return __request(OpenAPI, {
      method: "POST",
      url: "/api/v1/shares/",
      body: data,
      errors: {
        422: "Validation Error",
      },
    })
  }

  public static updateShare(
    share_id: string,
    data: FileShareUpdate,
  ): CancelablePromise<FileSharePublic> {
    return __request(OpenAPI, {
      method: "PUT",
      url: "/api/v1/shares/{share_id}",
      path: {
        share_id,
      },
      body: data,
      errors: {
        422: "Validation Error",
      },
    })
  }

  public static deleteShare(share_id: string): CancelablePromise<Message> {
    return __request(OpenAPI, {
      method: "DELETE",
      url: "/api/v1/shares/{share_id}",
      path: {
        share_id,
      },
      errors: {
        422: "Validation Error",
      },
    })
  }

  public static revokeShare(share_id: string): CancelablePromise<Message> {
    return __request(OpenAPI, {
      method: "POST",
      url: "/api/v1/shares/{share_id}/revoke",
      path: {
        share_id,
      },
      errors: {
        422: "Validation Error",
      },
    })
  }

  public static activateShare(share_id: string): CancelablePromise<Message> {
    return __request(OpenAPI, {
      method: "POST",
      url: "/api/v1/shares/{share_id}/activate",
      path: {
        share_id,
      },
      errors: {
        422: "Validation Error",
      },
    })
  }
}

export class TagsService {
  public static listTags(
    skip: number = 0,
    limit: number = 100,
  ): CancelablePromise<FileTagsPublic> {
    return __request(OpenAPI, {
      method: "GET",
      url: "/api/v1/tags/",
      query: {
        skip,
        limit,
      },
      errors: {
        422: "Validation Error",
      },
    })
  }

  public static readTag(tag_id: string): CancelablePromise<FileTagPublic> {
    return __request(OpenAPI, {
      method: "GET",
      url: "/api/v1/tags/{tag_id}",
      path: {
        tag_id,
      },
      errors: {
        422: "Validation Error",
      },
    })
  }

  public static searchTags(
    tag_name: string,
    limit: number = 20,
  ): CancelablePromise<FileTagsPublic> {
    return __request(OpenAPI, {
      method: "GET",
      url: "/api/v1/tags/search/{tag_name}",
      path: {
        tag_name,
      },
      query: {
        limit,
      },
      errors: {
        422: "Validation Error",
      },
    })
  }

  public static getPopularTags(
    limit: number = 10,
  ): CancelablePromise<FileTagsPublic> {
    return __request(OpenAPI, {
      method: "GET",
      url: "/api/v1/tags/popular/{limit}",
      path: {
        limit,
      },
      errors: {
        422: "Validation Error",
      },
    })
  }

  public static deleteTag(tag_id: string): CancelablePromise<Message> {
    return __request(OpenAPI, {
      method: "DELETE",
      url: "/api/v1/tags/{tag_id}",
      path: {
        tag_id,
      },
      errors: {
        422: "Validation Error",
      },
    })
  }
}

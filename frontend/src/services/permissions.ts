import { OpenAPI, request as __request } from "@/client/core/OpenAPI"
import type { CancelablePromise } from "@/client/core/CancelablePromise"

export interface RolePublic {
  id: string
  name: string
  code: string
  description?: string
  is_builtin: boolean
  created_at?: string
}

export interface UserWithRoles {
  id: string
  email: string
  is_active: boolean
  is_superuser: boolean
  is_banned: boolean
  full_name?: string
  created_at?: string
  roles: RolePublic[]
}

export class PermissionsService {
  public static readMyRoles(): CancelablePromise<RolePublic[]> {
    return __request(OpenAPI, {
      method: "GET",
      url: "/api/v1/users/me/roles",
      errors: {
        422: "Validation Error",
      },
    })
  }

  public static readMyPermissions(): CancelablePromise<string[]> {
    return __request(OpenAPI, {
      method: "GET",
      url: "/api/v1/users/me/permissions",
      errors: {
        422: "Validation Error",
      },
    })
  }

  public static readMyFullInfo(): CancelablePromise<UserWithRoles> {
    return __request(OpenAPI, {
      method: "GET",
      url: "/api/v1/users/me/full-info",
      errors: {
        422: "Validation Error",
      },
    })
  }
}

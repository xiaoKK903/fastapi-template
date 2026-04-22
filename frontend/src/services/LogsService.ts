import { OpenAPI } from "@/client/core/OpenAPI"
import { request as __request } from "@/client/core/request"

export type ActionType = "create" | "read" | "update" | "delete"
export type ResourceType =
  | "habit"
  | "habit_record"
  | "transaction"
  | "category"
  | "budget"
  | "user"
  | "role"
  | "permission"
  | "operation_log"
  | "task"
  | "file"
  | "folder"
  | "file_tag"
  | "file_share"

export interface OperationLogPublic {
  id: string
  user_id?: string
  user_email?: string
  action: ActionType
  resource: ResourceType
  resource_id?: string
  resource_name?: string
  request_path?: string
  request_method?: string
  request_data?: string
  response_status?: number
  ip_address?: string
  user_agent?: string
  success: boolean
  error_message?: string
  duration_ms?: number
  created_at?: string
}

export interface OperationLogsPublic {
  data: OperationLogPublic[]
  count: number
}

export interface LogStats {
  total_count: number
  success_count: number
  error_count: number
  avg_duration_ms: number
  top_resources: { resource: string; count: number }[]
  top_actions: { action: string; count: number }[]
  recent_errors: OperationLogPublic[]
}

export class LogsService {
  static getLogs(
    skip: number = 0,
    limit: number = 100,
    user_id?: string,
    action?: ActionType,
    resource?: ResourceType,
    success?: boolean,
  ): Promise<OperationLogsPublic> {
    const params: Record<string, string | number | boolean> = { skip, limit }
    if (user_id) params.user_id = user_id
    if (action) params.action = action
    if (resource) params.resource = resource
    if (success !== undefined) params.success = success

    return __request(OpenAPI, {
      method: "GET",
      url: "/api/v1/operation-logs",
      query: params,
      errors: {
        401: "Unauthorized",
        403: "Forbidden",
      },
    })
  }

  static getLogById(logId: string): Promise<OperationLogPublic> {
    return __request(OpenAPI, {
      method: "GET",
      url: "/api/v1/operation-logs/{log_id}",
      path: { log_id: logId },
      errors: {
        401: "Unauthorized",
        403: "Forbidden",
        404: "Log not found",
      },
    })
  }

  static getLogStats(): Promise<LogStats> {
    return __request(OpenAPI, {
      method: "GET",
      url: "/api/v1/operation-logs/stats",
      errors: {
        401: "Unauthorized",
        403: "Forbidden",
      },
    })
  }

  static cleanLogs(daysToKeep: number = 30): Promise<{ deleted_count: number }> {
    return __request(OpenAPI, {
      method: "DELETE",
      url: "/api/v1/operation-logs/clean",
      query: { days_to_keep: daysToKeep },
      errors: {
        401: "Unauthorized",
        403: "Forbidden",
      },
    })
  }
}

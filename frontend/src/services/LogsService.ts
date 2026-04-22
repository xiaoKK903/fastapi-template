import type { CancelablePromise } from "@/client/core/CancelablePromise"
import { OpenAPI } from "@/client/core/OpenAPI"
import { request as __request } from "@/client/core/request"

export enum ResourceType {
  HABIT = "habit",
  HABIT_RECORD = "habit_record",
  TRANSACTION = "transaction",
  CATEGORY = "category",
  BUDGET = "budget",
  USER = "user",
  ROLE = "role",
  PERMISSION = "permission",
  OPERATION_LOG = "operation_log",
  TASK = "task",
  FILE = "file",
  FOLDER = "folder",
  FILE_TAG = "file_tag",
  FILE_SHARE = "file_share",
}

export enum ActionType {
  CREATE = "create",
  READ = "read",
  UPDATE = "update",
  DELETE = "delete",
}

export interface OperationLog {
  id: string
  user_id?: string | null
  user_email?: string | null
  action: ActionType
  resource: ResourceType
  resource_id?: string | null
  resource_name?: string | null
  request_path?: string | null
  request_method?: string | null
  request_data?: string | null
  query_params?: string | null
  response_status?: number | null
  response_data?: string | null
  duration_ms?: number | null
  ip_address?: string | null
  user_agent?: string | null
  success: boolean
  error_message?: string | null
  created_at?: string | null
}

export interface OperationLogsPublic {
  data: OperationLog[]
  count: number
}

export interface LogStatsByResource {
  resource: string
  count: number
  avg_duration_ms?: number | null
}

export interface LogStatsByAction {
  action: string
  count: number
  avg_duration_ms?: number | null
}

export interface LogStatsByUser {
  user_id: string
  user_email?: string | null
  count: number
}

export interface LogStatsSummary {
  total_logs: number
  success_count: number
  failed_count: number
  success_rate: number
  avg_duration_ms?: number | null
  top_resources: LogStatsByResource[]
  top_actions: LogStatsByAction[]
  top_users: LogStatsByUser[]
  recent_failures: OperationLog[]
}

export interface Message {
  message: string
}

export interface SlowEndpoint {
  path: string
  method: string
  count: number
  avg_duration_ms?: number | null
  max_duration_ms?: number | null
}

export class LogsService {
  public static getOperationLogs(
    skip?: number,
    limit?: number,
    user_id?: string,
    action?: ActionType,
    resource?: ResourceType,
    success?: boolean,
    path?: string,
    ip_address?: string,
    min_duration_ms?: number,
    max_duration_ms?: number,
    start_time?: string,
    end_time?: string,
  ): CancelablePromise<OperationLogsPublic> {
    return __request(OpenAPI, {
      method: "GET",
      url: "/api/v1/operation-logs",
      query: {
        skip,
        limit,
        user_id,
        action,
        resource,
        success,
        path,
        ip_address,
        min_duration_ms,
        max_duration_ms,
        start_time,
        end_time,
      },
      errors: {
        422: "Validation Error",
      },
    })
  }

  public static getOperationLogById(log_id: string): CancelablePromise<OperationLog> {
    return __request(OpenAPI, {
      method: "GET",
      url: "/api/v1/operation-logs/{log_id}",
      path: {
        log_id,
      },
      errors: {
        404: "Operation log not found",
        422: "Validation Error",
      },
    })
  }

  public static getLogStatsSummary(hours?: number): CancelablePromise<LogStatsSummary> {
    return __request(OpenAPI, {
      method: "GET",
      url: "/api/v1/operation-logs/stats/summary",
      query: {
        hours,
      },
      errors: {
        422: "Validation Error",
      },
    })
  }

  public static getResourceStats(hours?: number): CancelablePromise<LogStatsByResource[]> {
    return __request(OpenAPI, {
      method: "GET",
      url: "/api/v1/operation-logs/stats/resources",
      query: {
        hours,
      },
      errors: {
        422: "Validation Error",
      },
    })
  }

  public static getSlowEndpoints(
    hours?: number,
    min_duration_ms?: number,
    limit?: number,
  ): CancelablePromise<SlowEndpoint[]> {
    return __request(OpenAPI, {
      method: "GET",
      url: "/api/v1/operation-logs/stats/slow-endpoints",
      query: {
        hours,
        min_duration_ms,
        limit,
      },
      errors: {
        422: "Validation Error",
      },
    })
  }

  public static getErrorLogs(
    hours?: number,
    skip?: number,
    limit?: number,
  ): CancelablePromise<OperationLogsPublic> {
    return __request(OpenAPI, {
      method: "GET",
      url: "/api/v1/operation-logs/errors",
      query: {
        hours,
        skip,
        limit,
      },
      errors: {
        422: "Validation Error",
      },
    })
  }

  public static deleteOperationLog(log_id: string): CancelablePromise<Message> {
    return __request(OpenAPI, {
      method: "DELETE",
      url: "/api/v1/operation-logs/{log_id}",
      path: {
        log_id,
      },
      errors: {
        404: "Operation log not found",
        422: "Validation Error",
      },
    })
  }

  public static deleteOldLogs(older_than_days: number): CancelablePromise<Message> {
    return __request(OpenAPI, {
      method: "DELETE",
      url: "/api/v1/operation-logs",
      query: {
        older_than_days,
      },
      errors: {
        422: "Validation Error",
      },
    })
  }

  public static cleanupExpiredLogs(): CancelablePromise<Message> {
    return __request(OpenAPI, {
      method: "POST",
      url: "/api/v1/operation-logs/cleanup",
      errors: {
        422: "Validation Error",
      },
    })
  }

  public static exportLogs(
    start_time?: string,
    end_time?: string,
    success?: boolean,
  ): CancelablePromise<OperationLog[]> {
    return __request(OpenAPI, {
      method: "GET",
      url: "/api/v1/operation-logs/export",
      query: {
        start_time,
        end_time,
        success,
      },
      errors: {
        422: "Validation Error",
      },
    })
  }
}

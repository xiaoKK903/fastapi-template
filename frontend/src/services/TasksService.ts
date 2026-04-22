import type { CancelablePromise } from "@/client/core/CancelablePromise"
import { OpenAPI } from "@/client/core/OpenAPI"
import { request as __request } from "@/client/core/request"

export enum TaskPriority {
  LOW = "low",
  MEDIUM = "medium",
  HIGH = "high",
  URGENT = "urgent",
}

export enum TaskStatus {
  TODO = "todo",
  IN_PROGRESS = "in_progress",
  DONE = "done",
  CANCELLED = "cancelled",
  ON_HOLD = "on_hold",
}

export enum TaskRepeatType {
  NONE = "none",
  DAILY = "daily",
  WEEKLY = "weekly",
  MONTHLY = "monthly",
  YEARLY = "yearly",
}

export interface TaskPublic {
  id: string
  owner_id: string
  title: string
  description?: string | null
  priority: TaskPriority
  status: TaskStatus
  due_date?: string | null
  completed_at?: string | null
  progress: number
  tags?: string[] | null
  parent_id?: string | null
  repeat_type: TaskRepeatType
  repeat_interval?: number | null
  repeat_days?: number[] | null
  repeat_end_date?: string | null
  is_deleted: boolean
  is_archived: boolean
  created_at?: string | null
  updated_at?: string | null
  is_overdue?: boolean | null
}

export interface TasksPublic {
  data: TaskPublic[]
  count: number
}

export interface TaskWithSubtasks extends TaskPublic {
  children: TaskWithSubtasks[]
}

export interface TasksWithSubtasksPublic {
  data: TaskWithSubtasks[]
  count: number
}

export interface TaskCreate {
  title: string
  description?: string | null
  priority?: TaskPriority
  status?: TaskStatus
  due_date?: string | Date | null
  progress?: number
  tags?: string[] | null
  parent_id?: string | null
  repeat_type?: TaskRepeatType
  repeat_interval?: number | null
  repeat_days?: number[] | null
  repeat_end_date?: string | Date | null
}

export interface TaskUpdate {
  title?: string | null
  description?: string | null
  priority?: TaskPriority | null
  status?: TaskStatus | null
  due_date?: string | Date | null
  progress?: number | null
  tags?: string[] | null
  parent_id?: string | null
  repeat_type?: TaskRepeatType | null
  repeat_interval?: number | null
  repeat_days?: number[] | null
  repeat_end_date?: string | Date | null
}

export interface TaskStatistics {
  total_tasks: number
  todo_tasks: number
  in_progress_tasks: number
  done_tasks: number
  cancelled_tasks: number
  on_hold_tasks: number
  overdue_tasks: number
  high_priority_tasks: number
  urgent_priority_tasks: number
  completion_rate: number
  archived_tasks: number
  deleted_tasks: number
}

export interface TaskTrendDay {
  date: string
  created_count: number
  completed_count: number
  overdue_count: number
}

export interface TaskTrend {
  days: TaskTrendDay[]
}

export interface Message {
  message: string
}

export interface TasksReadTasksData {
  skip?: number
  limit?: number
  status?: TaskStatus
  priority?: TaskPriority
  search?: string
  from_date?: string | Date
  to_date?: string | Date
  include_archived?: boolean
  include_deleted?: boolean
  parent_id?: string
}

export interface TasksCreateTaskData {
  requestBody: TaskCreate
}

export interface TasksReadTaskData {
  id: string
}

export interface TasksUpdateTaskData {
  id: string
  requestBody: TaskUpdate
}

export interface TasksDeleteTaskData {
  id: string
}

export interface TasksUpdateTaskStatusData {
  id: string
  status: TaskStatus
}

export interface TasksSoftDeleteTaskData {
  id: string
}

export interface TasksRestoreTaskData {
  id: string
}

export interface TasksArchiveTaskData {
  id: string
}

export interface TasksUnarchiveTaskData {
  id: string
}

export interface TasksGetTaskTrendData {
  days: number
}

export interface TasksGetTaskTreeData {
  status?: TaskStatus
  priority?: TaskPriority
  search?: string
  include_archived?: boolean
  include_deleted?: boolean
}

export class TasksService {
  /**
   * Read Tasks Tree
   * @param data The data for the request.
   * @returns TasksWithSubtasksPublic Successful Response
   * @throws ApiError
   */
  public static getTaskTree(
    data: TasksGetTaskTreeData = {},
  ): CancelablePromise<TasksWithSubtasksPublic> {
    return __request(OpenAPI, {
      method: "GET",
      url: "/api/v1/tasks/tree",
      query: {
        status: data.status,
        priority: data.priority,
        search: data.search,
        include_archived: data.include_archived,
        include_deleted: data.include_deleted,
      },
      errors: {
        422: "Validation Error",
      },
    })
  }

  /**
   * Read Tasks
   * @param data The data for the request.
   * @returns TasksPublic Successful Response
   * @throws ApiError
   */
  public static readTasks(
    data: TasksReadTasksData = {},
  ): CancelablePromise<TasksPublic> {
    return __request(OpenAPI, {
      method: "GET",
      url: "/api/v1/tasks/",
      query: {
        skip: data.skip,
        limit: data.limit,
        status: data.status,
        priority: data.priority,
        search: data.search,
        from_date: data.from_date,
        to_date: data.to_date,
        include_archived: data.include_archived,
        include_deleted: data.include_deleted,
        parent_id: data.parent_id,
      },
      errors: {
        422: "Validation Error",
      },
    })
  }

  /**
   * Create Task
   * @param data The data for the request.
   * @returns TaskPublic Successful Response
   * @throws ApiError
   */
  public static createTask(
    data: TasksCreateTaskData,
  ): CancelablePromise<TaskPublic> {
    return __request(OpenAPI, {
      method: "POST",
      url: "/api/v1/tasks/",
      body: data.requestBody,
      mediaType: "application/json",
      errors: {
        422: "Validation Error",
      },
    })
  }

  /**
   * Read Task
   * @param data The data for the request.
   * @returns TaskPublic Successful Response
   * @throws ApiError
   */
  public static readTask(
    data: TasksReadTaskData,
  ): CancelablePromise<TaskPublic> {
    return __request(OpenAPI, {
      method: "GET",
      url: "/api/v1/tasks/{id}",
      path: {
        id: data.id,
      },
      errors: {
        422: "Validation Error",
      },
    })
  }

  /**
   * Update Task
   * @param data The data for the request.
   * @returns TaskPublic Successful Response
   * @throws ApiError
   */
  public static updateTask(
    data: TasksUpdateTaskData,
  ): CancelablePromise<TaskPublic> {
    return __request(OpenAPI, {
      method: "PATCH",
      url: "/api/v1/tasks/{id}",
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

  /**
   * Delete Task
   * @param data The data for the request.
   * @returns Message Successful Response
   * @throws ApiError
   */
  public static deleteTask(
    data: TasksDeleteTaskData,
  ): CancelablePromise<Message> {
    return __request(OpenAPI, {
      method: "DELETE",
      url: "/api/v1/tasks/{id}",
      path: {
        id: data.id,
      },
      errors: {
        422: "Validation Error",
      },
    })
  }

  /**
   * Update Task Status
   * @param data The data for the request.
   * @returns TaskPublic Successful Response
   * @throws ApiError
   */
  public static updateTaskStatus(
    data: TasksUpdateTaskStatusData,
  ): CancelablePromise<TaskPublic> {
    return __request(OpenAPI, {
      method: "PATCH",
      url: "/api/v1/tasks/{id}/status/{status}",
      path: {
        id: data.id,
        status: data.status,
      },
      errors: {
        422: "Validation Error",
      },
    })
  }

  /**
   * Soft Delete Task
   * @param data The data for the request.
   * @returns Message Successful Response
   * @throws ApiError
   */
  public static softDeleteTask(
    data: TasksSoftDeleteTaskData,
  ): CancelablePromise<Message> {
    return __request(OpenAPI, {
      method: "PATCH",
      url: "/api/v1/tasks/{id}/soft-delete",
      path: {
        id: data.id,
      },
      errors: {
        422: "Validation Error",
      },
    })
  }

  /**
   * Restore Task
   * @param data The data for the request.
   * @returns Message Successful Response
   * @throws ApiError
   */
  public static restoreTask(
    data: TasksRestoreTaskData,
  ): CancelablePromise<Message> {
    return __request(OpenAPI, {
      method: "PATCH",
      url: "/api/v1/tasks/{id}/restore",
      path: {
        id: data.id,
      },
      errors: {
        422: "Validation Error",
      },
    })
  }

  /**
   * Archive Task
   * @param data The data for the request.
   * @returns Message Successful Response
   * @throws ApiError
   */
  public static archiveTask(
    data: TasksArchiveTaskData,
  ): CancelablePromise<Message> {
    return __request(OpenAPI, {
      method: "PATCH",
      url: "/api/v1/tasks/{id}/archive",
      path: {
        id: data.id,
      },
      errors: {
        422: "Validation Error",
      },
    })
  }

  /**
   * Unarchive Task
   * @param data The data for the request.
   * @returns Message Successful Response
   * @throws ApiError
   */
  public static unarchiveTask(
    data: TasksUnarchiveTaskData,
  ): CancelablePromise<Message> {
    return __request(OpenAPI, {
      method: "PATCH",
      url: "/api/v1/tasks/{id}/unarchive",
      path: {
        id: data.id,
      },
      errors: {
        422: "Validation Error",
      },
    })
  }

  /**
   * Empty Trash
   * @returns Message Successful Response
   * @throws ApiError
   */
  public static emptyTrash(): CancelablePromise<Message> {
    return __request(OpenAPI, {
      method: "DELETE",
      url: "/api/v1/tasks/trash/empty",
      errors: {
        422: "Validation Error",
      },
    })
  }

  /**
   * Get Task Statistics
   * @returns TaskStatistics Successful Response
   * @throws ApiError
   */
  public static getTaskStatistics(): CancelablePromise<TaskStatistics> {
    return __request(OpenAPI, {
      method: "GET",
      url: "/api/v1/tasks/statistics",
      errors: {
        422: "Validation Error",
      },
    })
  }

  /**
   * Get Task Trend
   * @param data The data for the request.
   * @returns TaskTrend Successful Response
   * @throws ApiError
   */
  public static getTaskTrend(
    data: TasksGetTaskTrendData,
  ): CancelablePromise<TaskTrend> {
    return __request(OpenAPI, {
      method: "GET",
      url: "/api/v1/tasks/trend/{days}",
      path: {
        days: data.days,
      },
      errors: {
        422: "Validation Error",
      },
    })
  }

  /**
   * Read Trash
   * @param data The data for the request.
   * @returns TasksPublic Successful Response
   * @throws ApiError
   */
  public static readTrash(
    data: { skip?: number; limit?: number } = {},
  ): CancelablePromise<TasksPublic> {
    return __request(OpenAPI, {
      method: "GET",
      url: "/api/v1/tasks/trash",
      query: {
        skip: data.skip,
        limit: data.limit,
      },
      errors: {
        422: "Validation Error",
      },
    })
  }

  /**
   * Read Archived
   * @param data The data for the request.
   * @returns TasksPublic Successful Response
   * @throws ApiError
   */
  public static readArchived(
    data: { skip?: number; limit?: number } = {},
  ): CancelablePromise<TasksPublic> {
    return __request(OpenAPI, {
      method: "GET",
      url: "/api/v1/tasks/archived",
      query: {
        skip: data.skip,
        limit: data.limit,
      },
      errors: {
        422: "Validation Error",
      },
    })
  }
}

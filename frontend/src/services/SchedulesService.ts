import type { CancelablePromise } from "@/client/core/CancelablePromise"
import { OpenAPI } from "@/client/core/OpenAPI"
import { request as __request } from "@/client/core/request"

export enum ScheduleColor {
  RED = "#EF4444",
  ORANGE = "#F97316",
  YELLOW = "#EAB308",
  GREEN = "#22C55E",
  TEAL = "#14B8A6",
  BLUE = "#3B82F6",
  INDIGO = "#6366F1",
  PURPLE = "#A855F7",
  PINK = "#EC4899",
  GRAY = "#6B7280",
}

export enum ScheduleCategory {
  WORK = "work",
  PERSONAL = "personal",
  IMPORTANT = "important",
  MEETING = "meeting",
  OTHER = "other",
}

export enum ScheduleRecurringType {
  NONE = "none",
  DAILY = "daily",
  WEEKLY = "weekly",
  MONTHLY = "monthly",
  YEARLY = "yearly",
}

export interface SchedulePublic {
  id: string
  title: string
  description?: string | null
  start_time: string
  end_time: string
  color: ScheduleColor
  category: ScheduleCategory
  is_recurring: boolean
  recurring_type: ScheduleRecurringType
  recurring_interval?: number | null
  recurring_end_date?: string | null
  reminder_minutes?: number | null
  is_all_day: boolean
  is_deleted: boolean
  owner_id: string
  created_at?: string | null
  updated_at?: string | null
}

export interface SchedulesPublic {
  data: SchedulePublic[]
  count: number
}

export interface ScheduleCreate {
  title: string
  description?: string | null
  start_time: string
  end_time: string
  color?: ScheduleColor
  category?: ScheduleCategory
  is_recurring?: boolean
  recurring_type?: ScheduleRecurringType
  recurring_interval?: number | null
  recurring_end_date?: string | null
  reminder_minutes?: number | null
  is_all_day?: boolean
}

export interface ScheduleUpdate {
  title?: string | null
  description?: string | null
  start_time?: string | null
  end_time?: string | null
  color?: ScheduleColor | null
  category?: ScheduleCategory | null
  is_recurring?: boolean | null
  recurring_type?: ScheduleRecurringType | null
  recurring_interval?: number | null
  recurring_end_date?: string | null
  reminder_minutes?: number | null
  is_all_day?: boolean | null
}

export interface ScheduleDayEvents {
  date: string
  events: SchedulePublic[]
}

export interface ScheduleCalendarView {
  year: number
  month: number
  days: ScheduleDayEvents[]
}

export interface Message {
  message: string
}

export const ScheduleCategoryLabels: Record<ScheduleCategory, string> = {
  [ScheduleCategory.WORK]: "工作",
  [ScheduleCategory.PERSONAL]: "生活",
  [ScheduleCategory.IMPORTANT]: "重要事项",
  [ScheduleCategory.MEETING]: "会议",
  [ScheduleCategory.OTHER]: "其他",
}

export const ScheduleColorNames: Record<ScheduleColor, string> = {
  [ScheduleColor.RED]: "红色",
  [ScheduleColor.ORANGE]: "橙色",
  [ScheduleColor.YELLOW]: "黄色",
  [ScheduleColor.GREEN]: "绿色",
  [ScheduleColor.TEAL]: "青色",
  [ScheduleColor.BLUE]: "蓝色",
  [ScheduleColor.INDIGO]: "靛蓝",
  [ScheduleColor.PURPLE]: "紫色",
  [ScheduleColor.PINK]: "粉色",
  [ScheduleColor.GRAY]: "灰色",
}

export class SchedulesService {
  public static readSchedules(
    data: {
      skip?: number
      limit?: number
      from_date?: string
      to_date?: string
      category?: ScheduleCategory
      include_deleted?: boolean
    } = {},
  ): CancelablePromise<SchedulesPublic> {
    return __request(OpenAPI, {
      method: "GET",
      url: "/api/v1/schedules/",
      query: {
        skip: data.skip,
        limit: data.limit,
        from_date: data.from_date,
        to_date: data.to_date,
        category: data.category,
        include_deleted: data.include_deleted,
      },
      errors: {
        422: "Validation Error",
      },
    })
  }

  public static getCalendarView(
    data: { year: number; month: number },
  ): CancelablePromise<ScheduleCalendarView> {
    return __request(OpenAPI, {
      method: "GET",
      url: "/api/v1/schedules/calendar",
      query: {
        year: data.year,
        month: data.month,
      },
      errors: {
        422: "Validation Error",
      },
    })
  }

  public static getUpcomingSchedules(
    data: { hours?: number } = {},
  ): CancelablePromise<SchedulesPublic> {
    return __request(OpenAPI, {
      method: "GET",
      url: "/api/v1/schedules/upcoming",
      query: {
        hours: data.hours,
      },
      errors: {
        422: "Validation Error",
      },
    })
  }

  public static getPendingReminders(): CancelablePromise<SchedulesPublic> {
    return __request(OpenAPI, {
      method: "GET",
      url: "/api/v1/schedules/reminders/pending",
      errors: {
        422: "Validation Error",
      },
    })
  }

  public static readSchedule(
    data: { id: string },
  ): CancelablePromise<SchedulePublic> {
    return __request(OpenAPI, {
      method: "GET",
      url: "/api/v1/schedules/{id}",
      path: {
        id: data.id,
      },
      errors: {
        422: "Validation Error",
      },
    })
  }

  public static createSchedule(
    data: { requestBody: ScheduleCreate },
  ): CancelablePromise<SchedulePublic> {
    return __request(OpenAPI, {
      method: "POST",
      url: "/api/v1/schedules/",
      body: data.requestBody,
      mediaType: "application/json",
      errors: {
        422: "Validation Error",
      },
    })
  }

  public static updateSchedule(
    data: { id: string; requestBody: ScheduleUpdate },
  ): CancelablePromise<SchedulePublic> {
    return __request(OpenAPI, {
      method: "PATCH",
      url: "/api/v1/schedules/{id}",
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

  public static softDeleteSchedule(
    data: { id: string },
  ): CancelablePromise<Message> {
    return __request(OpenAPI, {
      method: "PATCH",
      url: "/api/v1/schedules/{id}/soft-delete",
      path: {
        id: data.id,
      },
      errors: {
        422: "Validation Error",
      },
    })
  }

  public static restoreSchedule(
    data: { id: string },
  ): CancelablePromise<Message> {
    return __request(OpenAPI, {
      method: "PATCH",
      url: "/api/v1/schedules/{id}/restore",
      path: {
        id: data.id,
      },
      errors: {
        422: "Validation Error",
      },
    })
  }

  public static deleteSchedule(
    data: { id: string },
  ): CancelablePromise<Message> {
    return __request(OpenAPI, {
      method: "DELETE",
      url: "/api/v1/schedules/{id}",
      path: {
        id: data.id,
      },
      errors: {
        422: "Validation Error",
      },
    })
  }
}

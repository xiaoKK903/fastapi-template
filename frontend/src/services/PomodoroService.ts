import type { CancelablePromise } from "@/client/core/CancelablePromise"
import { OpenAPI } from "@/client/core/OpenAPI"
import { request as __request } from "@/client/core/request"

export enum PomodoroSessionType {
  FOCUS = "focus",
  SHORT_BREAK = "short_break",
  LONG_BREAK = "long_break",
}

export enum PomodoroSessionStatus {
  PENDING = "pending",
  RUNNING = "running",
  PAUSED = "paused",
  COMPLETED = "completed",
  CANCELLED = "cancelled",
}

export interface PomodoroSettingsPublic {
  id: string
  owner_id: string
  focus_duration_minutes: number
  short_break_duration_minutes: number
  long_break_duration_minutes: number
  sessions_before_long_break: number
  auto_start_breaks: boolean
  auto_start_focus: boolean
  sound_enabled: boolean
  notification_enabled: boolean
  updated_at?: string | null
}

export interface PomodoroSessionPublic {
  id: string
  session_type: PomodoroSessionType
  duration_minutes: number
  status: PomodoroSessionStatus
  actual_duration_seconds?: number | null
  start_time?: string | null
  end_time?: string | null
  title?: string | null
  description?: string | null
  owner_id: string
  created_at?: string | null
}

export interface PomodoroSessionsPublic {
  data: PomodoroSessionPublic[]
  count: number
}

export interface PomodoroDailyStats {
  date: string
  total_focus_sessions: number
  total_focus_minutes: number
  total_break_sessions: number
  total_break_minutes: number
}

export interface PomodoroWeeklyStats {
  days: PomodoroDailyStats[]
  total_focus_sessions: number
  total_focus_minutes: number
}

export interface Message {
  message: string
}

export const PomodoroSessionTypeLabels: Record<PomodoroSessionType, string> = {
  [PomodoroSessionType.FOCUS]: "专注",
  [PomodoroSessionType.SHORT_BREAK]: "短休息",
  [PomodoroSessionType.LONG_BREAK]: "长休息",
}

export const PomodoroSessionStatusLabels: Record<PomodoroSessionStatus, string> = {
  [PomodoroSessionStatus.PENDING]: "待开始",
  [PomodoroSessionStatus.RUNNING]: "进行中",
  [PomodoroSessionStatus.PAUSED]: "已暂停",
  [PomodoroSessionStatus.COMPLETED]: "已完成",
  [PomodoroSessionStatus.CANCELLED]: "已取消",
}

export class PomodoroService {
  public static getSettings(): CancelablePromise<PomodoroSettingsPublic> {
    return __request(OpenAPI, {
      method: "GET",
      url: "/api/v1/pomodoros/settings",
      errors: {
        422: "Validation Error",
      },
    })
  }

  public static updateSettings(
    data: {
      focus_duration_minutes?: number
      short_break_duration_minutes?: number
      long_break_duration_minutes?: number
      sessions_before_long_break?: number
      auto_start_breaks?: boolean
      auto_start_focus?: boolean
      sound_enabled?: boolean
      notification_enabled?: boolean
    },
  ): CancelablePromise<PomodoroSettingsPublic> {
    return __request(OpenAPI, {
      method: "PATCH",
      url: "/api/v1/pomodoros/settings",
      query: {
        focus_duration_minutes: data.focus_duration_minutes,
        short_break_duration_minutes: data.short_break_duration_minutes,
        long_break_duration_minutes: data.long_break_duration_minutes,
        sessions_before_long_break: data.sessions_before_long_break,
        auto_start_breaks: data.auto_start_breaks,
        auto_start_focus: data.auto_start_focus,
        sound_enabled: data.sound_enabled,
        notification_enabled: data.notification_enabled,
      },
      errors: {
        422: "Validation Error",
      },
    })
  }

  public static createSession(
    data: {
      requestBody: {
        session_type?: PomodoroSessionType
        duration_minutes?: number
        title?: string | null
        description?: string | null
      }
    },
  ): CancelablePromise<PomodoroSessionPublic> {
    return __request(OpenAPI, {
      method: "POST",
      url: "/api/v1/pomodoros/sessions",
      body: data.requestBody,
      mediaType: "application/json",
      errors: {
        422: "Validation Error",
      },
    })
  }

  public static getSessions(
    data: {
      skip?: number
      limit?: number
      session_type?: PomodoroSessionType
      status?: PomodoroSessionStatus
    } = {},
  ): CancelablePromise<PomodoroSessionsPublic> {
    return __request(OpenAPI, {
      method: "GET",
      url: "/api/v1/pomodoros/sessions",
      query: {
        skip: data.skip,
        limit: data.limit,
        session_type: data.session_type,
        status: data.status,
      },
      errors: {
        422: "Validation Error",
      },
    })
  }

  public static getTodaySessions(): CancelablePromise<PomodoroSessionsPublic> {
    return __request(OpenAPI, {
      method: "GET",
      url: "/api/v1/pomodoros/sessions/today",
      errors: {
        422: "Validation Error",
      },
    })
  }

  public static getSession(
    data: { session_id: string },
  ): CancelablePromise<PomodoroSessionPublic> {
    return __request(OpenAPI, {
      method: "GET",
      url: "/api/v1/pomodoros/sessions/{session_id}",
      path: {
        session_id: data.session_id,
      },
      errors: {
        422: "Validation Error",
      },
    })
  }

  public static updateSession(
    data: {
      session_id: string
      status?: PomodoroSessionStatus
      actual_duration_seconds?: number
      start_time?: string
      end_time?: string
      title?: string
      description?: string
    },
  ): CancelablePromise<PomodoroSessionPublic> {
    return __request(OpenAPI, {
      method: "PATCH",
      url: "/api/v1/pomodoros/sessions/{session_id}",
      path: {
        session_id: data.session_id,
      },
      query: {
        status: data.status,
        actual_duration_seconds: data.actual_duration_seconds,
        start_time: data.start_time,
        end_time: data.end_time,
        title: data.title,
        description: data.description,
      },
      errors: {
        422: "Validation Error",
      },
    })
  }

  public static startSession(
    data: { session_id: string },
  ): CancelablePromise<PomodoroSessionPublic> {
    return __request(OpenAPI, {
      method: "POST",
      url: "/api/v1/pomodoros/sessions/{session_id}/start",
      path: {
        session_id: data.session_id,
      },
      errors: {
        422: "Validation Error",
      },
    })
  }

  public static pauseSession(
    data: { session_id: string },
  ): CancelablePromise<PomodoroSessionPublic> {
    return __request(OpenAPI, {
      method: "POST",
      url: "/api/v1/pomodoros/sessions/{session_id}/pause",
      path: {
        session_id: data.session_id,
      },
      errors: {
        422: "Validation Error",
      },
    })
  }

  public static resumeSession(
    data: { session_id: string },
  ): CancelablePromise<PomodoroSessionPublic> {
    return __request(OpenAPI, {
      method: "POST",
      url: "/api/v1/pomodoros/sessions/{session_id}/resume",
      path: {
        session_id: data.session_id,
      },
      errors: {
        422: "Validation Error",
      },
    })
  }

  public static completeSession(
    data: { session_id: string; actual_duration_seconds?: number },
  ): CancelablePromise<PomodoroSessionPublic> {
    return __request(OpenAPI, {
      method: "POST",
      url: "/api/v1/pomodoros/sessions/{session_id}/complete",
      path: {
        session_id: data.session_id,
      },
      query: {
        actual_duration_seconds: data.actual_duration_seconds,
      },
      errors: {
        422: "Validation Error",
      },
    })
  }

  public static cancelSession(
    data: { session_id: string },
  ): CancelablePromise<PomodoroSessionPublic> {
    return __request(OpenAPI, {
      method: "POST",
      url: "/api/v1/pomodoros/sessions/{session_id}/cancel",
      path: {
        session_id: data.session_id,
      },
      errors: {
        422: "Validation Error",
      },
    })
  }

  public static deleteSession(
    data: { session_id: string },
  ): CancelablePromise<Message> {
    return __request(OpenAPI, {
      method: "DELETE",
      url: "/api/v1/pomodoros/sessions/{session_id}",
      path: {
        session_id: data.session_id,
      },
      errors: {
        422: "Validation Error",
      },
    })
  }

  public static getDailyStats(
    data: { date_str?: string } = {},
  ): CancelablePromise<PomodoroDailyStats> {
    return __request(OpenAPI, {
      method: "GET",
      url: "/api/v1/pomodoros/stats/daily",
      query: {
        date_str: data.date_str,
      },
      errors: {
        422: "Validation Error",
      },
    })
  }

  public static getWeeklyStats(): CancelablePromise<PomodoroWeeklyStats> {
    return __request(OpenAPI, {
      method: "GET",
      url: "/api/v1/pomodoros/stats/weekly",
      errors: {
        422: "Validation Error",
      },
    })
  }
}

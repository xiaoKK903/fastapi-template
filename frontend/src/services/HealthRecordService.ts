import type { CancelablePromise } from "@/client/core/CancelablePromise"
import { OpenAPI } from "@/client/core/OpenAPI"
import { request as __request } from "@/client/core/request"

export interface HealthRecordPublic {
  id: string
  record_date: string
  height?: number | null
  weight?: number | null
  heart_rate?: number | null
  blood_pressure_systolic?: number | null
  blood_pressure_diastolic?: number | null
  sleep_duration?: number | null
  exercise_duration?: number | null
  tags?: string[] | null
  notes?: string | null
  owner_id: string
  created_at?: string | null
  updated_at?: string | null
}

export interface HealthRecordsPublic {
  data: HealthRecordPublic[]
  count: number
}

export interface Message {
  message: string
}

export interface HealthRecordCreate {
  record_date: string
  height?: number | null
  weight?: number | null
  heart_rate?: number | null
  blood_pressure_systolic?: number | null
  blood_pressure_diastolic?: number | null
  sleep_duration?: number | null
  exercise_duration?: number | null
  tags?: string[] | null
  notes?: string | null
}

export interface HealthRecordUpdate {
  record_date?: string | null
  height?: number | null
  weight?: number | null
  heart_rate?: number | null
  blood_pressure_systolic?: number | null
  blood_pressure_diastolic?: number | null
  sleep_duration?: number | null
  exercise_duration?: number | null
  tags?: string[] | null
  notes?: string | null
}

export class HealthRecordService {
  public static getRecords(
    data: {
      skip?: number
      limit?: number
      start_date?: string
      end_date?: string
      tag?: string
    } = {},
  ): CancelablePromise<HealthRecordsPublic> {
    return __request(OpenAPI, {
      method: "GET",
      url: "/api/v1/health/records",
      query: {
        skip: data.skip,
        limit: data.limit,
        start_date: data.start_date,
        end_date: data.end_date,
        tag: data.tag,
      },
      errors: {
        422: "Validation Error",
      },
    })
  }

  public static getRecord(
    data: { record_id: string },
  ): CancelablePromise<HealthRecordPublic> {
    return __request(OpenAPI, {
      method: "GET",
      url: "/api/v1/health/records/{record_id}",
      path: {
        record_id: data.record_id,
      },
      errors: {
        422: "Validation Error",
      },
    })
  }

  public static createRecord(
    data: { requestBody: HealthRecordCreate },
  ): CancelablePromise<HealthRecordPublic> {
    return __request(OpenAPI, {
      method: "POST",
      url: "/api/v1/health/records",
      body: data.requestBody,
      mediaType: "application/json",
      errors: {
        422: "Validation Error",
      },
    })
  }

  public static updateRecord(
    data: {
      record_id: string
      requestBody: HealthRecordUpdate
    },
  ): CancelablePromise<HealthRecordPublic> {
    return __request(OpenAPI, {
      method: "PATCH",
      url: "/api/v1/health/records/{record_id}",
      path: {
        record_id: data.record_id,
      },
      body: data.requestBody,
      mediaType: "application/json",
      errors: {
        422: "Validation Error",
      },
    })
  }

  public static deleteRecord(
    data: { record_id: string },
  ): CancelablePromise<Message> {
    return __request(OpenAPI, {
      method: "DELETE",
      url: "/api/v1/health/records/{record_id}",
      path: {
        record_id: data.record_id,
      },
      errors: {
        422: "Validation Error",
      },
    })
  }
}

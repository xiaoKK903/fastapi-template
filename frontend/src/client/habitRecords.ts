import type { CancelablePromise } from './core/CancelablePromise';
import { OpenAPI } from './core/OpenAPI';
import { request as __request } from './core/request';

export type HabitRecordCreate = {
    habit_id: string;
    check_date: string;
    count?: number;
    note?: string | null;
};

export type HabitRecordPublic = {
    count: number;
    note?: string | null;
    id: string;
    habit_id: string;
    owner_id: string;
    check_date: string;
    created_at?: string | null;
};

export type HabitRecordsPublic = {
    data: Array<HabitRecordPublic>;
    count: number;
};

export type HabitCalendarDay = {
    date: string;
    total_count: number;
    completed_count: number;
    habit_ids: Array<string>;
};

export type HabitCalendar = {
    year: number;
    month: number;
    days: Array<HabitCalendarDay>;
};

export type HabitTrendDay = {
    date: string;
    completed_count: number;
    total_habits: number;
};

export type HabitTrend = {
    days: Array<HabitTrendDay>;
};

export type HabitStatistics = {
    total_habits: number;
    total_checks_last_30_days: number;
    average_checks_per_day: number;
    most_active_day?: string | null;
    streak_days: number;
};

export type Message = {
    message: string;
};

export class HabitRecordsService {
    public static readHabitRecords(data: {
        habit_id?: string;
        start_date?: string;
        end_date?: string;
        skip?: number;
        limit?: number;
    } = {}): CancelablePromise<HabitRecordsPublic> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/habit-records/',
            query: {
                habit_id: data.habit_id,
                start_date: data.start_date,
                end_date: data.end_date,
                skip: data.skip,
                limit: data.limit,
            },
            errors: {
                422: 'Validation Error',
            },
        });
    }

    public static getHabitCalendar(data: {
        year: number;
        month: number;
    }): CancelablePromise<HabitCalendar> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/habit-records/calendar',
            query: {
                year: data.year,
                month: data.month,
            },
            errors: {
                422: 'Validation Error',
            },
        });
    }

    public static getHabitTrend(data: {
        days?: number;
    } = {}): CancelablePromise<HabitTrend> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/habit-records/trend',
            query: {
                days: data.days,
            },
            errors: {
                422: 'Validation Error',
            },
        });
    }

    public static getHabitStatistics(): CancelablePromise<HabitStatistics> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/habit-records/statistics',
            errors: {
                422: 'Validation Error',
            },
        });
    }

    public static createHabitRecord(data: {
        requestBody: HabitRecordCreate;
    }): CancelablePromise<HabitRecordPublic> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/v1/habit-records/',
            body: data.requestBody,
            mediaType: 'application/json',
            errors: {
                422: 'Validation Error',
            },
        });
    }

    public static deleteHabitRecord(data: {
        id: string;
    }): CancelablePromise<Message> {
        return __request(OpenAPI, {
            method: 'DELETE',
            url: '/api/v1/habit-records/{id}',
            path: {
                id: data.id,
            },
            errors: {
                422: 'Validation Error',
            },
        });
    }
}

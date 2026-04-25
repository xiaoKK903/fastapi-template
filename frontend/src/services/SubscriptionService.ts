import type { CancelablePromise } from "@/client/core/CancelablePromise"
import { OpenAPI } from "@/client/core/OpenAPI"
import { request as __request } from "@/client/core/request"

export enum SubscriptionCategory {
  VIP_MEMBER = "vip_member",
  SOFTWARE_SUBSCRIPTION = "software_subscription",
  PAID_SERVICE = "paid_service",
  MUSIC = "music",
  VIDEO = "video",
  CLOUD_STORAGE = "cloud_storage",
  GYM = "gym",
  OTHER = "other",
}

export enum BillingCycle {
  MONTHLY = "monthly",
  QUARTERLY = "quarterly",
  YEARLY = "yearly",
  LIFETIME = "lifetime",
  ONE_TIME = "one_time",
}

export const SubscriptionCategoryLabels: Record<SubscriptionCategory, string> = {
  [SubscriptionCategory.VIP_MEMBER]: "VIP会员",
  [SubscriptionCategory.SOFTWARE_SUBSCRIPTION]: "软件订阅",
  [SubscriptionCategory.PAID_SERVICE]: "付费服务",
  [SubscriptionCategory.MUSIC]: "音乐会员",
  [SubscriptionCategory.VIDEO]: "视频会员",
  [SubscriptionCategory.CLOUD_STORAGE]: "云存储",
  [SubscriptionCategory.GYM]: "健身会员",
  [SubscriptionCategory.OTHER]: "其他",
}

export const BillingCycleLabels: Record<BillingCycle, string> = {
  [BillingCycle.MONTHLY]: "月付",
  [BillingCycle.QUARTERLY]: "季付",
  [BillingCycle.YEARLY]: "年付",
  [BillingCycle.LIFETIME]: "终身",
  [BillingCycle.ONE_TIME]: "一次性",
}

export interface SubscriptionPublic {
  id: string
  name: string
  category: SubscriptionCategory
  service_provider?: string | null
  price?: number | null
  original_price?: number | null
  billing_cycle: BillingCycle
  start_date?: string | null
  end_date?: string | null
  next_billing_date?: string | null
  auto_renewal: boolean
  is_active: boolean
  description?: string | null
  notes?: string | null
  account_email?: string | null
  payment_method?: string | null
  tags?: string[] | null
  owner_id: string
  created_at?: string | null
  updated_at?: string | null
}

export interface SubscriptionsPublic {
  data: SubscriptionPublic[]
  count: number
}

export interface SubscriptionStatistics {
  total_subscriptions: number
  active_count: number
  expired_count: number
  auto_renewal_count: number
  manual_renewal_count: number
  total_monthly_cost?: number | null
  total_yearly_cost?: number | null
  expiring_soon_count: number
  expired_count: number
}

export interface Message {
  message: string
}

export interface SubscriptionCreate {
  name: string
  category?: SubscriptionCategory
  service_provider?: string | null
  price?: number | null
  original_price?: number | null
  billing_cycle?: BillingCycle
  start_date?: string | null
  end_date?: string | null
  next_billing_date?: string | null
  auto_renewal?: boolean
  is_active?: boolean
  description?: string | null
  notes?: string | null
  account_email?: string | null
  payment_method?: string | null
  tags?: string[] | null
}

export interface SubscriptionUpdate {
  name?: string | null
  category?: SubscriptionCategory | null
  service_provider?: string | null
  price?: number | null
  original_price?: number | null
  billing_cycle?: BillingCycle | null
  start_date?: string | null
  end_date?: string | null
  next_billing_date?: string | null
  auto_renewal?: boolean | null
  is_active?: boolean | null
  description?: string | null
  notes?: string | null
  account_email?: string | null
  payment_method?: string | null
  tags?: string[] | null
}

export class SubscriptionService {
  public static getSubscriptions(
    data: {
      skip?: number
      limit?: number
      category?: SubscriptionCategory
      billing_cycle?: BillingCycle
      is_active?: boolean
      auto_renewal?: boolean
      expiring_soon?: boolean
      expired?: boolean
      search?: string
    } = {},
  ): CancelablePromise<SubscriptionsPublic> {
    return __request(OpenAPI, {
      method: "GET",
      url: "/api/v1/subscriptions/",
      query: {
        skip: data.skip,
        limit: data.limit,
        category: data.category,
        billing_cycle: data.billing_cycle,
        is_active: data.is_active,
        auto_renewal: data.auto_renewal,
        expiring_soon: data.expiring_soon,
        expired: data.expired,
        search: data.search || undefined,
      },
      errors: {
        422: "Validation Error",
      },
    })
  }

  public static getSubscriptionStats(): CancelablePromise<SubscriptionStatistics> {
    return __request(OpenAPI, {
      method: "GET",
      url: "/api/v1/subscriptions/stats",
      errors: {
        422: "Validation Error",
      },
    })
  }

  public static getSubscription(
    data: { subscription_id: string },
  ): CancelablePromise<SubscriptionPublic> {
    return __request(OpenAPI, {
      method: "GET",
      url: "/api/v1/subscriptions/{subscription_id}",
      path: {
        subscription_id: data.subscription_id,
      },
      errors: {
        422: "Validation Error",
      },
    })
  }

  public static createSubscription(
    data: { requestBody: SubscriptionCreate },
  ): CancelablePromise<SubscriptionPublic> {
    return __request(OpenAPI, {
      method: "POST",
      url: "/api/v1/subscriptions/",
      body: data.requestBody,
      mediaType: "application/json",
      errors: {
        422: "Validation Error",
      },
    })
  }

  public static updateSubscription(
    data: {
      subscription_id: string
      requestBody: SubscriptionUpdate
    },
  ): CancelablePromise<SubscriptionPublic> {
    return __request(OpenAPI, {
      method: "PATCH",
      url: "/api/v1/subscriptions/{subscription_id}",
      path: {
        subscription_id: data.subscription_id,
      },
      body: data.requestBody,
      mediaType: "application/json",
      errors: {
        422: "Validation Error",
      },
    })
  }

  public static deleteSubscription(
    data: { subscription_id: string },
  ): CancelablePromise<Message> {
    return __request(OpenAPI, {
      method: "DELETE",
      url: "/api/v1/subscriptions/{subscription_id}",
      path: {
        subscription_id: data.subscription_id,
      },
      errors: {
        422: "Validation Error",
      },
    })
  }
}

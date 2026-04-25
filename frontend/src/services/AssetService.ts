import type { CancelablePromise } from "@/client/core/CancelablePromise"
import { OpenAPI } from "@/client/core/OpenAPI"
import { request as __request } from "@/client/core/request"

export enum AssetCategory {
  ELECTRONICS = "electronics",
  HOME_APPLIANCE = "home_appliance",
  DAILY_USE = "daily_use",
}

export enum AssetStatus {
  IN_USE = "in_use",
  IDLE = "idle",
  SCRAPPED = "scrapped",
  MAINTENANCE = "maintenance",
}

export enum MaintenanceType {
  REPAIR = "repair",
  MAINTENANCE = "maintenance",
}

export const AssetCategoryLabels: Record<AssetCategory, string> = {
  [AssetCategory.ELECTRONICS]: "数码",
  [AssetCategory.HOME_APPLIANCE]: "家电",
  [AssetCategory.DAILY_USE]: "生活用品",
}

export const AssetStatusLabels: Record<AssetStatus, string> = {
  [AssetStatus.IN_USE]: "在用",
  [AssetStatus.IDLE]: "闲置",
  [AssetStatus.SCRAPPED]: "报废",
  [AssetStatus.MAINTENANCE]: "维修中",
}

export const MaintenanceTypeLabels: Record<MaintenanceType, string> = {
  [MaintenanceType.REPAIR]: "维修",
  [MaintenanceType.MAINTENANCE]: "保养",
}

export const AssetStatusColors: Record<AssetStatus, string> = {
  [AssetStatus.IN_USE]: "bg-green-500",
  [AssetStatus.IDLE]: "bg-yellow-500",
  [AssetStatus.SCRAPPED]: "bg-gray-500",
  [AssetStatus.MAINTENANCE]: "bg-orange-500",
}

export interface AssetPublic {
  id: string
  name: string
  category: AssetCategory
  brand?: string | null
  model?: string | null
  purchase_price?: number | null
  purchase_date?: string | null
  purchase_channel?: string | null
  storage_location?: string | null
  warranty_period_months?: number | null
  warranty_expiry_date?: string | null
  status: AssetStatus
  description?: string | null
  receipt_images?: string[] | null
  serial_number?: string | null
  is_archived: boolean
  owner_id: string
  created_at?: string | null
  updated_at?: string | null
}

export interface AssetsPublic {
  data: AssetPublic[]
  count: number
}

export interface AssetStatistics {
  total_assets: number
  in_use_count: number
  idle_count: number
  scrapped_count: number
  maintenance_count: number
  electronics_count: number
  home_appliance_count: number
  daily_use_count: number
  total_purchase_value?: number | null
  warranty_expiring_soon: number
  warranty_expired: number
}

export interface MaintenanceRecordPublic {
  id: string
  asset_id: string
  maintenance_type: MaintenanceType
  maintenance_date?: string | null
  title: string
  description?: string | null
  cost?: number | null
  parts_replaced?: string[] | null
  service_provider?: string | null
  technician_name?: string | null
  warranty_covered: boolean
  notes?: string | null
  owner_id: string
  created_at?: string | null
  updated_at?: string | null
}

export interface MaintenanceRecordsPublic {
  data: MaintenanceRecordPublic[]
  count: number
}

export interface Message {
  message: string
}

export interface AssetCreate {
  name: string
  category?: AssetCategory
  brand?: string | null
  model?: string | null
  purchase_price?: number | null
  purchase_date?: string | null
  purchase_channel?: string | null
  storage_location?: string | null
  warranty_period_months?: number | null
  warranty_expiry_date?: string | null
  status?: AssetStatus
  description?: string | null
  receipt_images?: string[] | null
  serial_number?: string | null
  is_archived?: boolean
}

export interface AssetUpdate {
  name?: string | null
  category?: AssetCategory | null
  brand?: string | null
  model?: string | null
  purchase_price?: number | null
  purchase_date?: string | null
  purchase_channel?: string | null
  storage_location?: string | null
  warranty_period_months?: number | null
  warranty_expiry_date?: string | null
  status?: AssetStatus | null
  description?: string | null
  receipt_images?: string[] | null
  serial_number?: string | null
  is_archived?: boolean | null
}

export interface MaintenanceRecordCreate {
  asset_id: string
  maintenance_type?: MaintenanceType
  maintenance_date?: string | null
  title: string
  description?: string | null
  cost?: number | null
  parts_replaced?: string[] | null
  service_provider?: string | null
  technician_name?: string | null
  warranty_covered?: boolean
  notes?: string | null
}

export interface MaintenanceRecordUpdate {
  maintenance_type?: MaintenanceType | null
  maintenance_date?: string | null
  title?: string | null
  description?: string | null
  cost?: number | null
  parts_replaced?: string[] | null
  service_provider?: string | null
  technician_name?: string | null
  warranty_covered?: boolean | null
  notes?: string | null
}

export class AssetService {
  public static getAssets(
    data: {
      skip?: number
      limit?: number
      category?: AssetCategory
      status?: AssetStatus
      show_archived?: boolean
      warranty_expiring?: boolean
      warranty_expired?: boolean
      search?: string
    } = {},
  ): CancelablePromise<AssetsPublic> {
    return __request(OpenAPI, {
      method: "GET",
      url: "/api/v1/assets/",
      query: {
        skip: data.skip,
        limit: data.limit,
        category: data.category,
        status: data.status,
        show_archived: data.show_archived,
        warranty_expiring: data.warranty_expiring,
        warranty_expired: data.warranty_expired,
        search: data.search,
      },
      errors: {
        422: "Validation Error",
      },
    })
  }

  public static getAssetStats(): CancelablePromise<AssetStatistics> {
    return __request(OpenAPI, {
      method: "GET",
      url: "/api/v1/assets/stats",
      errors: {
        422: "Validation Error",
      },
    })
  }

  public static getArchivedAssets(
    data: { skip?: number; limit?: number } = {},
  ): CancelablePromise<AssetsPublic> {
    return __request(OpenAPI, {
      method: "GET",
      url: "/api/v1/assets/archived",
      query: {
        skip: data.skip,
        limit: data.limit,
      },
      errors: {
        422: "Validation Error",
      },
    })
  }

  public static getAsset(
    data: { asset_id: string },
  ): CancelablePromise<AssetPublic> {
    return __request(OpenAPI, {
      method: "GET",
      url: "/api/v1/assets/{asset_id}",
      path: {
        asset_id: data.asset_id,
      },
      errors: {
        422: "Validation Error",
      },
    })
  }

  public static createAsset(
    data: { requestBody: AssetCreate },
  ): CancelablePromise<AssetPublic> {
    return __request(OpenAPI, {
      method: "POST",
      url: "/api/v1/assets/",
      body: data.requestBody,
      mediaType: "application/json",
      errors: {
        422: "Validation Error",
      },
    })
  }

  public static updateAsset(
    data: {
      asset_id: string
      requestBody: AssetUpdate
    },
  ): CancelablePromise<AssetPublic> {
    return __request(OpenAPI, {
      method: "PATCH",
      url: "/api/v1/assets/{asset_id}",
      path: {
        asset_id: data.asset_id,
      },
      body: data.requestBody,
      mediaType: "application/json",
      errors: {
        422: "Validation Error",
      },
    })
  }

  public static deleteAsset(
    data: { asset_id: string },
  ): CancelablePromise<Message> {
    return __request(OpenAPI, {
      method: "DELETE",
      url: "/api/v1/assets/{asset_id}",
      path: {
        asset_id: data.asset_id,
      },
      errors: {
        422: "Validation Error",
      },
    })
  }

  public static getMaintenanceRecords(
    data: {
      asset_id: string
      skip?: number
      limit?: number
    },
  ): CancelablePromise<MaintenanceRecordsPublic> {
    return __request(OpenAPI, {
      method: "GET",
      url: "/api/v1/assets/{asset_id}/maintenance",
      path: {
        asset_id: data.asset_id,
      },
      query: {
        skip: data.skip,
        limit: data.limit,
      },
      errors: {
        422: "Validation Error",
      },
    })
  }

  public static getMaintenanceRecord(
    data: { record_id: string },
  ): CancelablePromise<MaintenanceRecordPublic> {
    return __request(OpenAPI, {
      method: "GET",
      url: "/api/v1/assets/maintenance/{record_id}",
      path: {
        record_id: data.record_id,
      },
      errors: {
        422: "Validation Error",
      },
    })
  }

  public static createMaintenanceRecord(
    data: {
      asset_id: string
      requestBody: MaintenanceRecordCreate
    },
  ): CancelablePromise<MaintenanceRecordPublic> {
    return __request(OpenAPI, {
      method: "POST",
      url: "/api/v1/assets/{asset_id}/maintenance",
      path: {
        asset_id: data.asset_id,
      },
      body: data.requestBody,
      mediaType: "application/json",
      errors: {
        422: "Validation Error",
      },
    })
  }

  public static updateMaintenanceRecord(
    data: {
      record_id: string
      requestBody: MaintenanceRecordUpdate
    },
  ): CancelablePromise<MaintenanceRecordPublic> {
    return __request(OpenAPI, {
      method: "PATCH",
      url: "/api/v1/assets/maintenance/{record_id}",
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

  public static deleteMaintenanceRecord(
    data: { record_id: string },
  ): CancelablePromise<Message> {
    return __request(OpenAPI, {
      method: "DELETE",
      url: "/api/v1/assets/maintenance/{record_id}",
      path: {
        record_id: data.record_id,
      },
      errors: {
        422: "Validation Error",
      },
    })
  }
}

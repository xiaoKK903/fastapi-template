import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import {
  AlertCircle,
  Archive,
  Calendar,
  Check,
  Edit2,
  Eye,
  HardDrive,
  Home,
  Laptop,
  MoreHorizontal,
  Plus,
  Search,
  ShoppingCart,
  Tag,
  Trash2,
  Wrench,
  X,
} from "lucide-react"
import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import useCustomToast from "@/hooks/useCustomToast"
import {
  AssetCategory,
  AssetCategoryLabels,
  AssetService,
  AssetStatus,
  AssetStatusColors,
  AssetStatusLabels,
  MaintenanceType,
  MaintenanceTypeLabels,
  type AssetCreate,
  type AssetPublic,
  type AssetStatistics,
  type MaintenanceRecordCreate,
  type MaintenanceRecordPublic,
} from "@/services/AssetService"
import { handleError } from "@/utils"

function getAssetsQueryOptions({
  category,
  status,
  show_archived,
  warranty_expiring,
  warranty_expired,
  search,
}: {
  category?: AssetCategory
  status?: AssetStatus
  show_archived?: boolean
  warranty_expiring?: boolean
  warranty_expired?: boolean
  search?: string
} = {}) {
  return {
    queryFn: () =>
      AssetService.getAssets({
        skip: 0,
        limit: 100,
        category,
        status,
        show_archived,
        warranty_expiring,
        warranty_expired,
        search: search || undefined,
      }),
    queryKey: ["assets", category, status, show_archived, warranty_expiring, warranty_expired, search],
    staleTime: 30000,
    refetchOnWindowFocus: false,
  }
}

function getStatisticsQueryOptions() {
  return {
    queryFn: () => AssetService.getAssetStats(),
    queryKey: ["assetStats"],
    staleTime: 60000,
    refetchOnWindowFocus: false,
  }
}

function getArchivedAssetsQueryOptions() {
  return {
    queryFn: () => AssetService.getArchivedAssets({ skip: 0, limit: 100 }),
    queryKey: ["archivedAssets"],
    staleTime: 30000,
    refetchOnWindowFocus: false,
  }
}

function getMaintenanceRecordsQueryOptions(asset_id: string) {
  return {
    queryFn: () => AssetService.getMaintenanceRecords({ asset_id, skip: 0, limit: 100 }),
    queryKey: ["maintenanceRecords", asset_id],
    staleTime: 30000,
    refetchOnWindowFocus: false,
  }
}

export const Route = createFileRoute("/_layout/assets")({
  component: Assets,
  head: () => ({
    meta: [
      {
        title: "实物资产管理 - FastAPI Template",
      },
    ],
  }),
})

function StatCard({
  title,
  value,
  unit,
  icon: Icon,
  color,
  badge,
}: {
  title: string
  value: string | number
  unit?: string
  icon: React.ComponentType<{ className?: string }>
  color: string
  badge?: React.ReactNode
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <div className="flex items-center gap-2">
          {badge}
          <Icon className={`h-4 w-4 ${color}`} />
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">
          {value}
          {unit && <span className="text-sm font-normal text-muted-foreground ml-1">{unit}</span>}
        </div>
      </CardContent>
    </Card>
  )
}

function Statistics({
  stats,
  isLoading,
}: {
  stats: AssetStatistics | undefined
  isLoading: boolean
}) {
  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(5)].map((_, i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div className="text-sm font-medium">加载中...</div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">-</div>
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  if (!stats) {
    return null
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
      <StatCard
        title="总资产"
        value={stats.total_assets}
        icon={HardDrive}
        color="text-blue-500"
      />
      <StatCard
        title="总价值"
        value={stats.total_purchase_value ? `¥${stats.total_purchase_value.toLocaleString()}` : "-"}
        icon={ShoppingCart}
        color="text-green-500"
      />
      <StatCard
        title="在用"
        value={stats.in_use_count}
        icon={Check}
        color="text-emerald-500"
      />
      <StatCard
        title="闲置"
        value={stats.idle_count}
        icon={Archive}
        color="text-yellow-500"
      />
      <StatCard
        title="保修即将到期"
        value={stats.warranty_expiring_soon}
        icon={AlertCircle}
        color="text-orange-500"
        badge={
          stats.warranty_expiring_soon > 0 ? (
            <Badge variant="destructive" className="h-5">
              {stats.warranty_expiring_soon}
            </Badge>
          ) : null
        }
      />
    </div>
  )
}

function isWarrantyExpiring(expiryDate: string | null | undefined): boolean {
  if (!expiryDate) return false
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const expiry = new Date(expiryDate)
  const thirtyDaysLater = new Date(today)
  thirtyDaysLater.setDate(thirtyDaysLater.getDate() + 30)
  return expiry >= today && expiry <= thirtyDaysLater
}

function isWarrantyExpired(expiryDate: string | null | undefined): boolean {
  if (!expiryDate) return false
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const expiry = new Date(expiryDate)
  return expiry < today
}

function AssetCard({
  asset,
  onEdit,
  onDelete,
  onArchive,
  onViewMaintenance,
}: {
  asset: AssetPublic
  onEdit: (asset: AssetPublic) => void
  onDelete: (id: string) => void
  onArchive: (id: string, archived: boolean) => void
  onViewMaintenance: (asset: AssetPublic) => void
}) {
  const expiring = isWarrantyExpiring(asset.warranty_expiry_date)
  const expired = isWarrantyExpired(asset.warranty_expiry_date)

  const getCategoryIcon = () => {
    switch (asset.category) {
      case AssetCategory.ELECTRONICS:
        return Laptop
      case AssetCategory.HOME_APPLIANCE:
        return Home
      default:
        return Tag
    }
  }

  const CategoryIcon = getCategoryIcon()

  return (
    <Card
      className={`overflow-hidden hover:shadow-lg transition-shadow ${
        expiring ? "border-orange-400" : expired ? "border-red-400" : ""
      }`}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <CategoryIcon className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-lg truncate max-w-[180px]">
              {asset.name}
            </CardTitle>
          </div>
          <div className="flex items-center gap-1">
            {(expiring || expired) && (
              <AlertCircle
                className={`h-4 w-4 ${
                  expired ? "text-red-500" : "text-orange-500"
                }`}
              />
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>操作</DropdownMenuLabel>
                <DropdownMenuItem onClick={() => onViewMaintenance(asset)}>
                  <Wrench className="mr-2 h-4 w-4" />
                  维修保养记录
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onEdit(asset)}>
                  <Edit2 className="mr-2 h-4 w-4" />
                  编辑
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onArchive(asset.id, !asset.is_archived)}>
                  {asset.is_archived ? (
                    <>
                      <Eye className="mr-2 h-4 w-4" />
                      取消归档
                    </>
                  ) : (
                    <>
                      <Archive className="mr-2 h-4 w-4" />
                      归档
                    </>
                  )}
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-destructive"
                  onClick={() => onDelete(asset.id)}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  删除
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        {asset.brand || asset.model ? (
          <CardDescription className="text-xs">
            {asset.brand} {asset.model}
          </CardDescription>
        ) : null}
      </CardHeader>
      <CardContent className="pb-2">
        <div className="flex flex-wrap gap-2 mb-2">
          <Badge variant="outline" className="text-xs">
            {AssetCategoryLabels[asset.category]}
          </Badge>
          <Badge
            className={`${AssetStatusColors[asset.status]} text-white text-xs`}
          >
            {AssetStatusLabels[asset.status]}
          </Badge>
          {asset.purchase_price !== null && asset.purchase_price !== undefined && (
            <Badge variant="secondary" className="text-xs">
              ¥{asset.purchase_price.toLocaleString()}
            </Badge>
          )}
          {expired && (
            <Badge variant="destructive" className="text-xs">
              保修已过期
            </Badge>
          )}
          {expiring && (
            <Badge className="bg-orange-500 text-white text-xs">
              保修即将到期
            </Badge>
          )}
        </div>
        {asset.storage_location && (
          <p className="text-sm text-muted-foreground">
            <Tag className="inline mr-1 h-3 w-3" />
            存放位置: {asset.storage_location}
          </p>
        )}
        {asset.warranty_expiry_date && (
          <p className="text-sm text-muted-foreground">
            <Calendar className="inline mr-1 h-3 w-3" />
            保修到期: {asset.warranty_expiry_date}
          </p>
        )}
        {asset.description && (
          <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
            {asset.description}
          </p>
        )}
      </CardContent>
      <CardFooter className="pt-0 flex items-center justify-between">
        <div className="flex gap-2">
          {asset.serial_number && (
            <span className="text-xs text-muted-foreground">
              SN: {asset.serial_number}
            </span>
          )}
          {asset.purchase_date && (
            <span className="text-xs text-muted-foreground">
              购入: {asset.purchase_date}
            </span>
          )}
        </div>
        {asset.is_archived && (
          <Archive className="h-3 w-3 text-muted-foreground" />
        )}
      </CardFooter>
    </Card>
  )
}

function AssetForm({
  asset,
  onSubmit,
  onCancel,
}: {
  asset?: AssetPublic
  onSubmit: (data: AssetCreate) => void
  onCancel: () => void
}) {
  const [formData, setFormData] = useState<AssetCreate>({
    name: asset?.name || "",
    category: asset?.category || AssetCategory.DAILY_USE,
    brand: asset?.brand || null,
    model: asset?.model || null,
    purchase_price: asset?.purchase_price ?? null,
    purchase_date: asset?.purchase_date || null,
    purchase_channel: asset?.purchase_channel || null,
    storage_location: asset?.storage_location || null,
    warranty_period_months: asset?.warranty_period_months ?? null,
    warranty_expiry_date: asset?.warranty_expiry_date || null,
    status: asset?.status || AssetStatus.IN_USE,
    description: asset?.description || null,
    receipt_images: asset?.receipt_images || null,
    serial_number: asset?.serial_number || null,
    is_archived: asset?.is_archived || false,
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit(formData)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="name">资产名称 *</Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="例如: MacBook Pro 14寸"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="category">分类</Label>
          <Select
            value={formData.category}
            onValueChange={(v) =>
              setFormData({ ...formData, category: v as AssetCategory })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.values(AssetCategory).map((cat) => (
                <SelectItem key={cat} value={cat}>
                  {AssetCategoryLabels[cat]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="brand">品牌</Label>
          <Input
            id="brand"
            value={formData.brand || ""}
            onChange={(e) =>
              setFormData({ ...formData, brand: e.target.value || null })
            }
            placeholder="例如: Apple"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="model">型号</Label>
          <Input
            id="model"
            value={formData.model || ""}
            onChange={(e) =>
              setFormData({ ...formData, model: e.target.value || null })
            }
            placeholder="例如: M3 Pro"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="serial_number">序列号</Label>
          <Input
            id="serial_number"
            value={formData.serial_number || ""}
            onChange={(e) =>
              setFormData({ ...formData, serial_number: e.target.value || null })
            }
            placeholder="序列号"
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="purchase_price">购入价格 (¥)</Label>
          <Input
            id="purchase_price"
            type="number"
            min="0"
            step="0.01"
            value={formData.purchase_price ?? ""}
            onChange={(e) =>
              setFormData({
                ...formData,
                purchase_price: e.target.value ? parseFloat(e.target.value) : null,
              })
            }
            placeholder="例如: 14999"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="purchase_date">购入日期</Label>
          <Input
            id="purchase_date"
            type="date"
            value={formData.purchase_date || ""}
            onChange={(e) =>
              setFormData({
                ...formData,
                purchase_date: e.target.value || null,
              })
            }
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="purchase_channel">购买渠道</Label>
          <Input
            id="purchase_channel"
            value={formData.purchase_channel || ""}
            onChange={(e) =>
              setFormData({
                ...formData,
                purchase_channel: e.target.value || null,
              })
            }
            placeholder="例如: 京东、淘宝"
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="storage_location">存放位置</Label>
          <Input
            id="storage_location"
            value={formData.storage_location || ""}
            onChange={(e) =>
              setFormData({
                ...formData,
                storage_location: e.target.value || null,
              })
            }
            placeholder="例如: 书房书桌"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="warranty_period_months">保修期限 (月)</Label>
          <Input
            id="warranty_period_months"
            type="number"
            min="0"
            value={formData.warranty_period_months ?? ""}
            onChange={(e) =>
              setFormData({
                ...formData,
                warranty_period_months: e.target.value
                  ? parseInt(e.target.value)
                  : null,
              })
            }
            placeholder="例如: 24"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="warranty_expiry_date">保修到期日期</Label>
          <Input
            id="warranty_expiry_date"
            type="date"
            value={formData.warranty_expiry_date || ""}
            onChange={(e) =>
              setFormData({
                ...formData,
                warranty_expiry_date: e.target.value || null,
              })
            }
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="status">使用状态</Label>
          <Select
            value={formData.status}
            onValueChange={(v) =>
              setFormData({ ...formData, status: v as AssetStatus })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.values(AssetStatus).map((s) => (
                <SelectItem key={s} value={s}>
                  {AssetStatusLabels[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {asset && (
          <div className="space-y-2">
            <Label>归档状态</Label>
            <div className="flex items-center gap-2 h-10">
              <input
                type="checkbox"
                id="is_archived"
                checked={formData.is_archived}
                onChange={(e) =>
                  setFormData({ ...formData, is_archived: e.target.checked })
                }
                className="rounded border-gray-300"
              />
              <Label htmlFor="is_archived" className="cursor-pointer">
                <Archive className="inline mr-1 h-4 w-4" />
                已归档
              </Label>
            </div>
          </div>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">描述备注</Label>
        <Textarea
          id="description"
          value={formData.description || ""}
          onChange={(e) =>
            setFormData({ ...formData, description: e.target.value || null })
          }
          placeholder="详细描述或备注"
          rows={3}
        />
      </div>

      <DialogFooter className="gap-2 sm:gap-0">
        <Button type="button" variant="secondary" onClick={onCancel}>
          取消
        </Button>
        <Button type="submit">
          {asset ? "保存修改" : "添加资产"}
        </Button>
      </DialogFooter>
    </form>
  )
}

function MaintenanceRecordCard({
  record,
  onEdit,
  onDelete,
}: {
  record: MaintenanceRecordPublic
  onEdit: (record: MaintenanceRecordPublic) => void
  onDelete: (id: string) => void
}) {
  return (
    <Card className="mb-3">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <Wrench className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-base">{record.title}</CardTitle>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onEdit(record)}>
                <Edit2 className="mr-2 h-4 w-4" />
                编辑
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive"
                onClick={() => onDelete(record.id)}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                删除
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      <CardContent className="pb-2">
        <div className="flex flex-wrap gap-2 mb-2">
          <Badge variant="outline" className="text-xs">
            {MaintenanceTypeLabels[record.maintenance_type]}
          </Badge>
          {record.maintenance_date && (
            <Badge variant="outline" className="text-xs">
              {record.maintenance_date}
            </Badge>
          )}
          {record.cost !== null && record.cost !== undefined && (
            <Badge variant="secondary" className="text-xs">
              ¥{record.cost.toLocaleString()}
            </Badge>
          )}
          {record.warranty_covered && (
            <Badge className="bg-green-500 text-white text-xs">
              保修覆盖
            </Badge>
          )}
        </div>
        {record.description && (
          <p className="text-sm text-muted-foreground mb-2">{record.description}</p>
        )}
        {record.parts_replaced && record.parts_replaced.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2">
            <span className="text-sm text-muted-foreground">更换配件: </span>
            {record.parts_replaced.map((part, idx) => (
              <Badge key={idx} variant="outline" className="text-xs">
                {part}
              </Badge>
            ))}
          </div>
        )}
        <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
          {record.service_provider && (
            <span>服务商: {record.service_provider}</span>
          )}
          {record.technician_name && <span>技师: {record.technician_name}</span>}
        </div>
        {record.notes && (
          <p className="text-sm text-muted-foreground mt-2">
            备注: {record.notes}
          </p>
        )}
      </CardContent>
    </Card>
  )
}

function MaintenanceForm({
  assetId,
  record,
  onSubmit,
  onCancel,
}: {
  assetId: string
  record?: MaintenanceRecordPublic
  onSubmit: (data: MaintenanceRecordCreate) => void
  onCancel: () => void
}) {
  const [formData, setFormData] = useState<MaintenanceRecordCreate>({
    asset_id: assetId,
    maintenance_type: record?.maintenance_type || MaintenanceType.REPAIR,
    maintenance_date: record?.maintenance_date || null,
    title: record?.title || "",
    description: record?.description || null,
    cost: record?.cost ?? null,
    parts_replaced: record?.parts_replaced || null,
    service_provider: record?.service_provider || null,
    technician_name: record?.technician_name || null,
    warranty_covered: record?.warranty_covered || false,
    notes: record?.notes || null,
  })

  const [partsInput, setPartsInput] = useState(
    record?.parts_replaced?.join(", ") || ""
  )

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const parts = partsInput
      .split(",")
      .map((t) => t.trim())
      .filter((t) => t)
    onSubmit({ ...formData, parts_replaced: parts.length > 0 ? parts : null })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="title">标题 *</Label>
          <Input
            id="title"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            placeholder="例如: 屏幕故障维修"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="maintenance_type">类型</Label>
          <Select
            value={formData.maintenance_type}
            onValueChange={(v) =>
              setFormData({ ...formData, maintenance_type: v as MaintenanceType })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.values(MaintenanceType).map((t) => (
                <SelectItem key={t} value={t}>
                  {MaintenanceTypeLabels[t]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="maintenance_date">日期</Label>
          <Input
            id="maintenance_date"
            type="date"
            value={formData.maintenance_date || ""}
            onChange={(e) =>
              setFormData({
                ...formData,
                maintenance_date: e.target.value || null,
              })
            }
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="cost">费用 (¥)</Label>
          <Input
            id="cost"
            type="number"
            min="0"
            step="0.01"
            value={formData.cost ?? ""}
            onChange={(e) =>
              setFormData({
                ...formData,
                cost: e.target.value ? parseFloat(e.target.value) : null,
              })
            }
            placeholder="例如: 599"
          />
        </div>
        <div className="space-y-2">
          <Label>保修覆盖</Label>
          <div className="flex items-center gap-2 h-10">
            <input
              type="checkbox"
              id="warranty_covered"
              checked={formData.warranty_covered}
              onChange={(e) =>
                setFormData({ ...formData, warranty_covered: e.target.checked })
              }
              className="rounded border-gray-300"
            />
            <Label htmlFor="warranty_covered" className="cursor-pointer">
              保修覆盖
            </Label>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="service_provider">服务商</Label>
          <Input
            id="service_provider"
            value={formData.service_provider || ""}
            onChange={(e) =>
              setFormData({
                ...formData,
                service_provider: e.target.value || null,
              })
            }
            placeholder="例如: Apple 授权服务商"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="technician_name">技师</Label>
          <Input
            id="technician_name"
            value={formData.technician_name || ""}
            onChange={(e) =>
              setFormData({
                ...formData,
                technician_name: e.target.value || null,
              })
            }
            placeholder="技师姓名"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="parts_replaced">更换配件 (用逗号分隔)</Label>
        <Input
          id="parts_replaced"
          value={partsInput}
          onChange={(e) => setPartsInput(e.target.value)}
          placeholder="例如: 屏幕, 电池, 键盘"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">问题描述</Label>
        <Textarea
          id="description"
          value={formData.description || ""}
          onChange={(e) =>
            setFormData({ ...formData, description: e.target.value || null })
          }
          placeholder="问题描述"
          rows={2}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">备注</Label>
        <Textarea
          id="notes"
          value={formData.notes || ""}
          onChange={(e) =>
            setFormData({ ...formData, notes: e.target.value || null })
          }
          placeholder="备注信息"
          rows={2}
        />
      </div>

      <DialogFooter className="gap-2 sm:gap-0">
        <Button type="button" variant="secondary" onClick={onCancel}>
          取消
        </Button>
        <Button type="submit">
          {record ? "保存修改" : "添加记录"}
        </Button>
      </DialogFooter>
    </form>
  )
}

function Assets() {
  const [category, setCategory] = useState<AssetCategory | undefined>(undefined)
  const [status, setStatus] = useState<AssetStatus | undefined>(undefined)
  const [showArchived, setShowArchived] = useState(false)
  const [showWarrantyExpiring, setShowWarrantyExpiring] = useState(false)
  const [showWarrantyExpired, setShowWarrantyExpired] = useState(false)
  const [search, setSearch] = useState("")
  const [searchInput, setSearchInput] = useState("")
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [editAsset, setEditAsset] = useState<AssetPublic | undefined>(undefined)
  const [maintenanceAsset, setMaintenanceAsset] = useState<AssetPublic | undefined>(
    undefined
  )
  const [addMaintenanceOpen, setAddMaintenanceOpen] = useState(false)
  const [editMaintenance, setEditMaintenance] = useState<
    MaintenanceRecordPublic | undefined
  >(undefined)

  const queryClient = useQueryClient()
  const { showSuccessToast, showErrorToast } = useCustomToast()

  const {
    data: stats,
    isLoading: statsLoading,
  } = useQuery(getStatisticsQueryOptions())

  const {
    data: assets,
    isLoading: assetsLoading,
  } = useQuery(
    getAssetsQueryOptions({
      category,
      status,
      show_archived: showArchived,
      warranty_expiring: showWarrantyExpiring,
      warranty_expired: showWarrantyExpired,
      search,
    }),
  )

  const {
    data: archivedAssets,
    isLoading: archivedLoading,
  } = useQuery(getArchivedAssetsQueryOptions())

  const {
    data: maintenanceRecords,
    isLoading: maintenanceLoading,
  } = useQuery(
    getMaintenanceRecordsQueryOptions(maintenanceAsset?.id || ""),
    {
      enabled: !!maintenanceAsset,
    },
  )

  const handleSearch = () => {
    setSearch(searchInput)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSearch()
    }
  }

  const createMutation = useMutation({
    mutationFn: (data: AssetCreate) =>
      AssetService.createAsset({ requestBody: data }),
    onSuccess: () => {
      showSuccessToast("资产添加成功")
      setAddDialogOpen(false)
      queryClient.invalidateQueries({ queryKey: ["assets"] })
      queryClient.invalidateQueries({ queryKey: ["assetStats"] })
    },
    onError: handleError.bind(showErrorToast),
  })

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string
      data: AssetCreate
    }) =>
      AssetService.updateAsset({
        asset_id: id,
        requestBody: data,
      }),
    onSuccess: () => {
      showSuccessToast("资产更新成功")
      setEditAsset(undefined)
      queryClient.invalidateQueries({ queryKey: ["assets"] })
      queryClient.invalidateQueries({ queryKey: ["archivedAssets"] })
      queryClient.invalidateQueries({ queryKey: ["assetStats"] })
    },
    onError: handleError.bind(showErrorToast),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => AssetService.deleteAsset({ asset_id: id }),
    onSuccess: () => {
      showSuccessToast("资产删除成功")
      queryClient.invalidateQueries({ queryKey: ["assets"] })
      queryClient.invalidateQueries({ queryKey: ["archivedAssets"] })
      queryClient.invalidateQueries({ queryKey: ["assetStats"] })
    },
    onError: handleError.bind(showErrorToast),
  })

  const createMaintenanceMutation = useMutation({
    mutationFn: (data: MaintenanceRecordCreate) =>
      AssetService.createMaintenanceRecord({
        asset_id: data.asset_id,
        requestBody: data,
      }),
    onSuccess: () => {
      showSuccessToast("维修记录添加成功")
      setAddMaintenanceOpen(false)
      queryClient.invalidateQueries({ queryKey: ["maintenanceRecords"] })
    },
    onError: handleError.bind(showErrorToast),
  })

  const updateMaintenanceMutation = useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string
      data: MaintenanceRecordCreate
    }) =>
      AssetService.updateMaintenanceRecord({
        record_id: id,
        requestBody: data,
      }),
    onSuccess: () => {
      showSuccessToast("维修记录更新成功")
      setEditMaintenance(undefined)
      queryClient.invalidateQueries({ queryKey: ["maintenanceRecords"] })
    },
    onError: handleError.bind(showErrorToast),
  })

  const deleteMaintenanceMutation = useMutation({
    mutationFn: (id: string) =>
      AssetService.deleteMaintenanceRecord({ record_id: id }),
    onSuccess: () => {
      showSuccessToast("维修记录删除成功")
      queryClient.invalidateQueries({ queryKey: ["maintenanceRecords"] })
    },
    onError: handleError.bind(showErrorToast),
  })

  const handleCreate = (data: AssetCreate) => {
    createMutation.mutate(data)
  }

  const handleUpdate = (data: AssetCreate) => {
    if (editAsset) {
      updateMutation.mutate({ id: editAsset.id, data })
    }
  }

  const handleDelete = (id: string) => {
    if (window.confirm("确定要删除这个资产吗？")) {
      deleteMutation.mutate(id)
    }
  }

  const handleArchive = (id: string, archived: boolean) => {
    updateMutation.mutate({
      id,
      data: {
        name: "",
        is_archived: archived,
      },
    })
  }

  const handleCreateMaintenance = (data: MaintenanceRecordCreate) => {
    createMaintenanceMutation.mutate(data)
  }

  const handleUpdateMaintenance = (data: MaintenanceRecordCreate) => {
    if (editMaintenance) {
      updateMaintenanceMutation.mutate({ id: editMaintenance.id, data })
    }
  }

  const handleDeleteMaintenance = (id: string) => {
    if (window.confirm("确定要删除这条维修记录吗？")) {
      deleteMaintenanceMutation.mutate(id)
    }
  }

  const activeTab = showArchived ? "archived" : "active"

  const currentAssets = showArchived ? archivedAssets : assets
  const currentLoading = showArchived ? archivedLoading : assetsLoading

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">实物资产管理</h1>
          <p className="text-muted-foreground">
            管理您的数码、家电、生活用品等实物资产
          </p>
        </div>
        <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              添加资产
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>添加新资产</DialogTitle>
              <DialogDescription>
                添加一个新的实物资产记录
              </DialogDescription>
            </DialogHeader>
            <AssetForm onSubmit={handleCreate} onCancel={() => setAddDialogOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>

      <Statistics stats={stats} isLoading={statsLoading} />

      <Card>
        <CardHeader className="pb-3">
          <Tabs
            value={activeTab}
            onValueChange={(v) => setShowArchived(v === "archived")}
          >
            <div className="flex flex-wrap items-center gap-4">
              <TabsList>
                <TabsTrigger value="active">当前资产</TabsTrigger>
                <TabsTrigger value="archived">
                  已归档
                  {archivedAssets && archivedAssets.count > 0 && (
                    <Badge className="ml-2" variant="secondary">
                      {archivedAssets.count}
                    </Badge>
                  )}
                </TabsTrigger>
              </TabsList>

              {!showArchived && (
                <>
                  <Select
                    value={category || "all"}
                    onValueChange={(v) =>
                      setCategory(v === "all" ? undefined : (v as AssetCategory))
                    }
                  >
                    <SelectTrigger className="w-[130px]">
                      <SelectValue placeholder="全部分类" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">全部分类</SelectItem>
                      {Object.values(AssetCategory).map((cat) => (
                        <SelectItem key={cat} value={cat}>
                          {AssetCategoryLabels[cat]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select
                    value={status || "all"}
                    onValueChange={(v) =>
                      setStatus(v === "all" ? undefined : (v as AssetStatus))
                    }
                  >
                    <SelectTrigger className="w-[130px]">
                      <SelectValue placeholder="全部状态" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">全部状态</SelectItem>
                      {Object.values(AssetStatus).map((s) => (
                        <SelectItem key={s} value={s}>
                          {AssetStatusLabels[s]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="warranty_expiring"
                      checked={showWarrantyExpiring}
                      onChange={(e) => setShowWarrantyExpiring(e.target.checked)}
                      className="rounded border-gray-300"
                    />
                    <Label
                      htmlFor="warranty_expiring"
                      className="cursor-pointer text-sm"
                    >
                      保修即将到期
                    </Label>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="warranty_expired"
                      checked={showWarrantyExpired}
                      onChange={(e) => setShowWarrantyExpired(e.target.checked)}
                      className="rounded border-gray-300"
                    />
                    <Label
                      htmlFor="warranty_expired"
                      className="cursor-pointer text-sm"
                    >
                      保修已过期
                    </Label>
                  </div>

                  <div className="flex-1 max-w-sm ml-auto">
                    <div className="flex gap-2">
                      <Input
                        placeholder="搜索资产名称、品牌、型号..."
                        value={searchInput}
                        onChange={(e) => setSearchInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        className="flex-1"
                      />
                      <Button variant="secondary" onClick={handleSearch}>
                        <Search className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </Tabs>
        </CardHeader>
        <CardContent>
          {currentLoading ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {[...Array(6)].map((_, i) => (
                <Card key={i} className="animate-pulse">
                  <CardHeader className="pb-2">
                    <div className="h-5 w-3/4 bg-muted rounded" />
                  </CardHeader>
                  <CardContent>
                    <div className="h-4 w-full bg-muted rounded mb-2" />
                    <div className="h-4 w-2/3 bg-muted rounded" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : !currentAssets || currentAssets.data.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center py-12">
              <div className="rounded-full bg-muted p-4 mb-4">
                <HardDrive className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold">
                {showArchived
                  ? "没有已归档的资产"
                  : search
                    ? "没有找到匹配的资产"
                    : "您还没有任何实物资产"}
              </h3>
              <p className="text-muted-foreground">
                {showArchived
                  ? "归档的资产会显示在这里"
                  : search
                    ? "尝试使用其他关键词搜索"
                    : "点击上方按钮添加第一个资产"}
              </p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {currentAssets.data.map((asset) => (
                <AssetCard
                  key={asset.id}
                  asset={asset}
                  onEdit={setEditAsset}
                  onDelete={handleDelete}
                  onArchive={handleArchive}
                  onViewMaintenance={setMaintenanceAsset}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={!!editAsset}
        onOpenChange={(open) => !open && setEditAsset(undefined)}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>编辑资产</DialogTitle>
            <DialogDescription>
              修改资产的详细信息
            </DialogDescription>
          </DialogHeader>
          {editAsset && (
            <AssetForm
              asset={editAsset}
              onSubmit={handleUpdate}
              onCancel={() => setEditAsset(undefined)}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!maintenanceAsset}
        onOpenChange={(open) => !open && setMaintenanceAsset(undefined)}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle>维修保养记录 - {maintenanceAsset?.name}</DialogTitle>
                <DialogDescription>
                  管理该资产的维修和保养记录
                </DialogDescription>
              </div>
              <DialogTrigger asChild>
                <Button onClick={() => setAddMaintenanceOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  添加记录
                </Button>
              </DialogTrigger>
            </div>
          </DialogHeader>
          <div className="mt-4">
            {maintenanceLoading ? (
              <div className="flex flex-col gap-3">
                {[...Array(3)].map((_, i) => (
                  <Card key={i} className="animate-pulse">
                    <CardHeader className="pb-2">
                      <div className="h-5 w-3/4 bg-muted rounded" />
                    </CardHeader>
                    <CardContent>
                      <div className="h-4 w-full bg-muted rounded" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : !maintenanceRecords || maintenanceRecords.data.length === 0 ? (
              <div className="flex flex-col items-center justify-center text-center py-8">
                <div className="rounded-full bg-muted p-3 mb-3">
                  <Wrench className="h-6 w-6 text-muted-foreground" />
                </div>
                <h3 className="text-base font-semibold">暂无维修保养记录</h3>
                <p className="text-muted-foreground text-sm">
                  点击上方按钮添加第一条记录
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {maintenanceRecords.data.map((record) => (
                  <MaintenanceRecordCard
                    key={record.id}
                    record={record}
                    onEdit={setEditMaintenance}
                    onDelete={handleDeleteMaintenance}
                  />
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={addMaintenanceOpen || !!editMaintenance}
        onOpenChange={(open) => {
          if (!open) {
            setAddMaintenanceOpen(false)
            setEditMaintenance(undefined)
          }
        }}
      >
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editMaintenance ? "编辑维修保养记录" : "添加维修保养记录"}
            </DialogTitle>
            <DialogDescription>
              {editMaintenance
                ? "修改维修保养记录的详细信息"
                : "添加一条新的维修或保养记录"}
            </DialogDescription>
          </DialogHeader>
          {maintenanceAsset && (
            <MaintenanceForm
              assetId={maintenanceAsset.id}
              record={editMaintenance || undefined}
              onSubmit={(data) => {
                if (editMaintenance) {
                  handleUpdateMaintenance(data)
                } else {
                  handleCreateMaintenance(data)
                }
              }}
              onCancel={() => {
                setAddMaintenanceOpen(false)
                setEditMaintenance(undefined)
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import {
  AlertCircle,
  Calendar,
  CreditCard,
  Edit2,
  Mail,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Search,
  Tag,
  Trash2,
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
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import useCustomToast from "@/hooks/useCustomToast"
import {
  BillingCycle,
  BillingCycleLabels,
  SubscriptionCategory,
  SubscriptionCategoryLabels,
  SubscriptionService,
  type SubscriptionCreate,
  type SubscriptionPublic,
  type SubscriptionStatistics,
} from "@/services/SubscriptionService"
import { handleError } from "@/utils"

function getSubscriptionsQueryOptions({
  category,
  billing_cycle,
  is_active,
  auto_renewal,
  expiring_soon,
  expired,
  search,
}: {
  category?: SubscriptionCategory
  billing_cycle?: BillingCycle
  is_active?: boolean
  auto_renewal?: boolean
  expiring_soon?: boolean
  expired?: boolean
  search?: string
} = {}) {
  return {
    queryFn: () =>
      SubscriptionService.getSubscriptions({
        skip: 0,
        limit: 100,
        category,
        billing_cycle,
        is_active,
        auto_renewal,
        expiring_soon,
        expired,
        search: search || undefined,
      }),
    queryKey: [
      "subscriptions",
      category,
      billing_cycle,
      is_active,
      auto_renewal,
      expiring_soon,
      expired,
      search,
    ],
    staleTime: 30000,
    refetchOnWindowFocus: false,
  }
}

function getStatisticsQueryOptions() {
  return {
    queryFn: () => SubscriptionService.getSubscriptionStats(),
    queryKey: ["subscriptionStats"],
    staleTime: 60000,
    refetchOnWindowFocus: false,
  }
}

export const Route = createFileRoute("/_layout/subscriptions")({
  component: Subscriptions,
  head: () => ({
    meta: [
      {
        title: "会员订阅管理 - FastAPI Template",
      },
    ],
  }),
})

function isExpiringSoon(expiryDate: string | null | undefined): boolean {
  if (!expiryDate) return false
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const expiry = new Date(expiryDate)
  const thirtyDaysLater = new Date(today)
  thirtyDaysLater.setDate(thirtyDaysLater.getDate() + 30)
  return expiry >= today && expiry <= thirtyDaysLater
}

function isExpired(expiryDate: string | null | undefined, isActive: boolean): boolean {
  if (!isActive) return true
  if (!expiryDate) return false
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const expiry = new Date(expiryDate)
  return expiry < today
}

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
  stats: SubscriptionStatistics | undefined
  isLoading: boolean
}) {
  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[...Array(6)].map((_, i) => (
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
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      <StatCard
        title="总订阅数"
        value={stats.total_subscriptions}
        icon={CreditCard}
        color="text-blue-500"
      />
      <StatCard
        title="活跃订阅"
        value={stats.active_count}
        icon={Check}
        color="text-emerald-500"
      />
      <StatCard
        title="已过期"
        value={stats.expired_count}
        icon={X}
        color="text-gray-500"
      />
      <StatCard
        title="每月花费"
        value={stats.total_monthly_cost ? `¥${stats.total_monthly_cost.toFixed(2)}` : "-"}
        icon={CreditCard}
        color="text-orange-500"
      />
      <StatCard
        title="每年花费"
        value={stats.total_yearly_cost ? `¥${stats.total_yearly_cost.toFixed(2)}` : "-"}
        icon={CreditCard}
        color="text-red-500"
      />
      <StatCard
        title="即将到期"
        value={stats.expiring_soon_count}
        icon={AlertCircle}
        color="text-orange-500"
        badge={
          stats.expiring_soon_count > 0 ? (
            <Badge variant="destructive" className="h-5">
              {stats.expiring_soon_count}
            </Badge>
          ) : null
        }
      />
    </div>
  )
}

function SubscriptionCard({
  subscription,
  onEdit,
  onDelete,
}: {
  subscription: SubscriptionPublic
  onEdit: (subscription: SubscriptionPublic) => void
  onDelete: (id: string) => void
}) {
  const expiring = isExpiringSoon(subscription.next_billing_date)
  const expired = isExpired(subscription.next_billing_date, subscription.is_active)

  return (
    <Card
      className={`overflow-hidden hover:shadow-lg transition-shadow ${
        expiring ? "border-orange-400" : expired ? "border-red-400" : ""
      }`}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-lg truncate max-w-[180px]">
              {subscription.name}
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
                <DropdownMenuItem onClick={() => onEdit(subscription)}>
                  <Edit2 className="mr-2 h-4 w-4" />
                  编辑
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-destructive"
                  onClick={() => onDelete(subscription.id)}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  删除
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        {subscription.service_provider ? (
          <CardDescription className="text-xs">
            {subscription.service_provider}
          </CardDescription>
        ) : null}
      </CardHeader>
      <CardContent className="pb-2">
        <div className="flex flex-wrap gap-2 mb-2">
          <Badge variant="outline" className="text-xs">
            {SubscriptionCategoryLabels[subscription.category]}
          </Badge>
          <Badge variant="outline" className="text-xs">
            {BillingCycleLabels[subscription.billing_cycle]}
          </Badge>
          {subscription.price !== null && subscription.price !== undefined && (
            <Badge variant="secondary" className="text-xs">
              ¥{subscription.price.toLocaleString()}
            </Badge>
          )}
          {subscription.auto_renewal && (
            <Badge className="bg-green-500 text-white text-xs">
              <RefreshCw className="mr-1 h-3 w-3" />
              自动续费
            </Badge>
          )}
          {!subscription.is_active && (
            <Badge variant="outline" className="text-xs">
              已过期
            </Badge>
          )}
          {expiring && subscription.is_active && (
            <Badge className="bg-orange-500 text-white text-xs">
              即将到期
            </Badge>
          )}
          {expired && subscription.is_active && (
            <Badge variant="destructive" className="text-xs">
              已过期
            </Badge>
          )}
        </div>
        {subscription.next_billing_date && (
          <p className="text-sm text-muted-foreground">
            <Calendar className="inline mr-1 h-3 w-3" />
            下次扣费: {subscription.next_billing_date}
          </p>
        )}
        {subscription.start_date && (
          <p className="text-sm text-muted-foreground">
            <Calendar className="inline mr-1 h-3 w-3" />
            开始日期: {subscription.start_date}
          </p>
        )}
        {subscription.account_email && (
          <p className="text-sm text-muted-foreground">
            <Mail className="inline mr-1 h-3 w-3" />
            {subscription.account_email}
          </p>
        )}
        {subscription.description && (
          <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
            {subscription.description}
          </p>
        )}
      </CardContent>
      <CardFooter className="pt-0 flex items-center justify-between">
        <div className="flex gap-2">
          {subscription.payment_method && (
            <span className="text-xs text-muted-foreground">
              支付: {subscription.payment_method}
            </span>
          )}
        </div>
        {subscription.tags && subscription.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {subscription.tags.slice(0, 3).map((tag, idx) => (
              <Tag key={idx} className="h-3 w-3 text-muted-foreground" />
            ))}
            {subscription.tags.length > 3 && (
              <span className="text-xs text-muted-foreground">
                +{subscription.tags.length - 3}
              </span>
            )}
          </div>
        )}
      </CardFooter>
    </Card>
  )
}

function SubscriptionForm({
  subscription,
  onSubmit,
  onCancel,
}: {
  subscription?: SubscriptionPublic
  onSubmit: (data: SubscriptionCreate) => void
  onCancel: () => void
}) {
  const [formData, setFormData] = useState<SubscriptionCreate>({
    name: subscription?.name || "",
    category: subscription?.category || SubscriptionCategory.OTHER,
    service_provider: subscription?.service_provider || null,
    price: subscription?.price ?? null,
    original_price: subscription?.original_price ?? null,
    billing_cycle: subscription?.billing_cycle || BillingCycle.MONTHLY,
    start_date: subscription?.start_date || null,
    end_date: subscription?.end_date || null,
    next_billing_date: subscription?.next_billing_date || null,
    auto_renewal: subscription?.auto_renewal ?? true,
    is_active: subscription?.is_active ?? true,
    description: subscription?.description || null,
    notes: subscription?.notes || null,
    account_email: subscription?.account_email || null,
    payment_method: subscription?.payment_method || null,
    tags: subscription?.tags || null,
  })

  const [tagsInput, setTagsInput] = useState(
    subscription?.tags?.join(", ") || ""
  )

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const tags = tagsInput
      .split(",")
      .map((t) => t.trim())
      .filter((t) => t)
    onSubmit({
      ...formData,
      tags: tags.length > 0 ? tags : null,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="name">订阅名称 *</Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="例如: 爱奇艺会员、Netflix、Office 365"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="category">分类</Label>
          <Select
            value={formData.category}
            onValueChange={(v) =>
              setFormData({ ...formData, category: v as SubscriptionCategory })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.values(SubscriptionCategory).map((cat) => (
                <SelectItem key={cat} value={cat}>
                  {SubscriptionCategoryLabels[cat]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
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
            placeholder="例如: 爱奇艺、微软、苹果"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="price">当前价格 (¥)</Label>
          <Input
            id="price"
            type="number"
            min="0"
            step="0.01"
            value={formData.price ?? ""}
            onChange={(e) =>
              setFormData({
                ...formData,
                price: e.target.value ? parseFloat(e.target.value) : null,
              })
            }
            placeholder="例如: 19.9"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="original_price">原价 (¥)</Label>
          <Input
            id="original_price"
            type="number"
            min="0"
            step="0.01"
            value={formData.original_price ?? ""}
            onChange={(e) =>
              setFormData({
                ...formData,
                original_price: e.target.value
                  ? parseFloat(e.target.value)
                  : null,
              })
            }
            placeholder="例如: 29.9"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="billing_cycle">计费周期</Label>
          <Select
            value={formData.billing_cycle}
            onValueChange={(v) =>
              setFormData({ ...formData, billing_cycle: v as BillingCycle })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.values(BillingCycle).map((cycle) => (
                <SelectItem key={cycle} value={cycle}>
                  {BillingCycleLabels[cycle]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="start_date">开始日期</Label>
          <Input
            id="start_date"
            type="date"
            value={formData.start_date || ""}
            onChange={(e) =>
              setFormData({
                ...formData,
                start_date: e.target.value || null,
              })
            }
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="end_date">结束日期</Label>
          <Input
            id="end_date"
            type="date"
            value={formData.end_date || ""}
            onChange={(e) =>
              setFormData({
                ...formData,
                end_date: e.target.value || null,
              })
            }
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="next_billing_date">下次扣费日期</Label>
          <Input
            id="next_billing_date"
            type="date"
            value={formData.next_billing_date || ""}
            onChange={(e) =>
              setFormData({
                ...formData,
                next_billing_date: e.target.value || null,
              })
            }
          />
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <div className="space-y-2">
          <Label htmlFor="account_email">账户邮箱</Label>
          <Input
            id="account_email"
            type="email"
            value={formData.account_email || ""}
            onChange={(e) =>
              setFormData({
                ...formData,
                account_email: e.target.value || null,
              })
            }
            placeholder="登录邮箱"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="payment_method">支付方式</Label>
          <Input
            id="payment_method"
            value={formData.payment_method || ""}
            onChange={(e) =>
              setFormData({
                ...formData,
                payment_method: e.target.value || null,
              })
            }
            placeholder="例如: 微信支付、支付宝、信用卡"
          />
        </div>
        <div className="space-y-2">
          <Label>自动续费</Label>
          <div className="flex items-center gap-3 h-10">
            <Switch
              id="auto_renewal"
              checked={formData.auto_renewal}
              onCheckedChange={(checked) =>
                setFormData({ ...formData, auto_renewal: checked })
              }
            />
            <Label htmlFor="auto_renewal" className="cursor-pointer">
              {formData.auto_renewal ? "已开启" : "已关闭"}
            </Label>
          </div>
        </div>
        {subscription && (
          <div className="space-y-2">
            <Label>状态</Label>
            <div className="flex items-center gap-3 h-10">
              <Switch
                id="is_active"
                checked={formData.is_active}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, is_active: checked })
                }
              />
              <Label htmlFor="is_active" className="cursor-pointer">
                {formData.is_active ? "活跃" : "已过期"}
              </Label>
            </div>
          </div>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="tags">标签 (用逗号分隔)</Label>
        <Input
          id="tags"
          value={tagsInput}
          onChange={(e) => setTagsInput(e.target.value)}
          placeholder="例如: 娱乐、工作、家庭"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">描述</Label>
        <Textarea
          id="description"
          value={formData.description || ""}
          onChange={(e) =>
            setFormData({
              ...formData,
              description: e.target.value || null,
            })
          }
          placeholder="详细描述"
          rows={2}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">备注</Label>
        <Textarea
          id="notes"
          value={formData.notes || ""}
          onChange={(e) =>
            setFormData({
              ...formData,
              notes: e.target.value || null,
            })
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
          {subscription ? "保存修改" : "添加订阅"}
        </Button>
      </DialogFooter>
    </form>
  )
}

function Subscriptions() {
  const [category, setCategory] = useState<SubscriptionCategory | undefined>(
    undefined
  )
  const [billingCycle, setBillingCycle] = useState<BillingCycle | undefined>(
    undefined
  )
  const [isActive, setIsActive] = useState<boolean | undefined>(true)
  const [autoRenewal, setAutoRenewal] = useState<boolean | undefined>(undefined)
  const [showExpiringSoon, setShowExpiringSoon] = useState(false)
  const [showExpired, setShowExpired] = useState(false)
  const [search, setSearch] = useState("")
  const [searchInput, setSearchInput] = useState("")
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [editSubscription, setEditSubscription] = useState<
    SubscriptionPublic | undefined
  >(undefined)

  const queryClient = useQueryClient()
  const { showSuccessToast, showErrorToast } = useCustomToast()

  const {
    data: stats,
    isLoading: statsLoading,
  } = useQuery(getStatisticsQueryOptions())

  const {
    data: subscriptions,
    isLoading: subscriptionsLoading,
  } = useQuery(
    getSubscriptionsQueryOptions({
      category,
      billing_cycle: billingCycle,
      is_active: isActive,
      auto_renewal: autoRenewal,
      expiring_soon: showExpiringSoon,
      expired: showExpired,
      search,
    }),
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
    mutationFn: (data: SubscriptionCreate) =>
      SubscriptionService.createSubscription({ requestBody: data }),
    onSuccess: () => {
      showSuccessToast("订阅添加成功")
      setAddDialogOpen(false)
      queryClient.invalidateQueries({ queryKey: ["subscriptions"] })
      queryClient.invalidateQueries({ queryKey: ["subscriptionStats"] })
    },
    onError: handleError.bind(showErrorToast),
  })

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string
      data: SubscriptionCreate
    }) =>
      SubscriptionService.updateSubscription({
        subscription_id: id,
        requestBody: data,
      }),
    onSuccess: () => {
      showSuccessToast("订阅更新成功")
      setEditSubscription(undefined)
      queryClient.invalidateQueries({ queryKey: ["subscriptions"] })
      queryClient.invalidateQueries({ queryKey: ["subscriptionStats"] })
    },
    onError: handleError.bind(showErrorToast),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      SubscriptionService.deleteSubscription({ subscription_id: id }),
    onSuccess: () => {
      showSuccessToast("订阅删除成功")
      queryClient.invalidateQueries({ queryKey: ["subscriptions"] })
      queryClient.invalidateQueries({ queryKey: ["subscriptionStats"] })
    },
    onError: handleError.bind(showErrorToast),
  })

  const handleCreate = (data: SubscriptionCreate) => {
    createMutation.mutate(data)
  }

  const handleUpdate = (data: SubscriptionCreate) => {
    if (editSubscription) {
      updateMutation.mutate({ id: editSubscription.id, data })
    }
  }

  const handleDelete = (id: string) => {
    if (window.confirm("确定要删除这个订阅吗？")) {
      deleteMutation.mutate(id)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">会员订阅管理</h1>
          <p className="text-muted-foreground">
            统一管理所有会员、软件订阅、付费服务
          </p>
        </div>
        <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              添加订阅
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>添加新订阅</DialogTitle>
              <DialogDescription>
                添加一个新的会员或软件订阅记录
              </DialogDescription>
            </DialogHeader>
            <SubscriptionForm
              onSubmit={handleCreate}
              onCancel={() => setAddDialogOpen(false)}
            />
          </DialogContent>
        </Dialog>
      </div>

      <Statistics stats={stats} isLoading={statsLoading} />

      <Card>
        <CardHeader className="pb-3">
          <Tabs
            value={isActive === true ? "active" : isActive === false ? "expired" : "all"}
            onValueChange={(v) => {
              if (v === "active") {
                setIsActive(true)
                setShowExpired(false)
              } else if (v === "expired") {
                setIsActive(false)
                setShowExpired(true)
              } else {
                setIsActive(undefined)
                setShowExpired(false)
              }
            }}
          >
            <div className="flex flex-wrap items-center gap-4">
              <TabsList>
                <TabsTrigger value="active">活跃订阅</TabsTrigger>
                <TabsTrigger value="expired">已过期</TabsTrigger>
                <TabsTrigger value="all">全部</TabsTrigger>
              </TabsList>

              {isActive !== false && (
                <>
                  <Select
                    value={category || "all"}
                    onValueChange={(v) =>
                      setCategory(v === "all" ? undefined : (v as SubscriptionCategory))
                    }
                  >
                    <SelectTrigger className="w-[130px]">
                      <SelectValue placeholder="全部分类" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">全部分类</SelectItem>
                      {Object.values(SubscriptionCategory).map((cat) => (
                        <SelectItem key={cat} value={cat}>
                          {SubscriptionCategoryLabels[cat]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select
                    value={billingCycle || "all"}
                    onValueChange={(v) =>
                      setBillingCycle(v === "all" ? undefined : (v as BillingCycle))
                    }
                  >
                    <SelectTrigger className="w-[130px]">
                      <SelectValue placeholder="全部周期" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">全部周期</SelectItem>
                      {Object.values(BillingCycle).map((cycle) => (
                        <SelectItem key={cycle} value={cycle}>
                          {BillingCycleLabels[cycle]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="auto_renewal_filter"
                      checked={autoRenewal === true}
                      onChange={(e) =>
                        setAutoRenewal(e.target.checked ? true : undefined)
                      }
                      className="rounded border-gray-300"
                    />
                    <Label
                      htmlFor="auto_renewal_filter"
                      className="cursor-pointer text-sm"
                    >
                      仅自动续费
                    </Label>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="expiring_soon"
                      checked={showExpiringSoon}
                      onChange={(e) => setShowExpiringSoon(e.target.checked)}
                      className="rounded border-gray-300"
                    />
                    <Label
                      htmlFor="expiring_soon"
                      className="cursor-pointer text-sm"
                    >
                      即将到期
                    </Label>
                  </div>

                  <div className="flex-1 max-w-sm ml-auto">
                    <div className="flex gap-2">
                      <Input
                        placeholder="搜索订阅名称、服务商..."
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
          {subscriptionsLoading ? (
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
          ) : !subscriptions || subscriptions.data.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center py-12">
              <div className="rounded-full bg-muted p-4 mb-4">
                <CreditCard className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold">
                {showExpired
                  ? "没有已过期的订阅"
                  : search
                    ? "没有找到匹配的订阅"
                    : "您还没有任何订阅"}
              </h3>
              <p className="text-muted-foreground">
                {showExpired
                  ? "已过期的订阅会显示在这里"
                  : search
                    ? "尝试使用其他关键词搜索"
                    : "点击上方按钮添加第一个订阅"}
              </p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {subscriptions.data.map((subscription) => (
                <SubscriptionCard
                  key={subscription.id}
                  subscription={subscription}
                  onEdit={setEditSubscription}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={!!editSubscription}
        onOpenChange={(open) => !open && setEditSubscription(undefined)}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>编辑订阅</DialogTitle>
            <DialogDescription>
              修改订阅的详细信息
            </DialogDescription>
          </DialogHeader>
          {editSubscription && (
            <SubscriptionForm
              subscription={editSubscription}
              onSubmit={handleUpdate}
              onCancel={() => setEditSubscription(undefined)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

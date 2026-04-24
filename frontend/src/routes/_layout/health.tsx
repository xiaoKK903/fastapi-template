import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import {
  Activity,
  Bed,
  Calendar,
  Edit2,
  Heart,
  MoreHorizontal,
  Plus,
  Search,
  Tag,
  Trash2,
  User,
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
import { Textarea } from "@/components/ui/textarea"
import useCustomToast from "@/hooks/useCustomToast"
import {
  HealthRecordService,
  type HealthRecordCreate,
  type HealthRecordPublic,
} from "@/services/HealthRecordService"
import { handleError } from "@/utils"

function getRecordsQueryOptions({
  start_date,
  end_date,
  tag,
}: {
  start_date?: string
  end_date?: string
  tag?: string
} = {}) {
  return {
    queryFn: () =>
      HealthRecordService.getRecords({
        skip: 0,
        limit: 100,
        start_date: start_date || undefined,
        end_date: end_date || undefined,
        tag: tag || undefined,
      }),
    queryKey: ["healthRecords", start_date, end_date, tag],
    staleTime: 30000,
    refetchOnWindowFocus: false,
  }
}

export const Route = createFileRoute("/_layout/health")({
  component: HealthRecords,
  head: () => ({
    meta: [
      {
        title: "健康记录 - FastAPI Template",
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
}: {
  title: string
  value: string | number
  unit?: string
  icon: React.ComponentType<{ className?: string }>
  color: string
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className={`h-4 w-4 ${color}`} />
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

function Statistics({ records }: { records: HealthRecordPublic[] }) {
  if (records.length === 0) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        {[...Array(5)].map((_, i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div className="text-sm font-medium">暂无数据</div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">-</div>
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  const latestRecord = records[0]
  const avgWeight =
    records.filter((r) => r.weight !== null && r.weight !== undefined).length > 0
      ? (
          records
            .filter((r) => r.weight !== null && r.weight !== undefined)
            .reduce((sum, r) => sum + (r.weight || 0), 0) /
          records.filter((r) => r.weight !== null && r.weight !== undefined).length
        ).toFixed(1)
      : "-"

  const avgSleep =
    records.filter((r) => r.sleep_duration !== null && r.sleep_duration !== undefined).length > 0
      ? (
          records
            .filter((r) => r.sleep_duration !== null && r.sleep_duration !== undefined)
            .reduce((sum, r) => sum + (r.sleep_duration || 0), 0) /
          records.filter((r) => r.sleep_duration !== null && r.sleep_duration !== undefined).length
        ).toFixed(1)
      : "-"

  const avgHeartRate =
    records.filter((r) => r.heart_rate !== null && r.heart_rate !== undefined).length > 0
      ? Math.round(
          records
            .filter((r) => r.heart_rate !== null && r.heart_rate !== undefined)
            .reduce((sum, r) => sum + (r.heart_rate || 0), 0) /
            records.filter((r) => r.heart_rate !== null && r.heart_rate !== undefined).length,
        )
      : "-"

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
      <StatCard
        title="最新体重"
        value={latestRecord.weight?.toFixed(1) || "-"}
        unit="kg"
        icon={User}
        color="text-blue-500"
      />
      <StatCard
        title="平均体重"
        value={avgWeight}
        unit="kg"
        icon={User}
        color="text-cyan-500"
      />
      <StatCard
        title="平均睡眠"
        value={avgSleep}
        unit="小时"
        icon={Bed}
        color="text-purple-500"
      />
      <StatCard
        title="平均心率"
        value={avgHeartRate}
        unit="bpm"
        icon={Heart}
        color="text-red-500"
      />
      <StatCard
        title="总记录数"
        value={records.length}
        icon={Activity}
        color="text-green-500"
      />
    </div>
  )
}

function HealthRecordCard({
  record,
  onEdit,
  onDelete,
}: {
  record: HealthRecordPublic
  onEdit: (record: HealthRecordPublic) => void
  onDelete: (id: string) => void
}) {
  return (
    <Card className="overflow-hidden hover:shadow-lg transition-shadow">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-lg">{record.record_date}</CardTitle>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>操作</DropdownMenuLabel>
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
          {record.height !== null && record.height !== undefined && (
            <Badge variant="outline" className="text-xs">
              身高: {record.height}cm
            </Badge>
          )}
          {record.weight !== null && record.weight !== undefined && (
            <Badge variant="outline" className="text-xs">
              体重: {record.weight}kg
            </Badge>
          )}
          {record.heart_rate !== null && record.heart_rate !== undefined && (
            <Badge variant="outline" className="text-xs">
              心率: {record.heart_rate}bpm
            </Badge>
          )}
          {record.blood_pressure_systolic !== null &&
            record.blood_pressure_systolic !== undefined &&
            record.blood_pressure_diastolic !== null &&
            record.blood_pressure_diastolic !== undefined && (
              <Badge variant="outline" className="text-xs">
                血压: {record.blood_pressure_systolic}/{record.blood_pressure_diastolic}
              </Badge>
            )}
          {record.sleep_duration !== null && record.sleep_duration !== undefined && (
            <Badge variant="outline" className="text-xs">
              睡眠: {record.sleep_duration}h
            </Badge>
          )}
          {record.exercise_duration !== null && record.exercise_duration !== undefined && (
            <Badge variant="outline" className="text-xs">
              运动: {record.exercise_duration}min
            </Badge>
          )}
        </div>
        {record.tags && record.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2">
            {record.tags.map((tag, idx) => (
              <Badge key={idx} variant="secondary" className="text-xs">
                <Tag className="mr-1 h-3 w-3" />
                {tag}
              </Badge>
            ))}
          </div>
        )}
        {record.notes && (
          <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{record.notes}</p>
        )}
      </CardContent>
    </Card>
  )
}

function HealthRecordForm({
  record,
  onSubmit,
  onCancel,
}: {
  record?: HealthRecordPublic
  onSubmit: (data: HealthRecordCreate) => void
  onCancel: () => void
}) {
  const today = new Date().toISOString().split("T")[0]
  const [formData, setFormData] = useState<HealthRecordCreate>({
    record_date: record?.record_date || today,
    height: record?.height ?? null,
    weight: record?.weight ?? null,
    heart_rate: record?.heart_rate ?? null,
    blood_pressure_systolic: record?.blood_pressure_systolic ?? null,
    blood_pressure_diastolic: record?.blood_pressure_diastolic ?? null,
    sleep_duration: record?.sleep_duration ?? null,
    exercise_duration: record?.exercise_duration ?? null,
    tags: record?.tags || [],
    notes: record?.notes || null,
  })

  const [tagsInput, setTagsInput] = useState(
    record?.tags?.join(", ") || "",
  )

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const tags = tagsInput
      .split(",")
      .map((t) => t.trim())
      .filter((t) => t)
    onSubmit({ ...formData, tags: tags.length > 0 ? tags : null })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="record_date">记录日期 *</Label>
        <Input
          id="record_date"
          type="date"
          value={formData.record_date}
          onChange={(e) => setFormData({ ...formData, record_date: e.target.value })}
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="height">身高 (cm)</Label>
          <Input
            id="height"
            type="number"
            min="0"
            step="0.1"
            value={formData.height ?? ""}
            onChange={(e) =>
              setFormData({
                ...formData,
                height: e.target.value ? parseFloat(e.target.value) : null,
              })
            }
            placeholder="例如: 170.5"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="weight">体重 (kg)</Label>
          <Input
            id="weight"
            type="number"
            min="0"
            step="0.1"
            value={formData.weight ?? ""}
            onChange={(e) =>
              setFormData({
                ...formData,
                weight: e.target.value ? parseFloat(e.target.value) : null,
              })
            }
            placeholder="例如: 65.5"
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="heart_rate">心率 (bpm)</Label>
          <Input
            id="heart_rate"
            type="number"
            min="0"
            value={formData.heart_rate ?? ""}
            onChange={(e) =>
              setFormData({
                ...formData,
                heart_rate: e.target.value ? parseInt(e.target.value) : null,
              })
            }
            placeholder="例如: 72"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="blood_pressure_systolic">收缩压</Label>
          <Input
            id="blood_pressure_systolic"
            type="number"
            min="0"
            value={formData.blood_pressure_systolic ?? ""}
            onChange={(e) =>
              setFormData({
                ...formData,
                blood_pressure_systolic: e.target.value ? parseInt(e.target.value) : null,
              })
            }
            placeholder="例如: 120"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="blood_pressure_diastolic">舒张压</Label>
          <Input
            id="blood_pressure_diastolic"
            type="number"
            min="0"
            value={formData.blood_pressure_diastolic ?? ""}
            onChange={(e) =>
              setFormData({
                ...formData,
                blood_pressure_diastolic: e.target.value ? parseInt(e.target.value) : null,
              })
            }
            placeholder="例如: 80"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="sleep_duration">睡眠时长 (小时)</Label>
          <Input
            id="sleep_duration"
            type="number"
            min="0"
            step="0.5"
            value={formData.sleep_duration ?? ""}
            onChange={(e) =>
              setFormData({
                ...formData,
                sleep_duration: e.target.value ? parseFloat(e.target.value) : null,
              })
            }
            placeholder="例如: 7.5"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="exercise_duration">运动时长 (分钟)</Label>
          <Input
            id="exercise_duration"
            type="number"
            min="0"
            value={formData.exercise_duration ?? ""}
            onChange={(e) =>
              setFormData({
                ...formData,
                exercise_duration: e.target.value ? parseInt(e.target.value) : null,
              })
            }
            placeholder="例如: 45"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="tags">标签 (用逗号分隔)</Label>
        <Input
          id="tags"
          value={tagsInput}
          onChange={(e) => setTagsInput(e.target.value)}
          placeholder="例如: 晨起, 运动后, 定期检查"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">备注</Label>
        <Textarea
          id="notes"
          value={formData.notes || ""}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value || null })}
          placeholder="备注内容"
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

function HealthRecords() {
  const [startDate, setStartDate] = useState<string | undefined>(undefined)
  const [endDate, setEndDate] = useState<string | undefined>(undefined)
  const [tagFilter, setTagFilter] = useState<string | undefined>(undefined)
  const [tagInput, setTagInput] = useState("")
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [editRecord, setEditRecord] = useState<HealthRecordPublic | undefined>(
    undefined,
  )

  const queryClient = useQueryClient()
  const { showSuccessToast, showErrorToast } = useCustomToast()

  const {
    data: recordsData,
    isLoading: recordsLoading,
  } = useQuery(
    getRecordsQueryOptions({
      start_date: startDate,
      end_date: endDate,
      tag: tagFilter,
    }),
  )

  const records = recordsData?.data || []

  const handleTagSearch = () => {
    setTagFilter(tagInput || undefined)
  }

  const createMutation = useMutation({
    mutationFn: (data: HealthRecordCreate) =>
      HealthRecordService.createRecord({ requestBody: data }),
    onSuccess: () => {
      showSuccessToast("健康记录添加成功")
      setAddDialogOpen(false)
      queryClient.invalidateQueries({ queryKey: ["healthRecords"] })
    },
    onError: handleError.bind(showErrorToast),
  })

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string
      data: HealthRecordCreate
    }) =>
      HealthRecordService.updateRecord({
        record_id: id,
        requestBody: data,
      }),
    onSuccess: () => {
      showSuccessToast("健康记录更新成功")
      setEditRecord(undefined)
      queryClient.invalidateQueries({ queryKey: ["healthRecords"] })
    },
    onError: handleError.bind(showErrorToast),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      HealthRecordService.deleteRecord({ record_id: id }),
    onSuccess: () => {
      showSuccessToast("健康记录删除成功")
      queryClient.invalidateQueries({ queryKey: ["healthRecords"] })
    },
    onError: handleError.bind(showErrorToast),
  })

  const handleCreate = (data: HealthRecordCreate) => {
    createMutation.mutate(data)
  }

  const handleUpdate = (data: HealthRecordCreate) => {
    if (editRecord) {
      updateMutation.mutate({ id: editRecord.id, data })
    }
  }

  const handleDelete = (id: string) => {
    if (window.confirm("确定要删除这条健康记录吗？")) {
      deleteMutation.mutate(id)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">健康记录</h1>
          <p className="text-muted-foreground">
            记录您的个人健康体征数据，跟踪健康变化
          </p>
        </div>
        <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              添加记录
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>添加健康记录</DialogTitle>
              <DialogDescription>
                记录您的身高、体重、心率、血压、睡眠、运动等健康数据
              </DialogDescription>
            </DialogHeader>
            <HealthRecordForm
              onSubmit={handleCreate}
              onCancel={() => setAddDialogOpen(false)}
            />
          </DialogContent>
        </Dialog>
      </div>

      <Statistics records={records} />

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Label className="text-sm">开始日期:</Label>
              <Input
                type="date"
                value={startDate || ""}
                onChange={(e) => setStartDate(e.target.value || undefined)}
                className="w-auto"
              />
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-sm">结束日期:</Label>
              <Input
                type="date"
                value={endDate || ""}
                onChange={(e) => setEndDate(e.target.value || undefined)}
                className="w-auto"
              />
            </div>
            <div className="flex-1 max-w-sm ml-auto">
              <div className="flex gap-2">
                <Input
                  placeholder="按标签筛选..."
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  className="flex-1"
                />
                <Button variant="secondary" onClick={handleTagSearch}>
                  <Search className="h-4 w-4" />
                </Button>
              </div>
            </div>
            {(startDate || endDate || tagFilter) && (
              <Button
                variant="ghost"
                onClick={() => {
                  setStartDate(undefined)
                  setEndDate(undefined)
                  setTagFilter(undefined)
                  setTagInput("")
                }}
              >
                清除筛选
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {recordsLoading ? (
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
          ) : records.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center py-12">
              <div className="rounded-full bg-muted p-4 mb-4">
                <Activity className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold">
                {startDate || endDate || tagFilter
                  ? "没有找到匹配的健康记录"
                  : "您还没有任何健康记录"}
              </h3>
              <p className="text-muted-foreground">
                {startDate || endDate || tagFilter
                  ? "尝试调整筛选条件"
                  : "点击上方按钮添加第一条健康记录"}
              </p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {records.map((record) => (
                <HealthRecordCard
                  key={record.id}
                  record={record}
                  onEdit={setEditRecord}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={!!editRecord}
        onOpenChange={(open) => !open && setEditRecord(undefined)}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>编辑健康记录</DialogTitle>
            <DialogDescription>
              修改健康记录的详细信息
            </DialogDescription>
          </DialogHeader>
          {editRecord && (
            <HealthRecordForm
              record={editRecord}
              onSubmit={handleUpdate}
              onCancel={() => setEditRecord(undefined)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

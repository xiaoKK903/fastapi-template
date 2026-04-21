import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { Search, Trash2, ChevronDown, ChevronRight, TrendingUp } from "lucide-react"
import { useState, useCallback, useMemo } from "react"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
} from "recharts"

import { TasksService, TaskStatus, TaskPriority, type TaskStatistics, type TasksPublic, type TasksWithSubtasksPublic, type TaskWithSubtasks, type TaskTrend } from "@/services/TasksService"
import { DataTable } from "@/components/Common/DataTable"
import AddTask from "@/components/Tasks/AddTask"
import { columns, createTreeColumns } from "@/components/Tasks/columns"
import PendingTasks from "@/components/Pending/PendingTasks"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import useCustomToast from "@/hooks/useCustomToast"
import { handleError } from "@/utils"
import type { FlatTaskWithLevel } from "@/lib/utils"
import { flattenTaskTree, filterExpandedTasks } from "@/lib/utils"

function getTasksQueryOptions({
  status,
  priority,
  search,
  includeArchived,
  includeDeleted,
}: {
  status?: TaskStatus
  priority?: TaskPriority
  search?: string
  includeArchived?: boolean
  includeDeleted?: boolean
} = {}) {
  return {
    queryFn: () =>
      TasksService.readTasks({
        skip: 0,
        limit: 100,
        status,
        priority,
        search: search || undefined,
        includeArchived,
        includeDeleted,
      }),
    queryKey: ["tasks", status, priority, search, includeArchived, includeDeleted],
    retry: 1,
  }
}

function getTaskTreeQueryOptions({
  status,
  priority,
  search,
  includeArchived,
  includeDeleted,
}: {
  status?: TaskStatus
  priority?: TaskPriority
  search?: string
  includeArchived?: boolean
  includeDeleted?: boolean
} = {}) {
  return {
    queryFn: () =>
      TasksService.getTaskTree({
        status,
        priority,
        search: search || undefined,
        includeArchived,
        includeDeleted,
      }),
    queryKey: ["tasksTree", status, priority, search, includeArchived, includeDeleted],
    retry: 1,
  }
}

function getStatisticsQueryOptions() {
  return {
    queryFn: () => TasksService.getTaskStatistics(),
    queryKey: ["tasksStatistics"],
    retry: 1,
  }
}

function getTaskTrendQueryOptions(days: number = 7) {
  return {
    queryFn: () => TasksService.getTaskTrend({ days }),
    queryKey: ["tasksTrend", days],
    retry: 1,
  }
}

export const Route = createFileRoute("/_layout/tasks")({
  component: Tasks,
  head: () => ({
    meta: [
      {
        title: "任务管理 - FastAPI Template",
      },
    ],
  }),
})

function StatCard({
  title,
  value,
  badge,
  badgeVariant,
}: {
  title: string
  value: number
  badge?: string
  badgeVariant?: "default" | "secondary" | "destructive" | "outline"
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-2">
          <div className="text-2xl font-bold">{value}</div>
          {badge && (
            <Badge variant={badgeVariant || "outline"}>{badge}</Badge>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function Statistics({
  stats,
  isLoading,
  error,
}: {
  stats: TaskStatistics | undefined
  isLoading: boolean
  error: unknown
}) {
  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(8)].map((_, i) => (
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

  if (error || !stats) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(8)].map((_, i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div className="text-sm font-medium">--</div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">--</div>
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <StatCard title="总任务数" value={stats.total_tasks} />
      <StatCard
        title="待办任务"
        value={stats.todo_tasks}
        badge="待处理"
      />
      <StatCard
        title="进行中"
        value={stats.in_progress_tasks}
        badge="进行中"
        badgeVariant="default"
      />
      <StatCard
        title="已完成"
        value={stats.done_tasks}
        badge={`${stats.completion_rate}%`}
        badgeVariant="secondary"
      />
      <StatCard
        title="已逾期"
        value={stats.overdue_tasks}
        badge="逾期"
        badgeVariant="destructive"
      />
      <StatCard
        title="高优先级"
        value={stats.high_priority_tasks + stats.urgent_priority_tasks}
        badge="紧急/高"
        badgeVariant="destructive"
      />
      <StatCard
        title="已归档"
        value={stats.archived_tasks}
        badge="归档"
        badgeVariant="outline"
      />
      <StatCard
        title="回收站"
        value={stats.deleted_tasks}
        badge="回收站"
        badgeVariant="outline"
      />
    </div>
  )
}

function TaskTrendChart({
  trend,
  isLoading,
  error,
}: {
  trend: TaskTrend | undefined
  isLoading: boolean
  error: unknown
}) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">任务趋势</CardTitle>
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent className="h-64 flex items-center justify-center">
          <span className="text-muted-foreground">加载中...</span>
        </CardContent>
      </Card>
    )
  }

  if (error || !trend || !trend.days || trend.days.length === 0) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">任务趋势</CardTitle>
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent className="h-64 flex items-center justify-center">
          <span className="text-muted-foreground">暂无数据</span>
        </CardContent>
      </Card>
    )
  }

  const chartData = trend.days.map((day) => ({
    date: day.date.slice(5),
    新增: day.created_count,
    完成: day.completed_count,
    逾期: day.overdue_count,
  }))

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">任务趋势（近7天）</CardTitle>
        <TrendingUp className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis
              dataKey="date"
              stroke="#9CA3AF"
              tick={{ fontSize: 12 }}
            />
            <YAxis
              stroke="#9CA3AF"
              tick={{ fontSize: 12 }}
              allowDecimals={false}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#1F2937",
                border: "1px solid #374151",
                borderRadius: "0.5rem",
              }}
              labelStyle={{ color: "#F9FAFB" }}
            />
            <Legend />
            <Line
              type="monotone"
              dataKey="新增"
              stroke="#3B82F6"
              strokeWidth={2}
              dot={{ fill: "#3B82F6" }}
            />
            <Line
              type="monotone"
              dataKey="完成"
              stroke="#10B981"
              strokeWidth={2}
              dot={{ fill: "#10B981" }}
            />
            <Line
              type="monotone"
              dataKey="逾期"
              stroke="#EF4444"
              strokeWidth={2}
              dot={{ fill: "#EF4444" }}
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}

function StatusDistributionChart({
  stats,
}: {
  stats: TaskStatistics | undefined
}) {
  if (!stats) {
    return null
  }

  const chartData = [
    { name: "待办", value: stats.todo_tasks, color: "#6B7280" },
    { name: "进行中", value: stats.in_progress_tasks, color: "#3B82F6" },
    { name: "已完成", value: stats.done_tasks, color: "#10B981" },
    { name: "已暂停", value: stats.on_hold_tasks, color: "#F59E0B" },
    { name: "已取消", value: stats.cancelled_tasks, color: "#EF4444" },
  ].filter((item) => item.value > 0)

  if (chartData.length === 0) {
    return null
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">状态分布</CardTitle>
      </CardHeader>
      <CardContent className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis
              type="number"
              stroke="#9CA3AF"
              tick={{ fontSize: 12 }}
              allowDecimals={false}
            />
            <YAxis
              dataKey="name"
              type="category"
              stroke="#9CA3AF"
              tick={{ fontSize: 12 }}
              width={60}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#1F2937",
                border: "1px solid #374151",
                borderRadius: "0.5rem",
              }}
              labelStyle={{ color: "#F9FAFB" }}
            />
            <Bar dataKey="value" radius={[0, 4, 4, 0]}>
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}

function TasksTableContent({
  tasks,
  isLoading,
  error,
  includeArchived,
  includeDeleted,
}: {
  tasks: TasksPublic | undefined
  isLoading: boolean
  error: unknown
  includeArchived?: boolean
  includeDeleted?: boolean
}) {
  if (isLoading) {
    return <PendingTasks />
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center text-center py-12">
        <div className="rounded-full bg-destructive/10 p-4 mb-4">
          <Trash2 className="h-8 w-8 text-destructive" />
        </div>
        <h3 className="text-lg font-semibold">加载失败</h3>
        <p className="text-muted-foreground">请刷新页面重试</p>
      </div>
    )
  }

  if (!tasks || tasks.data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center text-center py-12">
        <div className="rounded-full bg-muted p-4 mb-4">
          <Search className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-semibold">
          {includeDeleted ? "回收站为空" : includeArchived ? "没有已归档的任务" : "您还没有任何任务"}
        </h3>
        <p className="text-muted-foreground">
          {includeDeleted ? "回收站中没有任务" : includeArchived ? "没有已归档的任务" : "添加一个新任务开始您的待办之旅"}
        </p>
      </div>
    )
  }

  return <DataTable columns={columns} data={tasks.data} />
}

function TasksTreeTableContent({
  tasks,
  isLoading,
  error,
  expandedIds,
  onToggleExpand,
}: {
  tasks: TasksWithSubtasksPublic | undefined
  isLoading: boolean
  error: unknown
  expandedIds: Set<string>
  onToggleExpand: (id: string) => void
}) {
  const treeColumns = useMemo(
    () => createTreeColumns({ expandedIds, onToggleExpand }),
    [expandedIds, onToggleExpand]
  )

  const displayData = useMemo(() => {
    if (!tasks || !tasks.data) return []
    const flatTasks = flattenTaskTree(tasks.data)
    return filterExpandedTasks(flatTasks, expandedIds)
  }, [tasks, expandedIds])

  if (isLoading) {
    return <PendingTasks />
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center text-center py-12">
        <div className="rounded-full bg-destructive/10 p-4 mb-4">
          <Trash2 className="h-8 w-8 text-destructive" />
        </div>
        <h3 className="text-lg font-semibold">加载失败</h3>
        <p className="text-muted-foreground">请刷新页面重试</p>
      </div>
    )
  }

  if (!tasks || tasks.data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center text-center py-12">
        <div className="rounded-full bg-muted p-4 mb-4">
          <Search className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-semibold">您还没有任何任务</h3>
        <p className="text-muted-foreground">添加一个新任务开始您的待办之旅</p>
      </div>
    )
  }

  return <DataTable columns={treeColumns} data={displayData} />
}

function Tasks() {
  const [status, setStatus] = useState<TaskStatus | undefined>(undefined)
  const [priority, setPriority] = useState<TaskPriority | undefined>(undefined)
  const [search, setSearch] = useState("")
  const [searchInput, setSearchInput] = useState("")
  const [activeTab, setActiveTab] = useState("active")
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  const handleSearch = () => {
    setSearch(searchInput)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSearch()
    }
  }

  const toggleExpand = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }, [])

  const queryClient = useQueryClient()
  const { showSuccessToast, showErrorToast } = useCustomToast()

  const { data: stats, isLoading: statsLoading, error: statsError } = useQuery(getStatisticsQueryOptions())
  const { data: trend, isLoading: trendLoading, error: trendError } = useQuery(getTaskTrendQueryOptions(7))

  const includeArchived = activeTab === "archived"
  const includeDeleted = activeTab === "trash"

  const { data: tasks, isLoading: tasksLoading, error: tasksError } = useQuery(
    getTasksQueryOptions({ status, priority, search, includeArchived, includeDeleted })
  )

  const { data: tasksTree, isLoading: treeLoading, error: treeError } = useQuery(
    getTaskTreeQueryOptions({ status, priority, search, includeArchived: false, includeDeleted: false })
  )

  const emptyTrashMutation = useMutation({
    mutationFn: () => TasksService.emptyTrash(),
    onSuccess: () => {
      showSuccessToast("回收站已清空")
      queryClient.invalidateQueries({ queryKey: ["tasks"] })
      queryClient.invalidateQueries({ queryKey: ["tasksTree"] })
      queryClient.invalidateQueries({ queryKey: ["tasksStatistics"] })
    },
    onError: handleError.bind(showErrorToast),
  })

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">任务管理</h1>
          <p className="text-muted-foreground">创建和管理您的多级任务待办</p>
        </div>
        <AddTask />
      </div>

      <Statistics stats={stats} isLoading={statsLoading} error={statsError} />

      <div className="grid gap-4 md:grid-cols-2">
        <TaskTrendChart trend={trend} isLoading={trendLoading} error={trendError} />
        <StatusDistributionChart stats={stats} />
      </div>

      <Tabs defaultValue="active" value={activeTab} onValueChange={setActiveTab}>
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="active">进行中</TabsTrigger>
            <TabsTrigger value="archived">已归档</TabsTrigger>
            <TabsTrigger value="trash">回收站</TabsTrigger>
          </TabsList>
          <div className="flex items-center gap-2">
            <div className="flex gap-2">
              <Select
                value={status || "all"}
                onValueChange={(v) => setStatus(v === "all" ? undefined : (v as TaskStatus))}
              >
                <SelectTrigger className="w-[120px]">
                  <SelectValue placeholder="状态" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部状态</SelectItem>
                  <SelectItem value="todo">待办</SelectItem>
                  <SelectItem value="in_progress">进行中</SelectItem>
                  <SelectItem value="done">已完成</SelectItem>
                  <SelectItem value="on_hold">暂停</SelectItem>
                  <SelectItem value="cancelled">已取消</SelectItem>
                </SelectContent>
              </Select>

              <Select
                value={priority || "all"}
                onValueChange={(v) => setPriority(v === "all" ? undefined : (v as TaskPriority))}
              >
                <SelectTrigger className="w-[120px]">
                  <SelectValue placeholder="优先级" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部优先级</SelectItem>
                  <SelectItem value="low">低</SelectItem>
                  <SelectItem value="medium">中</SelectItem>
                  <SelectItem value="high">高</SelectItem>
                  <SelectItem value="urgent">紧急</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-2">
              <Input
                placeholder="搜索任务..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={handleKeyDown}
                className="w-[200px]"
              />
              <Button variant="secondary" onClick={handleSearch}>
                搜索
              </Button>
            </div>
          </div>
        </div>

        <TabsContent value="active" className="mt-4">
          <TasksTreeTableContent
            tasks={tasksTree}
            isLoading={treeLoading}
            error={treeError}
            expandedIds={expandedIds}
            onToggleExpand={toggleExpand}
          />
        </TabsContent>

        <TabsContent value="archived" className="mt-4">
          <TasksTableContent
            tasks={tasks}
            isLoading={tasksLoading}
            error={tasksError}
            includeArchived={true}
            includeDeleted={false}
          />
        </TabsContent>

        <TabsContent value="trash" className="mt-4">
          <div className="flex items-center justify-between mb-4">
            <p className="text-muted-foreground text-sm">
              回收站中的任务可以恢复或永久删除
            </p>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => emptyTrashMutation.mutate()}
              disabled={emptyTrashMutation.isPending}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              清空回收站
            </Button>
          </div>
          <TasksTableContent
            tasks={tasks}
            isLoading={tasksLoading}
            error={tasksError}
            includeArchived={false}
            includeDeleted={true}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}

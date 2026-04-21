import { useSuspenseQuery, useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { Search, Archive, Trash2, RefreshCcw } from "lucide-react"
import { Suspense, useState } from "react"

import { TasksService, TaskStatus, TaskPriority, type TaskStatistics } from "@/services/TasksService"
import { DataTable } from "@/components/Common/DataTable"
import AddTask from "@/components/Tasks/AddTask"
import { columns } from "@/components/Tasks/columns"
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
  }
}

function getStatisticsQueryOptions() {
  return {
    queryFn: () => TasksService.getTaskStatistics(),
    queryKey: ["tasksStatistics"],
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

function StatisticsContent() {
  const { data: stats } = useSuspenseQuery(getStatisticsQueryOptions())

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

function Statistics() {
  return (
    <Suspense
      fallback={
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
      }
    >
      <StatisticsContent />
    </Suspense>
  )
}

function TasksTableContent({
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
}) {
  const { data: tasks } = useSuspenseQuery(
    getTasksQueryOptions({ status, priority, search, includeArchived, includeDeleted })
  )

  if (tasks.data.length === 0) {
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

function TasksTable({
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
}) {
  return (
    <Suspense fallback={<PendingTasks />}>
      <TasksTableContent
        status={status}
        priority={priority}
        search={search}
        includeArchived={includeArchived}
        includeDeleted={includeDeleted}
      />
    </Suspense>
  )
}

function Tasks() {
  const [status, setStatus] = useState<TaskStatus | undefined>(undefined)
  const [priority, setPriority] = useState<TaskPriority | undefined>(undefined)
  const [search, setSearch] = useState("")
  const [searchInput, setSearchInput] = useState("")

  const handleSearch = () => {
    setSearch(searchInput)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSearch()
    }
  }

  const queryClient = useQueryClient()
  const { showSuccessToast, showErrorToast } = useCustomToast()

  const emptyTrashMutation = useMutation({
    mutationFn: () => TasksService.emptyTrash(),
    onSuccess: () => {
      showSuccessToast("回收站已清空")
      queryClient.invalidateQueries({ queryKey: ["tasks"] })
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

      <Statistics />

      <Tabs defaultValue="active">
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
          <TasksTable
            status={status}
            priority={priority}
            search={search}
            includeArchived={false}
            includeDeleted={false}
          />
        </TabsContent>

        <TabsContent value="archived" className="mt-4">
          <TasksTable
            status={status}
            priority={priority}
            search={search}
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
          <TasksTable
            status={status}
            priority={priority}
            search={search}
            includeArchived={false}
            includeDeleted={true}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}

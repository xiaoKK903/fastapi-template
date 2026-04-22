import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useState, useEffect } from "react"
import {
  Activity,
  AlertTriangle,
  BarChart3,
  CheckCircle,
  Clock,
  Database,
  Download,
  FileText,
  Filter,
  Globe,
  RefreshCw,
  Search,
  Trash2,
  User,
  XCircle,
} from "lucide-react"

import {
  type ActionType,
  type LogStats,
  type OperationLogPublic,
  LogsService,
  type ResourceType,
} from "@/services/LogsService"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"
import useAuth from "@/hooks/useAuth"
import { formatDateTime, formatDuration } from "@/utils"
import useCustomToast from "@/hooks/useCustomToast"

function getResourceLabel(resource: ResourceType): string {
  const labels: Record<ResourceType, string> = {
    habit: "习惯",
    habit_record: "习惯记录",
    transaction: "交易",
    category: "分类",
    budget: "预算",
    user: "用户",
    role: "角色",
    permission: "权限",
    operation_log: "操作日志",
    task: "任务",
    file: "文件",
    folder: "文件夹",
    file_tag: "文件标签",
    file_share: "文件分享",
  }
  return labels[resource] || resource
}

function getActionLabel(action: ActionType): string {
  const labels: Record<ActionType, string> = {
    create: "创建",
    read: "读取",
    update: "更新",
    delete: "删除",
  }
  return labels[action] || action
}

function getActionBadgeVariant(action: ActionType): "default" | "secondary" | "outline" | "destructive" {
  const variants: Record<ActionType, "default" | "secondary" | "outline" | "destructive"> = {
    create: "default",
    read: "secondary",
    update: "outline",
    delete: "destructive",
  }
  return variants[action]
}

function getResourceBadgeVariant(resource: ResourceType): "default" | "secondary" | "outline" | "destructive" {
  const fileRelated: ResourceType[] = ["file", "folder", "file_tag", "file_share"]
  const userRelated: ResourceType[] = ["user", "role", "permission", "operation_log"]
  const habitRelated: ResourceType[] = ["habit", "habit_record"]
  const financeRelated: ResourceType[] = ["transaction", "category", "budget"]

  if (fileRelated.includes(resource)) return "default"
  if (userRelated.includes(resource)) return "secondary"
  if (habitRelated.includes(resource)) return "outline"
  if (financeRelated.includes(resource)) return "destructive"
  return "outline"
}

export const Route = createFileRoute("/_layout/logs")({
  component: LogsPage,
  head: () => ({
    meta: [
      {
        title: "操作日志 - FastAPI Template",
      },
    ],
  }),
})

function LogsPage() {
  const navigate = useNavigate()
  const { isSuperuser } = useAuth()
  const queryClient = useQueryClient()
  const { showSuccessToast, showErrorToast } = useCustomToast()

  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [searchTerm, setSearchTerm] = useState("")
  const [filterAction, setFilterAction] = useState<ActionType | "">("")
  const [filterResource, setFilterResource] = useState<ResourceType | "">("")
  const [filterSuccess, setFilterSuccess] = useState<boolean | "">("")
  const [selectedLog, setSelectedLog] = useState<OperationLogPublic | null>(null)
  const [detailDialogOpen, setDetailDialogOpen] = useState(false)
  const [confirmCleanDays, setConfirmCleanDays] = useState(30)
  const [cleanDialogOpen, setCleanDialogOpen] = useState(false)

  const {
    data: logsData,
    isLoading: logsLoading,
    error: logsError,
    refetch: refetchLogs,
  } = useQuery({
    queryKey: ["operationLogs", currentPage, pageSize, filterAction, filterResource, filterSuccess],
    queryFn: () =>
      LogsService.getLogs(
        (currentPage - 1) * pageSize,
        pageSize,
        undefined,
        filterAction || undefined,
        filterResource || undefined,
        filterSuccess === "" ? undefined : filterSuccess,
      ),
    enabled: !!isSuperuser,
  })

  const {
    data: statsData,
    isLoading: statsLoading,
    refetch: refetchStats,
  } = useQuery({
    queryKey: ["logStats"],
    queryFn: () => LogsService.getLogStats(),
    enabled: !!isSuperuser,
  })

  const cleanMutation = useMutation({
    mutationFn: (days: number) => LogsService.cleanLogs(days),
    onSuccess: (data) => {
      showSuccessToast(`成功清理 ${data.deleted_count} 条日志`)
      queryClient.invalidateQueries({ queryKey: ["operationLogs"] })
      queryClient.invalidateQueries({ queryKey: ["logStats"] })
    },
    onError: (error) => {
      showErrorToast(error instanceof Error ? error.message : "清理日志失败")
    },
  })

  useEffect(() => {
    if (!isSuperuser) {
      navigate({ to: "/" })
    }
  }, [isSuperuser, navigate])

  useEffect(() => {
    setCurrentPage(1)
  }, [filterAction, filterResource, filterSuccess])

  const totalPages = logsData ? Math.ceil(logsData.count / pageSize) : 1

  const viewLogDetail = (log: OperationLogPublic) => {
    setSelectedLog(log)
    setDetailDialogOpen(true)
  }

  const handleCleanLogs = () => {
    cleanMutation.mutate(confirmCleanDays)
    setCleanDialogOpen(false)
  }

  const renderStatsCards = () => {
    if (statsLoading) {
      return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-16" />
                <Skeleton className="h-3 w-20 mt-2" />
              </CardContent>
            </Card>
          ))}
        </div>
      )
    }

    const stats = statsData || {
      total_count: 0,
      success_count: 0,
      error_count: 0,
      avg_duration_ms: 0,
      top_resources: [],
      top_actions: [],
      recent_errors: [],
    }

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Activity className="h-4 w-4" />
              总请求数
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total_count.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">
              成功: {stats.success_count} | 失败: {stats.error_count}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-emerald-500" />
              成功率
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-500">
              {stats.total_count > 0
                ? ((stats.success_count / stats.total_count) * 100).toFixed(1)
                : 0}%
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.error_count} 个错误请求
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Clock className="h-4 w-4 text-blue-500" />
              平均耗时
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-500">
              {formatDuration(stats.avg_duration_ms || 0)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">毫秒</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              错误数
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${stats.error_count > 0 ? "text-red-500" : ""}`}>
              {stats.error_count}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.error_count > 0 ? "需要关注" : "一切正常"}
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const renderLogTable = () => {
    if (logsLoading) {
      return (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      )
    }

    if (logsError) {
      return (
        <div className="text-center py-8 text-muted-foreground">
          <XCircle className="h-12 w-12 mx-auto mb-2 opacity-50" />
          <p>加载日志失败</p>
          <Button variant="ghost" onClick={() => refetchLogs()} className="mt-2">
            重试
          </Button>
        </div>
      )
    }

    const logs = logsData?.data || []

    if (logs.length === 0) {
      return (
        <div className="text-center py-8 text-muted-foreground">
          <Database className="h-12 w-12 mx-auto mb-2 opacity-50" />
          <p>暂无日志记录</p>
        </div>
      )
    }

    return (
      <>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>时间</TableHead>
                <TableHead>用户</TableHead>
                <TableHead>操作</TableHead>
                <TableHead>资源</TableHead>
                <TableHead>路径</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>耗时</TableHead>
                <TableHead>操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((log) => (
                <TableRow key={log.id} className="cursor-pointer hover:bg-muted/50">
                  <TableCell className="whitespace-nowrap text-sm">
                    {log.created_at ? formatDateTime(log.created_at) : "-"}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center">
                        <User className="h-3 w-3 text-primary" />
                      </div>
                      <span className="text-sm">{log.user_email || "匿名"}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={getActionBadgeVariant(log.action)}>
                      {getActionLabel(log.action)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={getResourceBadgeVariant(log.resource)}>
                      {getResourceLabel(log.resource)}
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate text-sm text-muted-foreground">
                    {log.request_path}
                  </TableCell>
                  <TableCell>
                    {log.success ? (
                      <Badge variant="secondary" className="bg-emerald-50 text-emerald-700">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        成功
                      </Badge>
                    ) : (
                      <Badge variant="destructive">
                        <XCircle className="h-3 w-3 mr-1" />
                        失败
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">
                    {log.duration_ms !== undefined && log.duration_ms !== null
                      ? `${log.duration_ms}ms`
                      : "-"}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        viewLogDetail(log)
                      }}
                    >
                      <FileText className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {totalPages > 1 && (
          <Pagination className="mt-4">
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                />
              </PaginationItem>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const page = Math.max(1, Math.min(currentPage - 2, totalPages - 4)) + i
                if (page > totalPages || page < 1) return null
                return (
                  <PaginationItem key={page}>
                    <PaginationLink isActive={page === currentPage} onClick={() => setCurrentPage(page)}>
                      {page}
                    </PaginationLink>
                  </PaginationItem>
                )
              })}
              <PaginationItem>
                <PaginationNext
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        )}
      </>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">操作日志</h1>
          <p className="text-muted-foreground">
            监控和管理系统中的所有操作记录
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={() => { refetchLogs(); refetchStats() }}>
            <RefreshCw className="h-4 w-4 mr-2" />
            刷新
          </Button>
          <Button variant="destructive" onClick={() => setCleanDialogOpen(true)}>
            <Trash2 className="h-4 w-4 mr-2" />
            清理日志
          </Button>
        </div>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">
            <BarChart3 className="h-4 w-4 mr-2" />
            统计概览
          </TabsTrigger>
          <TabsTrigger value="logs">
            <Activity className="h-4 w-4 mr-2" />
            日志列表
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          {renderStatsCards()}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">热门资源</CardTitle>
                <CardDescription>访问量最高的资源类型</CardDescription>
              </CardHeader>
              <CardContent>
                {statsData?.top_resources && statsData.top_resources.length > 0 ? (
                  <div className="space-y-3">
                    {statsData.top_resources.map((item, index) => (
                      <div key={index} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Badge variant={getResourceBadgeVariant(item.resource as ResourceType)}>
                            {getResourceLabel(item.resource as ResourceType)}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-32 h-2 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full bg-primary rounded-full"
                              style={{
                                width: `${Math.min(100, (item.count / (statsData?.top_resources?.[0]?.count || 1)) * 100)}%`,
                              }}
                            />
                          </div>
                          <span className="text-sm text-muted-foreground w-12 text-right">
                            {item.count}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-sm">暂无数据</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">最近错误</CardTitle>
                <CardDescription>最近发生的异常请求</CardDescription>
              </CardHeader>
              <CardContent>
                {statsData?.recent_errors && statsData.recent_errors.length > 0 ? (
                  <div className="space-y-3">
                    {statsData.recent_errors.slice(0, 5).map((error) => (
                      <div
                        key={error.id}
                        className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg cursor-pointer hover:bg-red-100 dark:hover:bg-red-900/30"
                        onClick={() => viewLogDetail(error)}
                      >
                        <div className="flex items-center justify-between">
                          <Badge variant="destructive">{getActionLabel(error.action)}</Badge>
                          <span className="text-xs text-muted-foreground">
                            {error.created_at ? formatDateTime(error.created_at) : ""}
                          </span>
                        </div>
                        <p className="text-sm mt-1 font-medium truncate">{error.request_path}</p>
                        {error.error_message && (
                          <p className="text-xs text-red-600 dark:text-red-400 mt-1 truncate">
                            {error.error_message}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-4">
                    <CheckCircle className="h-8 w-8 mx-auto text-emerald-500 mb-2" />
                    <p className="text-muted-foreground text-sm">暂无错误</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="logs" className="mt-4">
          <div className="flex flex-col sm:flex-row gap-4 mb-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="搜索路径..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>

            <Select
              value={filterAction}
              onValueChange={(v) => setFilterAction(v as ActionType | "")}
            >
              <SelectTrigger className="w-32">
                <SelectValue placeholder="操作类型" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">全部</SelectItem>
                <SelectItem value="create">创建</SelectItem>
                <SelectItem value="read">读取</SelectItem>
                <SelectItem value="update">更新</SelectItem>
                <SelectItem value="delete">删除</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={filterResource}
              onValueChange={(v) => setFilterResource(v as ResourceType | "")}
            >
              <SelectTrigger className="w-32">
                <SelectValue placeholder="资源类型" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">全部</SelectItem>
                <SelectItem value="habit">习惯</SelectItem>
                <SelectItem value="transaction">交易</SelectItem>
                <SelectItem value="user">用户</SelectItem>
                <SelectItem value="task">任务</SelectItem>
                <SelectItem value="file">文件</SelectItem>
                <SelectItem value="folder">文件夹</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={filterSuccess === "" ? "all" : filterSuccess ? "success" : "error"}
              onValueChange={(v) => {
                if (v === "all") setFilterSuccess("")
                else setFilterSuccess(v === "success")
              }}
            >
              <SelectTrigger className="w-28">
                <SelectValue placeholder="状态" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部</SelectItem>
                <SelectItem value="success">成功</SelectItem>
                <SelectItem value="error">失败</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {renderLogTable()}
        </TabsContent>
      </Tabs>

      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>日志详情</DialogTitle>
            <DialogDescription>
              完整的操作日志记录信息
            </DialogDescription>
          </DialogHeader>

          {selectedLog && (
            <div className="space-y-4 max-h-[60vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">请求 ID</p>
                  <p className="text-sm font-mono">{selectedLog.id}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">请求时间</p>
                  <p className="text-sm">
                    {selectedLog.created_at ? formatDateTime(selectedLog.created_at) : "-"}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">用户</p>
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">{selectedLog.user_email || "匿名"}</span>
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">IP 地址</p>
                  <div className="flex items-center gap-2">
                    <Globe className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-mono">{selectedLog.ip_address || "-"}</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">请求</p>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{selectedLog.request_method}</Badge>
                    <code className="text-sm">{selectedLog.request_path}</code>
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">状态码</p>
                  <div className="flex items-center gap-2">
                    {selectedLog.success ? (
                      <Badge variant="secondary" className="bg-emerald-50 text-emerald-700">
                        {selectedLog.response_status || "200"}
                      </Badge>
                    ) : (
                      <Badge variant="destructive">
                        {selectedLog.response_status || "500"}
                      </Badge>
                    )}
                    <span className="text-sm text-muted-foreground">
                      耗时: {selectedLog.duration_ms || 0}ms
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">操作类型</p>
                  <Badge variant={getActionBadgeVariant(selectedLog.action)}>
                    {getActionLabel(selectedLog.action)}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">资源类型</p>
                  <Badge variant={getResourceBadgeVariant(selectedLog.resource)}>
                    {getResourceLabel(selectedLog.resource)}
                  </Badge>
                </div>
              </div>

              {selectedLog.resource_id && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">资源 ID</p>
                  <code className="text-sm bg-muted px-2 py-1 rounded">
                    {selectedLog.resource_id}
                  </code>
                </div>
              )}

              {selectedLog.resource_name && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">资源名称</p>
                  <p className="text-sm">{selectedLog.resource_name}</p>
                </div>
              )}

              {selectedLog.user_agent && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">User Agent</p>
                  <p className="text-sm text-muted-foreground truncate">{selectedLog.user_agent}</p>
                </div>
              )}

              {selectedLog.request_data && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">请求数据</p>
                  <pre className="text-xs bg-muted p-3 rounded-lg overflow-auto max-h-40">
                    {selectedLog.request_data}
                  </pre>
                </div>
              )}

              {selectedLog.error_message && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">错误信息</p>
                  <div className="bg-red-50 dark:bg-red-900/20 p-3 rounded-lg border border-red-200 dark:border-red-800">
                    <AlertTriangle className="h-4 w-4 text-red-500 inline mr-2" />
                    <span className="text-sm text-red-600 dark:text-red-400">
                      {selectedLog.error_message}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailDialogOpen(false)}>
              关闭
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={cleanDialogOpen} onOpenChange={setCleanDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>清理日志</DialogTitle>
            <DialogDescription>
              此操作将永久删除指定天数之前的所有日志记录，不可恢复。
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="flex items-center gap-4">
              <label className="text-sm font-medium whitespace-nowrap">保留天数:</label>
              <Select
                value={String(confirmCleanDays)}
                onValueChange={(v) => setConfirmCleanDays(Number(v))}
              >
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">7 天</SelectItem>
                  <SelectItem value="14">14 天</SelectItem>
                  <SelectItem value="30">30 天</SelectItem>
                  <SelectItem value="60">60 天</SelectItem>
                  <SelectItem value="90">90 天</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <p className="text-sm text-muted-foreground">
              将删除 <span className="font-medium text-red-500">{confirmCleanDays}</span> 天前的所有日志
            </p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCleanDialogOpen(false)}>
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={handleCleanLogs}
              disabled={cleanMutation.isPending}
            >
              {cleanMutation.isPending ? "清理中..." : "确认清理"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useEffect, useState } from "react"

import {
  ActionType,
  LogsService,
  type LogStatsSummary,
  type OperationLog,
  ResourceType,
} from "@/services/LogsService"
import { useCustomToast } from "@/hooks/useCustomToast"
import { formatDateTime, formatDuration } from "@/utils"

import {
  Activity,
  AlertTriangle,
  BarChart3,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Clock,
  Database,
  Eye,
  FileText,
  Globe,
  Loader2,
  RefreshCw,
  Search,
  Trash2,
  XCircle,
} from "lucide-react"

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui"

export const Route = createFileRoute("/_layout/logs")({
  component: LogsPage,
  head: () => ({
    meta: [
      {
        title: "日志管理 - FastAPI Template",
      },
    ],
  }),
})

function LogsPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { showSuccessToast, showErrorToast } = useCustomToast()

  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [searchTerm, setSearchTerm] = useState("")
  const [filterSuccess, setFilterSuccess] = useState<boolean | undefined>(undefined)
  const [filterAction, setFilterAction] = useState<ActionType | undefined>(undefined)
  const [filterResource, setFilterResource] = useState<ResourceType | undefined>(undefined)
  const [selectedLog, setSelectedLog] = useState<OperationLog | null>(null)
  const [statsHours, setStatsHours] = useState(24)

  const {
    data: logsData,
    isLoading: logsLoading,
    refetch: refetchLogs,
  } = useQuery({
    queryKey: [
      "logs",
      currentPage,
      pageSize,
      searchTerm,
      filterSuccess,
      filterAction,
      filterResource,
    ],
    queryFn: () =>
      LogsService.getOperationLogs(
        (currentPage - 1) * pageSize,
        pageSize,
        undefined,
        filterAction,
        filterResource,
        filterSuccess,
        searchTerm,
      ),
  })

  const {
    data: stats,
    isLoading: statsLoading,
    refetch: refetchStats,
  } = useQuery({
    queryKey: ["logs-stats", statsHours],
    queryFn: () => LogsService.getLogStatsSummary(statsHours),
  })

  const {
    data: errors,
    isLoading: errorsLoading,
    refetch: refetchErrors,
  } = useQuery({
    queryKey: ["logs-errors", statsHours],
    queryFn: () => LogsService.getErrorLogs(statsHours, 0, 10),
  })

  const {
    data: slowEndpoints,
    isLoading: slowLoading,
    refetch: refetchSlow,
  } = useQuery({
    queryKey: ["logs-slow", statsHours],
    queryFn: () => LogsService.getSlowEndpoints(statsHours, 1000, 10),
  })

  const cleanupMutation = useMutation({
    mutationFn: () => LogsService.cleanupExpiredLogs(),
    onSuccess: (data) => {
      showSuccessToast(data.message)
      queryClient.invalidateQueries({ queryKey: ["logs"] })
      queryClient.invalidateQueries({ queryKey: ["logs-stats"] })
    },
    onError: () => {
      showErrorToast("清理日志失败")
    },
  })

  const deleteLogMutation = useMutation({
    mutationFn: (logId: string) => LogsService.deleteOperationLog(logId),
    onSuccess: (data) => {
      showSuccessToast(data.message)
      queryClient.invalidateQueries({ queryKey: ["logs"] })
      setSelectedLog(null)
    },
    onError: () => {
      showErrorToast("删除日志失败")
    },
  })

  const totalPages = logsData ? Math.ceil(logsData.count / pageSize) : 0

  const refreshAll = () => {
    refetchLogs()
    refetchStats()
    refetchErrors()
    refetchSlow()
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">日志管理</h1>
          <p className="text-muted-foreground">
            系统操作日志监控与分析
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={refreshAll}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            刷新
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => cleanupMutation.mutate()}
            disabled={cleanupMutation.isPending}
          >
            {cleanupMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4 mr-2" />
            )}
            清理过期日志
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="总请求数"
          value={stats?.total_logs}
          icon={<Activity className="h-5 w-5" />}
          loading={statsLoading}
        />
        <StatsCard
          title="成功请求"
          value={stats?.success_count}
          icon={<CheckCircle className="h-5 w-5 text-green-500" />}
          loading={statsLoading}
          trend={stats ? `${stats.success_rate.toFixed(1)}%` : undefined}
        />
        <StatsCard
          title="失败请求"
          value={stats?.failed_count}
          icon={<XCircle className="h-5 w-5 text-red-500" />}
          loading={statsLoading}
          variant="warning"
        />
        <StatsCard
          title="平均响应时间"
          value={
            stats?.avg_duration_ms
              ? formatDuration(stats.avg_duration_ms)
              : undefined
          }
          icon={<Clock className="h-5 w-5 text-blue-500" />}
          loading={statsLoading}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>接口调用统计</CardTitle>
                <CardDescription>
                  按资源类型统计接口调用次数
                </CardDescription>
              </div>
              <Select
                value={statsHours.toString()}
                onValueChange={(v) => setStatsHours(parseInt(v))}
              >
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="时间范围" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">最近 1 小时</SelectItem>
                  <SelectItem value="6">最近 6 小时</SelectItem>
                  <SelectItem value="24">最近 24 小时</SelectItem>
                  <SelectItem value="168">最近 7 天</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <div className="space-y-2">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-8 w-full" />
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                {stats?.top_resources.map((r, i) => (
                  <div key={i} className="flex items-center gap-4">
                    <div className="w-28 text-sm font-medium truncate">
                      {r.resource}
                    </div>
                    <div className="flex-1">
                      <div className="h-4 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full transition-all"
                          style={{
                            width: `${
                              stats.total_logs > 0
                                ? (r.count / stats.total_logs) * 100
                                : 0
                            }%`,
                          }}
                        />
                      </div>
                    </div>
                    <div className="w-16 text-right text-sm text-muted-foreground">
                      {r.count} 次
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              最近错误
            </CardTitle>
          </CardHeader>
          <CardContent>
            {errorsLoading ? (
              <div className="space-y-2">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : errors?.data && errors.data.length > 0 ? (
              <div className="space-y-3">
                {errors.data.slice(0, 5).map((log) => (
                  <div
                    key={log.id}
                    className="p-3 bg-red-50 dark:bg-red-950/20 rounded-lg cursor-pointer hover:bg-red-100 dark:hover:bg-red-950/40"
                    onClick={() => setSelectedLog(log)}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-red-600 dark:text-red-400">
                        {log.request_method} {log.request_path}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {log.created_at ? formatDateTime(log.created_at) : ""}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 truncate">
                      {log.error_message || "Unknown error"}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center text-muted-foreground py-8">
                <CheckCircle className="h-8 w-8 mx-auto mb-2 text-green-500" />
                <p>暂无错误</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {slowEndpoints && slowEndpoints.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-orange-500" />
              慢接口监控
            </CardTitle>
            <CardDescription>
              响应时间超过 1 秒的接口
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>接口路径</TableHead>
                  <TableHead>方法</TableHead>
                  <TableHead>调用次数</TableHead>
                  <TableHead>平均耗时</TableHead>
                  <TableHead>最大耗时</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {slowEndpoints.map((endpoint, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-mono text-sm">
                      {endpoint.path}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{endpoint.method}</Badge>
                    </TableCell>
                    <TableCell>{endpoint.count}</TableCell>
                    <TableCell>
                      <span className="text-orange-600 dark:text-orange-400">
                        {endpoint.avg_duration_ms
                          ? formatDuration(endpoint.avg_duration_ms)
                          : "-"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="text-red-600 dark:text-red-400">
                        {endpoint.max_duration_ms
                          ? formatDuration(endpoint.max_duration_ms)
                          : "-"}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle>操作日志列表</CardTitle>
              <CardDescription>
                共 {logsData?.count || 0} 条记录
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="搜索路径..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 w-48"
                />
              </div>
              <Select
                value={filterSuccess === undefined ? "all" : filterSuccess.toString()}
                onValueChange={(v) =>
                  setFilterSuccess(v === "all" ? undefined : v === "true")
                }
              >
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="状态" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部</SelectItem>
                  <SelectItem value="true">成功</SelectItem>
                  <SelectItem value="false">失败</SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={filterAction || "all"}
                onValueChange={(v) =>
                  setFilterAction(v === "all" ? undefined : (v as ActionType))
                }
              >
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="操作类型" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部</SelectItem>
                  <SelectItem value="create">创建</SelectItem>
                  <SelectItem value="read">读取</SelectItem>
                  <SelectItem value="update">更新</SelectItem>
                  <SelectItem value="delete">删除</SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={filterResource || "all"}
                onValueChange={(v) =>
                  setFilterResource(v === "all" ? undefined : (v as ResourceType))
                }
              >
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="资源类型" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部</SelectItem>
                  <SelectItem value="file">文件</SelectItem>
                  <SelectItem value="folder">文件夹</SelectItem>
                  <SelectItem value="user">用户</SelectItem>
                  <SelectItem value="task">任务</SelectItem>
                  <SelectItem value="habit">习惯</SelectItem>
                  <SelectItem value="transaction">交易</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {logsLoading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : logsData?.data && logsData.data.length > 0 ? (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>时间</TableHead>
                    <TableHead>用户</TableHead>
                    <TableHead>方法</TableHead>
                    <TableHead>路径</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead>耗时</TableHead>
                    <TableHead>IP</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logsData.data.map((log) => (
                    <TableRow
                      key={log.id}
                      className={!log.success ? "bg-red-50/50 dark:bg-red-950/10" : ""}
                    >
                      <TableCell className="text-sm">
                        {log.created_at ? formatDateTime(log.created_at) : "-"}
                      </TableCell>
                      <TableCell className="text-sm">
                        {log.user_email || (
                          <span className="text-muted-foreground">未登录</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={
                            log.request_method === "GET"
                              ? "bg-blue-50 text-blue-700 dark:bg-blue-950/20 dark:text-blue-400"
                              : log.request_method === "POST"
                                ? "bg-green-50 text-green-700 dark:bg-green-950/20 dark:text-green-400"
                                : log.request_method === "DELETE"
                                  ? "bg-red-50 text-red-700 dark:bg-red-950/20 dark:text-red-400"
                                  : ""
                          }
                        >
                          {log.request_method}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-sm max-w-48 truncate">
                        {log.request_path}
                      </TableCell>
                      <TableCell>
                        {log.success ? (
                          <Badge className="bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400 hover:bg-green-100">
                            成功
                          </Badge>
                        ) : (
                          <Badge className="bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400 hover:bg-red-100">
                            失败
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">
                        {log.duration_ms !== null && log.duration_ms !== undefined
                          ? formatDuration(log.duration_ms)
                          : "-"}
                      </TableCell>
                      <TableCell className="text-sm font-mono">
                        {log.ip_address || "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedLog(log)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <div className="text-sm text-muted-foreground">
                    显示 {(currentPage - 1) * pageSize + 1} -{" "}
                    {Math.min(currentPage * pageSize, logsData.count)} 条，共{" "}
                    {logsData.count} 条
                  </div>
                  <div className="flex items-center gap-2">
                    <Select
                      value={pageSize.toString()}
                      onValueChange={(v) => {
                        setPageSize(parseInt(v))
                        setCurrentPage(1)
                      }}
                    >
                      <SelectTrigger className="w-20">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="10">10</SelectItem>
                        <SelectItem value="20">20</SelectItem>
                        <SelectItem value="50">50</SelectItem>
                        <SelectItem value="100">100</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-sm">
                      {currentPage} / {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setCurrentPage((p) => Math.min(totalPages, p + 1))
                      }
                      disabled={currentPage === totalPages}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="text-center text-muted-foreground py-12">
              <Database className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>暂无日志数据</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selectedLog} onOpenChange={(open) => !open && setSelectedLog(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedLog?.success ? (
                <CheckCircle className="h-5 w-5 text-green-500" />
              ) : (
                <XCircle className="h-5 w-5 text-red-500" />
              )}
              日志详情
            </DialogTitle>
            <DialogDescription>
              ID: {selectedLog?.id}
            </DialogDescription>
          </DialogHeader>

          {selectedLog && (
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">时间</Label>
                  <p className="font-mono text-sm">
                    {selectedLog.created_at
                      ? formatDateTime(selectedLog.created_at)
                      : "-"}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground">耗时</Label>
                  <p className="font-mono text-sm">
                    {selectedLog.duration_ms !== null &&
                    selectedLog.duration_ms !== undefined
                      ? formatDuration(selectedLog.duration_ms)
                      : "-"}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">方法</Label>
                  <p className="font-mono text-sm">{selectedLog.request_method}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">状态码</Label>
                  <p className="font-mono text-sm">{selectedLog.response_status || "-"}</p>
                </div>
              </div>

              <div>
                <Label className="text-muted-foreground">路径</Label>
                <p className="font-mono text-sm break-all">{selectedLog.request_path || "-"}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">用户</Label>
                  <p className="font-mono text-sm">
                    {selectedLog.user_email || "未登录"}
                    {selectedLog.user_id && ` (${selectedLog.user_id})`}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground">IP 地址</Label>
                  <p className="font-mono text-sm">{selectedLog.ip_address || "-"}</p>
                </div>
              </div>

              <div>
                <Label className="text-muted-foreground">User Agent</Label>
                <p className="font-mono text-xs break-all text-muted-foreground">
                  {selectedLog.user_agent || "-"}
                </p>
              </div>

              {selectedLog.query_params && (
                <div>
                  <Label className="text-muted-foreground">查询参数</Label>
                  <pre className="mt-1 p-3 bg-muted rounded-lg text-xs overflow-x-auto">
                    {selectedLog.query_params}
                  </pre>
                </div>
              )}

              {selectedLog.request_data && (
                <div>
                  <Label className="text-muted-foreground">请求体</Label>
                  <pre className="mt-1 p-3 bg-muted rounded-lg text-xs overflow-x-auto max-h-40">
                    {selectedLog.request_data}
                  </pre>
                </div>
              )}

              {selectedLog.response_data && (
                <div>
                  <Label className="text-muted-foreground">响应数据</Label>
                  <pre className="mt-1 p-3 bg-muted rounded-lg text-xs overflow-x-auto max-h-40">
                    {selectedLog.response_data}
                  </pre>
                </div>
              )}

              {selectedLog.error_message && (
                <div>
                  <Label className="text-muted-foreground text-red-500">错误信息</Label>
                  <pre className="mt-1 p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 rounded-lg text-xs overflow-x-auto max-h-40 text-red-700 dark:text-red-400">
                    {selectedLog.error_message}
                  </pre>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="flex justify-between">
            <Button
              variant="destructive"
              onClick={() => selectedLog && deleteLogMutation.mutate(selectedLog.id)}
              disabled={deleteLogMutation.isPending}
            >
              {deleteLogMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4 mr-2" />
              )}
              删除日志
            </Button>
            <Button variant="outline" onClick={() => setSelectedLog(null)}>
              关闭
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function StatsCard({
  title,
  value,
  icon,
  loading,
  trend,
  variant = "default",
}: {
  title: string
  value?: string | number
  icon: React.ReactNode
  loading: boolean
  trend?: string
  variant?: "default" | "warning"
}) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            {loading ? (
              <Skeleton className="h-8 w-24 mt-1" />
            ) : (
              <p
                className={`text-2xl font-bold mt-1 ${
                  variant === "warning"
                    ? "text-red-600 dark:text-red-400"
                    : ""
                }`}
              >
                {value !== undefined ? value : "-"}
              </p>
            )}
            {trend && (
              <p className="text-xs text-muted-foreground mt-1">{trend}</p>
            )}
          </div>
          <div
            className={`p-3 rounded-full ${
              variant === "warning"
                ? "bg-red-50 dark:bg-red-950/20"
                : "bg-muted"
            }`}
          >
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

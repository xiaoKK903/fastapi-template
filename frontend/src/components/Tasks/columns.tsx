import type { ColumnDef } from "@tanstack/react-table"
import { Check, Copy } from "lucide-react"

import type { TaskPublic, TaskStatus, TaskPriority } from "@/services/TasksService"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useCopyToClipboard } from "@/hooks/useCopyToClipboard"
import { cn } from "@/lib/utils"
import { TaskActionsMenu } from "./TaskActionsMenu"

function CopyId({ id }: { id: string }) {
  const [copiedText, copy] = useCopyToClipboard()
  const isCopied = copiedText === id

  return (
    <div className="flex items-center gap-1.5 group">
      <span className="font-mono text-xs text-muted-foreground">{id}</span>
      <Button
        variant="ghost"
        size="icon"
        className="size-6 opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={() => copy(id)}
      >
        {isCopied ? (
          <Check className="size-3 text-green-500" />
        ) : (
          <Copy className="size-3" />
        )}
        <span className="sr-only">Copy ID</span>
      </Button>
    </div>
  )
}

function getStatusLabel(status: TaskStatus) {
  const labels: Record<TaskStatus, string> = {
    todo: "待办",
    in_progress: "进行中",
    done: "已完成",
    cancelled: "已取消",
    on_hold: "已暂停",
  }
  return labels[status] || status
}

function getStatusVariant(status: TaskStatus) {
  const variants: Record<TaskStatus, "default" | "secondary" | "destructive" | "outline"> = {
    todo: "outline",
    in_progress: "default",
    done: "secondary",
    cancelled: "destructive",
    on_hold: "outline",
  }
  return variants[status] || "outline"
}

function getPriorityLabel(priority: TaskPriority) {
  const labels: Record<TaskPriority, string> = {
    low: "低",
    medium: "中",
    high: "高",
    urgent: "紧急",
  }
  return labels[priority] || priority
}

function getPriorityVariant(priority: TaskPriority) {
  const variants: Record<TaskPriority, "default" | "secondary" | "destructive" | "outline"> = {
    low: "outline",
    medium: "default",
    high: "destructive",
    urgent: "destructive",
  }
  return variants[priority] || "outline"
}

function formatDate(dateStr: string | null | undefined) {
  if (!dateStr) return "-"
  return new Date(dateStr).toLocaleDateString("zh-CN")
}

export const columns: ColumnDef<TaskPublic>[] = [
  {
    accessorKey: "id",
    header: "ID",
    cell: ({ row }) => <CopyId id={row.original.id} />,
  },
  {
    accessorKey: "title",
    header: "任务标题",
    cell: ({ row }) => (
      <div className="flex items-center gap-2">
        <span className={cn(
          "font-medium",
          row.original.is_overdue && "text-destructive",
        )}>
          {row.original.title}
        </span>
        {row.original.is_overdue && (
          <Badge variant="destructive" className="text-xs">
            已逾期
          </Badge>
        )}
      </div>
    ),
  },
  {
    accessorKey: "status",
    header: "状态",
    cell: ({ row }) => (
      <Badge variant={getStatusVariant(row.original.status)}>
        {getStatusLabel(row.original.status)}
      </Badge>
    ),
  },
  {
    accessorKey: "priority",
    header: "优先级",
    cell: ({ row }) => (
      <Badge variant={getPriorityVariant(row.original.priority)}>
        {getPriorityLabel(row.original.priority)}
      </Badge>
    ),
  },
  {
    accessorKey: "due_date",
    header: "截止时间",
    cell: ({ row }) => (
      <span className={cn(
        row.original.is_overdue && "text-destructive font-medium",
      )}>
        {formatDate(row.original.due_date)}
      </span>
    ),
  },
  {
    accessorKey: "progress",
    header: "进度",
    cell: ({ row }) => (
      <span className="font-medium">{row.original.progress}%</span>
    ),
  },
  {
    accessorKey: "description",
    header: "描述",
    cell: ({ row }) => {
      const description = row.original.description
      return (
        <span
          className={cn(
            "max-w-xs truncate block text-muted-foreground",
            !description && "italic",
          )}
        >
          {description || "无描述"}
        </span>
      )
    },
  },
  {
    id: "actions",
    header: () => <span className="sr-only">Actions</span>,
    cell: ({ row }) => (
      <div className="flex justify-end">
        <TaskActionsMenu task={row.original} />
      </div>
    ),
  },
]

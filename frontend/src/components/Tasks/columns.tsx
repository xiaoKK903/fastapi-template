import type { ColumnDef } from "@tanstack/react-table"
import { Check, Copy, ChevronRight, ChevronDown, FolderPlus, Repeat } from "lucide-react"

import type { TaskPublic, TaskStatus, TaskPriority, TaskRepeatType } from "@/services/TasksService"
import type { FlatTaskWithLevel } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useCopyToClipboard } from "@/hooks/useCopyToClipboard"
import { cn } from "@/lib/utils"
import { TaskActionsMenu } from "./TaskActionsMenu"
import AddTask from "./AddTask"
import { useState } from "react"

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

function getRepeatTypeLabel(repeatType: TaskRepeatType) {
  const labels: Record<TaskRepeatType, string> = {
    none: "不重复",
    daily: "每日",
    weekly: "每周",
    monthly: "每月",
    yearly: "每年",
  }
  return labels[repeatType] || repeatType
}

function formatDate(dateStr: string | null | undefined) {
  if (!dateStr) return "-"
  return new Date(dateStr).toLocaleDateString("zh-CN")
}

interface TreeColumnsOptions {
  expandedIds: Set<string>
  onToggleExpand: (id: string) => void
}

export function createTreeColumns({
  expandedIds,
  onToggleExpand,
}: TreeColumnsOptions): ColumnDef<FlatTaskWithLevel>[] {
  return [
    {
      accessorKey: "id",
      header: "ID",
      cell: ({ row }) => <CopyId id={row.original.id} />,
    },
    {
      accessorKey: "title",
      header: "任务标题",
      cell: ({ row }) => {
        const task = row.original
        const isExpanded = expandedIds.has(task.id)
        const hasChildren = task.hasChildren

        return (
          <div
            className="flex items-center gap-1"
            style={{ paddingLeft: `${task.level * 24}px` }}
          >
            {hasChildren ? (
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 p-0"
                onClick={() => onToggleExpand(task.id)}
              >
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </Button>
            ) : (
              <div className="w-6" />
            )}
            <div className="flex items-center gap-2 flex-1">
              <span className={cn(
                "font-medium",
                task.is_overdue && "text-destructive",
              )}>
                {task.title}
              </span>
              {task.is_overdue && (
                <Badge variant="destructive" className="text-xs">
                  已逾期
                </Badge>
              )}
              {hasChildren && (
                <Badge variant="outline" className="text-xs">
                  {task.children.length} 个子任务
                </Badge>
              )}
            </div>
          </div>
        )
      },
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
      accessorKey: "repeat_type",
      header: "重复",
      cell: ({ row }) => {
        const repeatType = row.original.repeat_type
        if (repeatType === "none") {
          return <span className="text-muted-foreground">-</span>
        }
        return (
          <div className="flex items-center gap-1">
            <Repeat className="h-3 w-3 text-muted-foreground" />
            <Badge variant="outline" className="text-xs">
              {getRepeatTypeLabel(repeatType)}
              {row.original.repeat_interval && row.original.repeat_interval > 1
                ? ` (每${row.original.repeat_interval}${
                    repeatType === "daily" ? "天" :
                    repeatType === "weekly" ? "周" :
                    repeatType === "monthly" ? "月" : "年"
                  })`
                : ""}
            </Badge>
          </div>
        )
      },
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
      cell: ({ row }) => {
        const task = row.original
        return (
          <div className="flex justify-end gap-1">
            {!task.is_deleted && !task.is_archived && (
              <AddSubtaskButton parentId={task.id} />
            )}
            <TaskActionsMenu task={task} />
          </div>
        )
      },
    },
  ]
}

function AddSubtaskButton({ parentId }: { parentId: string }) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        onClick={() => setIsOpen(true)}
        title="添加子任务"
      >
        <FolderPlus className="h-4 w-4" />
        <span className="sr-only">添加子任务</span>
      </Button>
      <AddTask parentId={parentId} isOpen={isOpen} onOpenChange={setIsOpen} />
    </>
  )
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
    accessorKey: "repeat_type",
    header: "重复",
    cell: ({ row }) => {
      const repeatType = row.original.repeat_type
      if (repeatType === "none") {
        return <span className="text-muted-foreground">-</span>
      }
      return (
        <div className="flex items-center gap-1">
          <Repeat className="h-3 w-3 text-muted-foreground" />
          <Badge variant="outline" className="text-xs">
            {getRepeatTypeLabel(repeatType)}
            {row.original.repeat_interval && row.original.repeat_interval > 1
              ? ` (每${row.original.repeat_interval}${
                  repeatType === "daily" ? "天" :
                  repeatType === "weekly" ? "周" :
                  repeatType === "monthly" ? "月" : "年"
                })`
              : ""}
          </Badge>
        </div>
      )
    },
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

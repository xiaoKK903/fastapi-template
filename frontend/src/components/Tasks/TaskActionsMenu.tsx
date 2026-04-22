import { useMutation, useQueryClient } from "@tanstack/react-query"
import {
  Archive,
  CheckCircle,
  Clock,
  Edit2,
  FileText,
  MoreHorizontal,
  Pause,
  RotateCcw,
  Trash2,
  XCircle,
} from "lucide-react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import useCustomToast from "@/hooks/useCustomToast"
import type { TaskPublic, TaskStatus } from "@/services/TasksService"
import { TasksService } from "@/services/TasksService"
import { handleError } from "@/utils"
import DeleteTask from "./DeleteTask"
import EditTask from "./EditTask"

interface TaskActionsMenuProps {
  task: TaskPublic
}

export function TaskActionsMenu({ task }: TaskActionsMenuProps) {
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const queryClient = useQueryClient()
  const { showSuccessToast, showErrorToast } = useCustomToast()

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: TaskStatus }) =>
      TasksService.updateTaskStatus({ id, status }),
    onSuccess: () => {
      showSuccessToast("任务状态更新成功")
    },
    onError: handleError.bind(showErrorToast),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] })
    },
  })

  const softDeleteMutation = useMutation({
    mutationFn: (id: string) => TasksService.softDeleteTask({ id }),
    onSuccess: () => {
      showSuccessToast("任务已移至回收站")
    },
    onError: handleError.bind(showErrorToast),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] })
    },
  })

  const restoreMutation = useMutation({
    mutationFn: (id: string) => TasksService.restoreTask({ id }),
    onSuccess: () => {
      showSuccessToast("任务已从回收站恢复")
    },
    onError: handleError.bind(showErrorToast),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] })
    },
  })

  const archiveMutation = useMutation({
    mutationFn: (id: string) => TasksService.archiveTask({ id }),
    onSuccess: () => {
      showSuccessToast("任务已归档")
    },
    onError: handleError.bind(showErrorToast),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] })
    },
  })

  const unarchiveMutation = useMutation({
    mutationFn: (id: string) => TasksService.unarchiveTask({ id }),
    onSuccess: () => {
      showSuccessToast("任务已取消归档")
    },
    onError: handleError.bind(showErrorToast),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] })
    },
  })

  const handleStatusChange = (status: TaskStatus) => {
    updateStatusMutation.mutate({ id: task.id, status })
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon">
            <MoreHorizontal className="size-4" />
            <span className="sr-only">打开菜单</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-[160px]">
          {!task.is_deleted && !task.is_archived && (
            <>
              <DropdownMenuItem onClick={() => setShowEditDialog(true)}>
                <Edit2 className="mr-2 size-4" />
                编辑
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => handleStatusChange("in_progress")}
                disabled={task.status === "in_progress"}
              >
                <Clock className="mr-2 size-4" />
                标记为进行中
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => handleStatusChange("done")}
                disabled={task.status === "done"}
              >
                <CheckCircle className="mr-2 size-4" />
                标记为已完成
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => handleStatusChange("on_hold")}
                disabled={task.status === "on_hold"}
              >
                <Pause className="mr-2 size-4" />
                标记为暂停
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => handleStatusChange("cancelled")}
                disabled={task.status === "cancelled"}
              >
                <XCircle className="mr-2 size-4" />
                标记为已取消
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => archiveMutation.mutate(task.id)}>
                <Archive className="mr-2 size-4" />
                归档
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => softDeleteMutation.mutate(task.id)}
              >
                <Trash2 className="mr-2 size-4" />
                移至回收站
              </DropdownMenuItem>
            </>
          )}
          {task.is_deleted && (
            <>
              <DropdownMenuItem onClick={() => restoreMutation.mutate(task.id)}>
                <RotateCcw className="mr-2 size-4" />
                恢复
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setShowDeleteDialog(true)}>
                <Trash2 className="mr-2 size-4" />
                永久删除
              </DropdownMenuItem>
            </>
          )}
          {task.is_archived && !task.is_deleted && (
            <>
              <DropdownMenuItem
                onClick={() => unarchiveMutation.mutate(task.id)}
              >
                <FileText className="mr-2 size-4" />
                取消归档
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => softDeleteMutation.mutate(task.id)}
              >
                <Trash2 className="mr-2 size-4" />
                移至回收站
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <EditTask
        task={task}
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
      />
      <DeleteTask
        task={task}
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
      />
    </>
  )
}

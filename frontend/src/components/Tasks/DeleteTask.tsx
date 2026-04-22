import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { LoadingButton } from "@/components/ui/loading-button"
import useCustomToast from "@/hooks/useCustomToast"
import { type TaskPublic, TasksService } from "@/services/TasksService"
import { handleError } from "@/utils"

interface DeleteTaskProps {
  task: TaskPublic
  open: boolean
  onOpenChange: (open: boolean) => void
}

const DeleteTask = ({ task, open, onOpenChange }: DeleteTaskProps) => {
  const queryClient = useQueryClient()
  const { showSuccessToast, showErrorToast } = useCustomToast()

  const mutation = useMutation({
    mutationFn: (id: string) => TasksService.deleteTask({ id }),
    onSuccess: () => {
      showSuccessToast("任务已永久删除")
      onOpenChange(false)
    },
    onError: handleError.bind(showErrorToast),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] })
    },
  })

  const handleDelete = () => {
    mutation.mutate(task.id)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>确认删除</DialogTitle>
          <DialogDescription>
            确定要永久删除任务{" "}
            <span className="font-semibold">{task.title}</span> 吗？
            此操作不可撤销，任务及其所有子任务将被永久删除。
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-0">
          <DialogClose asChild>
            <Button variant="outline" disabled={mutation.isPending}>
              取消
            </Button>
          </DialogClose>
          <LoadingButton
            variant="destructive"
            onClick={handleDelete}
            loading={mutation.isPending}
          >
            删除
          </LoadingButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default DeleteTask

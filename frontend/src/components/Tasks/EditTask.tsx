import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"

import { type TaskPublic, type TaskUpdate, TasksService, TaskStatus, TaskPriority, TaskRepeatType } from "@/services/TasksService"
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
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { LoadingButton } from "@/components/ui/loading-button"
import useCustomToast from "@/hooks/useCustomToast"
import { handleError } from "@/utils"

const formSchema = z.object({
  title: z.string().min(1, { message: "任务标题是必填项" }),
  description: z.string().optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
  status: z.enum(["todo", "in_progress", "done", "cancelled", "on_hold"]).default("todo"),
  due_date: z.string().optional(),
  progress: z.coerce.number().int().min(0).max(100).default(0),
  repeat_type: z.enum(["none", "daily", "weekly", "monthly", "yearly"]).default("none"),
  repeat_interval: z.coerce.number().int().min(1).optional(),
  repeat_end_date: z.string().optional(),
})

type FormData = z.infer<typeof formSchema>

interface EditTaskProps {
  task: TaskPublic
  open: boolean
  onOpenChange: (open: boolean) => void
}

const EditTask = ({ task, open, onOpenChange }: EditTaskProps) => {
  const queryClient = useQueryClient()
  const { showSuccessToast, showErrorToast } = useCustomToast()

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    mode: "onBlur",
    criteriaMode: "all",
    defaultValues: {
      title: task.title,
      description: task.description || "",
      priority: task.priority as TaskPriority,
      status: task.status as TaskStatus,
      due_date: task.due_date || "",
      progress: task.progress,
      repeat_type: task.repeat_type as TaskRepeatType,
      repeat_interval: task.repeat_interval || undefined,
      repeat_end_date: task.repeat_end_date || "",
    },
  })

  useEffect(() => {
    if (open) {
      form.reset({
        title: task.title,
        description: task.description || "",
        priority: task.priority as TaskPriority,
        status: task.status as TaskStatus,
        due_date: task.due_date || "",
        progress: task.progress,
        repeat_type: task.repeat_type as TaskRepeatType,
        repeat_interval: task.repeat_interval || undefined,
        repeat_end_date: task.repeat_end_date || "",
      })
    }
  }, [open, task, form])

  const mutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: TaskUpdate }) =>
      TasksService.updateTask({ id, requestBody: data }),
    onSuccess: () => {
      showSuccessToast("任务更新成功")
      onOpenChange(false)
    },
    onError: handleError.bind(showErrorToast),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] })
    },
  })

  const onSubmit = (data: FormData) => {
    const updateData: TaskUpdate = {
      title: data.title,
      description: data.description || undefined,
      priority: data.priority,
      status: data.status,
      due_date: data.due_date ? new Date(data.due_date) : undefined,
      progress: data.progress,
      repeat_type: data.repeat_type,
      repeat_interval: data.repeat_interval,
      repeat_end_date: data.repeat_end_date ? new Date(data.repeat_end_date) : undefined,
    }

    mutation.mutate({ id: task.id, data: updateData })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>编辑任务</DialogTitle>
          <DialogDescription>
            修改任务的详细信息。
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <div className="grid gap-4 py-4">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      任务标题 <span className="text-destructive">*</span>
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder="例如：完成项目文档"
                        type="text"
                        {...field}
                        required
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>描述</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="任务描述（可选）"
                        rows={3}
                        {...field}
                        value={field.value || ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="priority"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>优先级</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="选择优先级" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="low">低</SelectItem>
                          <SelectItem value="medium">中</SelectItem>
                          <SelectItem value="high">高</SelectItem>
                          <SelectItem value="urgent">紧急</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>状态</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="选择状态" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="todo">待办</SelectItem>
                          <SelectItem value="in_progress">进行中</SelectItem>
                          <SelectItem value="done">已完成</SelectItem>
                          <SelectItem value="on_hold">暂停</SelectItem>
                          <SelectItem value="cancelled">已取消</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="due_date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>截止日期</FormLabel>
                      <FormControl>
                        <Input
                          type="date"
                          {...field}
                          value={field.value || ""}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="progress"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>进度 (%)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="repeat_type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>重复类型</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="选择重复类型" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none">不重复</SelectItem>
                          <SelectItem value="daily">每日</SelectItem>
                          <SelectItem value="weekly">每周</SelectItem>
                          <SelectItem value="monthly">每月</SelectItem>
                          <SelectItem value="yearly">每年</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {form.watch("repeat_type") !== "none" && (
                  <>
                    <FormField
                      control={form.control}
                      name="repeat_interval"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>重复间隔</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min={1}
                              placeholder="例如：1"
                              {...field}
                              value={field.value || ""}
                              onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="repeat_end_date"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>重复结束日期</FormLabel>
                          <FormControl>
                            <Input
                              type="date"
                              {...field}
                              value={field.value || ""}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </>
                )}
              </div>
            </div>

            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline" disabled={mutation.isPending}>
                  取消
                </Button>
              </DialogClose>
              <LoadingButton type="submit" loading={mutation.isPending}>
                保存
              </LoadingButton>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

export default EditTask

import type { ColumnDef } from "@tanstack/react-table"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Check, Copy, Loader2, TrendingUp, X } from "lucide-react"

import type { CheckinRecordCreate, HabitPublicWithStats } from "@/client"
import { CheckinsService, HabitsService } from "@/client"
import { Button } from "@/components/ui/button"
import { useCopyToClipboard } from "@/hooks/useCopyToClipboard"
import { cn } from "@/lib/utils"
import { handleError } from "@/utils"
import { HabitActionsMenu } from "./HabitActionsMenu"
import useCustomToast from "@/hooks/useCustomToast"

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

function getFrequencyLabel(frequency: string) {
  const labels: Record<string, string> = {
    daily: "每日",
    weekly: "每周",
    monthly: "每月",
  }
  return labels[frequency] || frequency
}

function CheckinButton({ habit }: { habit: HabitPublicWithStats }) {
  const queryClient = useQueryClient()
  const { showSuccessToast, showErrorToast } = useCustomToast()

  const checkinMutation = useMutation({
    mutationFn: (data: CheckinRecordCreate) =>
      CheckinsService.createCheckin({ requestBody: data }),
    onSuccess: () => {
      showSuccessToast("打卡成功！")
    },
    onError: handleError.bind(showErrorToast),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["habits"] })
    },
  })

  const cancelCheckinMutation = useMutation({
    mutationFn: (habitId: string) =>
      CheckinsService.cancelCheckin({ habit_id: habitId }),
    onSuccess: () => {
      showSuccessToast("已取消今日打卡")
    },
    onError: handleError.bind(showErrorToast),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["habits"] })
    },
  })

  const handleCheckin = () => {
    checkinMutation.mutate({ habit_id: habit.id })
  }

  const handleCancelCheckin = () => {
    cancelCheckinMutation.mutate(habit.id)
  }

  if (habit.is_checked_today) {
    return (
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          className="bg-green-50 text-green-700 border-green-200 hover:bg-green-100"
          onClick={handleCancelCheckin}
          disabled={cancelCheckinMutation.isPending}
        >
          {cancelCheckinMutation.isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Check className="size-4" />
          )}
          <span>已打卡</span>
        </Button>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="default"
        size="sm"
        onClick={handleCheckin}
        disabled={checkinMutation.isPending}
      >
        {checkinMutation.isPending ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <TrendingUp className="size-4" />
        )}
        <span>今日打卡</span>
      </Button>
    </div>
  )
}

export const columns: ColumnDef<HabitPublicWithStats>[] = [
  {
    accessorKey: "id",
    header: "ID",
    cell: ({ row }) => <CopyId id={row.original.id} />,
  },
  {
    accessorKey: "name",
    header: "习惯名称",
    cell: ({ row }) => (
      <div className="flex flex-col">
        <span className="font-medium">{row.original.name}</span>
        <span className="text-xs text-muted-foreground">
          {row.original.description || "无描述"}
        </span>
      </div>
    ),
  },
  {
    accessorKey: "frequency",
    header: "目标频率",
    cell: ({ row }) => (
      <span className="font-medium">
        {getFrequencyLabel(row.original.frequency)}
      </span>
    ),
  },
  {
    accessorKey: "target_count",
    header: "目标次数",
    cell: ({ row }) => (
      <span className="font-medium">{row.original.target_count}</span>
    ),
  },
  {
    accessorKey: "total_checkins",
    header: "总打卡",
    cell: ({ row }) => (
      <span className="font-medium">{row.original.total_checkins}</span>
    ),
  },
  {
    accessorKey: "current_streak",
    header: "连续打卡",
    cell: ({ row }) => (
      <span
        className={cn(
          "font-medium",
          row.original.current_streak > 0 && "text-green-600"
        )}
      >
        {row.original.current_streak} 天
      </span>
    ),
  },
  {
    accessorKey: "longest_streak",
    header: "最长连续",
    cell: ({ row }) => (
      <span className="font-medium text-muted-foreground">
        {row.original.longest_streak} 天
      </span>
    ),
  },
  {
    accessorKey: "completion_rate",
    header: "完成率",
    cell: ({ row }) => {
      const rate = row.original.completion_rate
      let colorClass = "text-muted-foreground"
      if (rate >= 80) colorClass = "text-green-600"
      else if (rate >= 50) colorClass = "text-yellow-600"
      else if (rate > 0) colorClass = "text-orange-600"

      return (
        <span className={cn("font-medium", colorClass)}>
          {rate.toFixed(1)}%
        </span>
      )
    },
  },
  {
    id: "checkin",
    header: () => <span className="sr-only">打卡</span>,
    cell: ({ row }) => <CheckinButton habit={row.original} />,
  },
  {
    id: "actions",
    header: () => <span className="sr-only">Actions</span>,
    cell: ({ row }) => (
      <div className="flex justify-end">
        <HabitActionsMenu habit={row.original} />
      </div>
    ),
  },
]

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import {
  Calendar as CalendarIcon,
  Check,
  ChevronLeft,
  ChevronRight,
  Trash2,
  X,
} from "lucide-react"
import { Suspense, useMemo, useState } from "react"

import {
  type HabitCalendar,
  type HabitCalendarDay,
  type HabitPublic,
  type HabitRecordCreate,
  type HabitRecordPublic,
  HabitRecordsService,
  HabitsService,
} from "@/client"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import useCustomToast from "@/hooks/useCustomToast"
import { handleError } from "@/utils"

export const Route = createFileRoute("/_layout/habit-calendar")({
  component: HabitCalendarPage,
  head: () => ({
    meta: [
      {
        title: "打卡日历 - FastAPI Template",
      },
    ],
  }),
})

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate()
}

function getFirstDayOfMonth(year: number, month: number): number {
  return new Date(year, month - 1, 1).getDay()
}

function formatDate(year: number, month: number, day: number): string {
  const m = month.toString().padStart(2, "0")
  const d = day.toString().padStart(2, "0")
  return `${year}-${m}-${d}`
}

function getCalendarDays(
  calendar: HabitCalendar | undefined,
  year: number,
  month: number,
): (HabitCalendarDay | null)[] {
  if (!calendar) return []

  const daysInMonth = getDaysInMonth(year, month)
  const firstDay = getFirstDayOfMonth(year, month)

  const days: (HabitCalendarDay | null)[] = []

  for (let i = 0; i < firstDay; i++) {
    days.push(null)
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = formatDate(year, month, day)
    const dayData = calendar.days.find((d) => d.date === dateStr)
    if (dayData) {
      days.push(dayData)
    } else {
      days.push({
        date: dateStr,
        total_count: 0,
        completed_count: 0,
        habit_ids: [],
        record_ids: {},
      })
    }
  }

  return days
}

function getCalendarQueryOptions(year: number, month: number) {
  return {
    queryFn: () => HabitRecordsService.getHabitCalendar({ year, month }),
    queryKey: ["habit-calendar", year, month],
  }
}

function getHabitsQueryOptions() {
  return {
    queryFn: () => HabitsService.readHabits({ skip: 0, limit: 100 }),
    queryKey: ["habits"],
  }
}

function _getRecordsQueryOptions(
  habit_id: string,
  start_date: string,
  end_date: string,
) {
  return {
    queryFn: () =>
      HabitRecordsService.readHabitRecords({ habit_id, start_date, end_date }),
    queryKey: ["habit-records", habit_id, start_date, end_date],
    enabled: !!habit_id,
  }
}

function HabitCalendarContent() {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedDay, setSelectedDay] = useState<HabitCalendarDay | null>(null)
  const [isCheckInDialogOpen, setIsCheckInDialogOpen] = useState(false)
  const [selectedHabitId, setSelectedHabitId] = useState<string>("")
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false)
  const [recordToDelete, setRecordToDelete] =
    useState<HabitRecordPublic | null>(null)

  const queryClient = useQueryClient()
  const { showSuccessToast, showErrorToast } = useCustomToast()

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth() + 1

  const {
    data: calendar,
    isLoading: isCalendarLoading,
    refetch: refetchCalendar,
  } = useQuery(getCalendarQueryOptions(year, month))

  const { data: habits, isLoading: isHabitsLoading } = useQuery(
    getHabitsQueryOptions(),
  )

  const calendarDays = useMemo(
    () => getCalendarDays(calendar, year, month),
    [calendar, year, month],
  )

  const monthNames = [
    "一月",
    "二月",
    "三月",
    "四月",
    "五月",
    "六月",
    "七月",
    "八月",
    "九月",
    "十月",
    "十一月",
    "十二月",
  ]

  const weekDays = ["日", "一", "二", "三", "四", "五", "六"]

  const goToPreviousMonth = () => {
    setCurrentDate(new Date(year, month - 2, 1))
  }

  const goToNextMonth = () => {
    setCurrentDate(new Date(year, month, 1))
  }

  const goToToday = () => {
    setCurrentDate(new Date())
  }

  const handleDayClick = (day: HabitCalendarDay | null) => {
    if (!day) return
    setSelectedDay(day)
    setSelectedHabitId("")
    setIsCheckInDialogOpen(true)
  }

  const checkInMutation = useMutation({
    mutationFn: (data: HabitRecordCreate) =>
      HabitRecordsService.createHabitRecord({ requestBody: data }),
    onSuccess: () => {
      showSuccessToast("打卡成功")
      setIsCheckInDialogOpen(false)
      setSelectedHabitId("")
      refetchCalendar()
      queryClient.invalidateQueries({ queryKey: ["habit-calendar"] })
    },
    onError: (err) => {
      const errMsg = handleError(err)
      showErrorToast(errMsg)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => HabitRecordsService.deleteHabitRecord({ id }),
    onSuccess: () => {
      showSuccessToast("已取消打卡")
      setIsDeleteConfirmOpen(false)
      setRecordToDelete(null)
      refetchCalendar()
      queryClient.invalidateQueries({ queryKey: ["habit-calendar"] })
    },
    onError: (err) => {
      const errMsg = handleError(err)
      showErrorToast(errMsg)
    },
  })

  const handleCheckIn = () => {
    if (!selectedDay || !selectedHabitId) return

    checkInMutation.mutate({
      habit_id: selectedHabitId,
      check_date: selectedDay.date,
      count: 1,
    })
  }

  const handleDeleteRecord = (record: HabitRecordPublic) => {
    setRecordToDelete(record)
    setIsDeleteConfirmOpen(true)
  }

  const confirmDelete = () => {
    if (recordToDelete) {
      deleteMutation.mutate(recordToDelete.id)
    }
  }

  const getDayStatus = (day: HabitCalendarDay | null) => {
    if (!day) return { status: "empty", color: "" }

    if (day.total_count === 0) {
      return { status: "no-habits", color: "bg-muted/30" }
    }

    const completionRate = day.completed_count / day.total_count

    if (completionRate === 1) {
      return {
        status: "completed",
        color:
          "bg-green-500/20 text-green-600 dark:text-green-400 border-green-300 dark:border-green-700",
      }
    }
    if (completionRate > 0) {
      return {
        status: "partial",
        color:
          "bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 border-yellow-300 dark:border-yellow-700",
      }
    }
    return {
      status: "incomplete",
      color:
        "bg-red-500/20 text-red-600 dark:text-red-400 border-red-300 dark:border-red-700",
    }
  }

  const getCheckedHabitsForDay = (
    day: HabitCalendarDay | null,
  ): HabitPublic[] => {
    if (!day || !habits?.data) return []
    return habits.data.filter((h) => day.habit_ids.includes(h.id))
  }

  const getUncheckedHabitsForDay = (
    day: HabitCalendarDay | null,
  ): HabitPublic[] => {
    if (!day || !habits?.data) return habits?.data || []
    return habits.data.filter((h) => !day.habit_ids.includes(h.id))
  }

  const isToday = (day: HabitCalendarDay | null): boolean => {
    if (!day) return false
    const today = new Date()
    return (
      day.date ===
      formatDate(today.getFullYear(), today.getMonth() + 1, today.getDate())
    )
  }

  if (isCalendarLoading || isHabitsLoading) {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-32" />
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-7 gap-2">
              {Array.from({ length: 35 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full rounded-lg" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">打卡日历</h1>
          <p className="text-muted-foreground">查看和管理您的打卡记录</p>
        </div>
        <Button variant="outline" onClick={goToToday}>
          今天
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={goToPreviousMonth}>
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <div className="flex items-center gap-2">
                <Select
                  value={year.toString()}
                  onValueChange={(val) =>
                    setCurrentDate(new Date(parseInt(val, 10), month - 1, 1))
                  }
                >
                  <SelectTrigger className="w-24">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 10 }, (_, i) => {
                      const y = new Date().getFullYear() - 5 + i
                      return (
                        <SelectItem key={y} value={y.toString()}>
                          {y}年
                        </SelectItem>
                      )
                    })}
                  </SelectContent>
                </Select>
                <span className="text-xl font-semibold">
                  {monthNames[month - 1]}
                </span>
              </div>
              <Button variant="ghost" size="icon" onClick={goToNextMonth}>
                <ChevronRight className="h-5 w-5" />
              </Button>
            </div>
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-1">
                <div className="h-3 w-3 rounded-full bg-green-500/20 border border-green-500/50" />
                <span>全部完成</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="h-3 w-3 rounded-full bg-yellow-500/20 border border-yellow-500/50" />
                <span>部分完成</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="h-3 w-3 rounded-full bg-red-500/20 border border-red-500/50" />
                <span>未完成</span>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 gap-2">
            {weekDays.map((day) => (
              <div
                key={day}
                className="text-center text-sm font-medium text-muted-foreground py-2"
              >
                {day}
              </div>
            ))}
            {calendarDays.map((day, index) => {
              const { status, color } = getDayStatus(day)
              const today = isToday(day)

              return (
                <button
                  key={index}
                  onClick={() => handleDayClick(day)}
                  disabled={!day}
                  className={`
                    flex flex-col items-center justify-center p-2 rounded-lg border
                    min-h-16 transition-all
                    ${day ? "cursor-pointer hover:bg-accent hover:border-primary" : "cursor-default border-transparent"}
                    ${today ? "ring-2 ring-primary ring-offset-2" : ""}
                    ${day ? color : ""}
                  `}
                >
                  {day && (
                    <>
                      <span className="text-sm font-medium">
                        {new Date(day.date).getDate()}
                      </span>
                      {day.total_count > 0 && (
                        <div className="mt-1 flex items-center gap-1 text-xs">
                          {status === "completed" ? (
                            <Check className="h-3 w-3" />
                          ) : status === "partial" ? (
                            <span>
                              {day.completed_count}/{day.total_count}
                            </span>
                          ) : (
                            <X className="h-3 w-3" />
                          )}
                        </div>
                      )}
                      {today && (
                        <Badge variant="secondary" className="mt-1 text-xs">
                          今天
                        </Badge>
                      )}
                    </>
                  )}
                </button>
              )
            })}
          </div>
        </CardContent>
      </Card>

      <Dialog open={isCheckInDialogOpen} onOpenChange={setIsCheckInDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {selectedDay &&
                new Date(selectedDay.date).toLocaleDateString("zh-CN", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                  weekday: "long",
                })}
            </DialogTitle>
            <DialogDescription>
              选择要打卡的习惯，或取消已有的打卡
            </DialogDescription>
          </DialogHeader>

          {habits?.data.length === 0 ? (
            <div className="py-6 text-center text-muted-foreground">
              <CalendarIcon className="mx-auto h-12 w-12 mb-4 opacity-50" />
              <p>您还没有创建任何习惯</p>
              <p className="text-sm">请先在习惯管理页面创建习惯</p>
            </div>
          ) : (
            <div className="space-y-4 max-h-96 overflow-y-auto">
              {getCheckedHabitsForDay(selectedDay).length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-2">
                    已打卡
                  </h4>
                  <div className="space-y-2">
                    {getCheckedHabitsForDay(selectedDay).map((habit) => (
                      <div
                        key={habit.id}
                        className="flex items-center justify-between p-3 rounded-lg border bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-800"
                      >
                        <div className="flex items-center gap-3">
                          <div className="h-5 w-5 rounded-full bg-green-500 border-green-500 flex items-center justify-center">
                            <Check className="h-3 w-3 text-white" />
                          </div>
                          <div>
                            <p className="font-medium">{habit.name}</p>
                            <p className="text-sm text-muted-foreground">
                              {habit.frequency === "daily"
                                ? "每日"
                                : habit.frequency === "weekly"
                                  ? "每周"
                                  : "每月"}
                              · 目标 {habit.target_count} 次
                            </p>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-red-500 hover:text-red-600 hover:bg-red-50"
                          onClick={() => {
                            if (selectedDay?.record_ids?.[habit.id]) {
                              const recordId = selectedDay.record_ids[habit.id]
                              const fakeRecord: HabitRecordPublic = {
                                id: recordId,
                                habit_id: habit.id,
                                owner_id: "",
                                check_date: selectedDay.date,
                                count: 1,
                                note: null,
                                created_at: null,
                              }
                              handleDeleteRecord(fakeRecord)
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {getUncheckedHabitsForDay(selectedDay).length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-2">
                    待打卡
                  </h4>
                  <div className="space-y-2">
                    {getUncheckedHabitsForDay(selectedDay).map((habit) => (
                      <div
                        key={habit.id}
                        className={`
                          flex items-center justify-between p-3 rounded-lg border
                          transition-all hover:bg-accent
                          ${selectedHabitId === habit.id ? "ring-2 ring-primary border-primary" : ""}
                        `}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`
                              h-5 w-5 rounded-full border-2 flex items-center justify-center
                              ${selectedHabitId === habit.id ? "bg-primary border-primary" : "border-muted-foreground"}
                            `}
                          >
                            {selectedHabitId === habit.id && (
                              <Check className="h-3 w-3 text-primary-foreground" />
                            )}
                          </div>
                          <div>
                            <p className="font-medium">{habit.name}</p>
                            <p className="text-sm text-muted-foreground">
                              {habit.frequency === "daily"
                                ? "每日"
                                : habit.frequency === "weekly"
                                  ? "每周"
                                  : "每月"}
                              · 目标 {habit.target_count} 次
                            </p>
                          </div>
                        </div>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => setSelectedHabitId(habit.id)}
                        >
                          打卡
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => setIsCheckInDialogOpen(false)}
              className="flex-1"
            >
              关闭
            </Button>
            {selectedHabitId && (
              <Button
                onClick={handleCheckIn}
                loading={checkInMutation.isPending}
                className="flex-1"
              >
                确认打卡
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isDeleteConfirmOpen} onOpenChange={setIsDeleteConfirmOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>确认取消打卡</DialogTitle>
            <DialogDescription>
              确定要取消这个打卡记录吗？此操作不可撤销。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => setIsDeleteConfirmOpen(false)}
              className="flex-1"
            >
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              loading={deleteMutation.isPending}
              className="flex-1"
            >
              确认取消
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function HabitCalendarPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-10 w-32" />
          </div>
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-32" />
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-7 gap-2">
                {Array.from({ length: 35 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full rounded-lg" />
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      }
    >
      <HabitCalendarContent />
    </Suspense>
  )
}
